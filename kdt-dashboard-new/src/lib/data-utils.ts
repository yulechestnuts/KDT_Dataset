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
  총누적매출: number;
  최소과정시작일: string;
  최대과정종료일: string;
  훈련유형들: string[];
  원천과정수: number; // 집계된 과정의 개수
  총훈련생수: number;
  평균만족도: number;
  평균수료율: number;
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
  // 이전 연도 시작 과정 정보 추가
  prevYearStudents: number;
  prevYearCompletedStudents: number;
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

  // 선도기업 과정 여부 판단
  const isLeadingCompany = (String(rawData.파트너기관 || '').trim() !== '' && String(rawData.파트너기관 || '').trim() !== '0') &&
                           (String(rawData.선도기업 || '').trim() !== '' && String(rawData.선도기업 || '').trim() !== '0');

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
    leadingCompanyPartnerInstitution: isLeadingCompany ? (rawData.파트너기관 || rawData['파트너기관'] || '') : undefined,
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

// 수료율에 따른 매출액 보정 계수 계산 함수
function calculateRevenueAdjustmentFactor(completionRate: number): number {
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
  
  console.log('[선형보정 DEBUG]', {
    수료율: completionRate,
    보정계수: factor
  });
  
  return factor;
}

export const calculateInstitutionStats = (data: CourseData[], year?: number): InstitutionStat[] => {
  // 그룹명 기준으로 institutionNames 추출 (중복 제거)
  const institutionNames = Array.from(new Set(data.map(course => groupInstitutionsAdvanced(course))));
  const result: InstitutionStat[] = [];

  institutionNames.forEach(institutionName => {
    // 그룹명 기준으로 row를 모두 모음
    const groupedCourses = data.filter(course => groupInstitutionsAdvanced(course) === institutionName);
    // 상세보기와 동일하게 기관별 상세 매출 데이터 추출 (전체 데이터에서)
    const detailed = calculateInstitutionDetailedRevenue(data, institutionName, year);
    const aggregated = aggregateCoursesByCourseIdWithLatestInfo(detailed.courses, year, institutionName);
    const totalRevenue = aggregated.reduce((sum, course) => sum + course.총누적매출, 0);
    // 파트너기관이 대체한 운영기관(선도기업 과정에서 훈련기관이지만 파트너기관이 존재하는 경우)은 훈련생수/수료인원/과정수 집계에서 제외
    const validForCount = detailed.courses.filter(course => {
      const isLeadingWithPartner = course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution;
      if (isLeadingWithPartner && (course.원본훈련기관 || course.훈련기관) === institutionName) return false;
      return true;
    });
    const totalStudents = validForCount.reduce((sum, course) => sum + (course['수강신청 인원'] ?? 0), 0);
    const completedStudents = validForCount.reduce((sum, course) => sum + (course['수료인원'] ?? 0), 0);
    const totalCourses = validForCount.length;
    // 수료인원이 0명인 과정은 제외하고 계산
    const validCompletion = detailed.courses.filter(course => {
      const isLeadingWithPartner = course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution;
      if (isLeadingWithPartner && (course.원본훈련기관 || course.훈련기관) === institutionName) return false;
      return course['수료인원'] > 0 && course['수강신청 인원'] > 0;
    });
    const totalValidStudents = validCompletion.reduce((sum, course) => sum + (course['수강신청 인원'] ?? 0), 0);
    const totalValidGraduates = validCompletion.reduce((sum, course) => sum + (course['수료인원'] ?? 0), 0);
    const completionRate = totalValidStudents > 0 ? (totalValidGraduates / totalValidStudents) * 100 : 0;
    // 평균 만족도: 0이 아닌 과정, 수료인원 1명 이상, 파트너기관이 대체한 운영기관은 제외
    const validSatisfaction = detailed.courses.filter(course => {
      const isLeadingWithPartner = course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution;
      if (isLeadingWithPartner && (course.원본훈련기관 || course.훈련기관) === institutionName) return false;
      return course.만족도 && course.만족도 > 0 && course['수료인원'] > 0;
    });
    const totalWeighted = validSatisfaction.reduce((sum, course) => sum + (course.만족도 ?? 0) * (course['수료인원'] ?? 0), 0);
    const totalWeight = validSatisfaction.reduce((sum, course) => sum + (course['수료인원'] ?? 0), 0);
    const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
    // 이전 연도 시작 과정 정보 계산 (기존 방식 유지)
    let prevYearStudents = 0;
    let prevYearCompletedStudents = 0;
    if (year !== undefined) {
      const prevYearCourses = groupedCourses.filter(course => {
        const courseInstitution = course.원본훈련기관 || course.훈련기관;
        const coursePartner = course.leadingCompanyPartnerInstitution;
        const isTrainingInstitution = courseInstitution === institutionName;
        const isPartnerInstitution = coursePartner === institutionName;
        return (isTrainingInstitution || isPartnerInstitution) &&
               new Date(course.과정시작일).getFullYear() < year &&
               new Date(course.과정종료일).getFullYear() === year;
      });
      prevYearCourses.forEach(course => {
        let studentCount = course['수강신청 인원'] ?? 0;
        let completedCount = course.수료인원 ?? 0;
        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
          const courseInstitution = course.원본훈련기관 || course.훈련기관;
          if (courseInstitution === institutionName) {
            studentCount = 0;
            completedCount = 0;
          }
        }
        prevYearStudents += studentCount;
        prevYearCompletedStudents += completedCount;
      });
    }
    result.push({
      institutionName,
      totalRevenue,
      totalCourses,
      totalStudents,
      completedStudents,
      completionRate,
      avgSatisfaction,
      courses: detailed.courses,
      prevYearStudents,
      prevYearCompletedStudents
    });
  });

  // 매출액 기준 내림차순 정렬
  return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

// === Helper: Compute course revenue with the same rules used in calculateInstitutionStats ===
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
      baseRevenue = course.조정_실매출대비;
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

