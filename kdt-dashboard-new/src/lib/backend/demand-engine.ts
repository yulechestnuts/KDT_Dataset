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
  type TaxonomySource,
} from '@/lib/course-taxonomy';
import { computeOpComponentScores, type OpProfile, type OpScoreInput } from './op-score';

/**
 * 취업률을 '성숙했다'고 볼 최소 산출 비율.
 * 이 밑이면 그 코호트의 취업률은 표본이 아니라 '아직 안 나온 것'에 가깝다.
 */
export const MATURE_EMPLOYMENT_COVERAGE = 0.7;

/** 추이(기울기) 계산에 넣을 최소 정원. 이보다 작은 해는 노이즈라 제외한다. */
export const MIN_CAPACITY_FOR_TREND = 100;

/**
 * 수료율을 '집계가 끝났다'고 볼 최소 산출 비율. 취업률의 MATURE_… 와 같은 취지지만
 * 수료는 종료 후 3주 유예라 훨씬 빨리 찬다(@/lib/completion-rule).
 */
export const MATURE_COMPLETION_COVERAGE = 0.7;

/**
 * 분야별 과정 목록에 실어 보낼 최대 개수(신청인원 순).
 * "이 분야에 뭐가 있었나"를 보기 위한 목록이라 전수가 필요하지 않고, 22개 분야 ×
 * 전수(누적 2,700여 과정)를 다 실으면 응답이 3배로 부푼다. 잘린 개수는
 * courseListTruncated 로 알린다.
 */
export const MAX_COURSES_PER_CATEGORY = 300;

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
  /**
   * 배출률 (%) — 수강신청 100명 중 현업 취업까지 간 사람 수.
   * KDT 의 목적(훈련생을 현업 개발자로 배출)을 한 숫자로 잰 값이고,
   * 퍼널(신청 → 수료 → 취업) 전체를 곱으로 통과한 결과다.
   */
  yieldRate: number | null;
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

/**
 * 분야 안에 실제로 어떤 과정이 있었는지 보여주기 위한 롤업.
 *
 * 집계 단위는 '회차 행'이 아니라 **훈련과정 ID** 다. 같은 과정이 여러 번 열린 것을
 * 한 줄로 접어야 "무슨 과정이 있었나"가 읽힌다(회차 기준이면 SSAFY 한 과정이
 * 화면을 40줄 차지한다). 회차 수는 rounds 로 따로 낸다.
 */
export interface CategoryCourseSummary {
  courseId: string;
  courseName: string;
  /** 이 과정을 운영한 기관 (신청인원 많은 순, 최대 3곳) */
  institutions: string[];
  institutionCount: number;
  /** 회차 행 수 */
  rounds: number;
  firstYear: number;
  lastYear: number;
  enrollment: number;
  capacity: number;
  completionRate: number | null;
  employmentRate: number | null;
  /** 취업률이 산출된 회차 비율. 낮으면 employmentRate 를 믿으면 안 된다 */
  employmentCoverage: number;
  satisfaction: number | null;
  maxRevenue: number;
  /** 이 과정이 이 분야로 분류된 근거 (@/lib/course-taxonomy) — 분류 감사를 위해 노출 */
  taxonomySource: TaxonomySource;
  /** 'AI' 가 과정명에 붙어 있지만 AI 코어 과정은 아닌 경우 */
  aiBranded: boolean;
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

