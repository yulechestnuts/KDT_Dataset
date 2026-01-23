// 매출 계산 엔진

import { ProcessedCourseData, RevenueMode } from './types';
import { parseNumber, parsePercentage } from './parsers';

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

    let baseRevenue = parseNumber(
      (course[adjYearKey] as number) || (course[yearKey] as number) || 0
    );

    if (!alreadyAdjusted && baseRevenue > 0) {
      const factor = calculateRevenueAdjustmentFactor(completionRate);
      return baseRevenue * factor;
    }

    return baseRevenue;
  }

  // 전체 연도 합산
  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'] as const;
  let baseRevenue = 0.0;

  for (const yearCol of yearColumns) {
    const adjCol = `조정_${yearCol}` as keyof ProcessedCourseData;
    const value = parseNumber(
      (course[adjCol] as number) || (course[yearCol] as number) || 0
    );
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
  if (!alreadyAdjusted && baseRevenue > 0) {
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
  const yearRevenue = parseNumber(
    (course[adjYearKey] as number) || (course[yearKey] as number) || 0
  );

  // 전체 매출 기준 계산
  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'] as const;
  let totalRevenueBase = 0.0;

  for (const yearCol of yearColumns) {
    const adjCol = `조정_${yearCol}` as keyof ProcessedCourseData;
    const value = parseNumber((course[adjCol] as number) || (course[yearCol] as number) || 0);
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

  if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
    const partnerInstitution = groupInstitutionsAdvanced(course.leadingCompanyPartnerInstitution);

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
