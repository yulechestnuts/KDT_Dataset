// 성과 지표 산출 엔진

import { ProcessedCourseData } from './types';
import { parseNumber, parsePercentage, parseDate } from './parsers';

/**
 * 3주 규칙: 과정 종료일이 오늘 기준 21일 이상 지난 과정만 수료율 계산에 포함
 */
export function isCourseOldEnoughForCompletionRate(course: ProcessedCourseData): boolean {
  const endDateStr = course.과정종료일;
  if (!endDateStr) {
    return false;
  }

  const endDate = parseDate(endDateStr);
  const today = new Date();
  const threeWeeksAgo = new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000);

  return endDate <= threeWeeksAgo;
}

/**
 * 수료율 계산
 */
export function calculateCompletionRate(
  courses: ProcessedCourseData[],
  year?: number
): number {
  let filteredCourses = courses;

  // 연도 필터링
  if (year !== undefined) {
    filteredCourses = filteredCourses.filter((c) => {
      const endDate = parseDate(c.과정종료일);
      return endDate.getFullYear() === year;
    });
  }

  // 유효한 과정만 필터링
  const validCourses = filteredCourses.filter((c) => {
    return (
      c.수료인원 > 0 &&
      c['수강신청 인원'] > 0 &&
      isCourseOldEnoughForCompletionRate(c)
    );
  });

  if (validCourses.length === 0) {
    return 0.0;
  }

  const totalCompletion = validCourses.reduce((sum, c) => sum + c.수료인원, 0);
  const totalEnrollment = validCourses.reduce((sum, c) => sum + c['수강신청 인원'], 0);

  if (totalEnrollment === 0) {
    return 0.0;
  }

  const completionRate = (totalCompletion / totalEnrollment) * 100;
  return Math.round(completionRate * 10) / 10; // 소수점 1자리
}

/**
 * 취업 인원 선택 규칙
 */
export function getPreferredEmploymentCount(course: ProcessedCourseData): number {
  const sixMonth = course['취업인원 (6개월)'] || 0;
  if (sixMonth > 0) {
    return sixMonth;
  }

  const threeMonth = course['취업인원 (3개월)'] || 0;
  if (threeMonth > 0) {
    return threeMonth;
  }

  return course.취업인원 || 0;
}

/**
 * 취업율 계산
 */
export function calculateEmploymentRate(courses: ProcessedCourseData[]): number {
  const totalEmployed = courses.reduce((sum, c) => sum + getPreferredEmploymentCount(c), 0);
  const totalCompleted = courses.reduce((sum, c) => sum + c.수료인원, 0);

  if (totalCompleted === 0) {
    return 0.0;
  }

  const employmentRate = (totalEmployed / totalCompleted) * 100;
  return Math.round(employmentRate * 10) / 10; // 소수점 1자리
}

/**
 * 가중 평균 만족도 계산
 */
export function calculateWeightedSatisfaction(courses: ProcessedCourseData[]): number {
  let totalWeightedSatisfaction = 0.0;
  let totalWeight = 0.0;

  for (const course of courses) {
    const satisfaction = course.만족도 || 0;
    const completed = course.수료인원 || 0;

    if (satisfaction > 0 && completed > 0) {
      totalWeightedSatisfaction += satisfaction * completed;
      totalWeight += completed;
    }
  }

  if (totalWeight === 0) {
    return 0.0;
  }

  const avgSatisfaction = totalWeightedSatisfaction / totalWeight;
  return Math.round(avgSatisfaction * 10) / 10; // 소수점 1자리
}

/**
 * 연도별 값 분류
 */
export function classifyYearValues(
  course: ProcessedCourseData,
  targetYear: number
): {
  is_current_year_start: boolean;
  is_prev_year_start_ongoing: boolean;
  is_current_year_end: boolean;
} {
  const startDate = parseDate(course.과정시작일);
  const endDate = parseDate(course.과정종료일);

  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  const isCurrentYearStart = startYear === targetYear;
  const isPrevYearStartAndOngoing = startYear < targetYear && endYear >= targetYear;
  const isCurrentYearEnd = endYear === targetYear;

  return {
    is_current_year_start: isCurrentYearStart,
    is_prev_year_start_ongoing: isPrevYearStartAndOngoing,
    is_current_year_end: isCurrentYearEnd,
  };
}

/**
 * X(Y) 형식 문자열 생성
 */
export function formatXyDisplay(currentValue: number, prevValue: number): string {
  if (prevValue > 0) {
    return `${currentValue}(${prevValue})`;
  }
  return String(currentValue);
}

/**
 * 상세 비율 텍스트 생성
 */
export function formatRateDetail(
  numerator: number,
  denominator: number,
  rate: number
): string {
  return `${rate.toFixed(1)}% (${numerator}/${denominator})`;
}
