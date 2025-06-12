// 데이터 파싱 및 변환 유틸리티

import Papa from 'papaparse';
import { adjustYearlyRevenue, calculateActualRevenue, calculateMonthlyDistribution, calculateRevenueAdjustmentFactor, calculateRevenueDistribution } from "@/utils/data-utils";

export interface RawCourseData {
  고유값: string;
  과정명: string;
  훈련과정ID: string;
  회차: string;
  훈련기관: string;
  총훈련일수: string;
  총훈련시간: string;
  과정시작일: Date;
  과정종료일: Date;
  NCS명: string;
  NCS코드: string;
  훈련비: number;
  정원: string;
  수강신청인원: number;
  수료인원: number;
  수료율: string;
  만족도: string;
  지역: string;
  주소: string;
  과정페이지링크: string;
  선도기업: string;
  파트너기관: string;
  매출최대: number;
  매출최소: number;
  실매출대비: string;
  '2021년': number;
  '2022년': number;
  '2023년': number;
  '2024년': number;
  '2025년': number;
  '2026년': number;
}

export interface CourseData {
  고유값: string;
  훈련기관: string;
  과정명: string;
  과정시작일: string;
  과정종료일: string;
  '수강신청 인원': number;
  '수료인원': number;
  누적매출?: number;
  총훈련일수: number;
  총훈련시간: number;
  훈련비: number;
  정원: number;
  '수료율': number;
  만족도: number;
  훈련연도: number;
  훈련유형: string;
  파트너기관?: string;
  선도기업?: string;
  isLeadingCompanyCourse?: boolean;
  leadingCompanyPartnerInstitution?: string;
  '실 매출 대비'?: number;
  '매출 최소'?: number;
  '매출 최대'?: number;
  조정_누적매출?: number;
  '2021년'?: number;
  '2022년'?: number;
  '2023년'?: number;
  '2024년'?: number;
  '2025년'?: number;
  '2026년'?: number;
  '조정_2021년'?: number;
  '조정_2022년'?: number;
  '조정_2023년'?: number;
  '조정_2024년'?: number;
  '조정_2025년'?: number;
  '조정_2026년'?: number;
  월별매출?: { [key: string]: number };
  월별수강인원?: { [key: string]: number };
  월별수료인원?: { [key: string]: number };
  과정상세?: string;
  회차?: string;
  과정페이지링크?: string;
  [key: string]: any;  // 동적 필드를 위한 인덱스 시그니처
}

export interface AggregatedCourseData {
  과정명: string;
  총수강신청인원: number;
  총수료인원: number;
  총누적매출: number;
  최소과정시작일: string;
  최대과정종료일: string;
  훈련유형들: string[];
  원천과정수: number;
  총훈련생수: number;
  평균만족도: number;
}

export interface YearlyStats {
  year: number;
  revenue: number;
  totalStudents: number;
  completedStudents: number;
  courses: CourseData[];
}

export interface MonthlyStats {
  month: string;
  revenue: number;
  totalStudents: number;
  completedStudents: number;
  courses: CourseData[];
  completionRate: number;
}

export interface InstitutionStat {
  institutionName: string;
  totalRevenue: number;
  totalCourses: number;
  totalStudents: number;
  completedStudents: number;
  completionRate: number;
  avgSatisfaction: number;
  courses: CourseData[];
}

export interface CompletionRateDetails {
  completionRate: number;
  totalCourses: number;
  validCourses: number;
  excludedByDate: number;
  excludedByZeroCompletion: number;
  totalEnrollment: number;
  totalCompletion: number;
  details: {
    threeWeeksAgo: string;
    currentDate: string;
    year?: number;
  };
}

// 숫자 변환 유틸리티 함수들
export const parseNumber = (value: any): number => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  
  // 이미 숫자인 경우
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  
  // 문자열인 경우 정리 후 변환
  if (typeof value === 'string') {
    // 쉼표, 공백, 특수문자 제거
    const cleaned = value.replace(/[,\s%원]/g, '');
    
    // 빈 문자열이거나 숫자가 아닌 특수 문자만 있는 경우
    if (cleaned === '' || cleaned === '-' || cleaned === 'N/A') {
      return 0;
    }
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
};

