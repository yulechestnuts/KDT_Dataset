// 훈련 수요·경쟁력 집계 엔진
//
// 이 파일이 답하려는 질문 두 개:
//   Q1. 훈련생 수요가 어디로 쏠렸는가?
//   Q2. 어떤 분야가 앞으로 더 경쟁력이 있는가?
//
// ─────────────────────────────────────────────────────────────
// ⚠️ 정원은 '목표'가 아니라 '회차별 최대 수용 인원(행정적 상한)'이다
// ─────────────────────────────────────────────────────────────
// 그래서 충원율(신청/정원)을 경쟁률처럼 읽으면 안 된다. 상한을 넉넉히 잡은 과정은
// 수요가 멀쩡해도 충원율이 낮게 나온다. 실측이 이걸 그대로 보여준다:
//
//   연도   회차수   회차당 정원(상한)   회차당 실제 신청   충원율
//   2021    430          28.9              23.9          82.5%
//   2023   1340          34.0              23.8          70.2%
//   2025   2081          38.9              22.9          59.0%
//   2026    814          38.5              23.4          60.7%
//
// 충원율이 82.5% → 60.7% 로 떨어진 건 수요가 식어서가 아니라 상한을 28.9 → 38.5 명
// 으로 올렸기 때문이다. 한 회차가 실제로 끌어모으는 인원은 5년째 23명 안팎으로 거의
// 고정이다. 시장이 커진 것은 회차 수가 5배 늘어서지 회차당 수요가 커져서가 아니다.
//
// 따라서 수요 강도의 1차 지표는 충원율이 아니라 '회차당 실제 신청인원'이다:
//   · enrollmentPerRound = 수강신청 인원 / 회차 수  → 한 회차가 실제로 끌어온 인원
//   · enrollmentShare    = 그 해 전체 신청인원 중 점유율 → 수요가 쏠린 곳
//   · fillRate           = 신청 / 정원. 상한 대비 여유를 보는 보조지표일 뿐,
//                          단독으로 '수요가 약하다'는 근거가 될 수 없다.
//   · capacityShare / demandGap = 공급(상한) 배분과의 차이
//
// ─────────────────────────────────────────────────────────────
// 왜 '절대값'이 아니라 '시장 평균 대비 지수'로 보는가
// ─────────────────────────────────────────────────────────────
// 분야별 값을 그냥 재면 시장 전체의 움직임(회차 수 폭증, 상한 인상)이 22개 분야에
// 똑같이 섞여 들어온다. 분야의 특성만 남기려면 그 해 시장 평균으로 나눠야 한다.
//   · relativeEnrollmentPerRound = 카테고리 회차당 신청 / 그 해 전체 회차당 신청 × 100
//     (100 = 시장 평균, 120 = 한 회차가 평균보다 20% 많이 끌어옴)
// 수요 모멘텀은 이 지수의 기울기다. 취업률·충원율도 같은 이유로 상대지수를 둔다.
//
// ─────────────────────────────────────────────────────────────
// 왜 코호트를 '과정시작일' 기준으로 자르는가
// ─────────────────────────────────────────────────────────────
// 다른 라우트(course-analysis 등)는 매출 귀속 때문에 과정종료일로 연도를 자른다.
// 수요는 '사람이 신청한 시점'의 현상이라 여기서는 과정시작일을 쓴다.
// 두 축을 섞으면 같은 과정이 다른 연도에 잡혀 추이가 어긋나므로 주의.
//
// ─────────────────────────────────────────────────────────────
// 취업률의 구조적 함정 (가장 중요)
// ─────────────────────────────────────────────────────────────
// 6개월 취업률은 과정 종료 후 한참 뒤에야 집계된다. 실측(2026-09):
//   2024년 개강 과정 94.6% 산출 / 2025년 57.3% / 2026년 0%
// 즉 취업률 '수준'으로 줄을 세우면 최신 분야가 자동으로 진다. 신생 분야일수록
// 데이터가 비어 있기 때문이다. 그래서 이 엔진은
//   (1) 연도 셀마다 employmentCoverage(취업률이 산출된 과정 비율)를 같이 내보내고,
//   (2) 경쟁력 판정은 '수준'이 아니라 성숙 코호트만 골라낸 값으로 한다.
// UI 는 coverage 가 낮은 셀을 반드시 흐리게 처리해야 한다.

