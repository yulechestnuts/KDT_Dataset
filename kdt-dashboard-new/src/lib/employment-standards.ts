// 고용노동부 취업률 산정 기준
//
// 고용노동부는 같은 과정을 서로 다른 두 창(窓)으로 평가한다. 창이 다르면 같은 기관도
// 취업률이 달라지므로, 어느 기준의 숫자인지 밝히지 않은 취업률은 의미가 없다.
//
//   과정심사     : 회계연도 7/1 ~ 익년 6/30 (목표 60%)
//   연말성과평가 : 역년     1/1 ~ 12/31
//   ─ 둘 다 '수료일' 기준이다. 과정시작일이 아니다.
//
// 공통 산식:
//   취업자 모수 = 수료인원 − 근로자 − 제외자
//   취업률      = 취업자 / 취업자 모수
//   지원 만료일 = 수료일 + 6개월
//   목표 필요인원 = ceil(모수 × 목표%) − 취업자
//
// 제외 사유는 창업 / 해외이민 / 3주 이상 질병·부상 / 재학 / 휴학 이며,
// 증빙서류를 받아 HRD-Net 에 업로드해야 반영된다. 즉 제외자는 수료 직후가 아니라
// 시간이 지나면서 늘어나고, 그만큼 모수가 줄고 취업률은 올라간다.
//
// ── KDT 데이터셋으로 이 기준을 계산할 수 있는 근거 ──
// 데이터셋에는 근로자/제외자 컬럼이 없다. 그러나 HRD-Net 이 신고하는 취업률의 분모가
// 곧 위 '취업자 모수'라서, 취업인원 ÷ 취업률 로 역산하면 모수가 복원된다.
// 2025년 수료 과정 10건을 원 관리시트와 대조해 10/10 (오차 ±1명) 일치를 확인했다.
//   AIW1 10/10, DAB3 31/31, FE12 26/27, BESP2 16/16, AOS3 19/19,
//   UGM2 44/43, CLD2 22/22, UIUX4 53/52, UGM3 89/89, GM1 36/36
// 이 등식이 깨지면(예: HRD-Net 이 분모 정의를 바꾸면) 아래 계산 전체가 무효가 된다.

/** 취업률 집계 시점. 고용노동부 기준은 6개월이고 3개월은 조기 지표다. */
export type EmploymentPeriod = '3개월' | '6개월';

/** 고용노동부 평가 창 (calendar 는 기존 대시보드의 자유 연도 필터) */
export type EmploymentStandard = 'course_review' | 'annual_eval' | 'calendar';

/**
 * 과정의 취업률 집계 진행 단계.
 *
 * 전체 7,232건 중 약 1,845건(25.5%)이 not_started 다. 이 과정들을 분모에서 빼면
 * "평가가 끝난 과정만의 가중평균"이 되고, 넣으면 고용노동부 과정심사 시트와 같은
 * 숫자가 된다. 어느 쪽이든 몇 건이 어느 단계인지 함께 보여줘야 오해가 없다.
 */
export type AggregationStatus =
  /** 선택한 기간의 취업률이 집계 완료됨 */
  | 'confirmed'
  /** 선택 기간은 아직이나 더 짧은 기간(3개월) 실적이 있음 */
  | 'in_progress'
  /** 어떤 기간도 집계 전 — 모수를 수료인원으로 추정한다 */
  | 'not_started';

export interface EmploymentBase {
  status: AggregationStatus;
  /** 취업자 모수 (수료인원 − 근로자 − 제외자) */
  denominator: number;
  employed: number;
  /** 미집계면 null */
  rate: number | null;
  /** 모수가 역산이 아니라 수료인원 대체값인지 */
  isEstimatedDenominator: boolean;
  /** 실제 집계에 쓴 기간 */
  source: EmploymentPeriod | null;
  completedStudents: number;
  /** 수료인원 − 모수 = 근로자 + 제외자. 추정 모수일 때는 null */
  excludedCount: number | null;
}

export const STANDARD_LABELS: Record<EmploymentStandard, string> = {
  course_review: '과정심사 (7월~익년 6월)',
  annual_eval: '연말성과평가 (1월~12월)',
  calendar: '기존 방식 (연도 자유 선택)',
};