// 퍼센트 값 파싱 (문자열 "88.1%" -> 88.1)
export const parsePercentage = (value: any): number => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    const cleaned = value.replace(/[%\s]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === 'N/A') {
      return 0;
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
};

// 날짜 파싱
export const parseDate = (value: any): Date => {
  if (value instanceof Date) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  
  return new Date();
};

// 훈련 유형 분류 함수 (Python의 classify_training_type 번역)
export const classifyTrainingType = (course: RawCourseData): string => {
  const types: string[] = [];

  // 파트너기관이 존재하면 '선도기업형 훈련' 유형 추가 (훈련기관과 동일 여부 무관)
  const partnerInstitution = String(course.파트너기관 || '').trim();
  if (partnerInstitution !== '' && partnerInstitution !== '0') {
    types.push('선도기업형 훈련');
  }

  // 다른 유형 검사 (파트너기관 존재 여부와 관계없이)
  const courseName = String(course.과정명 || '').trim();
  if (courseName.includes('재직자_')) {
    types.push('재직자 훈련');
  }
  const trainingInstitution = String(course.훈련기관 || '').trim();
  if (trainingInstitution.includes('학교')) {
    types.push('대학주도형 훈련');
  }
  if (courseName.includes('심화_')) {
    types.push('심화 훈련');
  }
  if (courseName.includes('융합')) {
    types.push('융합 훈련');
  }

  return types.length > 0 ? types.join('&') : '신기술 훈련';
};