  // ── Op Score 재료 ────────────────────────────────────────────
  /**
   * 성숙 코호트 취업률 ÷ **같은 연도** 시장 평균 취업률 × 100.
   * matureEmploymentRate(절대값)를 그대로 쓰면 성숙 코호트가 2021~2022 에 몰린
   * 분야가 자동으로 이긴다 — 시장 평균 자체가 67.8% → 52.2% 로 내려왔기 때문이다.
   */
  matureEmploymentIndex: number | null;
  /** 성숙 코호트 취업대상자 합 (명). Op Score 신뢰도 계산에 쓴다 */
  matureTargetPop: number;
  /**
   * 배출률 (%) — 성숙 코호트에서 수강신청 100명 중 현업 취업까지 간 사람 수.
   * KDT 의 목적 그 자체를 잰 값이라 Op Score 의 주지표다.
   */
  matureYieldRate: number | null;
  /** 위 값 ÷ 같은 코호트 연도의 시장 배출률 × 100 */
  matureYieldIndex: number | null;
  /** 배출 인원 (명) — 성숙 코호트에서 실제로 현업 취업한 사람 수 */
  matureEmployed: number;
  /**
   * 현업 배출 점유율 (%) — 시장 전체가 배출한 현업 인력 중 이 분야의 몫.
   *
   * 규모를 '신청인원 점유'가 아니라 이걸로 재는 이유: 사용자 정의가
   * "**취업이 잘 될 수 있는 상황에서** 규모가 얼마나 늘어나는가"이기 때문이다.
   * 신청 점유로 재면 사람만 많이 모으고 취업은 안 되는 분야가 규모 점수를 다 가져간다.
   * 취업자 기준으로 재면 그 조건이 지표 정의 안에 들어가서, 별도의 게이트나
   * 임의 파라미터 없이도 "취업이 되는 만큼만 규모로 인정"된다.
   */
  matureEmployedShare: number | null;
  /** 집계가 끝난 코호트만의 수료율 (%) */
  matureCompletionRate: number | null;
  /** 위 값 ÷ 같은 연도 시장 평균 수료율 × 100 */
  matureCompletionIndex: number | null;
  /**
   * 최근 3개 완결 코호트의 신청인원 점유율 변화 (%p).
   * shareChange 는 '최초 → 최신(진행중 포함)'이라 진행 중인 해의 미달분이 섞인다.
   * Op Score 는 완결 코호트만으로 자른 이 값을 쓴다.
   */
  recentShareShift: number | null;
  /** 기울기 계산에 실제로 들어간 연도 수 (표본 두께) */
  trendYears: number;
  /** 가중치가 들어가지 않은 Op Score 재료. 최종 점수는 화면에서 가중치와 합친다 */
  opProfile: OpProfile | null;

  // ── 드릴다운용 ───────────────────────────────────────────────
  /** 서로 다른 훈련과정 ID 수 (누적) */
  distinctCourses: number;

  // ── 진입 여건 (다른 기관이 이 분야에 들어갈 만한가) ──────────
  /** 최근 코호트 연도의 훈련기관 수 = 지금 경쟁자 수 */
  latestInstitutions: number;
  /** 최근 코호트에서 기관 하나가 실제로 가져간 평균 신청인원 */
  enrollmentPerInstitution: number | null;
  /** 최근 3개 완결 코호트의 기관 수 변화 (신규 진입이 몰리는가) */
  institutionChange: number | null;
  /** 누적 신청인원 기준 상위 3개 기관의 점유율 (%). 높을수록 과점이라 비집고 들기 어렵다 */
  top3InstitutionShare: number | null;
  /** 신청인원 상위 과정 목록. 최대 MAX_COURSES_PER_CATEGORY 개 */
  courses: CategoryCourseSummary[];
  /** 위 목록이 잘렸는가 */
  courseListTruncated: boolean;
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
  /**
   * 분면 판정에 쓴 기준선.
   *
   * ⚠️ 2026-09 변경: 수요 축이 '회차당 신청인원 지수 기울기'에서 **신청인원 점유 이동**
   * 으로 바뀌었다. 옛 축은 분산의 70%가 '회차를 얼마나 크게 열었나'(회차당 정원과
   * r=0.835)라 수요가 아니라 공급을 재고 있었다 — @/lib/backend/op-score 헤더 (6).
   * 성과 축도 절대 취업률 중앙값이 아니라 '같은 코호트 연도의 시장 평균 대비 지수'다.
   */
  thresholds: {
    /** 성숙 코호트 취업률 중앙값 (%) — 참고용. 판정에는 쓰지 않는다 */
    employmentMedian: number | null;
    /** 수요 축 기준: 점유 이동 %p (0 = 점유율을 지켰다) */
    shareShift: number;
    /** 성과 축 기준: 취업 지수 (100 = 같은 코호트 연도의 시장 평균) */
    employmentIndex: number;
    /** 분면 가로축 기준: 배출률 지수 100 */
    yieldIndex: number;
    /**
     * 시장 전체 배출률 (%) — 성숙 코호트에서 수강신청 100명 중 현업 취업까지 간 사람 수.
     * 분야별 배출률을 읽을 때의 기준선이다.
     */
    marketYieldRate: number | null;
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
  /**
   * 취업률이 산출된 과정들의 수강신청 인원 합 — '배출률'의 분모.
   * 전체 enrollment 를 쓰면 취업 집계가 안 끝난 과정의 신청자까지 분모에 들어가
   * 배출률이 실제보다 낮게 나온다. 분자(employed)와 같은 과정 집합을 써야 한다.
   */
  employmentCountableEnrolled: number;
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
    employmentCountableEnrolled: 0,
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
    b.employmentCountableEnrolled += toNum(course['수강신청 인원']);
  }