/** 고용노동부 과정심사 목표 취업률 */
export const TARGET_RATE = 60;

function parseRate(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null;
  const cleaned = String(raw).replace(/[^0-9.]/g, '').trim();
  if (cleaned === '') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseCount(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 과정의 기간별 취업 원자료.
 *
 * 키를 substring 으로 찾는 이유는 DB(`취업인원_6개월`)와 앱(`취업인원 (6개월)`)의
 * 표기가 다르기 때문이다 (CLAUDE.md §4).
 */
function readPeriod(course: any, period: EmploymentPeriod): { employed: number; rate: number | null } {
  const keys = Object.keys(course || {});
  const empKey = keys.find((k) => k.includes('취업인원') && k.includes(period));
  const rateKey = keys.find((k) => k.includes('취업률') && k.includes(period));
  return {
    employed: empKey ? parseCount(course[empKey]) : 0,
    rate: rateKey ? parseRate(course[rateKey]) : null,
  };
}

/** 수료일. 데이터셋에는 수료일 컬럼이 없어 과정종료일을 쓴다(실무상 동일). */
export function getCompletionDate(course: any): Date | null {
  const raw = course?.과정종료일;
  if (!raw) return null;
  const d = new Date(String(raw));
  return Number.isFinite(d.getTime()) ? d : null;
}

/** 지원 만료일 = 수료일 + 6개월. 이 날짜가 지나야 6개월 취업률이 확정된다. */
export function getSupportExpiryDate(course: any): Date | null {
  const completed = getCompletionDate(course);
  if (!completed) return null;
  const d = new Date(completed);
  d.setMonth(d.getMonth() + 6);
  return d;
}

/**
 * 고용노동부 기준의 취업 모수·취업자·취업률을 산출한다.
 *
 * 선택 기간의 집계가 없으면 더 짧은 기간으로 물러서고, 그것도 없으면 모수를
 * 수료인원으로 추정한다. 추정 모수는 근로자·제외자를 못 빼므로 실제보다 크고,
 * 따라서 취업률은 보수적으로(낮게) 나온다.
 */
export function getEmploymentBase(course: any, period: EmploymentPeriod): EmploymentBase {
  const completedStudents = parseCount(course?.수료인원);
  const primary = readPeriod(course, period);

  if (primary.employed > 0 && primary.rate !== null) {
    const denominator = Math.round(primary.employed / (primary.rate / 100));
    return {
      status: 'confirmed',
      denominator,
      employed: primary.employed,
      rate: primary.rate,
      isEstimatedDenominator: false,
      source: period,
      completedStudents,
      excludedCount: completedStudents > 0 ? Math.max(0, completedStudents - denominator) : null,
    };
  }

  // 6개월을 골랐는데 아직이면 3개월 실적으로 진행 상황을 보여준다.
  if (period === '6개월') {
    const early = readPeriod(course, '3개월');
    if (early.employed > 0 && early.rate !== null) {
      const denominator = Math.round(early.employed / (early.rate / 100));
      return {
        status: 'in_progress',
        denominator,
        employed: early.employed,
        rate: early.rate,
        isEstimatedDenominator: false,
        source: '3개월',
        completedStudents,
        excludedCount: completedStudents > 0 ? Math.max(0, completedStudents - denominator) : null,
      };
    }
  }

  return {
    status: 'not_started',
    denominator: completedStudents,
    employed: 0,
    rate: null,
    isEstimatedDenominator: true,
    source: null,
    completedStudents,
    excludedCount: null,
  };
}

/** 회계연도. 7/1 부터 다음 해가 시작된다 (2026-07-01 → 2026, 2026-06-30 → 2025). */
export function getFiscalYear(date: Date): number {
  return date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
}

export function formatStandardYear(standard: EmploymentStandard, year: number): string {
  return standard === 'course_review' ? `${year}-${year + 1}` : `${year}`;
}

/** 과정이 선택한 기준·연도의 평가 창 안에서 수료했는지. year 가 null 이면 전체. */
export function matchesStandardWindow(
  course: any,
  standard: EmploymentStandard,
  year: number | null
): boolean {
  if (year === null) return true;

  const completed = getCompletionDate(course);
  if (!completed) return false;

  if (standard === 'course_review') return getFiscalYear(completed) === year;
  return completed.getFullYear() === year;
}

/** 데이터에 실제로 존재하는 평가 연도 목록 (최신순) */
export function listStandardYears(courses: any[], standard: EmploymentStandard): number[] {
  const years = new Set<number>();
  for (const course of courses) {
    const completed = getCompletionDate(course);
    if (!completed) continue;
    years.add(standard === 'course_review' ? getFiscalYear(completed) : completed.getFullYear());
  }
  return Array.from(years).sort((a, b) => b - a);
}

/** 목표 취업률 달성에 더 필요한 취업자 수 */
export function computeTargetGap(denominator: number, employed: number, targetRate: number): number {
  if (denominator <= 0) return 0;
  return Math.max(0, Math.ceil((denominator * targetRate) / 100) - employed);
}

// ── 격차 분해 (간접표준화) ──────────────────────────────────────────────
//
// "이 기관 취업률이 왜 낮은가"에는 답이 둘뿐이다.
//   ① 구성 효과 — 원래 취업이 어려운 분야/규모에 몰려 있다
//   ② 실행 격차 — 같은 조건의 다른 기관보다 실제로 못했다
// 둘을 안 나누면 "AI 분야가 원래 어렵다"는 항변과 "그래도 남들은 했다"가 평행선을 달린다.
//
// 분리 방법(간접표준화): 대상 기관의 분야별 모수 구성은 그대로 두고, 각 분야의 취업률만
// 전체 평균으로 바꿔 끼운 '기대 취업률'을 만든다.
//   기대 − 전체평균 = 구성 효과   (분야를 어디에 걸었는가)
//   실제 − 기대     = 실행 격차   (같은 분야에서 얼마나 했는가)

export interface BenchmarkRow {
  key: string;
  denominator: number;
  employed: number;
  rate: number;
  /** 같은 분야의 전체 평균 취업률 */
  referenceRate: number;
  /** 실제 − 전체평균 (음수면 뒤처짐) */
  gapPoints: number;
  /** 전체 평균만큼 했다면 더 나왔을 취업자 수 */
  shortfall: number;
}

export interface BenchmarkResult {
  denominator: number;
  employed: number;
  actualRate: number | null;
  /** 대상의 분야 구성 × 각 분야의 전체 평균 취업률 */
  expectedRate: number | null;
  /** 전체 평균 취업률 */
  referenceRate: number | null;
  /** 기대 − 전체평균. 양수면 유리한 분야에 포진 */
  mixEffect: number | null;
  /** 실제 − 기대. 음수면 같은 분야에서 뒤처짐 */
  executionGap: number | null;
  rows: BenchmarkRow[];
}

function tally(
  courses: any[],
  keyOf: (course: any) => string,
  period: EmploymentPeriod
): Map<string, { denominator: number; employed: number }> {
  const map = new Map<string, { denominator: number; employed: number }>();
  for (const course of courses) {
    const base = getEmploymentBase(course, period);
    // 미집계 과정은 취업률이 0으로 눌려 격차를 왜곡하므로 이 분석에서는 제외한다.
    if (base.status === 'not_started' || base.denominator <= 0) continue;
    const key = keyOf(course) || '미분류';
    if (!map.has(key)) map.set(key, { denominator: 0, employed: 0 });
    const entry = map.get(key)!;
    entry.denominator += base.denominator;
    entry.employed += base.employed;
  }
  return map;
}

/**
 * 대상 과정군의 취업률 격차를 '구성 효과'와 '실행 격차'로 분해한다.
 *
 * reference 에는 보통 대상을 포함한 전체를 넣는다 — 여기서 얻는 값이 화면에 쓰는
 * '전체 평균'과 같아야 하기 때문이다. 대상이 전체의 큰 비중이면 기준선이 자기 자신 쪽으로
 * 당겨져 격차가 실제보다 작게 보인다는 한계는 있다.
 */
export function benchmarkByGroup(
  target: any[],
  reference: any[],
  keyOf: (course: any) => string,
  period: EmploymentPeriod
): BenchmarkResult {
  const targetTally = tally(target, keyOf, period);
  const refTally = tally(reference, keyOf, period);

  let refDenominator = 0;
  let refEmployed = 0;
  for (const entry of refTally.values()) {
    refDenominator += entry.denominator;
    refEmployed += entry.employed;
  }

  let denominator = 0;
  let employed = 0;
  let expectedEmployed = 0;
  const rows: BenchmarkRow[] = [];

  for (const [key, entry] of targetTally) {
    const ref = refTally.get(key);
    const referenceRate = ref && ref.denominator > 0 ? (ref.employed / ref.denominator) * 100 : 0;
    const rate = (entry.employed / entry.denominator) * 100;
    const expected = (entry.denominator * referenceRate) / 100;

    denominator += entry.denominator;
    employed += entry.employed;
    expectedEmployed += expected;

    rows.push({
      key,
      denominator: entry.denominator,
      employed: entry.employed,
      rate,
      referenceRate,
      gapPoints: rate - referenceRate,
      shortfall: Math.round(expected - entry.employed),
    });
  }

  const actualRate = denominator > 0 ? (employed / denominator) * 100 : null;
  const expectedRate = denominator > 0 ? (expectedEmployed / denominator) * 100 : null;
  const referenceRate = refDenominator > 0 ? (refEmployed / refDenominator) * 100 : null;

  return {
    denominator,
    employed,
    actualRate,
    expectedRate,
    referenceRate,
    mixEffect: expectedRate !== null && referenceRate !== null ? expectedRate - referenceRate : null,
    executionGap: actualRate !== null && expectedRate !== null ? actualRate - expectedRate : null,
    rows: rows.sort((a, b) => b.denominator - a.denominator),
  };
}

/** 수료인원 대비 제외 비율. 근로자·제외자를 얼마나 반영했는지 본다. */
export function exclusionRate(courses: any[], period: EmploymentPeriod): number | null {
  let completed = 0;
  let denominator = 0;
  for (const course of courses) {
    const base = getEmploymentBase(course, period);
    if (base.status === 'not_started' || base.denominator <= 0) continue;
    completed += base.completedStudents;
    denominator += base.denominator;
  }
  return completed > 0 ? ((completed - denominator) / completed) * 100 : null;
}

export interface EmploymentTotals {
  denominator: number;
  employed: number;
  completedStudents: number;
  /** 모수 − 취업자. 시트의 '지원 대상(현재 기준)' */
  remainingSupport: number;
  rate: number | null;
  courseCount: number;
  statusCounts: Record<AggregationStatus, number>;
  /** 모수를 추정으로 채운 과정 수 */
  estimatedCourses: number;
}

export function emptyTotals(): EmploymentTotals {
  return {
    denominator: 0,
    employed: 0,
    completedStudents: 0,
    remainingSupport: 0,
    rate: null,
    courseCount: 0,
    statusCounts: { confirmed: 0, in_progress: 0, not_started: 0 },
    estimatedCourses: 0,
  };
}

/**
 * 과정 목록을 하나의 취업률로 합산한다.
 *
 * includeUnaggregated=false 는 기존 대시보드 동작(집계 끝난 과정만),
 * true 는 고용노동부 과정심사 시트 동작(진행 중 과정도 분모에 포함)이다.
 * 과정 수(courseCount)는 어느 모드든 전체를 센다 — 분모에서 빠진 과정도 존재하니까.
 */
export function accumulate(
  totals: EmploymentTotals,
  base: EmploymentBase,
  includeUnaggregated: boolean
): void {
  totals.courseCount += 1;
  totals.statusCounts[base.status] += 1;
  totals.completedStudents += base.completedStudents;

  if (!includeUnaggregated && base.status === 'not_started') return;
  if (base.denominator <= 0) return;

  if (base.isEstimatedDenominator) totals.estimatedCourses += 1;
  totals.denominator += base.denominator;
  totals.employed += base.employed;
}

export function finalize(totals: EmploymentTotals): EmploymentTotals {
  totals.rate = totals.denominator > 0 ? (totals.employed / totals.denominator) * 100 : null;
  totals.remainingSupport = Math.max(0, totals.denominator - totals.employed);
  return totals;
}

export function aggregateEmployment(
  courses: any[],
  period: EmploymentPeriod,
  includeUnaggregated: boolean
): EmploymentTotals {
  const totals = emptyTotals();
  for (const course of courses) {
    accumulate(totals, getEmploymentBase(course, period), includeUnaggregated);
  }
  return finalize(totals);
}
