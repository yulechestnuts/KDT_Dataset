// 성과 지표 산출 엔진

import { ProcessedCourseData } from './types';
import { parseNumber, parsePercentage, parseDate } from './parsers';

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
export const getSafeEmploymentData = (course: any) => {
  const rate6Raw = pickFirst(course, ['취업률 (6개월)', '취업률(6개월)', '취업률_6개월']);
  const rate3Raw = pickFirst(course, ['취업률 (3개월)', '취업률(3개월)', '취업률_3개월']);
  const rateAllRaw = pickFirst(course, ['취업률']);

  const eiRate6Raw = pickFirst(course, ['EI_EMPL_RATE_6', 'EI_EMPL_RATE6', 'EI_RATE_6', 'EI_RATE6']);
  const hrdRate6Raw = pickFirst(course, ['HRD_EMPL_RATE_6', 'HRD_EMPL_RATE6', 'HRD_RATE_6', 'HRD_RATE6']);

  // 진행 중(B) / 미실시(C) / 집계대기 등은 분자/분모 모두 완전 제외
  if (
    isExcludedEmploymentStatus(rate6Raw) ||
    isExcludedEmploymentStatus(rate3Raw) ||
    isExcludedEmploymentStatus(rateAllRaw) ||
    isExcludedEmploymentStatus(eiRate6Raw) ||
    isExcludedEmploymentStatus(hrdRate6Raw)
  ) {
    return {
      employed: 0,
      targetPop: 0,
      rate: 0,
      excluded: true,
    };
  }

  // 6개월 데이터 우선 추출
  const emp6Raw = pickFirst(course, ['취업인원 (6개월)', '취업인원(6개월)', '취업인원_6개월']);
  const emp6 = Number(emp6Raw) || 0;
  const rate6 = parsePercentageSafe(rate6Raw);
  
  // 3개월 데이터 추출
  const emp3Raw = pickFirst(course, ['취업인원 (3개월)', '취업인원(3개월)', '취업인원_3개월']);
  const emp3 = Number(emp3Raw) || 0;
  const rate3 = parsePercentageSafe(rate3Raw);
  
  // 유효 데이터 판별 (6개월 > 3개월 우선순위)
  let employed = 0;
  let rate = 0;
  
  if (emp6 > 0 || rate6 > 0) {
    employed = emp6;
    rate = rate6;
  } else if (emp3 > 0 || rate3 > 0) {
    employed = emp3;
    rate = rate3;
  }

  const completion = Number(course.수료인원 || course['수료인원']) || 0;

  // API 기반(EI/HRD) 취업인원/취업률이 존재하면 우선 적용
  const eiCnt6Raw = pickFirst(course, ['EI_EMPL_CNT_6', 'EI_EMPL_CNT6', 'EI_CNT_6', 'EI_CNT6']);
  const hrdCnt6Raw = pickFirst(course, ['HRD_EMPL_CNT_6', 'HRD_EMPL_CNT6', 'HRD_CNT_6', 'HRD_CNT6']);

  const eiCnt6 = Number(String(eiCnt6Raw ?? '').replace(/[^0-9.]/g, '')) || 0;
  const hrdCnt6 = Number(String(hrdCnt6Raw ?? '').replace(/[^0-9.]/g, '')) || 0;
  const eiRate6 = parsePercentageSafe(eiRate6Raw);
  const hrdRate6 = parsePercentageSafe(hrdRate6Raw);

  const hasApiEmployment = eiCnt6 > 0 || hrdCnt6 > 0 || eiRate6 > 0 || hrdRate6 > 0;

  // 취업인원 = EI + HRD (가입 + 미가입)
  if (hasApiEmployment) {
    employed = eiCnt6 + hrdCnt6;
  }

  // ★ 단일 과정별 targetPop 역산: EI/HRD 분모는 동일하므로 절대 더하지 말고 max 선택 ★
  const denomEi = eiCnt6 > 0 && eiRate6 > 0 ? Math.round(eiCnt6 / (eiRate6 / 100)) : 0;
  const denomHrd = hrdCnt6 > 0 && hrdRate6 > 0 ? Math.round(hrdCnt6 / (hrdRate6 / 100)) : 0;
  let targetPop = Math.max(denomEi, denomHrd);

  // EI/HRD가 없거나 역산 불가인 경우에만 기존 HRD-Net 취업률 기반으로 fallback
  if (targetPop === 0) {
    targetPop = completion;
    if (employed > 0 && rate > 0) {
      targetPop = Math.round(employed / (rate / 100));
    }
  }

  // 상한선 강제: targetPop은 수료인원(FINI_CNT)을 초과할 수 없음
  if (completion > 0 && targetPop > completion) {
    targetPop = completion;
  }

  // 정합성 보정: 취업인원이 수료인원을 초과할 수 없음
  if (completion > 0 && employed > completion) {
    employed = completion;
  }

  // 이상치 방어: 분모가 분자보다 작으면 100%로 상한
  if (employed > 0 && targetPop > 0 && targetPop < employed) {
    targetPop = employed;
  }

  return { 
    employed,   // 최종 취업인원
    targetPop,  // 역산된 산정대상자(분모)
    rate        // 명시된 취업률
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
    if (empData.targetPop <= 0) continue;

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
