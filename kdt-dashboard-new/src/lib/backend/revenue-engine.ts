// 매출 계산 엔진

import { ProcessedCourseData, RevenueMode } from './types';
import { parseNumber, parsePercentage } from './parsers';
import { extractRevenueYears } from '@/lib/revenue-years';
import { isCompletionCountable } from '@/lib/completion-rule';
import {
  calculateRevenueAdjustmentFactor,
  type CompletionRateSource,
} from '@/lib/revenue-factor';
import {
  retentionWeights,
  getCourseDurationMonths,
  getMonthIndexInCourse,
} from './retention-curve';

// 계수의 정의는 @/lib/revenue-factor 한 곳에만 있다. 기존 import 경로를 깨지 않도록 재수출한다.
export { calculateRevenueAdjustmentFactor } from '@/lib/revenue-factor';

/**
 * 연·월 튜플 표기 (1-indexed month). API 파라미터 YYYY-MM에서 파싱한 값과 동일 형태.
 */
export interface YearMonth {
  year: number;
  month: number; // 1..12
}

export interface PeriodRange {
  from: YearMonth;
  to: YearMonth;
}

export function ymToNumber(ym: YearMonth): number {
  return ym.year * 12 + (ym.month - 1);
}

export function isYearMonthInRange(
  y: number,
  m: number,
  range: PeriodRange
): boolean {
  const v = y * 12 + (m - 1);
  return v >= ymToNumber(range.from) && v <= ymToNumber(range.to);
}

function getMonthOverlapCountInYear(params: {
  courseStart: Date;
  courseEnd: Date;
  year: number;
}): { count: number; includesTargetMonth: (month: number) => boolean } {
  const { courseStart, courseEnd, year } = params;

  if (!Number.isFinite(courseStart.getTime()) || !Number.isFinite(courseEnd.getTime())) {
    return { count: 0, includesTargetMonth: () => false };
  }

  const startMonth = year === courseStart.getFullYear() ? courseStart.getMonth() : 0;
  const endMonth = year === courseEnd.getFullYear() ? courseEnd.getMonth() : 11;

  let count = 0;
  const included = new Set<number>();

  for (let monthIndex = startMonth; monthIndex <= endMonth; monthIndex++) {
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    if (monthStart <= courseEnd && monthEnd >= courseStart) {
      count += 1;
      included.add(monthIndex + 1);
    }
  }

  return { count, includesTargetMonth: (m) => included.has(m) };
}

export function computeCourseRevenueForMonth(
  course: ProcessedCourseData,
  month: number,
  year?: number,
  alreadyAdjusted: boolean = false
): number {
  const courseStart = new Date(course.과정시작일);
  const courseEnd = new Date(course.과정종료일);

  if (!Number.isFinite(courseStart.getTime()) || !Number.isFinite(courseEnd.getTime())) {
    return 0;
  }

  const years = year !== undefined ? [year] : getAvailableRevenueYears(course);
  let total = 0.0;

  for (const y of years) {
    const yearlyRevenue = computeCourseRevenue(course, y, alreadyAdjusted);
    if (yearlyRevenue <= 0) continue;

    const overlap = getMonthOverlapCountInYear({ courseStart, courseEnd, year: y });
    if (overlap.count <= 0) continue;
    if (!overlap.includesTargetMonth(month)) continue;

    total += yearlyRevenue / overlap.count;
  }

  return total;
}

function getAvailableRevenueYears(course: ProcessedCourseData): number[] {
  // 연도 목록은 course 의 키에서 뽑는다. 리터럴 배열 금지 — @/lib/revenue-years 참고.
  return extractRevenueYears(course);
}