  const sat = getSatisfactionSample(course);
  if (sat.score !== null) {
    b.satSum += sat.score * sat.weight;
    b.satWeight += sat.weight;
  }
}

/** 훈련과정 ID 단위 롤업. Bucket 을 재사용하되 목록 표시에 필요한 것만 덧붙인다. */
interface CourseAgg {
  bucket: Bucket;
  courseId: string;
  courseName: string;
  /** 기관별 신청인원 — 대표 기관을 뽑을 때 쓴다 */
  institutionEnrollment: Map<string, number>;
  firstYear: number;
  lastYear: number;
  taxonomySource: TaxonomySource;
  aiBranded: boolean;
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
  /** 분야 → (훈련과정 ID → 롤업). 드릴다운에서 "무슨 과정이 있었나"를 보여주는 재료 */
  const byCatCourse = new Map<CourseCategory, Map<string, CourseAgg>>();
  /** 분야 → (훈련기관 → 누적 신청인원). 과점 여부(진입 난이도) 판단용 */
  const byCatInstitution = new Map<CourseCategory, Map<string, number>>();
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

    const instName = String(course.훈련기관 ?? '').trim();
    if (instName) {
      if (!byCatInstitution.has(cat)) byCatInstitution.set(cat, new Map());
      const im = byCatInstitution.get(cat)!;
      im.set(instName, (im.get(instName) ?? 0) + enr);
    }

    // 과정 단위 롤업 — addToBucket 과 같은 규칙을 타야 분야 합계와 어긋나지 않는다.
    const courseId =
      String(course['훈련과정 ID'] ?? '').trim() || String(course.과정명 ?? '').trim();
    if (courseId) {
      if (!byCatCourse.has(cat)) byCatCourse.set(cat, new Map());
      const perCourse = byCatCourse.get(cat)!;
      let agg = perCourse.get(courseId);
      if (!agg) {
        agg = {
          bucket: newBucket(),
          courseId,
          courseName: String(course.과정명 ?? '').trim() || courseId,
          institutionEnrollment: new Map(),
          firstYear: year,
          lastYear: year,
          taxonomySource: taxonomy.source,
          aiBranded: Boolean(taxonomy.aiBranded),
        };
        perCourse.set(courseId, agg);
      }
      addToBucket(agg.bucket, course, now);
      agg.firstYear = Math.min(agg.firstYear, year);
      agg.lastYear = Math.max(agg.lastYear, year);
      const inst = String(course.훈련기관 ?? '').trim();
      if (inst) {
        agg.institutionEnrollment.set(inst, (agg.institutionEnrollment.get(inst) ?? 0) + enr);
      }
    }
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
        yieldRate: rate(b.employed, b.employmentCountableEnrolled),
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
    const matureEmploymentRate = rate(matureEmployed, matureTarget);

