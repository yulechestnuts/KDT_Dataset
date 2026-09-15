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
import { applyRevenueAdjustmentIfMissing } from './revenue-engine';
import { resolveYearColumns } from '@/lib/revenue-years';

/**
 * 원본 데이터를 처리된 데이터로 변환
 */
// 유효한 데이터인지 확인 (A, B, C, -, N/A 제외)
export function isValidData(value: any): boolean {
  if (value === null || value === undefined || value === '') return false;
  const s = String(value).trim().toUpperCase();
  return !['A', 'B', 'C', '-', 'N/A', '집계 대기 중'].includes(s);
}

export function isExcludedEmploymentStatus(value: any): boolean {
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
}

// 실질적인 분모(모수) 계산: 취업인원 / (취업률 / 100)
export function calculateRealDenominator(count: number, rate: number, fallback: number): number {
  if (rate > 0) {
    return Math.round(count / (rate / 100));
  }
  return fallback;
}

export function transformRawDataToCourseData(rawData: RawCourseData): ProcessedCourseData {
  const startDate = parseDate(rawData.과정시작일);
  const endDate = parseDate(rawData.과정종료일);

  const startDateStr = !isNaN(startDate.getTime())
    ? startDate.toISOString().split('T')[0]
    : String(rawData.과정시작일 || '').trim();
  const endDateStr = !isNaN(endDate.getTime())
    ? endDate.toISOString().split('T')[0]
    : String(rawData.과정종료일 || '').trim();

  // 날짜 차이 계산 (일수)
  const timeDiff = endDate.getTime() - startDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  const calculatedDays = Number.isFinite(daysDiff) && daysDiff > 0 ? daysDiff : 0;

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

  const employmentCountRawOverall = rawData.취업인원;
  const employmentCountRaw3m = (rawData as any)['취업인원 (3개월)'] ?? (rawData as any)['취업인원(3개월)'];
  const employmentCountRaw6m = (rawData as any)['취업인원 (6개월)'] ?? (rawData as any)['취업인원(6개월)'];

  const employmentRateRawOverall = rawData.취업률;
  const employmentRateRaw3m = (rawData as any)['취업률 (3개월)'] ?? (rawData as any)['취업률(3개월)'];
  const employmentRateRaw6m = (rawData as any)['취업률 (6개월)'] ?? (rawData as any)['취업률(6개월)'];

  const employmentCountOverall = isValidData(employmentCountRawOverall)
    ? parseNumber(employmentCountRawOverall)
    : null;
  const employmentCount3m = isValidData(employmentCountRaw3m) ? parseNumber(employmentCountRaw3m) : null;
  const employmentCount6m = isValidData(employmentCountRaw6m) ? parseNumber(employmentCountRaw6m) : null;

  const employmentRateOverall = isValidData(employmentRateRawOverall)
    ? parsePercentage(employmentRateRawOverall)
    : null;
  const employmentRate3m = isValidData(employmentRateRaw3m) ? parsePercentage(employmentRateRaw3m) : null;
  const employmentRate6m = isValidData(employmentRateRaw6m) ? parsePercentage(employmentRateRaw6m) : null;

  // HRD-Net 통합 취업률 및 취업대상인원(모수) 계산
  let targetPop = 0;
  let integratedEmployed = 0;

  // 진행 중(B) / 미실시(C) / 집계대기 등은 분자/분모 모두 완전 제외
  if (
    isExcludedEmploymentStatus(employmentRateRaw6m) ||
    isExcludedEmploymentStatus(employmentRateRaw3m) ||
    isExcludedEmploymentStatus(employmentRateRawOverall)
  ) {
    targetPop = 0;
    integratedEmployed = 0;
  } else {

  if (isValidData(employmentRateRaw6m)) {
    const r = parsePercentage(employmentRateRaw6m);
    const c = parseNumber(employmentCountRaw6m);
    integratedEmployed = c;
    if (r > 0) integratedEmployed = c; // ensure integratedEmployed is set
    targetPop = r > 0 ? Math.round(c / (r / 100)) : parsedCompletion.value;
  } else if (isValidData(employmentRateRaw3m)) {
    const r = parsePercentage(employmentRateRaw3m);
    const c = parseNumber(employmentCountRaw3m);
    integratedEmployed = c;
    targetPop = r > 0 ? Math.round(c / (r / 100)) : parsedCompletion.value;
  } else if (isValidData(employmentRateRawOverall)) {
    const r = parsePercentage(employmentRateRawOverall);
    const c = parseNumber(employmentCountRawOverall);
    integratedEmployed = c;
    targetPop = r > 0 ? Math.round(c / (r / 100)) : parsedCompletion.value;
  } else {
    targetPop = parsedCompletion.value;
    integratedEmployed = 0;
  }

  // 이상치 방어: 분모가 분자보다 작으면 100%로 상한
  if (integratedEmployed > 0 && targetPop > 0 && targetPop < integratedEmployed) {
    targetPop = integratedEmployed;
  }
  }

  // 특이 케이스: EI_EMPL_CNT_6 + HRD_EMPL_CNT_6 (고용보험 가입/미가입) 합계 처리
  const empInsured = parseNumber(rawData.EI_EMPL_CNT_6 || 0);
  const empNotInsured = parseNumber(rawData.HRD_EMPL_CNT_6 || 0);
  if (empInsured + empNotInsured > integratedEmployed && isValidData(employmentRateRaw6m)) {
    integratedEmployed = empInsured + empNotInsured;
    const r = parsePercentage(employmentRateRaw6m);
    if (r > 0) targetPop = Math.round(integratedEmployed / (r / 100));
  }

  // 연도별 매출 파싱
  const yearColumns = resolveYearColumns(rawData);
  const yearlyRevenues: Record<string, number> = {};
  const adjustedYearlyRevenues: Record<string, number> = {};

  for (const yearCol of yearColumns) {
    const yearDigits = yearCol.replace('년', '');
    const originalRevenue = parseNumber(
      (rawData as any)[yearCol] ?? (rawData as any)[yearDigits] ?? 0
    );
    yearlyRevenues[yearCol] = originalRevenue;
    // 조정 컬럼은 여기서 채우지 않는다 — 아래 주석 참고.
    adjustedYearlyRevenues[`조정_${yearCol}`] = 0;
  }

  const completionRate = parsePercentage(rawData.수료율 || 0);

  const 실매출대비 = parseNumber(
    (rawData as any).실매출대비 ||
      (rawData as any)['실 매출 대비'] ||
      (rawData as any)['실 매출 대비 '] ||
      0
  );

  // 매출 보정은 여기(행 단위)서 하지 않는다.
  //
  // 예전엔 이 자리에서 원본 수료율로 계수를 곱해 조정 컬럼을 채웠다. 그런데
  // 미종료 회차는 수료율이 0 이라 "0% 수료"로 계산됐고, 더 나쁜 건 조정 컬럼이
  // 채워진 탓에 revenue-engine 의 `applyRevenueAdjustmentIfMissing` 이
  // `이미 조정값이 있으면 유지` 가드에 걸려 **추정 사다리가 통째로 안 돌았다.**
  // 수료율 추정은 전체 데이터가 있어야 가능하므로 배열 변환의 마지막 단계
  // (transformRawDataArray)에서 한 번에 처리한다.

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
    과정시작일: startDateStr,
    과정종료일: endDateStr,
    '수강신청 인원': parsedEnrollment.value,
    수료인원: parsedCompletion.value,
    취업인원: integratedEmployed,
    '취업인원 (3개월)': employmentCount3m,
    '취업인원 (6개월)': employmentCount6m,
    수료율: completionRate,
    취업률: employmentRateOverall,
    '취업률 (3개월)': employmentRate3m,
    '취업률 (6개월)': employmentRate6m,
    취업대상인원: targetPop,
    통합취업인원: integratedEmployed,
    // 만족도는 이제 5점 척도(회차별 실측). parsePercentage 는 숫자만 뽑으므로 척도와 무관하다.
    만족도: parsePercentage(rawData.만족도 || 0),
    평가인원: parseNumber((rawData as any).평가인원 || (rawData as any)['평가 인원'] || 0),
    훈련비: parseNumber(rawData.훈련비 || 0),
    정원: parseNumber(rawData.정원 || 0),
    총훈련일수: totalDays,
    총훈련시간: totalHours,
    누적매출: totalCumulativeRevenue,
    '실 매출 대비': 실매출대비,
    '매출 최대': parseNumber((rawData as any).매출최대 || (rawData as any)['매출 최대'] || 0),
    '매출 최소': parseNumber((rawData as any).매출최소 || (rawData as any)['매출 최소'] || 0),
    // 연도 키는 yearColumns 에서 동적으로 펼친다 (리터럴 나열 금지)
    ...yearlyRevenues,
    ...adjustedYearlyRevenues,
    조정_실매출대비: 0,
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
  // 보정은 반드시 배열 단위로 — 미종료 회차의 수료율 추정에 전체 표본이 필요하다.
  return applyRevenueAdjustmentIfMissing(rawDataArray.map(transformRawDataToCourseData));
}