// === Aggregator for detail modal (share-aware) ===
export const aggregateCoursesByCourseNameForInstitution = (
  courses: CourseData[],
  institutionName: string,
  year?: number,
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

  // === year가 지정된 경우 해당 연도 시작 과정만 합산 ===
  const filteredCourses = year !== undefined
    ? courses.filter(c => new Date(c.과정시작일).getFullYear() === year)
    : courses;

  filteredCourses.forEach(course => {
    let revenueShare = 1;
    let studentShare = 1;
    if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
      if (institutionName === course.leadingCompanyPartnerInstitution) {
        revenueShare = 0.9;
        studentShare = 1;
      } else if (institutionName === course.훈련기관) {
        revenueShare = 0.1;
        studentShare = 0; // 선도기업은 훈련생 수 없음
      } else {
        revenueShare = 0;
        studentShare = 0;
      }
    }
    if (revenueShare === 0 && studentShare === 0) return;

    // 실제 매출 값
    const revenueBase =
      (typeof course['조정_실매출대비'] === 'number' && course['조정_실매출대비']! > 0)
        ? course['조정_실매출대비'] as number
        : (typeof course['실 매출 대비'] === 'number' ? course['실 매출 대비'] as number : 0);
    const revenue = revenueBase * revenueShare;

    const key = course.과정명;
    if (!map.has(key)) {
      map.set(key, {
        과정명: key,
        총수강신청인원: 0,
        총수료인원: 0,
        총누적매출: 0,
        최소과정시작일: course.과정시작일,
        최대과정종료일: course.과정종료일,
        훈련유형들: [],
        원천과정수: 0,
        총훈련생수: 0,
        평균만족도: 0,
        평균수료율: 0, // 초기화
      });
    }

    const agg = map.get(key)!;

    // 수료율 및 만족도 계산을 위한 임시 변수
    const internal = agg as any;
    if (internal._completionEnrollmentSum === undefined) {
      internal._completionEnrollmentSum = 0;
      internal._completionSum = 0;
      internal._completionWeight = 0; // 수료율 가중치 추가
      internal._satSum = 0;
      internal._satWeight = 0;
    }

    // 수료인원이 0이 아닌 경우에만 수료율 계산 모수에 포함
    if ((course['수료인원'] ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
      internal._completionEnrollmentSum += course['수강신청 인원'] ?? 0;
      internal._completionSum += course['수료인원'] ?? 0;
      internal._completionWeight += 1;
    }

    // 만족도 평균 (만족도가 0이 아닌 경우에만 모수에 포함)
    if (course.만족도 && course.만족도 > 0) {
      internal._satSum += course.만족도;
      internal._satWeight += 1;
    }

    // === year가 지정된 경우 해당 연도 시작 과정만 집계 ===
    agg.총수강신청인원 += course['수강신청 인원'];
    agg.총수료인원 += course['수료인원'];
    const revenueForSum =
      course.조정_실매출대비 ??
      (course.누적매출 ?? 0);
    agg.총누적매출 += revenueForSum;
    agg.총훈련생수 += course['수강신청 인원'];
    agg.원천과정수 += 1;

    // 최종 평균 계산
    agg.평균만족도 = internal._satWeight > 0 ? internal._satSum / internal._satWeight : 0;
    agg.평균수료율 = internal._completionWeight > 0 ? (internal._completionSum / internal._completionEnrollmentSum) * 100 : 0;

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
  });

  return Array.from(map.values()).sort((a, b) => b.총누적매출 - a.총누적매출);
};

