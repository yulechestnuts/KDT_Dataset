import { formatNumber } from "@/utils/formatters"; // formatNumber import 추가

// 데이터 파싱 및 변환 유틸리티

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
  취업인원: string;
  취업률: string;
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
  원본훈련기관?: string; // 원본 기관명 보존
  '훈련과정 ID'?: string;
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
  취업인원: number;
  취업률: number;
  '취업인원 (3개월)': number;
  '취업률 (3개월)': number;
  '취업인원 (6개월)': number;
  '취업률 (6개월)': number;
  훈련연도: number;
  훈련유형: string;
  NCS명: string;
  NCS코드?: string;
  파트너기관?: string;
  선도기업?: string;
  isLeadingCompanyCourse?: boolean;
  leadingCompanyPartnerInstitution?: string;
  '실 매출 대비'?: number;
  '매출 최대'?: number;
  '매출 최소'?: number;
  조정_실매출대비?: number;
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
  '훈련과정 ID'?: string; // 훈련과정 ID 추가
  총수강신청인원: number;
  총수료인원: number;
  총취업인원: number;
  총누적매출: number;
  최소과정시작일: string;
  최대과정종료일: string;
  훈련유형들: string[];
  원천과정수: number; // 집계된 과정의 개수
  총훈련생수: number;
  평균만족도: number;
  평균수료율: number;
  평균취업율: number;
  graduatesStr?: string; // Add graduatesStr
  studentsStr?: string; // Add studentsStr
  openCountStr?: string; // Add openCountStr
  총정원?: number; // 모집률 계산용 정원 합계
  연도정원?: number; // x(y)에서 x에 해당하는 정원 합계
  과거년도정원?: number; // x(y)에서 y에 해당하는 정원 합계
  연도훈련생수?: number; // x(y)에서 x에 해당하는 훈련생 수
  개강회차수?: number; // 개강회차수 (X)
  과거년도개강회차수?: number; // 과거년도 개강회차수 (Y)
  현재년도수강신청인원?: number; // 현재년도 수강신청인원 (X)
  과거년도수강신청인원?: number; // 과거년도 수강신청인원 (Y)
  현재년도수료인원?: number; // 현재년도 수료인원 (X)
  과거년도수료인원?: number; // 과거년도 수료인원 (Y)
  // 해당 연도에 종료된 과정 기준 수료율/취업율 계산용 분모/분자(연도별)
  현재년도수료과정_수강신청인원?: number; // 해당 연도에 종료되고 해당 연도에 시작한 과정의 수강신청 인원 합
  과거년도수료과정_수강신청인원?: number; // 해당 연도에 종료되었으나 과거에 시작한 과정의 수강신청 인원 합
  현재년도취업인원?: number; // 해당 연도에 종료되고 해당 연도에 시작한 과정의 취업인원 합
  과거년도취업인원?: number; // 해당 연도에 종료되었으나 과거에 시작한 과정의 취업인원 합
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
  totalCourses: string; // number에서 string으로 변경
  totalStudents: string; // number에서 string으로 변경
  completedStudents: string; // number에서 string으로 변경
  totalEmployed: number;
  completionRate: number;
  employmentRate: number;
  avgSatisfaction: number;
  courses: CourseData[];
  // 이전 연도 시작 과정 정보 추가
  prevYearStudents: number;
  prevYearCompletedStudents: number;
  currentYearCoursesCount: number;
  prevYearCoursesCount: number;
  currentYearStudents: number;
  currentYearCompletedStudents: number;
}

// 취업인원 선택 규칙: 6개월 > 3개월 > 전체
export function getPreferredEmploymentCount(course: CourseData): number {
  const sixMonth = (course['취업인원 (6개월)'] as number | undefined) ?? 0;
  const threeMonth = (course['취업인원 (3개월)'] as number | undefined) ?? 0;
  const overall = (course['취업인원'] as number | undefined) ?? 0;
  if (sixMonth > 0) return sixMonth;
  if (threeMonth > 0) return threeMonth;
  return overall;
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
    currentDate: string;
    year?: number;
  };
}

export interface NcsStat {
  ncsName: string;
  totalRevenue: number;
  totalCourses: number;
  totalStudents: number;
  completedStudents: number;
  completionRate: number;
  avgSatisfaction: number;
  courses: CourseData[];
  // 이전 연도 시작 과정 정보 추가
  prevYearStudents: number;
  prevYearCompletedStudents: number;
}

export interface LeadingCompanyStat {
  leadingCompany: string;
  totalRevenue: number;
  totalCourses: number;
  totalStudents: number;
  completedStudents: number;
  completionRate: number;
  avgSatisfaction: number;
  courses: CourseData[];
}