    // 성숙 코호트가 어느 해에 몰려 있는지는 분야마다 다르다. 시장 평균 취업률이
    // 67.8%(2021) → 52.2%(2025) 로 내려왔으므로, 절대값끼리 비교하면 '오래된
    // 코호트를 가진 분야'가 실력과 무관하게 이긴다. **그 분야가 실제로 쓴 연도들의**
    // 시장 평균과 비교해야 그 편향이 사라진다.
    const marketEmployed = matureCells.reduce((a, c) => a + (byYear.get(c.year)?.employed ?? 0), 0);
    const marketTarget = matureCells.reduce((a, c) => a + (byYear.get(c.year)?.targetPop ?? 0), 0);
    const matureEmploymentIndex = indexAgainstMarket(
      matureEmploymentRate,
      rate(marketEmployed, marketTarget)
    );

    // 배출률 = 취업자 / (취업률이 산출된 과정들의 신청인원).
    // 분자와 분모가 같은 과정 집합이라 집계 지연에 오염되지 않는다.
    const matureYieldRate = rate(
      matureEmployed,
      matureCells.reduce(
        (a, c) => a + (byCatYear.get(`${cat} ${c.year}`)?.employmentCountableEnrolled ?? 0),
        0
      )
    );
    const matureYieldIndex = indexAgainstMarket(
      matureYieldRate,
      rate(
        marketEmployed,
        matureCells.reduce((a, c) => a + (byYear.get(c.year)?.employmentCountableEnrolled ?? 0), 0)
      )
    );

    // 수료율도 같은 방식. 다만 유예가 3주뿐이라 거의 모든 코호트가 성숙 판정을 받는다.
    const completionCells = cells.filter(
      (c) => c.completionCoverage >= MATURE_COMPLETION_COVERAGE && c.completionRate !== null
    );
    const matureCompletionRate = rate(
      completionCells.reduce((a, c) => a + (byCatYear.get(`${cat} ${c.year}`)?.completed ?? 0), 0),
      completionCells.reduce(
        // ⚠️ 캐시 키 구분자는 공백이 아니라 NUL( )이다. 분야명에 공백이 있어도
        //    키가 겹치지 않게 하려고 위에서 그렇게 만들었다 — 공백으로 조회하면
        //    전부 miss 가 나면서 조용히 null 이 된다.
        (a, c) => a + (byCatYear.get(`${cat} ${c.year}`)?.completedEnrolled ?? 0),
        0
      )
    );
    const matureCompletionIndex = indexAgainstMarket(
      matureCompletionRate,
      rate(
        completionCells.reduce((a, c) => a + (byYear.get(c.year)?.completed ?? 0), 0),
        completionCells.reduce((a, c) => a + (byYear.get(c.year)?.completedEnrolled ?? 0), 0)
      )
    );

    // 점유 이동은 '완결 코호트'만으로 잰다. 진행 중인 해를 끝점으로 쓰면 아직 개강하지
    // 않은 과정의 신청인원이 빠져 있어 전 분야가 제각기 다른 방향으로 흔들린다.
    const fullCells = cells.filter((c) => !c.partial);
    const shiftWindow = fullCells.slice(-3);
    const recentShareShift =
      shiftWindow.length >= 2
        ? Math.round(
            (shiftWindow[shiftWindow.length - 1].enrollmentShare - shiftWindow[0].enrollmentShare) *
              10
          ) / 10
        : null;

    const employmentSlope = linearSlope(
      matureCells.filter((c) => c.employmentRate !== null).map((c) => ({ x: c.year, y: c.employmentRate! }))
    );
    const relativeEmploymentSlope = linearSlope(
      matureCells
        .filter((c) => c.relativeEmploymentRate !== null)
        .map((c) => ({ x: c.year, y: c.relativeEmploymentRate! }))
    );