// 수료율 추정에 쓸 표본은 @/lib/completion-rule 의 기준을 그대로 따른다.
//
// 예전엔 여기서 `수료인원 > 0` 만 봤다. 그러면 신청 93명에 수료인원 1명만 먼저
// 올라온 부분반영 과정이 표본으로 들어와 수료율 1.1% 를 만들고, 그 과정의 매출이
// 통째로 깎였다. completion-rule 이 같은 함정을 수료율 KPI 쪽에서 이미 막아 두었는데
// 매출 쪽만 적용이 안 돼 있었다.
function isMeasuredCompletion(c: ProcessedCourseData, now: Date): boolean {
  return isCompletionCountable(
    {
      '수강신청 인원': c['수강신청 인원'],
      수료인원: c.수료인원,
      과정종료일: c.과정종료일,
    },
    now
  );
}

function measuredCompletionRatePercent(c: ProcessedCourseData): number {
  const enrolled = c['수강신청 인원'] || 0;
  if (enrolled <= 0) return 0;
  return ((c.수료인원 || 0) / enrolled) * 100;
}

/**
 * 인원가중 수료율. 단순평균이 아니라 Σ수료 / Σ신청 이다.
 *
 * 비율을 추정하는데 단순평균을 쓰면 5명짜리 회차와 60명짜리 회차가 같은 무게를
 * 갖는다. 매출은 인원에 비례하므로 인원가중이 맞다.
 */
function completionRateByKey(
  courses: ProcessedCourseData[],
  now: Date,
  getKey: (c: ProcessedCourseData) => string | undefined,
  minSamples: number
): Map<string, number> {
  const enrolled = new Map<string, number>();
  const graduated = new Map<string, number>();
  const samples = new Map<string, number>();

  for (const c of courses) {
    if (!isMeasuredCompletion(c, now)) continue;
    const key = getKey(c);
    if (!key) continue;
    enrolled.set(key, (enrolled.get(key) || 0) + (c['수강신청 인원'] || 0));
    graduated.set(key, (graduated.get(key) || 0) + (c.수료인원 || 0));
    samples.set(key, (samples.get(key) || 0) + 1);
  }

  const result = new Map<string, number>();
  for (const [key, denom] of enrolled.entries()) {
    if (denom <= 0) continue;
    if ((samples.get(key) || 0) < minSamples) continue;
    result.set(key, ((graduated.get(key) || 0) / denom) * 100);
  }
  return result;
}

/**
 * 같은 과정의 다른 회차는 표본 1개라도 쓴다. 남의 평균보다 자기 과거가 언제나 낫다.
 * 기관·NCS 레벨은 3회차 이상 모였을 때만 쓴다 — 한 회차짜리 평균은 추정이 아니라 복사다.
 */
const MIN_SAMPLES_SAME_COURSE = 1;
const MIN_SAMPLES_PEER_GROUP = 3;

export interface CompletionRateEstimate {
  /** 매출 보정에 실제로 쓴 수료율(%). 추정치일 수 있다. */
  rate: number;
  source: CompletionRateSource;
}

