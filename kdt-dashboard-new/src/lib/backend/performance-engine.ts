// 성과 지표 산출 엔진

import { ProcessedCourseData } from './types';
import { parseNumber, parsePercentage, parsePercentageNullable, parseDate } from './parsers';

// 1. 퍼센트 문자열을 안전하게 숫자로 변환하는 헬퍼 함수
export const parsePercentageSafe = (value: any): number => {
  if (value === null || value === undefined || value === '-' || value === 'N/A') return 0;
  const cleaned = String(value).replace(/[^0-9.]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

export const isExcludedEmploymentStatus = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  const s = String(value).trim().toUpperCase();
  return (
    s === 'A' ||
    s === 'B' ||
    s === 'C' ||
    s === 'D' ||
    s.includes('진행 중(B)'.toUpperCase()) ||
    s.includes('미실시(C)'.toUpperCase()) ||
    s.includes('집계 대기 중'.toUpperCase())
  );
};

const pickFirst = (obj: any, keys: string[]): any => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
};

// 2. 과정별 안전한 취업 데이터 추출 및 모수 역산 함수
// ★ 절대 명제 적용:
//   1. 취업률 확인 불가 또는 필수 데이터 없음 → 0/0 처리 (targetPop: 0)
//   2. 취업률(%) + 취업인원 모두 유효 → 역산: targetPop = employed / (rate / 100)
// ★ Supabase DB 컬럼명 매핑:
//   - DB 컬럼명에 공백이 포함되어 있으므로 대괄호 표기법 필수
//   - 예: course['취업인원 (6개월)'] ← 점 표기법(course.취업인원) 사용 불가
export const getSafeEmploymentData = (course: any) => {
  // 모든 Key를 배열로 추출
  const keys = Object.keys(course || {});

  // Step 1: 6개월 데이터 명시적으로 찾기
  const count6Key = keys.find(k => k.includes('취업인원') && k.includes('6개월'));
  const rate6Key = keys.find(k => k.includes('취업률') && k.includes('6개월'));
  
  const employed6 = count6Key ? Number(course[count6Key]) || 0 : 0;
  const rawRate6 = rate6Key ? course[rate6Key] : null;
  const rate6 = rawRate6 !== null ? parsePercentageNullable(rawRate6) : null;

  // 6개월 데이터가 유효하면 사용
  if (employed6 > 0 && rate6 !== null && rate6 > 0) {
    const targetPop = Math.round(employed6 / (rate6 / 100));
    return {
      employed: employed6,
      targetPop,
      rate: rate6,
      source: '6개월'
    };
  }

  // Step 2: 6개월이 없거나 null이면 3개월로 fallback (2021년 초기 과정 대응)
  const count3Key = keys.find(k => k.includes('취업인원') && k.includes('3개월'));
  const rate3Key = keys.find(k => k.includes('취업률') && k.includes('3개월'));
  
  const employed3 = count3Key ? Number(course[count3Key]) || 0 : 0;
  const rawRate3 = rate3Key ? course[rate3Key] : null;
  const rate3 = rawRate3 !== null ? parsePercentageNullable(rawRate3) : null;

  if (employed3 > 0 && rate3 !== null && rate3 > 0) {
    const targetPop = Math.round(employed3 / (rate3 / 100));
    return {
      employed: employed3,
      targetPop,
      rate: rate3,
      source: '3개월'
    };
  }

  // Step 3: 데이터 없음 - null 반환하여 "미집계" 표시
  return {
    employed: null,
    targetPop: null,
    rate: null,
    source: null
  };
};

// 유효한 데이터인지 확인 (A, B, C, -, N/A 제외)
export function isValidData(value: any): boolean {
  if (value === null || value === undefined || value === '') return false;
  const s = String(value).trim().toUpperCase();
  return !['A', 'B', 'C', '-', 'N/A', '집계 대기 중'].includes(s);
}

// 실질적인 분모(모수) 계산: 취업인원 / (취업률 / 100)
export function calculateRealDenominator(count: number, rate: number, fallback: number): number {
  if (rate > 0) {
    // 역산: 취업인원 = 모수 * (취업률 / 100) => 모수 = 취업인원 / (취업률 / 100)
    return Math.round(count / (rate / 100));
  }
  // 취업률이 0이면 역산이 불가능하므로 수료인원(fallback) 사용
  return fallback;
}

/**
 * 취업율 계산 (HRD-Net 통합 취업률 로직 적용: 가중 평균)
 */
export function calculateEmploymentRate(courses: ProcessedCourseData[]): number {
  let totalEmployed = 0;
  let totalTargetPop = 0;

  courses.forEach((c) => {
    const empData = getSafeEmploymentData(c);
    if (empData.targetPop === null || empData.targetPop <= 0) return;
    totalEmployed += empData.employed;
    // ★ 산정대상자(targetPop)를 분모로 강제 적용 ★
    totalTargetPop += empData.targetPop;
  });

  if (totalTargetPop === 0) {
    return 0.0;
  }

  // ★ [취업인원 / 역산된 구직자수]로 통일 ★
  const employmentRate = (totalEmployed / totalTargetPop) * 100;
  return Math.round(employmentRate * 10) / 10; // 소수점 1자리
}

/**
 * 수료율 계산
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
 * 취업율 계산 (Legacy/Fallback용)
 */
export function calculateEmploymentRateLegacy(courses: ProcessedCourseData[]): number {
  let totalEmployed = 0.0;
  let totalValidTargetPop = 0.0;

  for (const course of courses) {
    const empData = getSafeEmploymentData(course);
    if (empData.targetPop === null || empData.targetPop <= 0) continue;

    totalEmployed += empData.employed;
    totalValidTargetPop += empData.targetPop;
  }

  if (totalValidTargetPop === 0) {
    return 0.0;
  }

  // ★ [취업인원 / 역산된 구직자수]로 통일 ★
  const employmentRate = (totalEmployed / totalValidTargetPop) * 100;
  return Math.round(employmentRate * 10) / 10;
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