    // 과정 목록 — 신청인원 큰 순. 화면에서 "이 분야가 뭘로 이뤄져 있나"를 확인하는 용도다.
    const courseAggs = [...(byCatCourse.get(cat)?.values() ?? [])].sort(
      (a, b) => b.bucket.enrollment - a.bucket.enrollment
    );
    const courseList: CategoryCourseSummary[] = courseAggs
      .slice(0, MAX_COURSES_PER_CATEGORY)
      .map((a) => {
        const b = a.bucket;
        return {
          courseId: a.courseId,
          courseName: a.courseName,
          institutions: [...a.institutionEnrollment.entries()]
            .sort((x, y) => y[1] - x[1])
            .slice(0, 3)
            .map(([name]) => name),
          institutionCount: a.institutionEnrollment.size,
          rounds: b.rows.length,
          firstYear: a.firstYear,
          lastYear: a.lastYear,
          enrollment: b.enrollment,
          capacity: b.capacity,
          completionRate: rate(b.completed, b.completedEnrolled),
          employmentRate: rate(b.employed, b.targetPop),
          employmentCoverage: b.rows.length ? b.employmentCountable / b.rows.length : 0,
          satisfaction: b.satWeight > 0 ? Math.round((b.satSum / b.satWeight) * 10) / 10 : null,
          maxRevenue: b.maxRevenue,
          taxonomySource: a.taxonomySource,
          aiBranded: a.aiBranded,
        };
      });

    // 진입 여건 — 지금 몇 곳이 하고 있고, 한 곳이 얼마나 가져가고, 얼마나 과점인가
    const instTotals = [...(byCatInstitution.get(cat)?.values() ?? [])].sort((a, b) => b - a);
    const instSum = instTotals.reduce((a, v) => a + v, 0);
    const top3InstitutionShare =
      instSum > 0
        ? Math.round((instTotals.slice(0, 3).reduce((a, v) => a + v, 0) / instSum) * 1000) / 10
        : null;
    const instWindow = fullCells.slice(-3);
    const institutionChange =
      instWindow.length >= 2
        ? instWindow[instWindow.length - 1].institutions - instWindow[0].institutions
        : null;

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
      matureEmploymentRate,
      matureEmploymentYears: matureCells.map((c) => c.year),
      employmentSlope: employmentSlope === null ? null : Math.round(employmentSlope * 100) / 100,
      relativeEmploymentSlope:
        relativeEmploymentSlope === null ? null : Math.round(relativeEmploymentSlope * 100) / 100,
      satisfaction: catTotal.satWeight > 0
        ? Math.round((catTotal.satSum / catTotal.satWeight) * 10) / 10
        : null,
      quadrant: null,

      matureEmploymentIndex,
      matureTargetPop: matureTarget,
      matureYieldRate,
      matureYieldIndex,
      matureEmployed,
      matureEmployedShare: null, // 아래에서 시장 합계가 나온 뒤 채운다
      matureCompletionRate,
      matureCompletionIndex,
      recentShareShift,
      trendYears: trendCells.length,
      opProfile: null, // 아래에서 전 분야를 한꺼번에 정규화한 뒤 채운다