import type { ProcessedCourseData } from './types';
import { parseDate } from './parsers';
import { getSafeEmploymentData } from './performance-engine';
import { isCompletionCountable } from '@/lib/completion-rule';
import { getSatisfactionSample } from '@/lib/satisfaction-rule';
import {
  classifyCourse,
  COURSE_CATEGORIES,
  CATEGORY_TO_GROUP,
  type CourseCategory,
} from '@/lib/course-taxonomy';

/**
 * 취업률을 '성숙했다'고 볼 최소 산출 비율.
 * 이 밑이면 그 코호트의 취업률은 표본이 아니라 '아직 안 나온 것'에 가깝다.
 */
export const MATURE_EMPLOYMENT_COVERAGE = 0.7;

/** 추이(기울기) 계산에 넣을 최소 정원. 이보다 작은 해는 노이즈라 제외한다. */
export const MIN_CAPACITY_FOR_TREND = 100;

export interface CategoryYearCell {
  year: number;
  /** 회차 행 수 */
  courses: number;
  /** 서로 다른 훈련과정 ID 수 (같은 과정의 반복 회차를 1로 셈) */
  distinctCourses: number;
  institutions: number;
  capacity: number;
  enrollment: number;
  /** 회차당 실제 수강신청 인원 — 수요 강도의 주지표 */
  enrollmentPerRound: number | null;
  /** 그 해 시장 전체 회차당 신청인원 대비 지수 (100 = 시장 평균) */
  relativeEnrollmentPerRound: number | null;
  /** 회차당 정원 = 행정적으로 허용된 최대 수용 인원 */
  capacityPerRound: number | null;
  /** 수강신청 인원 / 정원 (%). 정원이 상한이라 '수요 약함'의 근거로는 못 쓴다 */
  fillRate: number | null;
  /** 그 해 시장 전체 충원율 대비 지수 (100 = 시장 평균) */
  relativeFillRate: number | null;
  /** 그 해 전체 신청인원 중 점유율 (%) */
  enrollmentShare: number;
  /** 그 해 전체 정원 중 점유율 (%) */
  capacityShare: number;
  /** enrollmentShare - capacityShare (%p). 양수면 공급보다 수요가 몰린 분야 */
  demandGap: number;
  completionRate: number | null;
  /** 수료율 집계에 들어간 과정 비율 (@/lib/completion-rule 유예 규칙) */
  completionCoverage: number;
  employmentRate: number | null;
  /** 그 해 시장 전체 취업률 대비 지수 (100 = 시장 평균) */
  relativeEmploymentRate: number | null;
  employed: number;
  targetPop: number;
  /** 취업률이 산출된 과정 비율. 낮으면 employmentRate 를 신뢰하면 안 된다 */
  employmentCoverage: number;
  satisfaction: number | null;
  /** 매출 최대 합 (원) — 분야별 시장 규모 대용 */
  maxRevenue: number;
  /** 1인당 훈련비 중앙값 (원) */
  medianTrainingFee: number | null;
  /** 그 해가 아직 진행 중이라 값이 덜 찼는가 */
  partial: boolean;
}