// 메인 데이터 변환 함수
export const transformRawDataToCourseData = (rawData: any): CourseData => {
  // 과정 시작일과 종료일로부터 훈련 일수와 시간 계산
  const startDate = parseDate(rawData.과정시작일 || rawData['과정시작일']);
  const endDate = parseDate(rawData.과정종료일 || rawData['과정종료일']);
  
  // 날짜 차이 계산 (일수)
  const timeDiff = endDate.getTime() - startDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  const calculatedDays = daysDiff > 0 ? daysDiff : 0;
  
  // 훈련시간 계산 (보통 하루 8시간 기준, 또는 원본 데이터 사용)
  const originalHours = parseNumber(rawData.총훈련시간 || rawData['총훈련시간']);
  const calculatedHours = originalHours > 0 ? originalHours : calculatedDays * 8;
  
  // 연도별 매출을 합산하여 누적매출 계산
  let totalCumulativeRevenue = 0;
  const yearColumns: Array<keyof RawCourseData> = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'];
  yearColumns.forEach(yearCol => {
    totalCumulativeRevenue += parseNumber(rawData[yearCol]);
  });

  // 선도기업 과정 여부 판단
  const isLeadingCompany = (String(rawData.파트너기관 || '').trim() !== '' && String(rawData.파트너기관 || '').trim() !== '0') &&
                           (String(rawData.선도기업 || '').trim() !== '' && String(rawData.선도기업 || '').trim() !== '0');

  // 조정된 연도별 매출 계산
  const adjustedYearlyRevenues: { [key: string]: number } = {};
  yearColumns.forEach(yearCol => {
    const originalRevenue = parseNumber(rawData[yearCol]);
    // calculateActualRevenue에 CourseData 타입으로 변환된 course와 yearlyRevenue를 전달해야 합니다.
    // 여기서는 rawData를 기반으로 한 임시 CourseData 객체를 생성하여 전달합니다.
    const tempCourseData: CourseData = {
      고유값: rawData.고유값 || '',
      훈련기관: rawData.훈련기관 || '',
      과정명: rawData.과정명 || '',
      과정시작일: rawData.과정시작일 || '',
      과정종료일: rawData.과정종료일 || '',
      '수강신청 인원': parseNumber(rawData['수강신청 인원']),
      '수료인원': parseNumber(rawData['수료인원']),
      누적매출: parseNumber(rawData.누적매출),
      총훈련일수: parseNumber(rawData.총훈련일수),
      총훈련시간: parseNumber(rawData.총훈련시간),
      훈련비: parseNumber(rawData.훈련비),
      정원: parseNumber(rawData.정원),
      '수료율': parsePercentage(rawData.수료율),
      만족도: parseNumber(rawData.만족도),
      훈련연도: parseNumber(rawData.훈련연도),
      훈련유형: rawData.훈련유형 || '',
      파트너기관: rawData.파트너기관 || '',
      선도기업: rawData.선도기업 || '',
      isLeadingCompanyCourse: isLeadingCompany,
      leadingCompanyPartnerInstitution: rawData.leadingCompanyPartnerInstitution || '',
      '실 매출 대비': parseNumber(rawData['실 매출 대비']),
      '매출 최소': parseNumber(rawData['매출 최소']),
      '매출 최대': parseNumber(rawData['매출 최대']),
      // 여기에 필요한 다른 필드들을 추가하세요.
    };
    
    // adjustYearlyRevenue 함수 호출
    adjustedYearlyRevenues[`조정_${yearCol}`] = adjustYearlyRevenue(tempCourseData, originalRevenue);
  });

  return {
    고유값: rawData.고유값 || '',
    과정명: rawData.과정명 || '',
    과정상세: rawData.과정상세 || rawData['과정상세'] || '',
    회차: rawData.회차 || rawData['회차'] || '',
    훈련기관: rawData.훈련기관 || rawData['훈련기관'] || '',
    파트너기관: rawData.파트너기관 || rawData['파트너기관'] || '',
    선도기업: rawData.선도기업 || rawData['선도기업'] || '',
    isLeadingCompanyCourse: isLeadingCompany,
    leadingCompanyPartnerInstitution: isLeadingCompany ? (rawData.파트너기관 || rawData['파트너기관'] || '') : undefined,
    
    // 날짜 필드들
    과정시작일: startDate.toISOString().split('T')[0],
    과정종료일: endDate.toISOString().split('T')[0],

    // 숫자 필드들 파싱
    총훈련일수: parseNumber(rawData.총훈련일수 || rawData['총훈련일수']) || calculatedDays,
    총훈련시간: calculatedHours,
    훈련비: parseNumber(rawData.훈련비 || rawData['훈련비']),
    정원: parseNumber(rawData.정원 || rawData['정원']),
    '수강신청 인원': parseNumber(rawData.수강신청인원 || rawData['수강신청인원'] || rawData['수강신청 인원']),
    '수료인원': parseNumber(rawData.수료인원 || rawData['수료인원']),
    수료율: parsePercentage(rawData.수료율 || rawData['수료율']),
    만족도: parsePercentage(rawData.만족도 || rawData['만족도']),
    훈련연도: parseNumber(rawData.훈련연도 || rawData['훈련연도'] || new Date(rawData.과정시작일).getFullYear()),
    훈련유형: classifyTrainingType(rawData as RawCourseData),
    
    // 매출 관련 필드들
    누적매출: totalCumulativeRevenue,
    '실 매출 대비': parsePercentage(rawData.실매출대비 || rawData['실 매출 대비']),
    '매출 최대': parseNumber(rawData.매출최대 || rawData['매출 최대']),
    '매출 최소': parseNumber(rawData.매출최소 || rawData['매출 최소']),
    
    // 연도별 매출 데이터 및 조정된 연도별 매출
    '2021년': parseNumber(rawData['2021년']),
    '2022년': parseNumber(rawData['2022년']),
    '2023년': parseNumber(rawData['2023년']),
    '2024년': parseNumber(rawData['2024년']),
    '2025년': parseNumber(rawData['2025년']),
    '2026년': parseNumber(rawData['2026년']),
    ...adjustedYearlyRevenues,

    월별매출: rawData.월별매출 && typeof rawData.월별매출 === 'object' ? rawData.월별매출 : {},
    월별수강인원: rawData.월별수강인원 && typeof rawData.월별수강인원 === 'object' ? rawData.월별수강인원 : {},
    월별수료인원: rawData.월별수료인원 && typeof rawData.월별수료인원 === 'object' ? rawData.월별수료인원 : {},

    과정페이지링크: rawData.과정페이지링크 || rawData['과정페이지링크'] || '',
  };
};

