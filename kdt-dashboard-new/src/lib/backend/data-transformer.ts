// 데이터 변환 로직

import { RawCourseData, ProcessedCourseData } from './types';
import {
  parseNumber,
  parsePercentage,
  parseNumberWithParen,
  parseDate,
  calculateTotalTrainingHours,
  calculateCumulativeRevenue,
} from './parsers';
import {
  groupInstitutionsAdvanced,
  isLeadingCompanyCourse,
  classifyTrainingType,
} from './institution-grouping';
import { calculateRevenueAdjustmentFactor } from './revenue-engine';

/**
 * 원본 데이터를 처리된 데이터로 변환
 */
export function transformRawDataToCourseData(rawData: RawCourseData): ProcessedCourseData {
  const startDate = parseDate(rawData.과정시작일);
  const endDate = parseDate(rawData.과정종료일);

  // 날짜 차이 계산 (일수)
  const timeDiff = endDate.getTime() - startDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  const calculatedDays = daysDiff > 0 ? daysDiff : 0;

  // 총훈련일수
  let totalDays: number;
  if (
    rawData.총훈련일수 !== undefined &&
    rawData.총훈련일수 !== null &&
    String(rawData.총훈련일수).trim() !== ''
  ) {
    totalDays = parseNumber(rawData.총훈련일수);
  } else {
    totalDays = calculatedDays;
  }

  // 총훈련시간
  const totalHours = calculateTotalTrainingHours(
    rawData.총훈련일수,
    rawData.총훈련시간
  );

  // 누적 매출 계산
  const totalCumulativeRevenue = calculateCumulativeRevenue(rawData);

  // 선도기업 과정 판단
  const hasPartnerInstitution = isLeadingCompanyCourse(rawData.파트너기관);
  const isLeadingCompany = hasPartnerInstitution;

  // 원본 기관명 보존
  const originalInstitutionName = String(rawData.훈련기관 || '').trim();
  const groupedInstitutionName = groupInstitutionsAdvanced(originalInstitutionName);

  // 수강신청 인원, 수료인원 파싱 (괄호 포함)
  const parsedEnrollment = parseNumberWithParen(
    rawData.수강신청인원 || rawData['수강신청 인원'] || 0
  );
  const parsedCompletion = parseNumberWithParen(rawData.수료인원 || 0);

  // 연도별 매출 파싱
  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'] as const;
  const yearlyRevenues: Record<string, number> = {};
  const adjustedYearlyRevenues: Record<string, number> = {};

  for (const yearCol of yearColumns) {
    const yearDigits = yearCol.replace('년', '');
    const originalRevenue = parseNumber(
      (rawData as any)[yearCol] ?? (rawData as any)[yearDigits] ?? 0
    );
    yearlyRevenues[yearCol] = originalRevenue;
    adjustedYearlyRevenues[`조정_${yearCol}`] = originalRevenue; // 초기값은 원본과 동일
  }

  // 수료율에 따른 매출 보정 적용
  const completionRate = parsePercentage(rawData.수료율 || 0);
  const adjustmentFactor = calculateRevenueAdjustmentFactor(completionRate);

  // 조정된 연도별 매출 계산
  for (const yearCol of yearColumns) {
    const adjKey = `조정_${yearCol}`;
    adjustedYearlyRevenues[adjKey] = adjustedYearlyRevenues[adjKey] * adjustmentFactor;
  }

  // 조정된 실매출대비
  const 실매출대비 = parseNumber(
    (rawData as any).실매출대비 ||
      (rawData as any)['실 매출 대비'] ||
      (rawData as any)['실 매출 대비 '] ||
      0
  );
  const 조정_실매출대비 = 실매출대비 * adjustmentFactor;

  // 훈련 유형 분류
  const trainingType = classifyTrainingType(
    String(rawData.과정명 || ''),
    groupedInstitutionName,
    String(rawData.파트너기관 || '')
  );

  return {
    고유값: String(rawData.고유값 || ''),
    과정명: String(rawData.과정명 || ''),
    '훈련과정 ID': String(rawData.훈련과정ID || rawData['훈련과정 ID'] || ''),
    회차: String(rawData.회차 || ''),
    훈련기관: groupedInstitutionName,
    원본훈련기관: originalInstitutionName,
    과정시작일: startDate.toISOString().split('T')[0],
    과정종료일: endDate.toISOString().split('T')[0],
    '수강신청 인원': parsedEnrollment.value,
    수료인원: parsedCompletion.value,
    취업인원: parseNumber(rawData.취업인원 || 0),
    '취업인원 (3개월)': parseNumber(rawData['취업인원 (3개월)'] || rawData['취업인원(3개월)'] || 0),
    '취업인원 (6개월)': parseNumber(rawData['취업인원 (6개월)'] || rawData['취업인원(6개월)'] || 0),
    수료율: completionRate,
    취업률: parsePercentage(rawData.취업률 || 0),
    만족도: parsePercentage(rawData.만족도 || 0),
    훈련비: parseNumber(rawData.훈련비 || 0),
    정원: parseNumber(rawData.정원 || 0),
    총훈련일수: totalDays,
    총훈련시간: totalHours,
    누적매출: totalCumulativeRevenue,
    '실 매출 대비': 실매출대비,
    '매출 최대': parseNumber((rawData as any).매출최대 || (rawData as any)['매출 최대'] || 0),
    '매출 최소': parseNumber((rawData as any).매출최소 || (rawData as any)['매출 최소'] || 0),
    '2021년': yearlyRevenues['2021년'],
    '2022년': yearlyRevenues['2022년'],
    '2023년': yearlyRevenues['2023년'],
    '2024년': yearlyRevenues['2024년'],
    '2025년': yearlyRevenues['2025년'],
    '2026년': yearlyRevenues['2026년'],
    '조정_2021년': adjustedYearlyRevenues['조정_2021년'],
    '조정_2022년': adjustedYearlyRevenues['조정_2022년'],
    '조정_2023년': adjustedYearlyRevenues['조정_2023년'],
    '조정_2024년': adjustedYearlyRevenues['조정_2024년'],
    '조정_2025년': adjustedYearlyRevenues['조정_2025년'],
    '조정_2026년': adjustedYearlyRevenues['조정_2026년'],
    조정_실매출대비: 조정_실매출대비,
    훈련유형: trainingType,
    NCS명: String(rawData.NCS명 || '').trim(),
    NCS코드: String(rawData.NCS코드 || '').trim(),
    선도기업: String(rawData.선도기업 || '').trim(),
    파트너기관: String(rawData.파트너기관 || '').trim(),
    isLeadingCompanyCourse: isLeadingCompany,
    leadingCompanyPartnerInstitution: hasPartnerInstitution
      ? String(rawData.파트너기관 || '').trim()
      : undefined,
  };
}

/**
 * 원본 데이터 배열을 처리된 데이터 배열로 변환
 */
export function transformRawDataArray(rawDataArray: RawCourseData[]): ProcessedCourseData[] {
  return rawDataArray.map(transformRawDataToCourseData);
}