/** 수료율 추정 사다리. 자기 과거 → 좁은 피어 → 넓은 피어 → 전체 순. */
function buildCompletionRateEstimator(courses: ProcessedCourseData[], now: Date) {
  const bySameCourse = completionRateByKey(
    courses, now, (c) => c['훈련과정 ID'] || undefined, MIN_SAMPLES_SAME_COURSE
  );
  const byInstNcs = completionRateByKey(
    courses, now,
    (c) => (c.훈련기관 && c.NCS코드 ? `${c.훈련기관}|${c.NCS코드}` : undefined),
    MIN_SAMPLES_PEER_GROUP
  );
  const byInstitution = completionRateByKey(
    courses, now, (c) => c.훈련기관 || undefined, MIN_SAMPLES_PEER_GROUP
  );
  const byNcs = completionRateByKey(
    courses, now, (c) => c.NCS코드 || undefined, MIN_SAMPLES_PEER_GROUP
  );
  const overall = completionRateByKey(courses, now, () => 'ALL', 1).get('ALL');

  return function estimate(course: ProcessedCourseData): CompletionRateEstimate {
    // 실측이 있으면 무엇으로도 대체하지 않는다.
    //
    // 예전엔 '초회차'라는 이유만으로 실측 수료율을 과정 평균으로 덮어썼다.
    // 이미 끝나서 수료인원이 확정된 회차의 실측값을 평균으로 바꾸는 것은
    // 보정이 아니라 데이터를 버리는 일이다.
    if (isMeasuredCompletion(course, now)) {
      return { rate: measuredCompletionRatePercent(course), source: '실측' };
    }

    const picked = ((): CompletionRateEstimate => {
      const sameCourse = course['훈련과정 ID'] ? bySameCourse.get(course['훈련과정 ID']) : undefined;
      if (sameCourse && sameCourse > 0) return { rate: sameCourse, source: '동일과정' };

      if (course.훈련기관 && course.NCS코드) {
        const v = byInstNcs.get(`${course.훈련기관}|${course.NCS코드}`);
        if (v && v > 0) return { rate: v, source: '기관×NCS' };
      }

      const inst = course.훈련기관 ? byInstitution.get(course.훈련기관) : undefined;
      if (inst && inst > 0) return { rate: inst, source: '기관' };

      const ncs = course.NCS코드 ? byNcs.get(course.NCS코드) : undefined;
      if (ncs && ncs > 0) return { rate: ncs, source: 'NCS' };

      if (overall && overall > 0) return { rate: overall, source: '전체' };

      return { rate: 0, source: '미확정' };
    })();

    // 이미 올라온 수료인원은 수료율의 하한이다 - 반영이 늦어질 뿐 줄지는 않는다.
    //
    // 유예 기간(3주) 안인데 수료인원은 사실상 다 올라온 회차가 실제로 있다.
    // 거기에 과정 평균을 그대로 씌우면 추정치가 이미 확정된 수료인원보다 낮아져,
    // 매출이 `매출 최소`(= 훈련비 x 수료인원) 아래로 내려간다. 이미 수료한 사람
    // 몫보다 적게 버는 경우는 없으므로 하한을 우선한다.
    // (실측 32건에서 발생했고 전부 종료 후 2~3주 구간이었다)
    const floor = measuredCompletionRatePercent(course);
    if (floor > picked.rate) return { rate: floor, source: '부분실측' };

    return picked;
  };
}

/**
 * 매출 보정을 적용한다. 이미 조정값이 있으면 그대로 둔다.
 *
 * 예전엔 업로드 시점(data-transformer)이 추정 없는 수료율로 조정 컬럼을 먼저
 * 채워 버려서, 여기 있는 추정 사다리가 `이미 조정값이 있으면 유지` 가드에 걸려
 * **한 번도 실행되지 않았다.** 지금은 data-transformer 가 조정 컬럼을 비워 두고
 * 배열 변환 끝에서 이 함수를 부른다.
 */
export function applyRevenueAdjustmentIfMissing(
  courses: ProcessedCourseData[],
  now: Date = new Date()
): ProcessedCourseData[] {
  const estimate = buildCompletionRateEstimator(courses, now);

  return courses.map((course) => {
    // 이미 조정값이 있으면 유지.
    //
    // 키 존재가 아니라 **값**으로 판단한다. 조정 컬럼은 늘 만들어지므로(0 으로라도)
    // 키만 보면 언제나 '조정됨'으로 읽혀 보정이 통째로 건너뛰어진다 —
    // 이 파일이 예전에 겪은 그 버그다.
    const hasAdjustedYearValue = Object.keys(course).some(
      (k) => /^조정_\d{4}년$/.test(k) && (Number((course as any)[k]) || 0) > 0
    );
    const hasAdjustedTotal = (course.조정_실매출대비 ?? 0) > 0;
    if (hasAdjustedYearValue && hasAdjustedTotal) {
      return course;
    }

    const { rate, source } = estimate(course);
    // 수강신청 인원이 없으면 비율 자체가 정의되지 않는다 — 원본을 그대로 둔다.
    const factor =
      (course['수강신청 인원'] || 0) > 0 ? calculateRevenueAdjustmentFactor(rate) : 1.0;

    const next: ProcessedCourseData = {
      ...course,
      조정_실매출대비:
        (course.조정_실매출대비 ?? 0) > 0
          ? course.조정_실매출대비
          : parseNumber(course.누적매출 ?? course['실 매출 대비'] ?? 0) * factor,
      적용수료율: rate,
      수료율_출처: source,
    };

    // 연도별 조정 매출도 동일 계수로 생성 (조정 컬럼이 없거나 0일 때만)
    const years = getAvailableRevenueYears(course);
    for (const y of years) {
      const yearCol = `${y}년` as const;
      const adjCol = `조정_${yearCol}` as keyof ProcessedCourseData;
      const already = parseNumber((course[adjCol] as number) ?? 0);
      if (already > 0) continue;

      const origVal = parseNumber(
        (course[yearCol as keyof ProcessedCourseData] as number) ?? ((course as any)[String(y)] as number) ?? 0
      );
      if (origVal <= 0) continue;

      (next as any)[adjCol] = origVal * factor;
    }

    return next;
  });
}