export const aggregateCoursesByCourseName = (courses: CourseData[]): AggregatedCourseData[] => {
  const aggregatedMap = new Map<string, AggregatedCourseData>();

  courses.forEach(course => {
    const courseName = course.과정명;
    if (!aggregatedMap.has(courseName)) {
      aggregatedMap.set(courseName, {
        과정명: courseName,
        총수강신청인원: 0,
        총수료인원: 0,
        총누적매출: 0,
        최소과정시작일: course.과정시작일,
        최대과정종료일: course.과정종료일,
        훈련유형들: [],
        원천과정수: 0,
        총훈련생수: 0,
        평균만족도: 0,
      });
    }
    const aggregatedCourse = aggregatedMap.get(courseName)!;

    aggregatedCourse.총수강신청인원 += course['수강신청 인원'];
    aggregatedCourse.총수료인원 += course['수료인원'];
    aggregatedCourse.총누적매출 += course.누적매출 ?? 0;
    aggregatedCourse.원천과정수 += 1;
    aggregatedCourse.총훈련생수 += course['수강신청 인원'];
    aggregatedCourse.평균만족도 = 
      (aggregatedCourse.평균만족도 * (aggregatedCourse.원천과정수 - 1) + course.만족도) / aggregatedCourse.원천과정수;

    // 훈련유형 중복 없이 추가
    if (course.훈련유형 && !aggregatedCourse.훈련유형들.includes(course.훈련유형)) {
      aggregatedCourse.훈련유형들.push(course.훈련유형);
    }
    
    // 시작일/종료일 업데이트
    if (new Date(course.과정시작일) < new Date(aggregatedCourse.최소과정시작일)) {
      aggregatedCourse.최소과정시작일 = course.과정시작일;
    }
    if (new Date(course.과정종료일) > new Date(aggregatedCourse.최대과정종료일)) {
      aggregatedCourse.최대과정종료일 = course.과정종료일;
    }
  });

  return Array.from(aggregatedMap.values()).sort((a, b) => b.총누적매출 - a.총누적매출);
};