// NCS별 통계 계산
export const calculateNcsStats = (data: CourseData[], year?: number): NcsStat[] => {
  const map = new Map<string, {
    totalRevenue: number;
    totalCourses: number;
    totalStudents: number;
    completedStudents: number;
    satisfactionSum: number;
    satisfactionCoursesCount: number;
    courses: CourseData[];
    prevYearStudents: number;
    prevYearCompletedStudents: number;
  }>();

  data.forEach(course => {
    const key = course.NCS명 || '기타';
    if (!map.has(key)) {
      map.set(key, {
        totalRevenue: 0,
        totalCourses: 0,
        totalStudents: 0,
        completedStudents: 0,
        satisfactionSum: 0,
        satisfactionCoursesCount: 0,
        courses: [],
        prevYearStudents: 0,
        prevYearCompletedStudents: 0
      });
    }
    const stat = map.get(key)!;

    // 매출 계산
    let revenue = 0;
    if (year !== undefined) {
      const yearKey = `조정_${year}년` as keyof CourseData;
      revenue = (course[yearKey] as number | undefined) ?? 0;
    } else {
      revenue = course.조정_누적매출 ?? course.누적매출 ?? 0;
    }
    stat.totalRevenue += revenue;

    // === 통계는 '과정 시작 연도' 기준으로만 합산 ===
    const courseStartYear = new Date(course.과정시작일).getFullYear();
    const courseEndYear = new Date(course.과정종료일).getFullYear();
    
    if (year === undefined || courseStartYear === year) {
      stat.totalStudents += course['수강신청 인원'] ?? 0;
      stat.completedStudents += course['수료인원'] ?? 0;
      if ((course.만족도 ?? 0) > 0) {
        stat.satisfactionSum += course.만족도 ?? 0;
        stat.satisfactionCoursesCount += 1;
      }
      stat.totalCourses += 1;
    } else if (year !== undefined && courseStartYear < year && courseEndYear === year) {
      // 이전 연도에 시작해서 해당 연도에 종료된 과정
      stat.prevYearStudents += course['수강신청 인원'] ?? 0;
      stat.prevYearCompletedStudents += course['수료인원'] ?? 0;
    }
    stat.courses.push(course);
  });

  const result: NcsStat[] = Array.from(map.entries()).map(([name, stats]) => {
    const {
      totalRevenue, totalCourses, totalStudents, completedStudents,
      satisfactionSum, satisfactionCoursesCount, courses,
      prevYearStudents, prevYearCompletedStudents
    } = stats;

    // === 수료율 계산: 해당 연도 시작 과정 + 이전 연도 시작하여 해당 연도 종료된 과정 ===
    let validCompletedStudents = 0;
    let validTotalStudents = 0;
    if (year !== undefined) {
      courses.forEach(course => {
        const courseStartYear = new Date(course.과정시작일).getFullYear();
        const courseEndYear = new Date(course.과정종료일).getFullYear();
        
        // 해당 연도에 시작한 과정이거나 이전 연도에 시작해서 해당 연도에 종료된 과정
        if ((courseStartYear === year || (courseStartYear < year && courseEndYear === year)) &&
            (course.수료인원 ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
          validCompletedStudents += course.수료인원;
          validTotalStudents += course['수강신청 인원'];
        }
      });
    } else {
      courses.forEach(course => {
        if ((course.수료인원 ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
          validCompletedStudents += course.수료인원;
          validTotalStudents += course['수강신청 인원'];
        }
      });
    }
    const completionRate = validTotalStudents > 0 ? (validCompletedStudents / validTotalStudents) * 100 : 0;

    return {
      ncsName: name,
      totalRevenue,
      totalCourses,
      totalStudents,
      completedStudents,
      completionRate,
      avgSatisfaction: satisfactionCoursesCount > 0 ? satisfactionSum / satisfactionCoursesCount : 0,
      courses,
      prevYearStudents,
      prevYearCompletedStudents
    };
  });

  return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

// NCS별 상세 모달용 Aggregator (과정명 기준)
export const aggregateCoursesByCourseNameForNcs = (
  courses: CourseData[],
  ncsName: string,
  year?: number,
): AggregatedCourseData[] => {
  const filtered = courses.filter(c => (c.NCS명 || '기타') === ncsName && (year ? new Date(c.과정시작일).getFullYear() === year : true));
  return aggregateCoursesByCourseName(filtered);
};

// === Aggregator using 실제 매출(실 매출 대비) ===
export const aggregateCoursesByCourseNameActualRevenue = (
  courses: CourseData[],
  institutionName: string,
): AggregatedCourseData[] => {
  const map = new Map<string, AggregatedCourseData>();

  // 훈련과정ID별로 최신 과정명 찾기
  const latestCourseNames = new Map<string, string>();
  courses.forEach(course => {
    if (course.훈련과정ID) {
      const existing = latestCourseNames.get(course.훈련과정ID);
      if (!existing || new Date(course.과정시작일) > new Date(existing)) {
        latestCourseNames.set(course.훈련과정ID, course.과정명);
      }
    }
  });

  courses.forEach(course => {
    // 지분 계산 (매출 90/10, 학생 100/0)
    let revenueShare = 1;
    let studentShare = 1;
    if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
      if (institutionName === course.leadingCompanyPartnerInstitution) {
        revenueShare = 0.9;
        studentShare = 1;
      } else if (institutionName === course.훈련기관) {
        revenueShare = 0.1;
        studentShare = 0; // 선도기업은 학생 수 없음
      } else {
        revenueShare = 0;
        studentShare = 0;
      }
    }
    if (revenueShare === 0 && studentShare === 0) return;

    // 공통적으로 계산한 단일 매출값 (일할/수료율 보정 포함)
    const revenue = computeCourseRevenue(course) * revenueShare;

    const key = course.훈련과정ID || course.과정명; // 훈련과정ID를 우선 사용, 없으면 과정명 사용
    if (!map.has(key)) {
      // 훈련과정ID가 있는 경우 최신 과정명 사용, 없는 경우 원본 과정명 사용
      const displayName = course.훈련과정ID ? (latestCourseNames.get(course.훈련과정ID) || course.과정명) : course.과정명;
      
      map.set(key, {
        과정명: displayName,
        '훈련과정 ID': course['훈련과정 ID'], // 훈련과정 ID 추가
        총수강신청인원: 0,
        총수료인원: 0,
        총누적매출: 0,
        최소과정시작일: course.과정시작일,
        최대과정종료일: course.과정종료일,
        훈련유형들: [],
        원천과정수: 0,
        총훈련생수: 0,
        평균만족도: 0,
        평균수료율: 0, // 초기화
      });
    }

    const agg = map.get(key)!;

    // 수료율 및 만족도 계산을 위한 임시 변수
    const internal = agg as any;
    if (internal._completionEnrollmentSum === undefined) {
      internal._completionEnrollmentSum = 0;
      internal._completionSum = 0;
      internal._completionWeight = 0; // 수료율 가중치 추가
      internal._satSum = 0;
      internal._satWeight = 0;
    }

    // 수료인원이 0이 아닌 경우에만 수료율 계산 모수에 포함
    if ((course['수료인원'] ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
      internal._completionEnrollmentSum += course['수강신청 인원'] ?? 0;
      internal._completionSum += course['수료인원'] ?? 0;
      internal._completionWeight += 1;
    }

    // 만족도 평균 (만족도가 0이 아닌 경우에만 모수에 포함)
    if (course.만족도 && course.만족도 > 0) {
      internal._satSum += course.만족도;
      internal._satWeight += 1;
    }

    // 기존 로직 유지
    agg.총수강신청인원 += course['수강신청 인원'];
    agg.총수료인원 += course['수료인원'];
    const revenueForSum =
      course.조정_실매출대비 ??
      (course.누적매출 ?? 0);
    agg.총누적매출 += revenueForSum;
    agg.총훈련생수 += course['수강신청 인원'];
    agg.원천과정수 += 1;

    // 최종 평균 계산
    agg.평균만족도 = internal._satWeight > 0 ? internal._satSum / internal._satWeight : 0;
    agg.평균수료율 = internal._completionWeight > 0 ? (internal._completionSum / internal._completionEnrollmentSum) * 100 : 0;

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
  });

  // NOTE: _satSum / _satWeight 내부 키는 반환 이전에 굳이 제거할 필요가 없지만, 타입 안전을 위해 삭제.
  // map.forEach(agg => { delete (agg as any)._satSum; delete (agg as any)._satWeight; });

  return Array.from(map.values()).sort((a, b) => b.총누적매출 - a.총누적매출);
};

// === Leading Company stats ===
export const calculateLeadingCompanyStats = (
  data: CourseData[],
  year?: number,
): LeadingCompanyStat[] => {
  // 필터: 선도기업 과정만
  const filteredAll = data.filter((c) => c.isLeadingCompanyCourse);
  const filtered = year
    ? filteredAll.filter((c) => new Date(c.과정시작일).getFullYear() === year)
    : filteredAll;

  const map = new Map<string, LeadingCompanyStat>();

  filtered.forEach((course) => {
    const key = course.선도기업 || '기타';
    if (!map.has(key)) {
      map.set(key, {
        leadingCompany: key,
        totalRevenue: 0,
        totalCourses: 0,
        totalStudents: 0,
        completedStudents: 0,
        completionRate: 0,
        avgSatisfaction: 0,
        courses: [],
      });
    }
    const stat = map.get(key)!;
    stat.totalRevenue += course.조정_누적매출 ?? course.누적매출 ?? 0;
    stat.totalCourses += 1;
    stat.totalStudents += course['수강신청 인원'] ?? 0;
    stat.completedStudents += course['수료인원'] ?? 0;
    stat.courses.push(course);
    const idx = stat.courses.length;
    stat.avgSatisfaction = ((stat.avgSatisfaction * (idx - 1)) + (course.만족도 || 0)) / idx;
  });

  map.forEach((stat) => {
    stat.completionRate = stat.totalStudents > 0 ? (stat.completedStudents / stat.totalStudents) * 100 : 0;
  });

  return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
};

export const aggregateCoursesByCourseNameForLeadingCompany = (
  courses: CourseData[],
  leadingCompany: string,
  year?: number,
): AggregatedCourseData[] => {
  const filtered = courses.filter(
    (c) => c.isLeadingCompanyCourse && (c.선도기업 || '기타') === leadingCompany && (year ? new Date(c.과정시작일).getFullYear() === year : true),
  );
  return aggregateCoursesByCourseName(filtered);
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
      취업인원: 15,
      취업률: 75,
      '취업인원 (3개월)': 12,
      '취업률 (3개월)': 60,
      '취업인원 (6개월)': 15,
      '취업률 (6개월)': 75,
      훈련연도: 2024,
      훈련유형: "일반",
      NCS명: "테스트",
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
      취업인원: 10,
      취업률: 67,
      '취업인원 (3개월)': 8,
      '취업률 (3개월)': 53,
      '취업인원 (6개월)': 10,
      '취업률 (6개월)': 67,
      훈련연도: 2024,
      훈련유형: "일반",
      NCS명: "테스트",
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
      취업인원: 0,
      취업률: 0,
      '취업인원 (3개월)': 0,
      '취업률 (3개월)': 0,
      '취업인원 (6개월)': 0,
      '취업률 (6개월)': 0,
      훈련연도: 2024,
      훈련유형: "일반",
      NCS명: "테스트",
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

export const aggregateCoursesByCourseName = (courses: CourseData[]): AggregatedCourseData[] => {
  const aggregatedMap = new Map<string, AggregatedCourseData>();

  // 훈련과정ID별로 최신 과정명 찾기
  const latestCourseNames = new Map<string, string>();
  courses.forEach(course => {
    if (course.훈련과정ID) {
      const existing = latestCourseNames.get(course.훈련과정ID);
      if (!existing || new Date(course.과정시작일) > new Date(existing)) {
        latestCourseNames.set(course.훈련과정ID, course.과정명);
      }
    }
  });

  courses.forEach(course => {
    const key = course.훈련과정ID || course.과정명; // 훈련과정ID를 우선 사용, 없으면 과정명 사용
    if (!aggregatedMap.has(key)) {
      // 훈련과정ID가 있는 경우 최신 과정명 사용, 없는 경우 원본 과정명 사용
      const displayName = course.훈련과정ID ? (latestCourseNames.get(course.훈련과정ID) || course.과정명) : course.과정명;
      
      aggregatedMap.set(key, {
        과정명: displayName,
        '훈련과정 ID': course['훈련과정 ID'], // 훈련과정 ID 추가
        총수강신청인원: 0,
        총수료인원: 0,
        총누적매출: 0,
        최소과정시작일: course.과정시작일,
        최대과정종료일: course.과정종료일,
        훈련유형들: [],
        원천과정수: 0,
        총훈련생수: 0,
        평균만족도: 0,
        평균수료율: 0, // 초기화
      });
    }
    const aggregatedCourse = aggregatedMap.get(key)!;

    // 수료율 및 만족도 계산을 위한 임시 변수
    const internal = aggregatedCourse as any;
    if (internal._completionEnrollmentSum === undefined) {
      internal._completionEnrollmentSum = 0;
      internal._completionSum = 0;
      internal._completionWeight = 0;
      internal._satSum = 0;
      internal._satWeight = 0;
    }

    // 수료인원이 0이 아닌 경우에만 수료율 계산 모수에 포함
    if ((course['수료인원'] ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
      internal._completionEnrollmentSum += course['수강신청 인원'] ?? 0;
      internal._completionSum += course['수료인원'] ?? 0;
      internal._completionWeight += 1;
    }

    // 만족도 평균 (만족도가 0이 아닌 경우에만 모수에 포함)
    if (course.만족도 && course.만족도 > 0) {
      internal._satSum += course.만족도;
      internal._satWeight += 1;
    }

    // 기존 로직 유지
    aggregatedCourse.총수강신청인원 += course['수강신청 인원'];
    aggregatedCourse.총수료인원 += course['수료인원'];
    const revenueForSum =
      course.조정_실매출대비 ??
      (course.누적매출 ?? 0);
    aggregatedCourse.총누적매출 += revenueForSum;
    aggregatedCourse.총훈련생수 += course['수강신청 인원'];
    aggregatedCourse.원천과정수 += 1;

    // 최종 평균 계산
    aggregatedCourse.평균만족도 = internal._satWeight > 0 ? internal._satSum / internal._satWeight : 0;
    aggregatedCourse.평균수료율 = internal._completionWeight > 0 ? (internal._completionSum / internal._completionEnrollmentSum) * 100 : 0;

    // 훈련 유형
    if (course.훈련유형 && !aggregatedCourse.훈련유형들.includes(course.훈련유형)) {
      aggregatedCourse.훈련유형들.push(course.훈련유형);
    }

    // 날짜 업데이트
    if (new Date(course.과정시작일) < new Date(aggregatedCourse.최소과정시작일)) {
      aggregatedCourse.최소과정시작일 = course.과정시작일;
    }
    if (new Date(course.과정종료일) > new Date(aggregatedCourse.최대과정종료일)) {
      aggregatedCourse.최대과정종료일 = course.과정종료일;
    }
  });

  return Array.from(aggregatedMap.values()).sort((a, b) => b.총누적매출 - a.총누적매출);
};

// 그룹핑 기준을 외부로 분리
export const institutionGroups: { [key: string]: string[] } = {
  '이젠아카데미': ['이젠', '이젠컴퓨터학원', '이젠아이티아카데미'],
  '그린컴퓨터아카데미': ['그린', '그린컴퓨터아카데미', '그린아카데미컴퓨터학원'],
  '더조은아카데미': ['더조은', '더조은컴퓨터아카데미', '더조은아이티아카데미'],
  '코리아IT아카데미': ['코리아IT', '코리아아이티', 'KIT', '코리아IT아카데미'],
  '비트교육센터': ['비트', '비트캠프', '비트교육센터'],
  '하이미디어': ['하이미디어', '하이미디어아카데미', '하이미디어컴퓨터학원'],
  '아이티윌': ['아이티윌', 'IT WILL', '아이티윌부산교육센터'],
  '메가스터디': ['메가스터디'],
  '에이콘아카데미': ['에이콘', '에이콘아카데미', '에이콘아카데미(강남)'],
  '한국ICT인재개발원': ['ICT'],
  'MBC아카데미 컴퓨터 교육센터': ['MBC아카데미', '(MBC)'],
  '쌍용아카데미': ['쌍용'],
  'KH정보교육원': ['KH'],
  '(주)솔데스크': ['솔데스크강남학원', '(주)솔데스크', '솔데스크']
};

// 훈련기관 그룹화 함수
export function groupInstitutionsAdvanced(course: CourseData): string {
  if (!course.훈련기관) return '';
  const cleanName = course.훈련기관
    .replace(/[^가-힣A-Za-z0-9\s()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  for (const [groupName, keywords] of Object.entries(institutionGroups)) {
    for (const keyword of keywords) {
      if (cleanName.includes(keyword.toUpperCase())) {
        return groupName;
      }
    }
  }
  return course.훈련기관; // 매칭되는 그룹이 없으면 원래 기관명 반환
}

export function aggregateCoursesByCourseIdWithLatestInfo(courses: CourseData[], year?: number, institutionName?: string) {
  const groupMap = new Map<string, CourseData[]>();
  courses.forEach(course => {
    const key = typeof course['훈련과정 ID'] === 'string' ? course['훈련과정 ID'].trim() : '';
    if (!key) return;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(course);
  });

  const result: AggregatedCourseData[] = [];
  groupMap.forEach((group, courseId) => {
    const latest = group.reduce((a, b) => new Date(a.과정시작일) > new Date(b.과정시작일) ? a : b);
    
    // calculateInstitutionStats와 동일한 매출 계산 로직 적용 (선도기업형 훈련 매출 분배 포함)
    const totalRevenue = group.reduce((sum, c) => {
      let revenue = 0;
      if (year !== undefined) {
        // 특정 연도가 선택된 경우 해당 연도의 조정된 매출 사용
        const yearKey = `조정_${year}년` as keyof CourseData;
        revenue = (c[yearKey] as number | undefined) ?? 0;
      } else {
        // 전체 연도의 경우 조정_누적매출 사용
        revenue = c.조정_누적매출 ?? 0;
      }
      
      // 선도기업형 훈련의 매출 분배 적용
      let revenueShare = 1;
      if (c.isLeadingCompanyCourse && c.leadingCompanyPartnerInstitution && institutionName) {
        const originalInstitutionName = c.원본훈련기관 || c.훈련기관;
        // 동일 기관 예외 처리
        if (originalInstitutionName === c.leadingCompanyPartnerInstitution && institutionName === originalInstitutionName) {
          revenueShare = 1.0;
        } else {
          const isTrainingInstitution = originalInstitutionName === institutionName;
          const isPartnerInstitution = c.leadingCompanyPartnerInstitution === institutionName;
          // 그룹명 기준으로도 매칭 시도
          const isTrainingInstitutionInGroup = groupInstitutionsAdvanced({ ...c, 훈련기관: originalInstitutionName }) === institutionName;
          const isPartnerInstitutionInGroup = groupInstitutionsAdvanced({ ...c, 훈련기관: c.leadingCompanyPartnerInstitution }) === institutionName;
          if (isPartnerInstitution || isPartnerInstitutionInGroup) {
            revenueShare = 0.9;
          } else if (isTrainingInstitution || isTrainingInstitutionInGroup) {
            revenueShare = 0.1;
          } else {
            revenueShare = 0;
          }
        }
      }
      
      return sum + (revenue * revenueShare);
    }, 0);
    
    const totalStudents = group.reduce((sum, c) => sum + (c['수강신청 인원'] || 0), 0);
    const totalGraduates = group.reduce((sum, c) => sum + (c.수료인원 || 0), 0);
    const courseCount = group.length;
    
    // 평균수료율을 집계된 전체 과정의 실제 수료율로 계산 (수료인원이 0인 과정 제외)
    const validCourses = group.filter(c => (c.수료인원 ?? 0) > 0 && (c['수강신청 인원'] ?? 0) > 0);
    let averageCompletionRate = 0;
    
    if (validCourses.length > 0) {
      const validStudents = validCourses.reduce((sum, c) => sum + (c['수강신청 인원'] || 0), 0);
      const validGraduates = validCourses.reduce((sum, c) => sum + (c.수료인원 || 0), 0);
      averageCompletionRate = validStudents > 0 ? (validGraduates / validStudents) * 100 : 0;
    }
    
    result.push({
      과정명: latest.과정명,
      '훈련과정 ID': courseId,
      총수강신청인원: totalStudents,
      총수료인원: totalGraduates,
      총누적매출: totalRevenue,
      최소과정시작일: group.reduce((min, c) => new Date(c.과정시작일) < new Date(min) ? c.과정시작일 : min, group[0].과정시작일),
      최대과정종료일: group.reduce((max, c) => new Date(c.과정종료일) > new Date(max) ? c.과정종료일 : max, group[0].과정종료일),
      훈련유형들: [latest.훈련유형],
      원천과정수: courseCount, // 개강 과정수로 표시되지만 필드명은 유지
      총훈련생수: totalStudents,
      평균만족도: latest.만족도,
      평균수료율: averageCompletionRate,
    });
  });
  return result.sort((a, b) => b.총누적매출 - a.총누적매출);
}

export function preprocessData(data: any[]) {
  return data.map(row => {
    const newRow: any = {};
    Object.keys(row).forEach(key => {
      // 공백 제거
      const newKey = key.replace(/\s/g, '');
      newRow[newKey] = row[key];
    });
    return newRow;
  });
}

export const calculateAdjustedRevenueForCourse = (
  course: CourseData,
  overallCompletionRate: number,
  courseCompletionRate?: number, // 동일 훈련과정의 평균 수료율
  institutionCompletionRate?: number, // 동일 훈련기관의 평균 수료율
  isFirstTimeCourse?: boolean, // 초회차 여부
  courseIdAvgCompletionRateMap?: Map<string, number> // <== 추가: 훈련과정ID별 평균 수료율 맵
): number => {
  // 1) 실 매출 대비, 매출 최대
  const minRevenue = course['실 매출 대비'] ?? course.누적매출 ?? 0;
  const maxRevenue = (typeof course['매출 최대'] === 'number' && !isNaN(course['매출 최대']) && course['매출 최대'] > 0)
    ? course['매출 최대']
    : minRevenue;

  // 2) 매출이 없으면 보정 없이 반환
  if (minRevenue === 0) {
    return minRevenue;
  }

  // 3) 수강신청 인원이 0이면 보정 계산이 불가능하므로 그대로 반환
  if ((course['수강신청 인원'] ?? 0) === 0) {
    return minRevenue;
  }

  // 4) 실제 수료율 계산
  let actualCompletionRate = (course['수료인원'] ?? 0) / (course['수강신청 인원'] ?? 1);
  let usedCompletionRate = actualCompletionRate * 100;
  let usedType = '실제';

  // 수료인원이 0인 경우, 또는 초회차인 경우 예상 수료율 결정
  if ((course['수료인원'] ?? 0) === 0 || isFirstTimeCourse) {
    let estimatedCompletionRate = 0;
    // 1순위: 훈련과정ID별 평균 수료율
    if (courseIdAvgCompletionRateMap && course['훈련과정 ID'] && courseIdAvgCompletionRateMap.has(course['훈련과정 ID'])) {
      estimatedCompletionRate = courseIdAvgCompletionRateMap.get(course['훈련과정 ID'])!;
    } else if (courseCompletionRate !== undefined && courseCompletionRate > 0) {
      estimatedCompletionRate = courseCompletionRate;
    } else if (institutionCompletionRate !== undefined && institutionCompletionRate > 0) {
      estimatedCompletionRate = institutionCompletionRate;
    } else {
      estimatedCompletionRate = overallCompletionRate;
    }
    actualCompletionRate = estimatedCompletionRate / 100; // %를 비율로 변환
    usedCompletionRate = estimatedCompletionRate;
    usedType = '예상';
  }

  // 5) 지수함수형 보정 적용 (y = min + (max-min)*(1 - a^(-b*rate)))
  const a = 2;
  const b = 2; // p값을 2로 고정
  const rate = actualCompletionRate;
  const expFactor = 1 - Math.pow(a, -b * rate);
  const adjustedRevenue = minRevenue + (maxRevenue - minRevenue) * expFactor;

  // 디버깅 로그 추가 - 모든 과정에 대해 출력
  console.log('[지수보정 DEBUG]', {
    과정명: course.과정명,
    고유값: course.고유값,
    수료인원: course['수료인원'],
    수강신청인원: course['수강신청 인원'],
    실매출대비: minRevenue,
    매출최대: maxRevenue,
    적용수료율: usedCompletionRate,
    수료율타입: usedType,
    a값: a,
    b값: b, // p값 확인
    expFactor,
    최종조정매출: adjustedRevenue,
    원본매출: minRevenue
  });

  return adjustedRevenue;
};

export const applyRevenueAdjustment = (
  courses: CourseData[],
  _overallCompletionRate: number // 기존 전체 평균은 무시
): CourseData[] => {
  console.log('[applyRevenueAdjustment] 함수 호출됨', {
    과정수: courses.length,
    전체평균수료율: _overallCompletionRate
  });
  
  // 1. 전체 평균 수료율(0% 제외) 재계산
  const validForOverall = courses.filter(c => (c['수료인원'] ?? 0) > 0 && (c['수강신청 인원'] ?? 0) > 0);
  let overallCompletionRate = 0;
  if (validForOverall.length > 0) {
    const total = validForOverall.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
    const enroll = validForOverall.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
    overallCompletionRate = enroll > 0 ? (total / enroll) * 100 : 0;
  }

  // 2. 훈련과정ID별 평균 수료율 맵 생성 (0% 제외)
  const courseIdAvgCompletionRateMap = new Map<string, number>();
  const courseIdGroups = new Map<string, CourseData[]>();
  courses.forEach(course => {
    const courseId = course['훈련과정 ID'];
    if (!courseId) return;
    if (!courseIdGroups.has(courseId)) courseIdGroups.set(courseId, []);
    courseIdGroups.get(courseId)!.push(course);
  });
  courseIdGroups.forEach((group, courseId) => {
    const valid = group.filter(c => (c['수료인원'] ?? 0) > 0 && (c['수강신청 인원'] ?? 0) > 0);
    if (valid.length > 0) {
      const total = valid.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
      const enroll = valid.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
      const avg = enroll > 0 ? (total / enroll) * 100 : 0;
      courseIdAvgCompletionRateMap.set(courseId, avg);
    }
  });

  // 3. 기존 보정 로직 (2차 스케일링 포함, overallCompletionRate만 교체)
  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'] as const;
  const firstTimeCourses = new Set<string>();
  const courseIdStartDateMap = new Map<string, Date>();
  courses.forEach(course => {
    if (course['훈련과정 ID']) {
      const startDate = new Date(course.과정시작일);
      if (!courseIdStartDateMap.has(course['훈련과정 ID']) || startDate < courseIdStartDateMap.get(course['훈련과정 ID'])!) {
        courseIdStartDateMap.set(course['훈련과정 ID'], startDate);
      }
    }
  });
  courses.forEach(course => {
    if (course['훈련과정 ID'] && courseIdStartDateMap.has(course['훈련과정 ID'])) {
      if (new Date(course.과정시작일).getTime() === courseIdStartDateMap.get(course['훈련과정 ID'])!.getTime()) {
        firstTimeCourses.add(course.고유값);
      }
    }
  });
  const intermediate = courses.map(course => {
    const isFirstTime = firstTimeCourses.has(course.고유값);
    const currentCourseCompletionRate = course['훈련과정 ID'] ? courseIdAvgCompletionRateMap.get(course['훈련과정 ID']) : undefined;
    // 기존 institutionCompletionRates 등은 그대로 유지
    // calculateAdjustedRevenueForCourse에 courseIdAvgCompletionRateMap 전달
    const adjustedTotalRevenue = calculateAdjustedRevenueForCourse(
      course,
      overallCompletionRate,
      currentCourseCompletionRate,
      undefined,
      isFirstTime,
      courseIdAvgCompletionRateMap
    );
    const adjustedYearlyRevenues: { [key: string]: number | undefined } = {};
    yearColumns.forEach(yearCol => {
      const originalYearlyRevenue = course[yearCol] as number | undefined;
      if (originalYearlyRevenue !== undefined) {
        adjustedYearlyRevenues[`조정_${yearCol}`] = calculateAdjustedRevenueForCourse(
          { ...course, 누적매출: originalYearlyRevenue, '실 매출 대비': originalYearlyRevenue },
          overallCompletionRate,
          currentCourseCompletionRate,
          undefined,
          isFirstTime,
          courseIdAvgCompletionRateMap
        );
      }
    });
    return {
      ...course,
      조정_실매출대비: adjustedTotalRevenue,
      조정_누적매출: adjustedTotalRevenue,
      ...adjustedYearlyRevenues,
    };
  });
  return intermediate;
}

// 그룹화된 기관의 개별 기관 정보를 추출하는 함수
export const getIndividualInstitutionsInGroup = (
  allCourses: CourseData[],
  groupName: string,
  year?: number
): InstitutionStat[] => {
  // 그룹화 기준에 따라 row를 분리
  const groupedCourses = allCourses.filter(course => groupInstitutionsAdvanced(course) === groupName);

  // 실제 원본 기관명 목록 추출 (파트너기관 포함)
  const individualInstitutions = [...new Set([
    ...groupedCourses.map(c => c.원본훈련기관 || c.훈련기관),
    ...groupedCourses.map(c => c.leadingCompanyPartnerInstitution).filter((name): name is string => Boolean(name))
  ])];



  const individualStats: InstitutionStat[] = [];
  individualInstitutions.forEach(originalInstitutionName => {
    // 그룹 내에서 해당 기관의 과정들만 필터링 (파트너기관으로 참여한 과정 포함)
    const institutionCourses = groupedCourses.filter(course => {
      const courseInstitution = course.원본훈련기관 || course.훈련기관;
      const coursePartner = course.leadingCompanyPartnerInstitution;
      return courseInstitution === originalInstitutionName || coursePartner === originalInstitutionName;
    });
    

    
    if (institutionCourses.length === 0) return;
    
    // 상세보기와 동일한 매출 계산 로직 적용
    // 선도기업 과정의 매출 분배를 위해 개별 기관명 기준으로 계산
    const aggregated = aggregateCoursesByCourseIdWithLatestInfo(institutionCourses, year, originalInstitutionName);
    const totalRevenue = aggregated.reduce((sum, course) => sum + course.총누적매출, 0);
    

    
    // 학생수/수료인원/과정수 계산 (파트너기관이 대체한 경우 파트너기관이 100% 담당)
    let totalStudents = 0;
    let completedStudents = 0;
    let totalCourses = 0;
    
    institutionCourses.forEach(course => {
      const courseInstitution = course.원본훈련기관 || course.훈련기관;
      const coursePartner = course.leadingCompanyPartnerInstitution;
      const isTrainingInstitution = courseInstitution === originalInstitutionName;
      const isPartnerInstitution = coursePartner === originalInstitutionName;
      
      if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
        // 선도기업 과정: 파트너기관이 100% 담당
        if (isPartnerInstitution) {
          totalStudents += course['수강신청 인원'] ?? 0;
          completedStudents += course['수료인원'] ?? 0;
          totalCourses += 1;
        }
        // 훈련기관은 학생수/수료인원/과정수 0
      } else {
        // 일반 과정: 훈련기관이 100% 담당
        if (isTrainingInstitution) {
          totalStudents += course['수강신청 인원'] ?? 0;
          completedStudents += course['수료인원'] ?? 0;
          totalCourses += 1;
        }
      }
    });
    
    // 수료율 계산 (파트너기관이 대체한 경우 파트너기관 기준으로 계산)
    let totalValidStudents = 0;
    let totalValidGraduates = 0;
    
    institutionCourses.forEach(course => {
      const courseInstitution = course.원본훈련기관 || course.훈련기관;
      const coursePartner = course.leadingCompanyPartnerInstitution;
      const isTrainingInstitution = courseInstitution === originalInstitutionName;
      const isPartnerInstitution = coursePartner === originalInstitutionName;
      
      if (course['수료인원'] > 0 && course['수강신청 인원'] > 0) {
        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
          // 선도기업 과정: 파트너기관만 계산
          if (isPartnerInstitution) {
            totalValidStudents += course['수강신청 인원'] ?? 0;
            totalValidGraduates += course['수료인원'] ?? 0;
          }
        } else {
          // 일반 과정: 훈련기관만 계산
          if (isTrainingInstitution) {
            totalValidStudents += course['수강신청 인원'] ?? 0;
            totalValidGraduates += course['수료인원'] ?? 0;
          }
        }
      }
    });
    
    const completionRate = totalValidStudents > 0 ? (totalValidGraduates / totalValidStudents) * 100 : 0;
    
    // 평균 만족도 계산 (파트너기관이 대체한 경우 파트너기관 기준으로 계산)
    let totalWeighted = 0;
    let totalWeight = 0;
    
    institutionCourses.forEach(course => {
      const courseInstitution = course.원본훈련기관 || course.훈련기관;
      const coursePartner = course.leadingCompanyPartnerInstitution;
      const isTrainingInstitution = courseInstitution === originalInstitutionName;
      const isPartnerInstitution = coursePartner === originalInstitutionName;
      
      if (course.만족도 && course.만족도 > 0 && course['수료인원'] > 0) {
        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
          // 선도기업 과정: 파트너기관만 계산
          if (isPartnerInstitution) {
            totalWeighted += (course.만족도 ?? 0) * (course['수료인원'] ?? 0);
            totalWeight += course['수료인원'] ?? 0;
          }
        } else {
          // 일반 과정: 훈련기관만 계산
          if (isTrainingInstitution) {
            totalWeighted += (course.만족도 ?? 0) * (course['수료인원'] ?? 0);
            totalWeight += course['수료인원'] ?? 0;
          }
        }
      }
    });
    
    const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
    
    // 이전 연도 시작 과정 정보 계산 (파트너기관이 대체한 경우 파트너기관 기준으로 계산)
    let prevYearStudents = 0;
    let prevYearCompletedStudents = 0;
    if (year !== undefined) {
      institutionCourses.forEach(course => {
        const courseInstitution = course.원본훈련기관 || course.훈련기관;
        const coursePartner = course.leadingCompanyPartnerInstitution;
        const isTrainingInstitution = courseInstitution === originalInstitutionName;
        const isPartnerInstitution = coursePartner === originalInstitutionName;
        
        const isPrevYearCourse = new Date(course.과정시작일).getFullYear() < year &&
                                new Date(course.과정종료일).getFullYear() === year;
        
        if (isPrevYearCourse) {
          if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
            // 선도기업 과정: 파트너기관만 계산
            if (isPartnerInstitution) {
              prevYearStudents += course['수강신청 인원'] ?? 0;
              prevYearCompletedStudents += course['수료인원'] ?? 0;
            }
            // 훈련기관은 0
          } else {
            // 일반 과정: 훈련기관만 계산
            if (isTrainingInstitution) {
              prevYearStudents += course['수강신청 인원'] ?? 0;
              prevYearCompletedStudents += course['수료인원'] ?? 0;
            }
          }
        }
      });
    }
    

    
    individualStats.push({
      institutionName: originalInstitutionName,
      totalRevenue,
      totalCourses,
      totalStudents,
      completedStudents,
      completionRate,
      avgSatisfaction,
      courses: institutionCourses,
      prevYearStudents,
      prevYearCompletedStudents
    });
  });
  // 매출액 기준 내림차순 정렬
  return individualStats.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

// 기관별 상세 매출 계산을 위한 통합 함수 (훈련기관/파트너기관 역할 모두 포함)
export const calculateInstitutionDetailedRevenue = (
  allCourses: CourseData[],
  institutionName: string,
  year?: number
): {
  totalRevenue: number;
  totalCourses: number;
  totalStudents: number;
  completedStudents: number;
  courses: CourseData[];
} => {
  let totalRevenue = 0;
  let totalCourses = 0;
  let totalStudents = 0;
  let completedStudents = 0;
  const courses: CourseData[] = [];

  allCourses.forEach(course => {
    // 연도 필터링
    if (year !== undefined) {
      const courseYear = new Date(course.과정시작일).getFullYear();
      if (courseYear !== year) return;
    }

    const courseInstitution = course.원본훈련기관 || course.훈련기관;
    const coursePartner = course.leadingCompanyPartnerInstitution;
    
    // 그룹명(프랜차이즈) 기준으로도 포함되도록 보완
    const isInstitutionInGroup = groupInstitutionsAdvanced({ ...course, 훈련기관: courseInstitution }) === institutionName;
    const isPartnerInGroup = coursePartner && groupInstitutionsAdvanced({ ...course, 훈련기관: coursePartner }) === institutionName;

    // 해당 그룹(기관)이 훈련기관이거나 파트너기관으로 참여한 과정인지 확인
    const isTrainingInstitution = isInstitutionInGroup;
    const isPartnerInstitution = isPartnerInGroup;

    if (!isTrainingInstitution && !isPartnerInstitution) return;

    // 매출 계산
    let revenue = 0;
    if (year !== undefined) {
      const yearKey = `조정_${year}년` as keyof CourseData;
      revenue = (course[yearKey] as number | undefined) ?? 0;
    } else {
      revenue = course.조정_누적매출 ?? 0;
    }

    // 선도기업 훈련인 경우 매출 분배 적용
    if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
      if (courseInstitution === course.leadingCompanyPartnerInstitution && isTrainingInstitution && isPartnerInstitution) {
        // 동일 기관: 100% 집계
        // 아무런 분배 없이 그대로 둠 (revenue = revenue * 1)
      } else if (isPartnerInstitution) {
        // 파트너기관: 90%
        revenue = revenue * 0.9;
      } else if (isTrainingInstitution) {
        // 훈련기관: 10%
        revenue = revenue * 0.1;
      }
    }

    // 학생 수 계산 (선도기업 훈련에서는 파트너기관이 100% 담당)
    let studentCount = course['수강신청 인원'] ?? 0;
    let completedCount = course.수료인원 ?? 0;
    if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
      if (courseInstitution === course.leadingCompanyPartnerInstitution && isTrainingInstitution && isPartnerInstitution) {
        // 동일 기관: 100% 집계 (변경 없음)
      } else if (isTrainingInstitution) {
        // 훈련기관은 학생 수 0
        studentCount = 0;
        completedCount = 0;
      }
      // 파트너기관은 학생 수 100% (기본값)
    }

    totalRevenue += revenue;
    totalStudents += studentCount;
    completedStudents += completedCount;
    courses.push(course);
  });

  totalCourses = courses.length;

  return {
    totalRevenue,
    totalCourses,
    totalStudents,
    completedStudents,
    courses
  };
};