/**
 * 과정별 매출 계산
 */
export function computeCourseRevenue(
  course: ProcessedCourseData,
  year?: number,
  alreadyAdjusted: boolean = false
): number {
  const completionRate = course.수료율 || 0;

  if (year !== undefined) {
    // 특정 연도 지정
    const yearKey = `${year}년` as keyof ProcessedCourseData;
    const adjYearKey = `조정_${year}년` as keyof ProcessedCourseData;

    const adjVal = parseNumber((course[adjYearKey] as number) ?? 0);
    const origVal = parseNumber(
      (course[yearKey] as number) ?? ((course as any)[String(year)] as number) ?? 0
    );
    let baseRevenue = adjVal > 0 ? adjVal : origVal;

    const isAlreadyAdjusted = alreadyAdjusted || adjVal > 0;

    if (!isAlreadyAdjusted && baseRevenue > 0) {
      const factor = calculateRevenueAdjustmentFactor(completionRate);
      return baseRevenue * factor;
    }

    return baseRevenue;
  }

  // 전체 연도 합산
  const years = getAvailableRevenueYears(course);
  let baseRevenue = 0.0;
  let usedAdjustedColumn = false;

  for (const y of years) {
    const yearCol = `${y}년` as const;
    const adjCol = `조정_${yearCol}` as keyof ProcessedCourseData;
    const adjVal = parseNumber((course[adjCol] as number) ?? 0);
    const origVal = parseNumber(
      (course[yearCol as keyof ProcessedCourseData] as number) ?? ((course as any)[String(y)] as number) ?? 0
    );
    const value = adjVal > 0 ? adjVal : origVal;
    if (adjVal > 0) usedAdjustedColumn = true;
    baseRevenue += value;
  }

  // baseRevenue가 0이면 대체 값 시도
  if (baseRevenue === 0) {
    baseRevenue = parseNumber(
      course.조정_실매출대비 ||
        course['실 매출 대비'] ||
        course.누적매출 ||
        0
    );
  }

  // 이미 조정되지 않았으면 보정 적용
  if (!(alreadyAdjusted || usedAdjustedColumn) && baseRevenue > 0) {
    const factor = calculateRevenueAdjustmentFactor(completionRate);
    return baseRevenue * factor;
  }

  return baseRevenue;
}

/**
 * 최대 매출 모드 계산
 */