      distinctCourses: catTotal.courseIds.size,
      latestInstitutions: latest ? latest.institutions : 0,
      enrollmentPerInstitution:
        latest && latest.institutions > 0
          ? Math.round((latest.enrollment / latest.institutions) * 10) / 10
          : null,
      institutionChange,
      top3InstitutionShare,
      courses: courseList,
      courseListTruncated: courseAggs.length > courseList.length,
    });
  }

  // 분면 판정.
  //
  // 두 축 모두 '시장 대비'라서 기준선이 데이터에 따라 움직이지 않는 상수다:
  //   · 수요 축 = 점유 이동 0%p  → 시장에서 차지하는 몫을 지켰는가 (사람 수 기준)
  //   · 성과 축 = 취업 지수 100  → 같은 코호트 연도의 시장 평균만큼 취업시켰는가
  //
  // 옛 판정은 수요 축에 relativeDemandSlope(회차당 신청인원 지수의 기울기)를 썼는데,
  // 그 값은 분산의 70%가 '회차를 얼마나 크게 열었나'라 수요가 아니라 공급을 쟀다.
  // 실제로 AI/머신러닝은 점유율이 3년 +7.3%p(1위)인데 옛 축은 +0.44(정체)로 잡았다.
  // 성과 축도 절대 취업률 중앙값을 쓰면 성숙 코호트가 2021~2022 에 몰린 분야가
  // 자동으로 이겼다(시장 평균이 67.8% → 52.2% 로 내려왔으므로).
  const employmentMedian = median(
    categories.map((c) => c.matureEmploymentRate).filter((v): v is number => v !== null)
  );

  for (const c of categories) {
    if (c.recentShareShift === null || c.matureYieldIndex === null) {
      c.quadrant = null;
      continue;
    }
    // 세로축 = 규모가 늘고 있는가(신청 점유 이동), 가로축 = 취업이 되는가(배출률 지수).
    // "취업이 잘 될 수 있는 상황에서 규모가 얼마나 늘어나는가"를 그대로 두 축으로 옮긴 것.
    const demandUp = c.recentShareShift > 0;
    const perfUp = c.matureYieldIndex >= 100;
    c.quadrant = demandUp
      ? perfUp
        ? '유망'
        : '과열주의'
      : perfUp
        ? '저평가/틈새'
        : '축소';
  }

  // 현업 배출 점유율 — 분모(시장 전체 배출 인원)가 전 분야 합이라 여기서 채운다.
  const marketMatureEmployed = categories.reduce((a, c) => a + c.matureEmployed, 0);
  for (const c of categories) {
    c.matureEmployedShare =
      marketMatureEmployed > 0
        ? Math.round((c.matureEmployed / marketMatureEmployed) * 1000) / 10
        : null;
  }

  // Op Score 재료 — 정규화 기준(중앙값·MAD)이 '지금 이 필터로 남은 분야 집합' 안에서
  // 정해지므로 반드시 전 분야를 모아 한 번에 돌린다. 가중치는 여기서 넣지 않는다.
  // (화면이 슬라이더로 바꿀 수 있어야 하기 때문 — @/lib/backend/op-score 헤더 참고)
  const opInputs: OpScoreInput[] = categories.map((c) => ({
    key: c.category,
    values: {
      // 배출 축(질) — KDT 의 목적 그 자체. 수료율과 취업률을 따로 평균내지 않고
      // 퍼널로 곱해 하나의 '배출률'로 만든다. 곱이라 어느 단계가 무너지면 같이 무너진다.
      yieldIndex: c.matureYieldIndex,
      employmentTrend: c.relativeEmploymentSlope,
      satisfaction: c.satisfaction,
      // 규모 축 — '취업까지 간' 사람 수 기준. 신청 점유로 재면 사람만 모으고
      // 취업은 안 되는 분야가 규모를 다 가져간다(@/lib CategorySummary.matureEmployedShare).
      reachLevel: c.matureEmployedShare,
      reachShift: c.recentShareShift,
    },
    trendYears: c.trendYears,
    matureTargetPop: c.matureTargetPop,
    totalEnrollment: c.totalEnrollment,
  }));
  const opProfiles = computeOpComponentScores(opInputs);
  for (const c of categories) {
    c.opProfile = opProfiles.get(c.category) ?? null;
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
      shareShift: 0,
      employmentIndex: 100,
      /** 분면 가로축 기준: 배출률 지수 100 (= 시장 평균만큼 현업으로 내보냄) */
      yieldIndex: 100,
      marketYieldRate: (() => {
        // 성숙 코호트만 모아 시장 전체 배출률을 낸다(분야 판정 기준선과 같은 모집단).
        let emp = 0;
        let enr = 0;
        for (const [key, b] of byCatYear) {
          const y = Number(key.split(' ')[1]);
          const cell = categories
            .find((c) => c.category === key.split(' ')[0])
            ?.years.find((v) => v.year === y);
          if (!cell || cell.employmentCoverage < MATURE_EMPLOYMENT_COVERAGE || cell.targetPop <= 0)
            continue;
          emp += b.employed;
          enr += b.employmentCountableEnrolled;
        }
        return rate(emp, enr);
      })(),
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