// 훈련기관 그룹화 함수
function groupInstitutionsAdvanced(course: CourseData): string {
  if (!course.훈련기관) return '';

  // 1. 훈련기관명 전처리 (특수문자 제거, 공백 정리, 대문자 변환)
  const cleanName = course.훈련기관
    .replace(/[^가-힣A-Za-z0-9\s()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  // 2. 핵심 키워드 기반 그룹핑
  const institutionGroups: { [key: string]: string[] } = {
    '이젠아카데미': ['이젠'],
    '그린컴퓨터아카데미': ['그린'],
    '더조은아카데미': ['더조은'],
    '코리아IT아카데미': ['코리아IT', 'KIT'],
    '비트교육센터': ['비트'],
    '하이미디어': ['하이미디어'],
    '아이티윌': ['아이티윌', 'IT WILL'],
    '메가스터디': ['메가스터디'],
    '에이콘아카데미': ['에이콘'],
    '한국ICT인재개발원': ['ICT'],
    'MBC아카데미 컴퓨터 교육센터': ['MBC아카데미'],
    '쌍용아카데미': ['쌍용'],
    'KH정보교육원': ['KH'],
    '이스트소프트': ['이스트소프트', '(주)이스트소프트']
  };

  // 그룹 매칭
  for (const [groupName, keywords] of Object.entries(institutionGroups)) {
    for (const keyword of keywords) {
      if (cleanName.includes(keyword.toUpperCase())) {
        return groupName;
      }
    }
  }

  return course.훈련기관; // 매칭되는 그룹이 없으면 원래 기관명 반환
}

// 배열 데이터 일괄 변환
export const transformRawDataArray = (rawDataArray: any[]): CourseData[] => {
  let transformedData = rawDataArray.map(transformRawDataToCourseData);
  transformedData = transformedData.map(course => ({
    ...course,
    훈련기관: groupInstitutionsAdvanced(course)
  }));
  return transformedData;
};

// CSV 파싱시 사용할 Papaparse 옵션
export const csvParseOptions = {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false, // 모든 값을 문자열로 읽어서 수동으로 변환
  delimitersToGuess: [',', '\t', '|', ';'],
  trimHeaders: true, // 헤더의 공백을 제거합니다.
  transform: (value: string, header: string) => {
    // 헤더에서 공백 제거
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  }
};

// 데이터 검증 함수
export const validateCourseData = (data: CourseData): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!data.고유값) errors.push('고유값이 없습니다');
  if (!data.훈련기관) errors.push('훈련기관이 없습니다');
  if (data.훈련비 < 0) errors.push('훈련비가 음수입니다');
  if (data.정원 < 0) errors.push('정원이 음수입니다');
  if (data.과정종료일 < data.과정시작일) errors.push('과정 종료일이 시작일보다 빠릅니다');
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 개선된 수료율 계산 함수
export function calculateCompletionRate(data: CourseData[], year?: number): number {
  const currentDate = new Date();
  // 3주 전 날짜 계산 (21일)
  const threeWeeksAgo = new Date(currentDate.getTime() - 21 * 24 * 60 * 60 * 1000);

  let filteredData = data;

  if (year) {
    // 해당 연도에 종료된 과정만 필터링
    filteredData = data.filter(course => {
      const endDate = new Date(course.과정종료일);
      return endDate.getFullYear() === year && endDate < threeWeeksAgo;
    });
  } else {
    // 전체 기간 중 3주 이내 종료 과정 제외
    filteredData = data.filter(course => {
      const endDate = new Date(course.과정종료일);
      return endDate < threeWeeksAgo;
    });
  }

  // 수료인원이 0인 과정과 수강신청 인원이 0인 과정 제외
  const validData = filteredData.filter(course => 
    course['수료인원'] > 0 && course['수강신청 인원'] > 0
  );

  if (validData.length === 0) {
    return 0;
  }

  // 전체 수료인원 합계를 전체 수강신청 인원 합계로 나눔
  const totalCompletion = validData.reduce((sum, course) => sum + course['수료인원'], 0);
  const totalEnrollment = validData.reduce((sum, course) => sum + course['수강신청 인원'], 0);

  if (totalEnrollment === 0) {
    return 0; // 수강신청 인원이 0인 경우 0 반환
  }

  const completionRate = (totalCompletion / totalEnrollment) * 100;
  return Number(completionRate.toFixed(1));
}

// 디버깅을 위한 상세 정보 반환 함수
export function calculateCompletionRateWithDetails(data: CourseData[], year?: number): CompletionRateDetails {
  const currentDate = new Date();
  const threeWeeksAgo = new Date(currentDate.getTime() - 21 * 24 * 60 * 60 * 1000);

  let filteredByYear = data;
  if (year) {
    filteredByYear = data.filter(course => {
      const endDate = new Date(course.과정종료일);
      return endDate.getFullYear() === year;
    });
  }

  // 3주 이내 종료 과정 제외
  const filteredByDate = filteredByYear.filter(course => {
    const endDate = new Date(course.과정종료일);
    return endDate < threeWeeksAgo;
  });

  // 수료인원이 0인 과정 제외
  const validData = filteredByDate.filter(course => 
    course['수료인원'] > 0 && course['수강신청 인원'] > 0
  );

  const totalCompletion = validData.reduce((sum, course) => sum + course['수료인원'], 0);
  const totalEnrollment = validData.reduce((sum, course) => sum + course['수강신청 인원'], 0);

  const completionRate = totalEnrollment > 0 ? (totalCompletion / totalEnrollment) * 100 : 0;

  return {
    completionRate: Number(completionRate.toFixed(1)),
    totalCourses: filteredByYear.length,
    validCourses: validData.length,
    excludedByDate: filteredByYear.length - filteredByDate.length,
    excludedByZeroCompletion: filteredByDate.length - validData.length,
    totalEnrollment,
    totalCompletion,
    details: {
      threeWeeksAgo: threeWeeksAgo.toISOString().split('T')[0],
      currentDate: currentDate.toISOString().split('T')[0],
      year
    }
  };
}

// 연도별 통계 계산
export function calculateYearlyStats(data: CourseData[], year: number): YearlyStats {
  const yearData = data.filter(course => course.훈련연도 === year);
  
  const totalStudents = yearData.reduce((sum, course) => sum + course['수강신청 인원'], 0);
  const completedStudents = yearData.reduce((sum, course) => sum + course['수료인원'], 0);
  const revenue = yearData.reduce((sum, course) => sum + (course[`${year}년`] || 0), 0);

  return {
    year,
    revenue,
    totalStudents,
    completedStudents,
    courses: yearData
  };
}

// 월별 통계 계산
export function calculateMonthlyStats(data: CourseData[], year: number, month: number): MonthlyStats {
  const monthString = `${year}-${month.toString().padStart(2, '0')}`;
  
  // 해당 월에 진행중이거나 시작된 과정들 필터링
  const monthData = data.filter(course => {
    const startDate = new Date(course.과정시작일);
    const endDate = new Date(course.과정종료일);
    const targetDate = new Date(year, month - 1, 1);
    
    return startDate <= targetDate && endDate >= targetDate;
  });

  const activeCourses = monthData.length;
  const totalCourses = data.filter(course => course.훈련연도 === year).length;
  
  const revenue = monthData.reduce((sum, course) => {
    const monthlyRevenue = course.월별매출?.[monthString] || 0;
    return sum + monthlyRevenue;
  }, 0);

  const totalStudents = monthData.reduce((sum, course) => {
    const monthlyStudents = course.월별수강인원?.[monthString] || 0;
    return sum + monthlyStudents;
  }, 0);

  const completedStudents = monthData.reduce((sum, course) => {
    const monthlyCompleted = course.월별수료인원?.[monthString] || 0;
    return sum + monthlyCompleted;
  }, 0);

  return {
    month: monthString,
    revenue,
    totalStudents,
    completedStudents,
    courses: monthData,
    completionRate: calculateCompletionRate(monthData, year)
  };
}

export const calculateInstitutionStats = (data: CourseData[], year?: number): InstitutionStat[] => {
  // 연도 필터링을 먼저 적용
  const filteredData = year 
    ? data.filter(course => {
        const courseYear = new Date(course.과정시작일).getFullYear();
        return courseYear === year;
      })
    : data;

  const institutionMap = new Map<string, {
    totalRevenue: number;
    totalCourses: number;
    totalStudents: number;
    completedStudents: number;
    satisfactionSum: number;
    satisfactionCount: number;
    courses: CourseData[];
    originalCourses: Set<string>;
  }>();

  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'] as const;
  const adjustedYearColumns: string[] = yearColumns.map(yearCol => `조정_${yearCol}`);

  // 현재 날짜를 기준으로 미래 데이터 제외
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  filteredData.forEach(course => {
    let primaryInstitution = course.훈련기관;
    let secondaryInstitution: string | undefined = undefined;
    let primaryRevenueShare = 1;
    let secondaryRevenueShare = 0;

    // '선도기업' 로직 적용
    if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
      if (course.leadingCompanyPartnerInstitution !== course.훈련기관) {
        primaryInstitution = course.leadingCompanyPartnerInstitution;
        secondaryInstitution = course.훈련기관;
        primaryRevenueShare = 0.9;
        secondaryRevenueShare = 0.1;
      }
    }

    // 1차 기관 데이터 처리
    if (!institutionMap.has(primaryInstitution)) {
      institutionMap.set(primaryInstitution, {
        totalRevenue: 0,
        totalCourses: 0,
        totalStudents: 0,
        completedStudents: 0,
        satisfactionSum: 0,
        satisfactionCount: 0,
        courses: [],
        originalCourses: new Set(),
      });
    }
    const primaryStats = institutionMap.get(primaryInstitution)!;

    // 매출 계산: 선택된 연도 또는 전체 연도에 따라 합산 (일할 계산 반영)
    let courseRevenue = 0;
    const courseStartDate = parseDate(course.과정시작일);
    const courseEndDate = parseDate(course.과정종료일);

    // 1. 기본 매출액 (baseRevenue) 결정
    let baseRevenue = 0;
    if (year) {
      const yearlyRevenueKey = `${year}년` as keyof CourseData;
      const adjustedYearlyRevenueKey = `조정_${year}년` as keyof CourseData;
      baseRevenue = (course[adjustedYearlyRevenueKey] as number) ?? (course[yearlyRevenueKey] as number) ?? 0;
    } else {
      baseRevenue = adjustedYearColumns.reduce((sum, key) => {
        const value = course[key as keyof CourseData];
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);
      if (baseRevenue === 0 && course.누적매출 !== undefined) {
        baseRevenue = course.누적매출;
      }
    }

    // 2. 현재 날짜를 기준으로 baseRevenue 조정 (일할 계산)
    if (courseStartDate > today) {
      courseRevenue = 0;
    } else if (courseEndDate < today) {
      courseRevenue = baseRevenue;
    } else {
      const totalDurationDays = (courseEndDate.getTime() - courseStartDate.getTime()) / (1000 * 60 * 60 * 24);
      const passedDays = (today.getTime() - courseStartDate.getTime()) / (1000 * 60 * 60 * 24);

      if (totalDurationDays > 0) {
        courseRevenue = baseRevenue * (passedDays / totalDurationDays);
      } else {
        courseRevenue = courseStartDate <= today ? baseRevenue : 0;
      }
    }

    // 3. 수료율에 따른 매출액 보정
    const courseCompletionRate = course['수료율'];
    const revenueAdjustmentFactor = calculateRevenueAdjustmentFactor(courseCompletionRate);
    courseRevenue *= revenueAdjustmentFactor;

    primaryStats.totalRevenue += courseRevenue * primaryRevenueShare;
    primaryStats.totalCourses += 1;
    primaryStats.totalStudents += course['수강신청 인원'] * primaryRevenueShare;
    primaryStats.completedStudents += course['수료인원'] * primaryRevenueShare;
    if (course.만족도 > 0) {
      primaryStats.satisfactionSum += course.만족도 * primaryRevenueShare;
      primaryStats.satisfactionCount += primaryRevenueShare;
    }
    primaryStats.courses.push(course);
    primaryStats.originalCourses.add(course.과정명);

    // 2차 기관 (기존 훈련기관) 데이터 처리
    if (secondaryInstitution) {
      if (!institutionMap.has(secondaryInstitution)) {
        institutionMap.set(secondaryInstitution, {
          totalRevenue: 0,
          totalCourses: 0,
          totalStudents: 0,
          completedStudents: 0,
          satisfactionSum: 0,
          satisfactionCount: 0,
          courses: [],
          originalCourses: new Set(),
        });
      }
      const secondaryStats = institutionMap.get(secondaryInstitution)!;
      secondaryStats.totalRevenue += courseRevenue * secondaryRevenueShare;
      // 2차 기관은 과정 수, 학생 수, 수료 인원은 따로 합산하지 않음 (매출만 공유)
      if (course.만족도 > 0) {
        secondaryStats.satisfactionSum += course.만족도 * secondaryRevenueShare;
        secondaryStats.satisfactionCount += secondaryRevenueShare;
      }
      secondaryStats.courses.push(course);
      secondaryStats.originalCourses.add(course.과정명);
    }
  });

  const result: InstitutionStat[] = Array.from(institutionMap.entries()).map(([name, stats]) => {
    const totalStudents = stats.totalStudents;
    const completedStudents = stats.completedStudents;
    const completionRateFromHelper = calculateCompletionRate(stats.courses, year);
    const avgSatisfaction = stats.satisfactionCount > 0 ? stats.satisfactionSum / stats.satisfactionCount : 0;

    return {
      institutionName: name,
      totalRevenue: Math.round(stats.totalRevenue),
      totalCourses: stats.totalCourses,
      totalStudents: Math.round(totalStudents),
      completedStudents: Math.round(completedStudents),
      completionRate: Math.round(completionRateFromHelper * 10) / 10,
      avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
      courses: stats.courses,
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return result;
};

// 테스트 함수
export function testCompletionRateCalculation() {
  const testData: CourseData[] = [
    {
      고유값: "test1",
      훈련기관: "기관A",
      과정명: "과정1",
      과정시작일: "2024-01-01",
      과정종료일: "2024-03-01", // 3주 이전 종료
      '수강신청 인원': 20,
      '수료인원': 18,
      누적매출: 1000000,
      총훈련일수: 60,
      총훈련시간: 480,
      훈련비: 1000000,
      정원: 25,
      '수료율': 90,
      만족도: 85,
      훈련연도: 2024,
      훈련유형: "일반"
    },
    {
      고유값: "test2",
      훈련기관: "기관B",
      과정명: "과정2",
      과정종료일: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10일 전 종료 (제외되어야 함)
      과정시작일: "2024-01-01",
      '수강신청 인원': 15,
      '수료인원': 12,
      누적매출: 500000,
      총훈련일수: 30,
      총훈련시간: 240,
      훈련비: 500000,
      정원: 20,
      '수료율': 80,
      만족도: 80,
      훈련연도: 2024,
      훈련유형: "일반"
    },
    {
      고유값: "test3",
      훈련기관: "기관C",
      과정명: "과정3",
      과정종료일: "2024-02-01", // 3주 이전 종료
      과정시작일: "2024-01-01",
      '수강신청 인원': 10,
      '수료인원': 0, // 수료인원 0 (제외되어야 함)
      누적매출: 0,
      총훈련일수: 30,
      총훈련시간: 240,
      훈련비: 500000,
      정원: 15,
      '수료율': 0,
      만족도: 0,
      훈련연도: 2024,
      훈련유형: "일반"
    }
  ];

  console.log('=== 수료율 계산 테스트 ===');
  
  const result = calculateCompletionRateWithDetails(testData, 2024);
  console.log('상세 결과:', result);
  
  const simpleResult = calculateCompletionRate(testData, 2024);
  console.log('간단 결과:', simpleResult);
  
  // 예상 결과: test1만 유효 (18/20 = 90%)
  console.log('예상 수료율: 90%');
  
  // 기관별 통계 테스트
  console.log('\n=== 기관별 통계 ===');
  const institutionStats = calculateInstitutionStats(testData);
  console.log('기관별 통계:', institutionStats);
}

// 사용 예시
export const exampleUsage = () => {
  // 예시 원본 데이터 (CSV에서 읽어온 것처럼)
  const rawData = {
    고유값: "AIG202300004555885",
    과정명: "클라우드 기반 빅데이터 융합 자바(JAVA) 풀스택개발자 양성과정",
    총훈련일수: "180", // 문자열
    총훈련시간: "1440", // 문자열
    훈련비: "9,097,920", // 쉼표가 포함된 문자열
    정원: "25", // 문자열
    수료율: "85.5%", // 퍼센트 문자열
    만족도: "88.1", // 문자열
    과정시작일: "2025-04-30",
    과정종료일: "2025-10-28"
  };
  
  // 변환
  const transformedData = transformRawDataToCourseData(rawData);
  
  console.log('변환된 데이터:', transformedData);
  
  // 검증
  const validation = validateCourseData(transformedData);
  console.log('검증 결과:', validation);
};

// 기본 내보내기
export default {
  parseNumber,
  parsePercentage,
  parseDate,
  transformRawDataToCourseData,
  transformRawDataArray,
  calculateCompletionRate,
  calculateCompletionRateWithDetails,
  calculateYearlyStats,
  calculateMonthlyStats,
  calculateInstitutionStats,
  validateCourseData,
  csvParseOptions,
  testCompletionRateCalculation,
  exampleUsage
};