export interface CategorySummary {
  category: CourseCategory;
  group: string;
  years: CategoryYearCell[];
  /** 전체 기간 누적 */
  totalEnrollment: number;
  totalCapacity: number;
  totalCourses: number;
  /** 과정 하나당 평균 회차 수 — 시장이 계속 재구매하는 상품인지의 지표 */
  avgRounds: number;
  /**
   * 시장 대비 '회차당 신청인원' 지수의 기울기 (지수p / 년) — 수요 모멘텀의 주지표.
   * 양수 = 한 회차가 끌어오는 인원이 시장 평균보다 빠르게 늘고 있다.
   */
  relativeDemandSlope: number | null;
  /** 최근 회차당 신청인원 (명) */
  latestEnrollmentPerRound: number | null;
  /** 최근 시장 대비 회차당 신청인원 지수 (100 = 시장 평균) */
  latestRelativeEnrollmentPerRound: number | null;
  /** 충원율 추이 기울기 (%p / 년). 정원 상한 변화가 섞여 있어 보조지표 */
  fillRateSlope: number | null;
  /** 시장 대비 충원율 지수의 기울기 — 보조지표 */
  relativeFillSlope: number | null;
  /** 최근 시장 대비 충원율 지수 (100 = 시장 평균) */
  latestRelativeFillRate: number | null;
  /** 신청인원 점유율 변화 (최신 - 최초, %p) */
  shareChange: number | null;
  /** 최근 신청인원 점유율 (%) */
  latestShare: number | null;
  /** 최근 충원율 (%) */
  latestFillRate: number | null;
  /** 취업률이 충분히 성숙한 코호트만으로 계산한 취업률 (%) */
  matureEmploymentRate: number | null;
  /** 위 값이 어느 연도들에서 나왔는지 */
  matureEmploymentYears: number[];
  /** 성숙 코호트 취업률의 절대 기울기 (%p / 년). 시장 전체 하락이 섞여 있다 */
  employmentSlope: number | null;
  /**
   * 시장 대비 취업률 지수의 기울기 (지수p / 년) — 성과 추세의 주지표.
   * 시장 평균 취업률이 67.8%(2021) → 52.2%(2025) 로 내려와서, 절대 기울기를 재면
   * 거의 모든 분야가 음수다. 분야 고유의 개선/악화만 남기려면 상대지수로 봐야 한다.
   */
  relativeEmploymentSlope: number | null;
  satisfaction: number | null;
  /** 2×2 분면 판정 */
  quadrant: Quadrant | null;
}

export type Quadrant = '유망' | '과열주의' | '저평가/틈새' | '축소';

export interface DemandAnalysisResult {
  categories: CategorySummary[];
  /** 연도별 전체 합계 (분모이자, 시장 전체 추이) */
  totals: Array<{
    year: number;
    courses: number;
    capacity: number;
    enrollment: number;
    /** 회차당 실제 신청인원 — 시장 전체의 수요 강도 */
    enrollmentPerRound: number | null;
    /** 회차당 정원(상한) */
    capacityPerRound: number | null;
    fillRate: number | null;
    employmentRate: number | null;
    completionRate: number | null;
    employmentCoverage: number;
    partial: boolean;
  }>;
  /** 분면 판정에 쓴 기준선 */
  thresholds: {
    /** 성숙 코호트 취업률 중앙값 (%) */
    employmentMedian: number | null;
    /** 시장 대비 회차당 신청인원 지수 기울기의 기준 (0 = 시장과 같은 속도) */
    relativeDemandSlope: number;
  };
  meta: {
    rows: number;
    years: number[];
    partialYears: number[];
    /** 분류 근거 분포 (신청인원 기준 비율) */
    taxonomySources: Record<string, number>;
    generatedFor: {
      trainingType: string;
      aiCampus: string;
    };
  };
}