export function computeCourseRevenueByMode(
  course: ProcessedCourseData,
  year: number | undefined,
  revenueMode: RevenueMode
): number {
  if (revenueMode === 'current') {
    return computeCourseRevenue(course, year);
  }

  // 'max' 모드
  const maxRevenue = parseNumber(course['매출 최대'] || 0);

  if (year === undefined) {
    return maxRevenue;
  }

  // 연도별 매출 계산
  const yearKey = `${year}년` as keyof ProcessedCourseData;
  const adjYearKey = `조정_${year}년` as keyof ProcessedCourseData;
  const adjYearRevenue = parseNumber((course[adjYearKey] as number) ?? 0);
  const origYearRevenue = parseNumber(
    (course[yearKey] as number) ?? ((course as any)[String(year)] as number) ?? 0
  );
  const yearRevenue = adjYearRevenue > 0 ? adjYearRevenue : origYearRevenue;

  // 전체 매출 기준 계산
  const years = getAvailableRevenueYears(course);
  let totalRevenueBase = 0.0;

  for (const y of years) {
    const yearCol = `${y}년` as const;
    const adjCol = `조정_${yearCol}` as keyof ProcessedCourseData;
    const adjVal = parseNumber((course[adjCol] as number) ?? 0);
    const origVal = parseNumber(
      (course[yearCol as keyof ProcessedCourseData] as number) ?? ((course as any)[String(y)] as number) ?? 0
    );
    const value = adjVal > 0 ? adjVal : origVal;
    totalRevenueBase += value;
  }

  if (totalRevenueBase === 0) {
    totalRevenueBase = parseNumber(
      course.조정_실매출대비 || course['실 매출 대비'] || course.누적매출 || 0
    );
  }

  if (totalRevenueBase <= 0) {
    return 0.0;
  }

  return maxRevenue * (yearRevenue / totalRevenueBase);
}

/**
 * 기관별 매출 분배 비율 계산
 */
export function calculateRevenueShare(
  course: ProcessedCourseData,
  institutionName: string,
  groupInstitutionsAdvanced: (name: string) => string
): number {
  const trainingInstitution = groupInstitutionsAdvanced(course.훈련기관);
  const partnerRaw = String(
    course.leadingCompanyPartnerInstitution ?? course.파트너기관 ?? ''
  ).trim();
  const isLeading =
    Boolean(course.isLeadingCompanyCourse && partnerRaw && partnerRaw !== '0') ||
    (partnerRaw !== '' && partnerRaw !== '0');

  if (isLeading && partnerRaw && partnerRaw !== '0') {
    const partnerInstitution = groupInstitutionsAdvanced(partnerRaw);

    // 훈련기관과 파트너기관이 같으면 훈련기관이 100% 흡수
    if (trainingInstitution === partnerInstitution) {
      if (trainingInstitution === institutionName) {
        return 1.0;
      }
      return 0.0;
    }

    // 파트너기관 90%
    if (partnerInstitution === institutionName) {
      return 0.9;
    }

    // 훈련기관 10%
    if (trainingInstitution === institutionName) {
      return 0.1;
    }

    return 0.0;
  } else {
    // 일반 과정: 훈련기관 100%
    if (trainingInstitution === institutionName) {
      return 1.0;
    }
    return 0.0;
  }
}

/**
 * 과정 수주금액(매출 최대)을 기관별로 배분
 * - 선도기업: 파트너 90% / 훈련기관 10%
 * - 동일기관이거나 일반과정: 훈련기관 100%
 */
export function allocateContractRevenueByInstitution(
  course: ProcessedCourseData,
  contractRevenue: number,
  groupInstitutionsAdvanced: (name: string) => string
): Array<{ institution: string; amount: number }> {
  const candidates = new Set<string>();
  const training = String(course.훈련기관 ?? '').trim();
  if (training) {
    candidates.add(groupInstitutionsAdvanced(training));
  }
  if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
    candidates.add(groupInstitutionsAdvanced(String(course.leadingCompanyPartnerInstitution)));
  }

  const allocated: Array<{ institution: string; amount: number }> = [];
  for (const institution of candidates) {
    const share = calculateRevenueShare(course, institution, groupInstitutionsAdvanced);
    if (share > 0) {
      allocated.push({ institution, amount: contractRevenue * share });
    }
  }

  if (allocated.length === 0) {
    allocated.push({
      institution: training ? groupInstitutionsAdvanced(training) : '미상',
      amount: contractRevenue,
    });
  }

  return allocated;
}

/**
 * 과정의 연 단위 매출(현재/최대)을 잔존율 곡선으로 월별 분배한 뒤,
 * [from, to] 구간에 속하는 월들의 매출만 합산해서 반환한다.
 *
 * - 연도 내 총합은 기존 산식(computeCourseRevenue / computeCourseRevenueByMode)과
 *   보존된다. 즉 range가 그 연도를 완전히 포함하면 결과는 기존 연도값과 동일.
 * - range가 연도 경계를 부분적으로 자르면, 그 연도의 활동 월들 중
 *   구간에 속하는 월들의 sqrt-shape 가중합 / 그 연도 전체 가중합 만큼만 잘라 냄.
 * - 수료율(수료율 필드) 결측 시 uniform fallback(곡선 없이 균등).
 */
