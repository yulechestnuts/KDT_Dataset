// 매출 계산 엔진

import { ProcessedCourseData, RevenueMode } from './types';
import { parseNumber, parsePercentage } from './parsers';
import {
  retentionWeights,
  getCourseDurationMonths,
  getMonthIndexInCourse,
} from './retention-curve';

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
  const years = new Set<number>();

  for (const key of Object.keys(course)) {
    // 조정_2026년, 2026년
    const m1 = key.match(/^(?:조정_)?(\d{4})년$/);
    if (m1) {
      years.add(parseInt(m1[1], 10));
      continue;
    }

    // 2026
    const m2 = key.match(/^\d{4}$/);
    if (m2) {
      years.add(parseInt(key, 10));
    }
  }

  return Array.from(years).sort((a, b) => a - b);
}

function calculateOverallCompletionRatePercent(courses: ProcessedCourseData[]): number {
  const valid = courses.filter((c) => (c.수료인원 || 0) > 0 && (c['수강신청 인원'] || 0) > 0);
  const totalEnrollment = valid.reduce((sum, c) => sum + (c['수강신청 인원'] || 0), 0);
  const totalGraduates = valid.reduce((sum, c) => sum + (c.수료인원 || 0), 0);
  if (totalEnrollment <= 0) return 0;
  return (totalGraduates / totalEnrollment) * 100;
}

function computeAverageCompletionRateByKey(
  courses: ProcessedCourseData[],
  getKey: (c: ProcessedCourseData) => string | undefined
): Map<string, number> {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const c of courses) {
    if ((c.수료인원 || 0) <= 0 || (c['수강신청 인원'] || 0) <= 0) continue;
    const key = getKey(c);
    if (!key) continue;
    const rate = ((c.수료인원 || 0) / (c['수강신청 인원'] || 1)) * 100;
    sums.set(key, (sums.get(key) || 0) + rate);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const result = new Map<string, number>();
  for (const [key, sum] of sums.entries()) {
    const count = counts.get(key) || 0;
    if (count > 0) result.set(key, sum / count);
  }
  return result;
}

function computeFirstTimeCourseSet(courses: ProcessedCourseData[]): Set<string> {
  const courseIdEarliestStart = new Map<string, number>();
  for (const c of courses) {
    const id = c['훈련과정 ID'];
    if (!id) continue;
    const t = new Date(c.과정시작일).getTime();
    if (!Number.isFinite(t)) continue;
    const prev = courseIdEarliestStart.get(id);
    if (prev === undefined || t < prev) {
      courseIdEarliestStart.set(id, t);
    }
  }

  const firstTime = new Set<string>();
  for (const c of courses) {
    const id = c['훈련과정 ID'];
    if (!id) continue;
    const earliest = courseIdEarliestStart.get(id);
    if (earliest === undefined) continue;
    const t = new Date(c.과정시작일).getTime();
    if (Number.isFinite(t) && t === earliest) {
      firstTime.add(c.고유값);
    }
  }

  return firstTime;
}

function calculateAdjustedRevenueForCourse(params: {
  course: ProcessedCourseData;
  originalRevenue: number;
  overallCompletionRatePercent: number;
  courseCompletionRatePercent?: number;
  institutionCompletionRatePercent?: number;
  isFirstTimeCourse: boolean;
}): number {
  const {
    course,
    originalRevenue,
    overallCompletionRatePercent,
    courseCompletionRatePercent,
    institutionCompletionRatePercent,
    isFirstTimeCourse,
  } = params;

  if (originalRevenue === 0) return 0;
  if ((course['수강신청 인원'] || 0) === 0) return originalRevenue;

  let usedCompletionRatePercent = ((course.수료인원 || 0) / (course['수강신청 인원'] || 1)) * 100;

  // 수료인원이 0인 경우, 또는 초회차인 경우 예상 수료율 결정
  if ((course.수료인원 || 0) === 0 || isFirstTimeCourse) {
    let estimated = 0;
    if (courseCompletionRatePercent !== undefined && courseCompletionRatePercent > 0) {
      estimated = courseCompletionRatePercent;
    } else if (institutionCompletionRatePercent !== undefined && institutionCompletionRatePercent > 0) {
      estimated = institutionCompletionRatePercent;
    } else {
      estimated = overallCompletionRatePercent;
    }
    usedCompletionRatePercent = estimated;
  }

  const factor = calculateRevenueAdjustmentFactor(usedCompletionRatePercent);
  return originalRevenue * factor;
}

export function applyRevenueAdjustmentIfMissing(
  courses: ProcessedCourseData[]
): ProcessedCourseData[] {
  const overallCompletionRatePercent = calculateOverallCompletionRatePercent(courses);
  const byCourseId = computeAverageCompletionRateByKey(courses, (c) => c['훈련과정 ID']);
  const byInstitution = computeAverageCompletionRateByKey(courses, (c) => c.훈련기관);
  const firstTime = computeFirstTimeCourseSet(courses);

  return courses.map((course) => {
    // 이미 조정값이 있으면 유지
    const hasAnyAdjustedYear = Object.keys(course).some((k) => k.startsWith('조정_') && /\d{4}년$/.test(k));
    const hasAdjustedTotal = (course.조정_실매출대비 ?? 0) > 0;
    if (hasAnyAdjustedYear && hasAdjustedTotal) {
      return course;
    }

    const isFirstTimeCourse = firstTime.has(course.고유값);
    const courseRate = course['훈련과정 ID'] ? byCourseId.get(course['훈련과정 ID']) : undefined;
    const instRate = course.훈련기관 ? byInstitution.get(course.훈련기관) : undefined;

    const baseTotalRevenue = parseNumber(course.누적매출 ?? course['실 매출 대비'] ?? 0);
    const adjustedTotalRevenue = calculateAdjustedRevenueForCourse({
      course,
      originalRevenue: baseTotalRevenue,
      overallCompletionRatePercent,
      courseCompletionRatePercent: courseRate,
      institutionCompletionRatePercent: instRate,
      isFirstTimeCourse,
    });

    const next: ProcessedCourseData = {
      ...course,
      조정_실매출대비: (course.조정_실매출대비 ?? 0) > 0 ? course.조정_실매출대비 : adjustedTotalRevenue,
    };

    // 연도별 조정 매출도 동일 로직으로 생성 (조정 컬럼이 없거나 0일 때만)
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

      (next as any)[adjCol] = calculateAdjustedRevenueForCourse({
        course,
        originalRevenue: origVal,
        overallCompletionRatePercent,
        courseCompletionRatePercent: courseRate,
        institutionCompletionRatePercent: instRate,
        isFirstTimeCourse,
      });
    }

    return next;
  });
}

/**
 * 매출 조정 계수 계산
 */
export function calculateRevenueAdjustmentFactor(completionRate: number): number {
  if (completionRate >= 100.0) {
    return 1.25;
  } else if (completionRate >= 75.0) {
    // 선형 보간: 75%에서 1.0, 100%에서 1.25
    return 1.0 + (0.25 * (completionRate - 75.0)) / 25.0;
  } else if (completionRate >= 50.0) {
    // 선형 보간: 50%에서 0.75, 75%에서 1.0
    return 0.75 + (0.25 * (completionRate - 50.0)) / 25.0;
  } else {
    return 0.75;
  }
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