export interface InstitutionExtraStats {
  leadingCourseCount: number;
  leadingRevenue: number;
  techCourseCount: number;
  techRevenue: number;
  ncsTop: { ncsName: string; revenue: number; courses: number }[];
  yearly: { year: number; revenue: number; students: number }[];
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
    const cleaned = value.replace(/[, %원]/g, '');
    
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
    const cleaned = value.replace(/[% ]/g, '');
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

// 숫자와 괄호 안 숫자 분리 유틸
function parseNumberWithParen(str: any) {
  if (typeof str === 'number') return { value: str, display: String(str), paren: null };
  if (typeof str !== 'string') return { value: 0, display: '', paren: null };
  const match = str.match(/^(\d+)(?:\((\d+)\))?$/);
  if (match) {
    return {
      value: parseInt(match[1], 10),
      display: str,
      paren: match[2] ? parseInt(match[2], 10) : null
    };
  }
  return { value: parseNumber(str), display: str, paren: null };
}

// 훈련기관 그룹화 헬퍼 함수 (단일 CourseData 객체 처리)
export const groupInstitutionsAdvanced = (course: CourseData): string => {
  const institutionGroups: { [key: string]: string[] } = {
    '이젠아카데미': ['이젠', '이젠컴퓨터학원', '이젠아이티아카데미'],
    '그린컴퓨터아카데미': ['그린', '그린컴퓨터아카데미', '그린아카데미컴퓨터학원'],
    '더조은아카데미': ['더조은', '더조은컴퓨터아카데미', '더조은아이티아카데미'],
    '코리아IT아카데미': ['코리아IT', '코리아아이티', 'KIT', '코리아IT아카데미'],
    '비트교육센터': ['비트', '비트캠프', '비트교육센터'],
    '하이미디어': ['하이미디어', '하이미디어아카데미', '하이미디어컴퓨터학원'],
    '아이티윌': ['아이티윌', 'IT WILL', '아이티윌부산교육센터'],
    '메가스터디': ['메가스터디'],
    '에이콘아카데미': ['에이콘'],
    '한국ICT인재개발원': ['ICT'],
    'MBC아카데미 컴퓨터 교육센터': ['MBC아카데미', '(MBC)'],
    '쌍용아카데미': ['쌍용'],
    'KH정보교육원': ['KH']
  };

  if (!course.훈련기관) return '알 수 없는 기관';

  let cleanName = course.훈련기관.replace(/[^가-힣A-Za-z0-9\s()]/g, '');
  cleanName = cleanName.replace(/\s+/g, ' ').trim().toUpperCase();

  for (const groupName in institutionGroups) {
    if (institutionGroups.hasOwnProperty(groupName)) {
      const keywords = institutionGroups[groupName];
      for (const keyword of keywords) {
        if (cleanName.includes(keyword.toUpperCase())) {
          return groupName;
        }
      }
    }
  }
  return cleanName; // 그룹에 속하지 않으면 원래 기관명 유지
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

  // 총훈련일수: 원본 값이 null/undefined/빈 문자열이 아닐 때만 원본 사용, 아니면 계산값 사용
  let totalDays: number;
  if (
    rawData['총 훈련일수'] !== undefined &&
    rawData['총 훈련일수'] !== null &&
    String(rawData['총 훈련일수']).trim() !== ''
  ) {
    totalDays = parseNumber(rawData['총 훈련일수']);
  } else {
    totalDays = calculatedDays;
  }

  // 총훈련시간: 원본 값이 null/undefined/빈 문자열이 아닐 때만 원본 사용, 아니면 계산값 사용
  let totalHours: number;
  if (
    rawData['총 훈련시간'] !== undefined &&
    rawData['총 훈련시간'] !== null &&
    String(rawData['총 훈련시간']).trim() !== ''
  ) {
    totalHours = parseNumber(rawData['총 훈련시간']);
  } else {
    totalHours = totalDays * 8;
  }
  
  // 연도별 매출을 합산하여 누적매출 계산
  let totalCumulativeRevenue = 0;
  const yearColumns: Array<keyof RawCourseData> = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'];
  yearColumns.forEach(yearCol => {
    totalCumulativeRevenue += parseNumber(rawData[yearCol]);
  });

  // 선도기업 과정 여부 판단 (파트너기관만 있어도 선도기업 과정으로 간주)
  const hasPartnerInstitution = (String(rawData.파트너기관 || '').trim() !== '' && String(rawData.파트너기관 || '').trim() !== '0');
  const isLeadingCompany = hasPartnerInstitution; // 파트너기관이 있으면 선도기업 과정으로 간주

  // 조정된 연도별 매출 계산 (여기서는 원본 값을 복사, 최종 조정은 calculateInstitutionStats에서)
  const adjustedYearlyRevenues: { [key: string]: number } = {};
  yearColumns.forEach(yearCol => {
    const originalRevenue = parseNumber(rawData[yearCol]);
    adjustedYearlyRevenues[`조정_${yearCol}`] = originalRevenue; 
  });

  const parsedEnrollment = parseNumberWithParen(rawData.수강신청인원 || rawData['수강신청인원'] || rawData['수강신청 인원']);
  const parsedCompletion = parseNumberWithParen(rawData.수료인원 || rawData['수료인원']);

  return {
    고유값: rawData.고유값 || rawData['고유값'] || '',
    과정명: rawData.과정명 || rawData['과정명'] || '',
    과정상세: rawData.과정상세 || rawData['과정상세'] || '',
    회차: rawData.회차 || rawData['회차'] || '',
    훈련기관: rawData.훈련기관 || rawData['훈련기관'] || '',
    파트너기관: rawData.파트너기관 || rawData['파트너기관'] || '',
    선도기업: rawData.선도기업 || rawData['선도기업'] || '',
    isLeadingCompanyCourse: isLeadingCompany,
    leadingCompanyPartnerInstitution: hasPartnerInstitution ? (rawData.파트너기관 || rawData['파트너기관'] || '') : undefined,
    '훈련과정 ID': rawData['훈련과정 ID'] || rawData.훈련과정ID || '',
    
    // 날짜 필드들
    과정시작일: startDate.toISOString().split('T')[0],
    과정종료일: endDate.toISOString().split('T')[0],

    // 숫자 필드들 파싱
    총훈련일수: totalDays,
    총훈련시간: totalHours,
    훈련비: parseNumber(rawData.훈련비 || rawData['훈련비']),
    정원: parseNumber(rawData.정원 || rawData['정원']),
    '수강신청 인원': parsedEnrollment.value,
    수강신청_표시: parsedEnrollment.display,
    수강신청_괄호: parsedEnrollment.paren,
    '수료인원': parsedCompletion.value,
    수료인원_표시: parsedCompletion.display,
    수료인원_괄호: parsedCompletion.paren,
    수료율: parsePercentage(rawData.수료율 || rawData['수료율']),
    만족도: parsePercentage(rawData.만족도 || rawData['만족도']),
    취업인원: parseNumber(rawData.취업인원 || rawData['취업인원']),
    취업률: parsePercentage(rawData.취업률 || rawData['취업률']),
    '취업인원 (3개월)': parseNumber(rawData['취업인원 (3개월)'] || rawData['취업인원(3개월)'] || 0),
    '취업률 (3개월)': parsePercentage(rawData['취업률 (3개월)'] || rawData['취업률(3개월)'] || 0),
    '취업인원 (6개월)': parseNumber(rawData['취업인원 (6개월)'] || rawData['취업인원(6개월)'] || 0),
    '취업률 (6개월)': parsePercentage(rawData['취업률 (6개월)'] || rawData['취업률(6개월)'] || 0),
    훈련연도: parseNumber(rawData.훈련연도 || rawData['훈련연도'] || new Date(rawData.과정시작일).getFullYear()),
    훈련유형: classifyTrainingType(rawData as RawCourseData),
    NCS명: String(rawData.NCS명 || rawData['NCS명'] || '').trim(),
    NCS코드: String(rawData.NCS코드 || rawData['NCS코드'] || '').trim(),
    
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

    과정페이지링크: String(
      rawData.과정페이지링크 ||
      rawData['과정페이지링크'] ||
      rawData['과정페이지 링크'] ||
      rawData['과정 페이지 링크'] ||
      ''
    ).trim(),
  };
};

export const transformRawDataArray = (rawDataArray: any[]): CourseData[] => {
  let transformedData = rawDataArray.map(transformRawDataToCourseData);

  // 1. 훈련과정 ID가 같으면 최신 과정명으로 업데이트
  if (transformedData.length > 0 && '훈련과정 ID' in transformedData[0] && '과정시작일' in transformedData[0] && '과정명' in transformedData[0]) {
    // 훈련과정 ID별로 최신 과정명 찾기
    const latestCourseNames = new Map<string, string>();
    
    // 훈련과정 ID별로 그룹화하여 최신 과정명 찾기
    const courseGroups = new Map<string, CourseData[]>();
    transformedData.forEach(course => {
      if (course['훈련과정 ID']) {
        if (!courseGroups.has(course['훈련과정 ID'])) {
          courseGroups.set(course['훈련과정 ID'], []);
        }
        courseGroups.get(course['훈련과정 ID'])!.push(course);
      }
    });

    // 각 훈련과정 ID 그룹에서 훈련시작일이 가장 늦은 과정의 과정명을 최신 과정명으로 설정
    courseGroups.forEach((courses, courseId) => {
      const latestCourse = courses.reduce((latest, current) => {
        return new Date(current.과정시작일) > new Date(latest.과정시작일) ? current : latest;
      });
      latestCourseNames.set(courseId, latestCourse.과정명);
    });
    
    // 모든 과정에 최신 훈련명 적용 (중복 제거하지 않고 모든 과정 유지)
    transformedData = transformedData.map(course => {
      return {
        ...course,
        과정명: course['훈련과정 ID'] ? latestCourseNames.get(course['훈련과정 ID']) || course.과정명 : course.과정명
      };
    });
  }

  // 훈련기관 그룹화 적용 (원본 기관명 보존)
  transformedData = transformedData.map(course => {
    const originalInstitutionName = course.훈련기관; // 원본 기관명 보존
    const groupedInstitutionName = groupInstitutionsAdvanced(course); // 그룹화된 기관명
    
    return {
      ...course,
      훈련기관: groupedInstitutionName, // 그룹화된 기관명으로 표시
      원본훈련기관: originalInstitutionName // 원본 기관명 보존
    };
  });
  
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
  if (!data.length || !('훈련과정 ID' in data[0])) {
    console.warn("경고: '훈련과정 ID' 컬럼이 없어 과정별 평균 수료율을 계산할 수 없습니다.");
    return 0;
  }
  let filteredData = data;

  if (year) {
    // 해당 연도에 종료된 과정만 필터링
    filteredData = data.filter(course => {
      const endDate = new Date(course.과정종료일);
      return endDate.getFullYear() === year;
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
  let filteredData = data;

  if (year) {
    // 해당 연도에 종료된 과정만 필터링
    filteredData = data.filter(course => {
      const endDate = new Date(course.과정종료일);
      return endDate.getFullYear() === year;
    });
  }

  // 수료인원이 0인 과정과 수강신청 인원이 0인 과정 제외
  const validData = filteredData.filter(course => 
    course['수료인원'] > 0 && course['수강신청 인원'] > 0
  );

  const totalCompletion = validData.reduce((sum, course) => sum + course['수료인원'], 0);
  const totalEnrollment = validData.reduce((sum, course) => sum + course['수강신청 인원'], 0);

  const completionRate = totalEnrollment > 0 ? (totalCompletion / totalEnrollment) * 100 : 0;

  return {
    completionRate: Number(completionRate.toFixed(1)),
    totalCourses: data.length,
    validCourses: validData.length,
    excludedByDate: 0, // 날짜 제외 로직 제거
    excludedByZeroCompletion: data.length - validData.length,
    totalEnrollment,
    totalCompletion,
    details: {
      currentDate: new Date().toISOString().split('T')[0],
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
export const calculateMonthlyStatistics = (
  data: CourseData[],
  year?: number | null
): MonthlyStats[] => {
  const monthlyMap = new Map<string, MonthlyStats>();

  // 연도 범위 결정
  const startYear = year ?? 2021;
  const endYear = year ?? 2026; // 현재 날짜 대신 고정된 최대 연도 사용
  
  // 선택된 연도 범위의 모든 월 초기화
  for (let y = startYear; y <= endYear; y++) {
    for (let i = 0; i < 12; i++) {
      const monthName = `${y}-${String(i + 1).padStart(2, '0')}`;
      monthlyMap.set(monthName, {
        month: monthName,
        revenue: 0,
        totalStudents: 0,
        completedStudents: 0,
        courses: [],
        completionRate: 0
      });
    }
  }

  // 훈련과정 ID별 수료율 평균 계산
  const courseCompletionRates = new Map<string, number>();
  data.forEach((course) => {
    if ((course.수료인원 ?? 0) > 0 && course.훈련과정ID) {
      const courseId = course.훈련과정ID;
      const completionRate = (course.수료인원 ?? 0) / (course['수강신청 인원'] ?? 1) * 100;
      if (!courseCompletionRates.has(courseId)) {
        courseCompletionRates.set(courseId, completionRate);
      } else {
        const currentRate = courseCompletionRates.get(courseId)!;
        courseCompletionRates.set(courseId, (currentRate + completionRate) / 2);
      }
    }
  });

  // 과정 시작일 기준으로 정렬 (기존 로직 유지)
  const sortedData = [...data].sort((a, b) =>
    new Date(a.과정시작일).getTime() - new Date(b.과정시작일).getTime()
  );

  sortedData.forEach((course) => {
    const courseStartDate = new Date(course.과정시작일);
    const courseEndDate = new Date(course.과정종료일);

    // 선택된 연도에 해당하는 과정만 처리 (선택된 연도가 없으면 모든 연도 처리)
    for (let y = startYear; y <= endYear; y++) {
      const yearColumn = `${y}년` as keyof CourseData;
      const adjustedRevenue = computeCourseRevenue(course, y); // 해당 연도의 조정된 매출을 가져옴

      if (adjustedRevenue > 0) {
        let monthsInThisCourseYear = 0;
        const currentYearMonths: string[] = [];

        const iterStartMonth = (y === courseStartDate.getFullYear()) ? courseStartDate.getMonth() : 0;
        const iterEndMonth = (y === courseEndDate.getFullYear()) ? courseEndDate.getMonth() : 11;

        for (let monthIndex = iterStartMonth; monthIndex <= iterEndMonth; monthIndex++) {
          const monthStart = new Date(y, monthIndex, 1);
          const monthEnd = new Date(y, monthIndex + 1, 0);

          // 현재 월이 과정의 전체 기간 내에 포함되는지 확인
          if (monthStart <= courseEndDate && monthEnd >= courseStartDate) {
            monthsInThisCourseYear++;
            currentYearMonths.push(`${y}-${String(monthIndex + 1).padStart(2, '0')}`);
          }
        }

        if (monthsInThisCourseYear > 0) {
          const revenuePerMonth = adjustedRevenue / monthsInThisCourseYear;
          currentYearMonths.forEach(monthName => {
            if (monthlyMap.has(monthName)) {
              monthlyMap.get(monthName)!.revenue += revenuePerMonth;
            }
          });
        }
      }

      // 학생 수 및 과정 정보는 과정 시작 월에만 추가 (기존 로직 유지)
      const courseStartMonthName = `${courseStartDate.getFullYear()}-${String(courseStartDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap.has(courseStartMonthName) && courseStartDate.getFullYear() === y) {
        const stats = monthlyMap.get(courseStartMonthName)!;
        stats.totalStudents += course['수강신청 인원'] ?? 0;
        stats.completedStudents += course.수료인원 ?? 0;
        stats.courses.push(course);
      }
    }
  });

  // 각 월별 수료율 계산 (기존 로직 유지)
  monthlyMap.forEach((stats) => {
    if (stats.courses.length > 0) {
      const validCourses = stats.courses.filter(course => (course.수료인원 ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0);
      if (validCourses.length > 0) {
        const totalCompletion = validCourses.reduce((sum, course) => sum + (course.수료인원 ?? 0), 0);
        const totalEnrollment = validCourses.reduce((sum, course) => sum + (course['수강신청 인원'] ?? 0), 0);
        stats.completionRate = totalEnrollment > 0 ? (totalCompletion / totalEnrollment * 100) : 0;
      }
    }
  });

  return Array.from(monthlyMap.values()).sort((a, b) => {
    const [aYear, aMonth] = a.month.split('-').map(Number);
    const [bYear, bMonth] = b.month.split('-').map(Number);
    return aYear === bYear ? aMonth - bMonth : aYear - bYear;
  });
};

// 수료율에 따른 매출액 보정 계수 계산 함수
export function calculateRevenueAdjustmentFactor(completionRate: number): number {
  let factor = 0;
  if (completionRate >= 100) {
    factor = 1.25; // 100% 이상일 때 1.25배
  } else if (completionRate >= 75) {
    // 75%에서 100% 사이는 선형적으로 1.0에서 1.25로 증가
    factor = 1.0 + (0.25 * (completionRate - 75) / 25);
  } else if (completionRate >= 50) {
    // 50%에서 75% 사이는 선형적으로 0.75에서 1.0으로 증가
    factor = 0.75 + (0.25 * (completionRate - 50) / 25);
  } else {
    // 50% 미만은 0.75배
    factor = 0.75;
  }
  
  return factor;
}

// Helper: Compute course revenue with the same rules used in calculateInstitutionStats
export const computeCourseRevenue = (
  course: CourseData,
  year?: number,
): number => {
  // If a specific year is requested, use only that year's revenue columns; otherwise sum all.
  if (year) {
    const yearlyKey = `${year}년` as keyof CourseData;
    const adjKey = `조정_${year}년` as keyof CourseData;
    let baseRevenue: number = (course[adjKey] as number) ?? (course[yearlyKey] as number) ?? 0;

    // 수료율에 따른 추가 조정 (이미 조정된 경우 스킵)
    const alreadyAdjusted = typeof course[adjKey] === 'number';
    if (!alreadyAdjusted) {
      baseRevenue *= calculateRevenueAdjustmentFactor(course['수료율'] ?? 0);
    }
    return baseRevenue;
  }

  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'] as const;
  const adjustedCols = yearColumns.map(col => `조정_${col}`); // as keyof CourseData 제거

  // 1) 조정된 연도별 매출의 합계 (누적매출로 대체)
  let baseRevenue = adjustedCols.reduce((sum, key) => {
    return sum + parseNumber(course[key as keyof CourseData]); // key를 CourseData의 유효한 키로 캐스팅
  }, 0);
  if (baseRevenue === 0) {
    if (typeof course.조정_실매출대비 === 'number') {
      baseRevenue = course.조정_실매출대비; // 오타 수정: 조정_실매매출대비 -> 조정_실매출대비
    } else if (typeof course['실 매출 대비'] === 'number') {
      baseRevenue = course['실 매출 대비'];
    } else if (course.누적매출 !== undefined) {
      baseRevenue = course.누적매출;
    }
  }

  // 3) 수료율에 따른 보정 (이미 조정된 경우 스킵)
  const alreadyAdjusted = Object.keys(course).some(k => k.startsWith('조정_'));
  if (!alreadyAdjusted) {
    baseRevenue *= calculateRevenueAdjustmentFactor(course['수료율'] ?? 0);
  }
  return baseRevenue;
};

export const calculateInstitutionStats = (data: CourseData[], year?: number): InstitutionStat[] => {
  // 그룹명 기준으로 institutionNames 추출 (중복 제거)
  // 훈련기관과 파트너기관 모두를 고려하여 통계 목록에 포함될 기관명들을 추출
  const allPossibleInstitutionNames = new Set<string>();
  data.forEach(course => {
    allPossibleInstitutionNames.add(groupInstitutionsAdvanced(course)); // 훈련기관 기준
    if (course.leadingCompanyPartnerInstitution) {
      allPossibleInstitutionNames.add(groupInstitutionsAdvanced({ ...course, 훈련기관: course.leadingCompanyPartnerInstitution })); // 파트너기관 기준
    }
  });
  const institutionNames = Array.from(allPossibleInstitutionNames);
  const result: InstitutionStat[] = [];

  institutionNames.forEach(institutionName => {
    // 해당 institutionName과 관련된 모든 과정 (훈련기관이거나 파트너기관인 경우)
    const relevantCourses = data.filter(course => {
      const isTrainingInstitution = groupInstitutionsAdvanced(course) === institutionName;
      const isPartnerInstitution = course.leadingCompanyPartnerInstitution && groupInstitutionsAdvanced({ ...course, 훈련기관: course.leadingCompanyPartnerInstitution }) === institutionName;
      return isTrainingInstitution || isPartnerInstitution;
    });

    if (relevantCourses.length === 0) return; // 관련 과정이 없으면 건너뜜

    // calculateInstitutionDetailedRevenue 함수를 사용하여 해당 기관의 상세 매출 및 관련 과정 데이터 추출
    // 이 함수는 이미 매출 분배 로직을 포함하고 있음
    const detailed = calculateInstitutionDetailedRevenue(relevantCourses, institutionName, year);
    const aggregated = aggregateCoursesByCourseIdWithLatestInfo(detailed.courses, year, institutionName);
    const totalRevenue = aggregated.reduce((sum: number, course: AggregatedCourseData) => sum + course.총누적매출, 0);

    // 학생수/수료인원/과정수 계산 (파트너기관이 대체한 경우 파트너기관이 100% 담당)
    let totalStudents = 0;
    let completedStudents = 0;
    let totalCourses = 0;
    let totalEmployed = 0;
    let currentYearCoursesCount = 0;
    let prevYearCoursesCount = 0;
    let currentYearStudents = 0;
    let prevYearStudents = 0;
    let currentYearCompletedStudents = 0;
    let prevYearCompletedStudents = 0;

    detailed.courses.forEach((course: CourseData) => {
      const courseInstitutionGroup = groupInstitutionsAdvanced(course);
      const coursePartnerGroup = course.leadingCompanyPartnerInstitution ? groupInstitutionsAdvanced({ ...course, 훈련기관: course.leadingCompanyPartnerInstitution }) : undefined;

      // 현재 통계를 계산하는 institutionName이 이 과정의 훈련기관이거나 파트너기관인 경우에만 집계
      if (courseInstitutionGroup === institutionName || coursePartnerGroup === institutionName) {
        const courseStartDate = new Date(course.과정시작일);
        const courseEndDate = new Date(course.과정종료일);
        const currentYear = year || new Date().getFullYear(); // 현재 연도 또는 지정된 연도

        const isCurrentYearStart = courseStartDate.getFullYear() === currentYear;
        const isPrevYearStartAndOngoing = courseStartDate.getFullYear() < currentYear && courseEndDate.getFullYear() >= currentYear;

        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
          // 선도기업 과정: 파트너기관이 100% 담당
          if (coursePartnerGroup === institutionName) {
            totalStudents += course['수강신청 인원'] ?? 0;
            completedStudents += course['수료인원'] ?? 0;
            totalCourses += 1;
            totalEmployed += getPreferredEmploymentCount(course);

            if (isCurrentYearStart) {
              currentYearCoursesCount += 1;
              currentYearStudents += course['수강신청 인원'] ?? 0;
              currentYearCompletedStudents += course['수료인원'] ?? 0;
            } else if (isPrevYearStartAndOngoing) {
              prevYearCoursesCount += 1;
              prevYearStudents += course['수강신청 인원'] ?? 0;
              prevYearCompletedStudents += course['수료인원'] ?? 0;
            }
          }
          // 훈련기관은 학생수/수료인원/과정수 0
        } else {
          // 일반 과정: 훈련기관이 100% 담당
          if (courseInstitutionGroup === institutionName) {
            totalStudents += course['수강신청 인원'] ?? 0;
            completedStudents += course['수료인원'] ?? 0;
            totalCourses += 1;
            totalEmployed += getPreferredEmploymentCount(course);

            if (isCurrentYearStart) {
              currentYearCoursesCount += 1;
              currentYearStudents += course['수강신청 인원'] ?? 0;
              currentYearCompletedStudents += course['수료인원'] ?? 0;
            } else if (isPrevYearStartAndOngoing) {
              prevYearCoursesCount += 1;
              prevYearStudents += course['수강신청 인원'] ?? 0;
              prevYearCompletedStudents += course['수료인원'] ?? 0;
            }
          }
        }
      }
    });

    // 수료율 계산 (수료인원이 0명인 과정은 제외하고 계산)
    let totalValidStudentsForCompletion = 0;
    let totalValidGraduatesForCompletion = 0;
    detailed.courses.forEach((course: CourseData) => {
      const courseInstitutionGroup = groupInstitutionsAdvanced(course);
      const coursePartnerGroup = course.leadingCompanyPartnerInstitution ? groupInstitutionsAdvanced({ ...course, 훈련기관: course.leadingCompanyPartnerInstitution }) : undefined;

      if ((course.수료인원 ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
          if (coursePartnerGroup === institutionName) { // 타입 오류 해결을 위해 비교 로직은 그대로 유지
            totalValidStudentsForCompletion += course['수강신청 인원'] ?? 0;
            totalValidGraduatesForCompletion += course['수료인원'] ?? 0;
          }
        } else {
          if (courseInstitutionGroup === institutionName) { // 타입 오류 해결을 위해 비교 로직은 그대로 유지
            totalValidStudentsForCompletion += course['수강신청 인원'] ?? 0;
            totalValidGraduatesForCompletion += course['수료인원'] ?? 0;
          }
        }
      }
    });
    const completionRate = totalValidStudentsForCompletion > 0 ? (totalValidGraduatesForCompletion / totalValidStudentsForCompletion) * 100 : 0;
    const employmentRate = totalValidGraduatesForCompletion > 0 ? (totalEmployed / totalValidGraduatesForCompletion) * 100 : 0;

    // 평균 만족도 계산
    let totalWeightedSatisfaction = 0;
    let totalWeightSatisfaction = 0;
    detailed.courses.forEach((course: CourseData) => {
      const courseInstitutionGroup = groupInstitutionsAdvanced(course);
      const coursePartnerGroup = course.leadingCompanyPartnerInstitution ? groupInstitutionsAdvanced({ ...course, 훈련기관: course.leadingCompanyPartnerInstitution }) : undefined;

      if (course.만족도 && course.만족도 > 0 && course['수료인원'] > 0) {
        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
          if (coursePartnerGroup === institutionName) { // 타입 오류 해결을 위해 비교 로직은 그대로 유지
            totalWeightedSatisfaction += (course.만족도 ?? 0) * (course['수료인원'] ?? 0);
            totalWeightSatisfaction += course['수료인원'] ?? 0;
          }
        } else {
          if (courseInstitutionGroup === institutionName) { // 타입 오류 해결을 위해 비교 로직은 그대로 유지
            totalWeightedSatisfaction += (course.만족도 ?? 0) * (course['수료인원'] ?? 0);
            totalWeightSatisfaction += course['수료인원'] ?? 0;
          }
        }
      }
    });
    const avgSatisfaction = totalWeightSatisfaction > 0 ? totalWeightedSatisfaction / totalWeightSatisfaction : 0;

    result.push({
      institutionName,
      totalRevenue: totalRevenue ?? 0,
      totalCourses: `${currentYearCoursesCount}(${prevYearCoursesCount})`, // X(Y) 형식으로 변경
      totalStudents: `${currentYearStudents}(${prevYearStudents})`, // X(Y) 형식으로 변경
      completedStudents: `${currentYearCompletedStudents}(${prevYearCompletedStudents})`, // X(Y) 형식으로 변경
      totalEmployed: typeof totalEmployed === 'number' && !isNaN(totalEmployed) ? totalEmployed : 0,
      completionRate: typeof completionRate === 'number' && !isNaN(completionRate) ? completionRate : 0,
      employmentRate: typeof employmentRate === 'number' && !isNaN(employmentRate) ? employmentRate : 0,
      avgSatisfaction: typeof avgSatisfaction === 'number' && !isNaN(avgSatisfaction) ? avgSatisfaction : 0,
      courses: detailed.courses, // detailed.courses는 이미 필터링된 과정 목록
      prevYearStudents: prevYearStudents,
      prevYearCompletedStudents: prevYearCompletedStudents,
      currentYearCoursesCount: currentYearCoursesCount,
      prevYearCoursesCount: prevYearCoursesCount,
      currentYearStudents: currentYearStudents,
      currentYearCompletedStudents: currentYearCompletedStudents,
    });
  });

  // 매출액 기준 내림차순 정렬
  return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
};


// calculateInstitutionDetailedRevenue 함수 추가
export const calculateInstitutionDetailedRevenue = (
  allCourses: CourseData[],
  institutionName: string,
  year?: number
): { courses: CourseData[]; totalRevenue: number } => {
  let totalRevenue = 0;
  const coursesForInstitution: CourseData[] = [];

  allCourses.forEach(course => {
    const courseInstitutionGroup = groupInstitutionsAdvanced(course);
    const coursePartnerGroup = course.leadingCompanyPartnerInstitution ? groupInstitutionsAdvanced({ ...course, 훈련기관: course.leadingCompanyPartnerInstitution }) : undefined;

    let revenueShare = 0;

    if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
      // 선도기업 과정: 파트너기관과 훈련기관이 같으면 100% 흡수, 아니면 파트너기관 90%, 훈련기관 10%
      if (courseInstitutionGroup === institutionName && courseInstitutionGroup === coursePartnerGroup) {
        revenueShare = 1.0; // 훈련기관과 파트너기관이 같으면 훈련기관이 100% 흡수
      } else if (coursePartnerGroup === institutionName) {
        revenueShare = 0.9;
      } else if (courseInstitutionGroup === institutionName) {
        revenueShare = 0.1;
      }
    } else {
      // 일반 과정: 훈련기관이 100%
      if (courseInstitutionGroup === institutionName) {
        revenueShare = 1.0;
      }
    }

    if (revenueShare > 0) {
      const courseRevenue = computeCourseRevenue(course, year) * revenueShare;
      totalRevenue += courseRevenue;
      coursesForInstitution.push({ ...course, 총누적매출: courseRevenue }); // 매출을 할당하여 반환
    }
  });

  return { courses: coursesForInstitution, totalRevenue };
};

// aggregateCoursesByCourseIdWithLatestInfo 함수 추가
export const aggregateCoursesByCourseIdWithLatestInfo = (
  courses: CourseData[],
  year?: number,
  institutionName?: string // 기관명 추가
): AggregatedCourseData[] => {
  const map = new Map<string, AggregatedCourseData>();

  // 훈련과정ID별로 최신 과정명 찾기
  const latestCourseNames = new Map<string, string>();
  courses.forEach(course => {
    if (course['훈련과정 ID']) {
      const existing = latestCourseNames.get(course['훈련과정 ID']);
      if (!existing || new Date(course.과정시작일) > new Date(existing)) {
        latestCourseNames.set(course['훈련과정 ID'], course.과정명);
      }
    }
  });

  // === year가 지정된 경우 해당 연도에 진행 중인 모든 과정 합산 ===
  const filteredCourses = year !== undefined
    ? courses.filter(c => {
        const startDate = new Date(c.과정시작일);
        const endDate = new Date(c.과정종료일);
        // 해당 연도에 시작했거나, 이전 연도에 시작하여 해당 연도에 진행 중인 과정
        return startDate.getFullYear() === year || 
               (startDate.getFullYear() < year && endDate.getFullYear() >= year);
      })
    : courses;

  filteredCourses.forEach(course => {
    let revenueShare = 1;
    let studentShare = 1; // studentShare를 여기서 정의

    if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
      const originalInstitutionName = course.원본훈련기관 || course.훈련기관;
      const isTrainingInstitutionInGroup = groupInstitutionsAdvanced({ ...course, 훈련기관: originalInstitutionName }) === institutionName;
      const isPartnerInstitutionInGroup = groupInstitutionsAdvanced({ ...course, 훈련기관: course.leadingCompanyPartnerInstitution }) === institutionName;

      // 선도기업 과정: 파트너기관과 훈련기관이 같으면 100% 흡수, 아니면 파트너기관 90%, 훈련기관 10%
      if (isTrainingInstitutionInGroup && isPartnerInstitutionInGroup) { // 훈련기관과 파트너기관이 같고, 현재 기관이 그 기관인 경우
        revenueShare = 1.0;
        studentShare = 1;
      } else if (isPartnerInstitutionInGroup) {
        revenueShare = 0.9;
        studentShare = 1;
      } else if (isTrainingInstitutionInGroup) {
        revenueShare = 0.1;
        studentShare = 0; // 훈련기관이 10%를 가져갈 때 학생 수는 0으로 설정
      }
    } else {
      // 일반 과정: 훈련기관이 100%
      if (groupInstitutionsAdvanced(course) === institutionName) {
        revenueShare = 1.0;
        studentShare = 1;
      }
    }

    const key = course['훈련과정 ID'] || course.과정명;
    if (!map.has(key)) {
      map.set(key, {
        과정명: latestCourseNames.get(course['훈련과정 ID'] || '') || course.과정명,
        '훈련과정 ID': course['훈련과정 ID'],
        총수강신청인원: 0,
        총수료인원: 0,
        총취업인원: 0,
        총누적매출: 0,
        최소과정시작일: course.과정시작일,
        최대과정종료일: course.과정종료일,
        훈련유형들: [],
        원천과정수: 0,
        총훈련생수: 0,
        평균만족도: 0,
        평균수료율: 0,
        평균취업율: 0,
        총정원: 0,
        연도정원: 0,
        연도훈련생수: 0,
        개강회차수: 0,
        과거년도개강회차수: 0,
        현재년도수강신청인원: 0,
        과거년도수강신청인원: 0,
        현재년도수료인원: 0,
        과거년도수료인원: 0,
      });
    }

    const agg = map.get(key)!;

    // 매출 분배 로직 (calculateInstitutionDetailedRevenue와 유사하게)
    const courseRevenue = computeCourseRevenue(course, year) * revenueShare;
    agg.총누적매출 += courseRevenue;

    // 학생수, 수료인원, 취업인원, 과정수 등 집계 (studentShare 적용)
    agg.총수강신청인원 += (course['수강신청 인원'] ?? 0) * studentShare;
    agg.총수료인원 += (course['수료인원'] ?? 0) * studentShare;
    agg.총취업인원 += getPreferredEmploymentCount(course) * studentShare;
    agg.원천과정수 += studentShare > 0 ? 1 : 0; // 학생 수가 0이 아니면 과정 수에 포함
    agg.총훈련생수 += (course['수강신청 인원'] ?? 0) * studentShare;
    agg.총정원 = (agg.총정원 ?? 0) + (course.정원 ?? 0) * studentShare;

    // 개강회차수, 훈련생 수, 수료인원 X(Y) 표기 로직
    const courseStartDate = new Date(course.과정시작일);
    const courseEndDate = new Date(course.과정종료일);
    const currentYear = year || new Date().getFullYear();

    const isCurrentYearStart = courseStartDate.getFullYear() === currentYear;
    const isPrevYearStartAndOngoing = courseStartDate.getFullYear() < currentYear && courseEndDate.getFullYear() >= currentYear;
    const isCurrentYearEnd = courseEndDate.getFullYear() === currentYear;

    // 훈련생 수: 해당 연도에 진행 중인 모든 과정의 수강신청 인원
    if (isCurrentYearStart || isPrevYearStartAndOngoing) {
      if (isCurrentYearStart) {
        agg.개강회차수 = (agg.개강회차수 ?? 0) + (studentShare > 0 ? 1 : 0);
        agg.현재년도수강신청인원 = (agg.현재년도수강신청인원 ?? 0) + (course['수강신청 인원'] ?? 0) * studentShare;
      } else {
        agg.과거년도개강회차수 = (agg.과거년도개강회차수 ?? 0) + (studentShare > 0 ? 1 : 0);
        agg.과거년도수강신청인원 = (agg.과거년도수강신청인원 ?? 0) + (course['수강신청 인원'] ?? 0) * studentShare;
      }
    }

    // 수료/취업 집계: 해당 연도에 종료된 과정만 (수료인원이 0명인 과정은 제외)
    if (isCurrentYearEnd && (course['수료인원'] ?? 0) > 0) {
      if (isCurrentYearStart) {
        // 수료인원
        agg.현재년도수료인원 = (agg.현재년도수료인원 ?? 0) + (course['수료인원'] ?? 0) * studentShare;
        // 종료 회차 기준 수료율 계산용 분모(수강신청 인원)
        agg.현재년도수료과정_수강신청인원 = (agg.현재년도수료과정_수강신청인원 ?? 0) + (course['수강신청 인원'] ?? 0) * studentShare;
        // 취업인원
        agg.현재년도취업인원 = (agg.현재년도취업인원 ?? 0) + getPreferredEmploymentCount(course) * studentShare;
      } else {
        agg.과거년도수료인원 = (agg.과거년도수료인원 ?? 0) + (course['수료인원'] ?? 0) * studentShare;
        agg.과거년도수료과정_수강신청인원 = (agg.과거년도수료과정_수강신청인원 ?? 0) + (course['수강신청 인원'] ?? 0) * studentShare;
        agg.과거년도취업인원 = (agg.과거년도취업인원 ?? 0) + getPreferredEmploymentCount(course) * studentShare;
      }
    }

    // 연도별 정원 및 훈련생 수 (모집률 계산용)
    if (year !== undefined) {
      const isCurrentYearStart = new Date(course.과정시작일).getFullYear() === year;
      const isPrevYearStartAndOngoing = new Date(course.과정시작일).getFullYear() < year && new Date(course.과정종료일).getFullYear() >= year;
      if (isCurrentYearStart) {
        agg.연도정원 = (agg.연도정원 ?? 0) + (course.정원 ?? 0) * studentShare; // X
        agg.연도훈련생수 = (agg.연도훈련생수 ?? 0) + (course['수강신청 인원'] ?? 0) * studentShare; // X
      } else if (isPrevYearStartAndOngoing) {
        agg.과거년도정원 = (agg.과거년도정원 ?? 0) + (course.정원 ?? 0) * studentShare; // Y
      }
    }

    // 훈련 유형
    if (course.훈련유형 && !agg.훈련유형들.includes(course.훈련유형)) {
      agg.훈련유형들.push(course.훈련유형);
    }

    // 날짜 업데이트
    if (new Date(course.과정시작일) < new Date(agg.최소과정시작일)) {
      agg.최소과정시작일 = course.과정시작일;
    }
    if (new Date(course.과정종료일) > new Date(agg.최대과정종료일)) {
      agg.최대과정종료일 = course.과정종료일;
    }

    // 평균 만족도 및 수료율 (재계산 필요)
    const internal = agg as any;
    if (internal._completionEnrollmentSum === undefined) {
      internal._completionEnrollmentSum = 0;
      internal._completionSum = 0;
      internal._completionWeight = 0; // 수료율 가중치 추가
      internal._satSum = 0;
      internal._satWeight = 0;
    }

    // 수료율과 취업율은 해당 연도에 종료된 과정들만 고려
    if (isCurrentYearEnd && (course['수료인원'] ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
      internal._completionEnrollmentSum += (course['수강신청 인원'] ?? 0) * studentShare;
      internal._completionSum += (course['수료인원'] ?? 0) * studentShare;
      internal._completionWeight += studentShare > 0 ? 1 : 0;
    }

    // 만족도는 해당 연도에 종료된 과정들만 고려 (수료인원이 0명인 과정은 제외)
    if (isCurrentYearEnd && (course['수료인원'] ?? 0) > 0 && course.만족도 && course.만족도 > 0) {
      internal._satSum += (course.만족도 ?? 0) * studentShare;
      internal._satWeight += studentShare > 0 ? 1 : 0;
    }
  });

  // 최종 평균 계산 및 연도별 인원 표시
  map.forEach(agg => {
    const internal = agg as any;
    agg.평균만족도 = internal._satWeight > 0 ? internal._satSum / internal._satWeight : 0;
    agg.평균수료율 = internal._completionEnrollmentSum > 0 ? (internal._completionSum / internal._completionEnrollmentSum) * 100 : 0;
    agg.평균취업율 = agg.총수료인원 > 0 ? (agg.총취업인원 / agg.총수료인원) * 100 : 0;
    
    // 연도별 인원 표시 (x(y) 형식)
    if (year !== undefined) {
      const currentYearStudents = agg.현재년도수강신청인원 ?? 0;
      const prevYearStudents = agg.과거년도수강신청인원 ?? 0;
      agg.studentsStr = prevYearStudents > 0 
        ? `${formatNumber(currentYearStudents)}(${formatNumber(prevYearStudents)})`
        : formatNumber(currentYearStudents);
      
      const currentYearGraduates = agg.현재년도수료인원 ?? 0;
      const prevYearGraduates = agg.과거년도수료인원 ?? 0;
      agg.graduatesStr = prevYearGraduates > 0
        ? `${formatNumber(currentYearGraduates)}(${formatNumber(prevYearGraduates)})`
        : formatNumber(currentYearGraduates);
      
      // 개강 회차수도 연도별로 표시
      const currentYearCount = agg.개강회차수 ?? 0;
      const prevYearCount = agg.과거년도개강회차수 ?? 0;
      agg.openCountStr = prevYearCount > 0
        ? `${currentYearCount}(${prevYearCount})`
        : `${currentYearCount}`;
    } else {
      agg.studentsStr = formatNumber(agg.총수강신청인원);
      agg.graduatesStr = formatNumber(agg.총수료인원);
      agg.openCountStr = `${agg.원천과정수}`;
    }
  });

  return Array.from(map.values()).sort((a, b) => b.총누적매출 - a.총누적매출);
};

// 그룹화된 기관명에 속하는 개별 기관들을 반환하는 함수
export const getIndividualInstitutionsInGroup = (
  data: CourseData[],
  groupName: string,
  year?: number
): InstitutionStat[] => {
  // 해당 그룹에 속하는 개별 기관들을 찾기
  const individualInstitutions = new Set<string>();
  
  data.forEach(course => {
    const courseInstitutionGroup = groupInstitutionsAdvanced(course);
    if (courseInstitutionGroup === groupName) {
      individualInstitutions.add(course.훈련기관);
    }
    if (course.leadingCompanyPartnerInstitution) {
      const partnerGroup = groupInstitutionsAdvanced({ ...course, 훈련기관: course.leadingCompanyPartnerInstitution });
      if (partnerGroup === groupName) {
        individualInstitutions.add(course.leadingCompanyPartnerInstitution);
      }
    }
  });

  // 각 개별 기관에 대해 통계 계산
  const result: InstitutionStat[] = [];
  
  individualInstitutions.forEach(institutionName => {
    // 해당 기관의 과정들만 필터링
    const institutionCourses = data.filter(course => {
      const isTrainingInstitution = course.훈련기관 === institutionName;
      const isPartnerInstitution = course.leadingCompanyPartnerInstitution === institutionName;
      return isTrainingInstitution || isPartnerInstitution;
    });

    if (institutionCourses.length === 0) return;

    // 연도별 필터링
    let filteredCourses = institutionCourses;
    if (year !== undefined) {
      filteredCourses = institutionCourses.filter(course => {
        const courseStartDate = new Date(course.과정시작일);
        const courseEndDate = new Date(course.과정종료일);
        return courseStartDate.getFullYear() === year || 
               (courseStartDate.getFullYear() < year && courseEndDate.getFullYear() >= year);
      });
    }

    if (filteredCourses.length === 0) return;

    // 통계 계산
    const totalStudents = filteredCourses.reduce((sum, course) => sum + (course['수강신청 인원'] ?? 0), 0);
    const totalGraduates = filteredCourses.reduce((sum, course) => sum + (course['수료인원'] ?? 0), 0);
    const totalEmployed = filteredCourses.reduce((sum, course) => sum + getPreferredEmploymentCount(course), 0);
    const totalRevenue = filteredCourses.reduce((sum, course) => {
      const revenue = course.조정_누적매출 ?? course.누적매출 ?? 0;
      return sum + revenue;
    }, 0);

    // 수료율 계산
    const validCourses = filteredCourses.filter(course => 
      (course['수강신청 인원'] ?? 0) > 0 && (course['수료인원'] ?? 0) > 0
    );
    const validStudents = validCourses.reduce((sum, course) => sum + (course['수강신청 인원'] ?? 0), 0);
    const validGraduates = validCourses.reduce((sum, course) => sum + (course['수료인원'] ?? 0), 0);
    const completionRate = validStudents > 0 ? (validGraduates / validStudents) * 100 : 0;

    // 취업율 계산
    const employmentRate = totalGraduates > 0 ? (totalEmployed / totalGraduates) * 100 : 0;

    // 만족도 계산
    const satisfactionCourses = filteredCourses.filter(course => course.만족도 && course.만족도 > 0);
    const totalSatisfaction = satisfactionCourses.reduce((sum, course) => 
      sum + (course.만족도 ?? 0) * (course['수료인원'] ?? 0), 0
    );
    const totalSatisfactionWeight = satisfactionCourses.reduce((sum, course) => 
      sum + (course['수료인원'] ?? 0), 0
    );
    const avgSatisfaction = totalSatisfactionWeight > 0 ? totalSatisfaction / totalSatisfactionWeight : 0;

    result.push({
      institutionName,
      totalRevenue,
      totalCourses: filteredCourses.length.toString(),
      totalStudents: totalStudents.toString(),
      completedStudents: totalGraduates.toString(),
      totalEmployed,
      completionRate,
      employmentRate,
      avgSatisfaction,
      courses: filteredCourses,
      prevYearStudents: 0,
      prevYearCompletedStudents: 0,
      currentYearCoursesCount: filteredCourses.length,
      prevYearCoursesCount: 0,
      currentYearStudents: totalStudents,
      currentYearCompletedStudents: totalGraduates
    });
  });

  return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
};