export function computeCourseRevenueForRange(
  course: ProcessedCourseData,
  range: PeriodRange,
  revenueMode: RevenueMode
): number {
  const courseStart = new Date(course.과정시작일);
  const courseEnd = new Date(course.과정종료일);

  if (!Number.isFinite(courseStart.getTime()) || !Number.isFinite(courseEnd.getTime())) {
    return 0;
  }

  const durationMonths = getCourseDurationMonths(courseStart, courseEnd);
  const completionRate01 = Math.max(0, Math.min(1, (course.수료율 || 0) / 100));
  const weights = retentionWeights(completionRate01, durationMonths);

  const startYear = courseStart.getFullYear();
  const endYear = courseEnd.getFullYear();

  // 과정 활동 연 × 연도 내 활동 월 목록을 순회
  let total = 0;

  for (let y = startYear; y <= endYear; y++) {
    // range와 겹치지 않는 연도는 skip
    if (y < range.from.year || y > range.to.year) continue;

    // 연도 내 과정 활동 월 범위
    const monthStart = y === startYear ? courseStart.getMonth() + 1 : 1;
    const monthEnd = y === endYear ? courseEnd.getMonth() + 1 : 12;

    // 연 단위 매출 (기존 산식 그대로)
    const yearRevenue =
      revenueMode === 'max'
        ? computeCourseRevenueByMode(course, y, 'max')
        : computeCourseRevenue(course, y);

    if (!(yearRevenue > 0)) continue;

    // 연 내 각 활동 월의 가중치 및 range 내 여부 판단
    let yearWeightSum = 0;
    let inRangeWeightSum = 0;

    for (let m = monthStart; m <= monthEnd; m++) {
      const t = getMonthIndexInCourse(courseStart, y, m);
      if (t === null) continue;
      const w = weights[Math.min(t, weights.length - 1)] ?? 0;
      yearWeightSum += w;
      if (isYearMonthInRange(y, m, range)) {
        inRangeWeightSum += w;
      }
    }

    if (yearWeightSum > 0) {
      total += yearRevenue * (inRangeWeightSum / yearWeightSum);
    }
  }

  return total;
}

/**
 * 수주매출(과정시작일 기준) 범위 필터.
 * 과정시작일의 (year, month)가 [from, to]에 속하면 true.
 */
export function isCourseStartInRange(
  course: ProcessedCourseData,
  range: PeriodRange
): boolean {
  const start = new Date(course.과정시작일);
  if (!Number.isFinite(start.getTime())) return false;
  return isYearMonthInRange(start.getFullYear(), start.getMonth() + 1, range);
}

/**
 * 학생 수 분배 비율 계산
 */
export function calculateStudentShare(
  course: ProcessedCourseData,
  institutionName: string,
  groupInstitutionsAdvanced: (name: string) => string
): number {
  const trainingInstitution = groupInstitutionsAdvanced(course.훈련기관);

  if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
    const partnerInstitution = groupInstitutionsAdvanced(course.leadingCompanyPartnerInstitution);

    // 훈련기관과 파트너기관이 같으면 해당 기관이 학생 수 100% 흡수
    if (trainingInstitution === partnerInstitution) {
      if (trainingInstitution === institutionName) {
        return 1.0;
      }
      return 0.0;
    }

    // 파트너기관이 학생 수 100% 담당
    if (partnerInstitution === institutionName) {
      return 1.0;
    }

    // 훈련기관은 학생 수 0
    if (trainingInstitution === institutionName) {
      return 0.0;
    }

    return 0.0;
  } else {
    // 일반 과정: 훈련기관 100%
    if (trainingInstitution === institutionName) {
      return 1.0;
    }
    return 0.0;
  }
}