function toNum(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** 최소제곱 기울기. 점이 2개 미만이면 null. */
export function linearSlope(points: Array<{ x: number; y: number }>): number | null {
  if (points.length < 2) return null;
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 과정시작일에서 코호트 연도를 뽑는다. 못 읽으면 null. */
function cohortYear(course: any): number | null {
  const d = parseDate(course?.과정시작일);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getFullYear();
  return y >= 2000 && y <= 2100 ? y : null;
}

interface Bucket {
  rows: ProcessedCourseData[];
  courseIds: Set<string>;
  institutions: Set<string>;
  capacity: number;
  enrollment: number;
  completedEnrolled: number;
  completed: number;
  completionCountable: number;
  employed: number;
  targetPop: number;
  employmentCountable: number;
  satSum: number;
  satWeight: number;
  maxRevenue: number;
  fees: number[];
}

function newBucket(): Bucket {
  return {
    rows: [],
    courseIds: new Set(),
    institutions: new Set(),
    capacity: 0,
    enrollment: 0,
    completedEnrolled: 0,
    completed: 0,
    completionCountable: 0,
    employed: 0,
    targetPop: 0,
    employmentCountable: 0,
    satSum: 0,
    satWeight: 0,
    maxRevenue: 0,
    fees: [],
  };
}

function addToBucket(b: Bucket, course: any, now: Date) {
  b.rows.push(course);
  const id = String(course['훈련과정 ID'] ?? '').trim() || String(course.과정명 ?? '').trim();
  if (id) b.courseIds.add(id);
  const inst = String(course.훈련기관 ?? '').trim();
  if (inst) b.institutions.add(inst);

  b.capacity += toNum(course.정원);
  b.enrollment += toNum(course['수강신청 인원']);
  b.maxRevenue += toNum(course['매출 최대']);

  const fee = toNum(course.훈련비);
  if (fee > 0) b.fees.push(fee);

  if (isCompletionCountable(course, now)) {
    b.completionCountable += 1;
    b.completedEnrolled += toNum(course['수강신청 인원']);
    b.completed += toNum(course.수료인원);
  }

  const emp = getSafeEmploymentData(course);
  if (emp.employed !== null && emp.targetPop !== null && emp.targetPop > 0) {
    b.employmentCountable += 1;
    b.employed += emp.employed;
    b.targetPop += emp.targetPop;
  }

  const sat = getSatisfactionSample(course);
  if (sat.score !== null) {
    b.satSum += sat.score * sat.weight;
    b.satWeight += sat.weight;
  }
}

const rate = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : null;

/** 회차당 평균. 회차가 없으면 null. */
const perRound = (total: number, rounds: number): number | null =>
  rounds > 0 ? Math.round((total / rounds) * 10) / 10 : null;

/**
 * 카테고리 × 코호트연도 매트릭스를 만든다.
 *
 * @param courses  이미 필터링된(훈련유형/AI캠퍼스 등) 과정 목록
 * @param now      '수료인원 반영 유예'와 '진행중인 해' 판정 기준 시각. 테스트용 주입.
 */
export function calculateDemandAnalysis(
  courses: ProcessedCourseData[],
  options: {
    now?: Date;
    trainingType?: string;
    aiCampus?: string;
  } = {}
): DemandAnalysisResult {
  const now = options.now ?? new Date();
  const currentYear = now.getFullYear();

  const byCatYear = new Map<string, Bucket>();
  const byYear = new Map<number, Bucket>();
  const byCat = new Map<CourseCategory, Bucket>();
  const sourceEnrollment: Record<string, number> = {};
  let totalEnrollment = 0;
  let usedRows = 0;

  for (const course of courses as any[]) {
    const year = cohortYear(course);
    if (year === null) continue;
    usedRows += 1;

    const taxonomy = classifyCourse(course);
    const cat = taxonomy.primary;
    const enr = toNum(course['수강신청 인원']);
    totalEnrollment += enr;
    sourceEnrollment[taxonomy.source] = (sourceEnrollment[taxonomy.source] ?? 0) + enr;

    const key = `${cat} ${year}`;
    if (!byCatYear.has(key)) byCatYear.set(key, newBucket());
    addToBucket(byCatYear.get(key)!, course, now);

    if (!byYear.has(year)) byYear.set(year, newBucket());
    addToBucket(byYear.get(year)!, course, now);

    if (!byCat.has(cat)) byCat.set(cat, newBucket());
    addToBucket(byCat.get(cat)!, course, now);
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  // 진행 중인 해는 신청인원·수료·취업이 전부 덜 찬다. 추이 계산에서 빼기 위해 표시한다.
  const partialYears = years.filter((y) => y >= currentYear);

  const totals = years.map((y) => {
    const b = byYear.get(y)!;
    return {
      year: y,
      courses: b.rows.length,
      capacity: b.capacity,
      enrollment: b.enrollment,
      enrollmentPerRound: perRound(b.enrollment, b.rows.length),
      capacityPerRound: perRound(b.capacity, b.rows.length),
      fillRate: rate(b.enrollment, b.capacity),
      employmentRate: rate(b.employed, b.targetPop),
      completionRate: rate(b.completed, b.completedEnrolled),
      employmentCoverage: b.rows.length ? b.employmentCountable / b.rows.length : 0,
      partial: partialYears.includes(y),
    };
  });
  const totalByYear = new Map(totals.map((t) => [t.year, t]));

  /** 시장 평균 대비 지수. 분모가 없으면 null. */
  const indexAgainstMarket = (
    value: number | null,
    market: number | null | undefined
  ): number | null => (value === null || !market ? null : Math.round((value / market) * 1000) / 10);

  const categories: CategorySummary[] = [];

  for (const cat of COURSE_CATEGORIES) {
    const catTotal = byCat.get(cat);
    if (!catTotal || catTotal.rows.length === 0) continue;

    const cells: CategoryYearCell[] = [];
    for (const y of years) {
      const b = byCatYear.get(`${cat} ${y}`);
      if (!b) continue;
      const yearTotal = byYear.get(y)!;
      const enrollmentShare = yearTotal.enrollment > 0 ? (b.enrollment / yearTotal.enrollment) * 100 : 0;
      const capacityShare = yearTotal.capacity > 0 ? (b.capacity / yearTotal.capacity) * 100 : 0;
      const market = totalByYear.get(y);
      const fillRate = rate(b.enrollment, b.capacity);
      const employmentRate = rate(b.employed, b.targetPop);
      const enrollmentPerRound = perRound(b.enrollment, b.rows.length);
      cells.push({
        year: y,
        courses: b.rows.length,
        distinctCourses: b.courseIds.size,
        institutions: b.institutions.size,
        capacity: b.capacity,
        enrollment: b.enrollment,
        enrollmentPerRound,
        relativeEnrollmentPerRound: indexAgainstMarket(enrollmentPerRound, market?.enrollmentPerRound),
        capacityPerRound: perRound(b.capacity, b.rows.length),
        fillRate,
        relativeFillRate: indexAgainstMarket(fillRate, market?.fillRate),
        enrollmentShare: Math.round(enrollmentShare * 10) / 10,
        capacityShare: Math.round(capacityShare * 10) / 10,
        demandGap: Math.round((enrollmentShare - capacityShare) * 10) / 10,
        completionRate: rate(b.completed, b.completedEnrolled),
        completionCoverage: b.rows.length ? b.completionCountable / b.rows.length : 0,
        employmentRate,
        relativeEmploymentRate: indexAgainstMarket(employmentRate, market?.employmentRate),
        employed: b.employed,
        targetPop: b.targetPop,
        employmentCoverage: b.rows.length ? b.employmentCountable / b.rows.length : 0,
        satisfaction: b.satWeight > 0 ? Math.round((b.satSum / b.satWeight) * 10) / 10 : null,
        maxRevenue: b.maxRevenue,
        medianTrainingFee: median(b.fees),
        partial: partialYears.includes(y),
      });
    }

    // 충원율·점유율은 이미 개강한 과정만 대상이라 진행 중인 해도 값이 확정돼 있다
    // (미래 시작일 과정 0건 확인). 표본이 너무 작은 해만 제외한다.
    const trendCells = cells.filter((c) => c.capacity >= MIN_CAPACITY_FOR_TREND);
    const fillRateSlope = linearSlope(
      trendCells.filter((c) => c.fillRate !== null).map((c) => ({ x: c.year, y: c.fillRate! }))
    );
    const relativeFillSlope = linearSlope(
      trendCells
        .filter((c) => c.relativeFillRate !== null)
        .map((c) => ({ x: c.year, y: c.relativeFillRate! }))
    );
    // 수요 모멘텀의 주지표 — 정원(상한) 변화에 오염되지 않는다.
    const relativeDemandSlope = linearSlope(
      trendCells
        .filter((c) => c.relativeEnrollmentPerRound !== null)
        .map((c) => ({ x: c.year, y: c.relativeEnrollmentPerRound! }))
    );

    const shareChange =
      cells.length >= 2
        ? Math.round((cells[cells.length - 1].enrollmentShare - cells[0].enrollmentShare) * 10) / 10
        : null;

    const latest = cells.length ? cells[cells.length - 1] : null;

    // 취업률: coverage 가 충분한 코호트만. 신생 분야가 데이터 공백만으로
    // 불리해지는 것을 막기 위해 '수준'이 아니라 '성숙한 코호트'로 판단한다.
    const matureCells = cells.filter(
      (c) => c.employmentCoverage >= MATURE_EMPLOYMENT_COVERAGE && c.targetPop > 0
    );
    const matureEmployed = matureCells.reduce((a, c) => a + c.employed, 0);
    const matureTarget = matureCells.reduce((a, c) => a + c.targetPop, 0);
    const employmentSlope = linearSlope(
      matureCells.filter((c) => c.employmentRate !== null).map((c) => ({ x: c.year, y: c.employmentRate! }))
    );
    const relativeEmploymentSlope = linearSlope(
      matureCells
        .filter((c) => c.relativeEmploymentRate !== null)
        .map((c) => ({ x: c.year, y: c.relativeEmploymentRate! }))
    );

    categories.push({
      category: cat,
      group: CATEGORY_TO_GROUP[cat] ?? '미분류',
      years: cells,
      totalEnrollment: catTotal.enrollment,
      totalCapacity: catTotal.capacity,
      totalCourses: catTotal.rows.length,
      avgRounds: catTotal.courseIds.size > 0
        ? Math.round((catTotal.rows.length / catTotal.courseIds.size) * 10) / 10
        : 0,
      relativeDemandSlope:
        relativeDemandSlope === null ? null : Math.round(relativeDemandSlope * 100) / 100,
      latestEnrollmentPerRound: latest ? latest.enrollmentPerRound : null,
      latestRelativeEnrollmentPerRound: latest ? latest.relativeEnrollmentPerRound : null,
      fillRateSlope: fillRateSlope === null ? null : Math.round(fillRateSlope * 100) / 100,
      relativeFillSlope: relativeFillSlope === null ? null : Math.round(relativeFillSlope * 100) / 100,
      latestRelativeFillRate: latest ? latest.relativeFillRate : null,
      shareChange,
      latestShare: latest ? latest.enrollmentShare : null,
      latestFillRate: latest ? latest.fillRate : null,
      matureEmploymentRate: rate(matureEmployed, matureTarget),
      matureEmploymentYears: matureCells.map((c) => c.year),
      employmentSlope: employmentSlope === null ? null : Math.round(employmentSlope * 100) / 100,
      relativeEmploymentSlope:
        relativeEmploymentSlope === null ? null : Math.round(relativeEmploymentSlope * 100) / 100,
      satisfaction: catTotal.satWeight > 0
        ? Math.round((catTotal.satSum / catTotal.satWeight) * 10) / 10
        : null,
      quadrant: null,
    });
  }

  // 분면 판정 — 성과 기준선은 절대값이 아니라 '이 데이터 안에서의 중앙값'.
  // KDT 전체 취업률 수준이 해마다 달라지므로 고정 임계값을 쓰면 매년 의미가 변한다.
  const employmentMedian = median(
    categories.map((c) => c.matureEmploymentRate).filter((v): v is number => v !== null)
  );

  for (const c of categories) {
    if (
      c.relativeDemandSlope === null ||
      c.matureEmploymentRate === null ||
      employmentMedian === null
    ) {
      c.quadrant = null;
      continue;
    }
    // 수요 축은 '회차당 실제 신청인원'의 시장 대비 지수 기울기다.
    // 충원율을 쓰면 정원(상한) 인상이 수요 감소로 둔갑한다 — 파일 상단 실측 참고.
    const demandUp = c.relativeDemandSlope > 0;
    const perfUp = c.matureEmploymentRate >= employmentMedian;
    c.quadrant = demandUp
      ? perfUp
        ? '유망'
        : '과열주의'
      : perfUp
        ? '저평가/틈새'
        : '축소';
  }

  categories.sort((a, b) => b.totalEnrollment - a.totalEnrollment);

  const taxonomySources: Record<string, number> = {};
  for (const [k, v] of Object.entries(sourceEnrollment)) {
    taxonomySources[k] = totalEnrollment > 0 ? Math.round((v / totalEnrollment) * 1000) / 10 : 0;
  }

  return {
    categories,
    totals,
    thresholds: {
      employmentMedian: employmentMedian === null ? null : Math.round(employmentMedian * 10) / 10,
      relativeDemandSlope: 0,
    },
    meta: {
      rows: usedRows,
      years,
      partialYears,
      taxonomySources,
      generatedFor: {
        trainingType: options.trainingType ?? 'all',
        aiCampus: options.aiCampus ?? 'all',
      },
    },
  };
}
