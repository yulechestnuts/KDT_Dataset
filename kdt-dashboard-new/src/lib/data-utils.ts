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
  훈련과정ID?: string;
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
  훈련과정ID?: string; // 훈련과정ID 추가
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

export interface NcsStat {
  ncsName: string;
  totalRevenue: number;
  totalCourses: number;
  totalStudents: number;
  completedStudents: number;
  completionRate: number;
  avgSatisfaction: number;
  courses: CourseData[];
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

  // 조정된 연도별 매출 계산 (여기서는 원본 값을 복사, 최종 조정은 calculateInstitutionStats에서)
  const adjustedYearlyRevenues: { [key: string]: number } = {};
  yearColumns.forEach(yearCol => {
    const originalRevenue = parseNumber(rawData[yearCol]);
    adjustedYearlyRevenues[`조정_${yearCol}`] = originalRevenue; 
  });

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

export const aggregateCoursesByCourseName = (courses: CourseData[]): AggregatedCourseData[] => {
  const aggregatedMap = new Map<string, AggregatedCourseData>();

  courses.forEach(course => {
    const key = course.훈련과정ID || course.과정명; // 훈련과정ID를 우선 사용, 없으면 과정명 사용
    if (!aggregatedMap.has(key)) {
      aggregatedMap.set(key, {
        과정명: course.과정명,
        훈련과정ID: course.훈련과정ID, // 훈련과정ID 추가
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

    aggregatedCourse.총수강신청인원 += course['수강신청 인원'];
    aggregatedCourse.총수료인원 += course['수료인원'];
    const revenueForSum =
      course.조정_실매출대비 ??
      (course.누적매출 ?? 0);
    aggregatedCourse.총누적매출 += revenueForSum;
    aggregatedCourse.원천과정수 += 1;
    aggregatedCourse.총훈련생수 += course['수강신청 인원'];
    
    // 평균 만족도 계산 (가중 평균)
    const currentSatisfactionSum = (aggregatedCourse as any)._satisfactionSum || 0;
    const currentSatisfactionCount = (aggregatedCourse as any)._satisfactionCount || 0;
    (aggregatedCourse as any)._satisfactionSum = currentSatisfactionSum + (course.만족도 || 0);
    (aggregatedCourse as any)._satisfactionCount = currentSatisfactionCount + 1;
    aggregatedCourse.평균만족도 = (aggregatedCourse as any)._satisfactionCount > 0
      ? (aggregatedCourse as any)._satisfactionSum / (aggregatedCourse as any)._satisfactionCount
      : 0;

    // 평균 수료율 계산 (가중 평균)
    const currentCompletionSum = (aggregatedCourse as any)._completionSum || 0;
    const currentEnrollmentSum = (aggregatedCourse as any)._enrollmentSum || 0;
    (aggregatedCourse as any)._completionSum = currentCompletionSum + (course.수료인원 || 0);
    (aggregatedCourse as any)._enrollmentSum = currentEnrollmentSum + (course['수강신청 인원'] || 0);
    aggregatedCourse.평균수료율 = (aggregatedCourse as any)._enrollmentSum > 0
      ? ((aggregatedCourse as any)._completionSum / (aggregatedCourse as any)._enrollmentSum) * 100
      : 0;

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

  // 1. 훈련과정 ID가 같으면 최신 과정명으로 업데이트 및 중복 제거
  if (transformedData.length > 0 && '훈련과정ID' in transformedData[0] && '과정시작일' in transformedData[0] && '과정명' in transformedData[0]) {
    // 훈련과정ID와 과정시작일을 기준으로 정렬하여 최신 과정을 식별
    transformedData.sort((a, b) => {
      const idComparison = (a.훈련과정ID || '').localeCompare(b.훈련과정ID || '');
      if (idComparison !== 0) return idComparison;
      return new Date(b.과정시작일).getTime() - new Date(a.과정시작일).getTime();
    });

    const latestCourseNames = new Map<string, string>();
    const uniqueCourseIds = new Set<string>();
    const tempTransformedData: CourseData[] = [];

    for (const course of transformedData) {
      if (course.훈련과정ID && !uniqueCourseIds.has(course.훈련과정ID)) {
        latestCourseNames.set(course.훈련과정ID, course.과정명);
        uniqueCourseIds.add(course.훈련과정ID);
        tempTransformedData.push(course); // 최신 과정만 임시 저장
      }
    }
    
    // 모든 과정에 최신 훈련명 적용
    transformedData = transformedData.map(course => ({
      ...course,
      과정명: course.훈련과정ID ? latestCourseNames.get(course.훈련과정ID) || course.과정명 : course.과정명
    }));

    // 훈련과정 ID 기준으로 중복 제거 (가장 최신 과정 유지)
    const finalTransformedDataMap = new Map<string, CourseData>();
    for (const course of transformedData) {
        if (course.훈련과정ID) {
            const existing = finalTransformedDataMap.get(course.훈련과정ID);
            if (!existing || new Date(course.과정시작일) > new Date(existing.과정시작일)) {
                finalTransformedDataMap.set(course.훈련과정ID, course);
            }
        } else {
            // 훈련과정ID가 없는 경우, 고유값으로 처리하거나 다른 기준으로 중복 제거
            // 여기서는 일단 그대로 추가 (필요시 추가 로직 구현)
            finalTransformedDataMap.set(course.고유값, course);
        }
    }
    transformedData = Array.from(finalTransformedDataMap.values());

    console.log("훈련과정 ID 기준으로 최신 훈련명 적용 및 중복 제거 완료.");
  } else {
    console.warn("경고: '훈련과정ID', '과정시작일', '과정명' 컬럼 중 하나 이상이 없어 최신 훈련명 적용 및 중복 제거를 건너뜁니다.");
  }

  // 훈련기관 그룹화 적용 (기존 로직 유지)
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

// 수료율에 따른 매출액 보정 계수 계산 함수
function calculateRevenueAdjustmentFactor(completionRate: number): number {
  if (completionRate >= 100) {
    return 1.25; // 100% 이상일 때 1.25배
  } else if (completionRate >= 75) {
    // 75%에서 100% 사이는 선형적으로 1.0에서 1.25로 증가
    return 1.0 + (0.25 * (completionRate - 75) / 25);
  } else if (completionRate >= 50) {
    // 50%에서 75% 사이는 선형적으로 0.75에서 1.0으로 증가
    return 0.75 + (0.25 * (completionRate - 50) / 25);
  } else {
    // 50% 미만은 0.75배
    return 0.75;
  }
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
  const adjustedCols = yearColumns.map(col => `조정_${col}` as keyof CourseData);

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
      if (primaryInstitution === course.leadingCompanyPartnerInstitution) {
        primaryInstitution = course.leadingCompanyPartnerInstitution;
        secondaryInstitution = course.훈련기관;
        primaryRevenueShare = 0.9;
        secondaryRevenueShare = 0.1;
      } else if (primaryInstitution === course.훈련기관) {
        primaryInstitution = course.훈련기관;
        secondaryInstitution = course.leadingCompanyPartnerInstitution;
        primaryRevenueShare = 0.1;
        secondaryRevenueShare = 0.9;
      } else {
        primaryInstitution = course.훈련기관;
        secondaryInstitution = undefined;
        primaryRevenueShare = 1;
        secondaryRevenueShare = 0;
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

    // 공통적으로 계산한 단일 매출값 (일할/수료율 보정 포함)
    const courseRevenue = computeCourseRevenue(course, today, year);

    primaryStats.totalRevenue += courseRevenue * primaryRevenueShare;
    primaryStats.totalCourses += 1;
    primaryStats.totalStudents += (course['수강신청 인원'] ?? 0) * primaryRevenueShare;
    primaryStats.completedStudents += (course['수료인원'] ?? 0) * primaryRevenueShare;
    if (course.만족도 && course.만족도 > 0) {
      primaryStats.satisfactionSum += course.만족도 * primaryRevenueShare; // 가중치: 매출 지분
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
      secondaryStats.totalCourses += 0;
      secondaryStats.totalStudents += 0;
      secondaryStats.completedStudents += 0;
      if (course.만족도 && course.만족도 > 0) {
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

// === Helper: Compute course revenue with the same rules used in calculateInstitutionStats ===
export const computeCourseRevenue = (
  course: CourseData,
  today: Date = new Date(),
  year?: number,
): number => {
  // If a specific year is requested, use only that year's revenue columns; otherwise sum all.
  if (year) {
    const yearlyKey = `${year}년` as keyof CourseData;
    const adjKey = `조정_${year}년` as keyof CourseData;
    let baseRevenue: number = (course[adjKey] as number) ?? (course[yearlyKey] as number) ?? 0;

    // 과정 진행률에 따른 매출 보정
    const startDate = parseDate(course.과정시작일);
    const endDate = parseDate(course.과정종료일);
    let revenue = 0;

    if (startDate > today) {
      revenue = 0; // 과정이 아직 시작되지 않음
    } else if (endDate < today) {
      revenue = baseRevenue; // 과정이 이미 종료됨
    } else {
      // 과정이 진행 중인 경우, 경과 일수에 비례하여 매출 계산
      const totalDuration = endDate.getTime() - startDate.getTime();
      const elapsedDuration = today.getTime() - startDate.getTime();
      const progressRatio = totalDuration > 0 ? Math.min(Math.max(elapsedDuration / totalDuration, 0), 1) : 0;
      revenue = baseRevenue * progressRatio;
    }

    // 수료율에 따른 추가 조정 (이미 조정된 경우 스킵)
    const alreadyAdjusted = typeof course[adjKey] === 'number';
    if (!alreadyAdjusted) {
      revenue *= calculateRevenueAdjustmentFactor(course['수료율'] ?? 0);
    }
    return revenue;
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

  // 2) 진행 중인 과정에 대한 일할 계산
  const startDate = parseDate(course.과정시작일);
  const endDate = parseDate(course.과정종료일);
  let revenue = 0;
  if (startDate > today) {
    revenue = 0;
  } else if (endDate < today) {
    revenue = baseRevenue as number; // 명시적으로 number로 캐스팅
  } else {
    const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const passedDays = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    revenue = totalDays > 0 ? (baseRevenue as number) * (passedDays / totalDays) : (baseRevenue as number); // 명시적으로 number로 캐스팅
  }

  // 3) 수료율에 따른 보정 (이미 조정된 경우 스킵)
  const alreadyAdjusted = Object.keys(course).some(k => k.startsWith('조정_'));
  if (!alreadyAdjusted) {
    revenue *= calculateRevenueAdjustmentFactor(course['수료율'] ?? 0);
  }
  return revenue;
};

// === Aggregator for detail modal (share-aware) ===
export const aggregateCoursesByCourseNameForInstitution = (
  courses: CourseData[],
  institutionName: string,
  year?: number,
): AggregatedCourseData[] => {
  const map = new Map<string, AggregatedCourseData>();
  const today = new Date();

  courses.forEach(course => {
    // Determine revenue and student share for this institution
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

    // 공통적으로 계산한 단일 매출값 (일할/수료율 보정 포함)
    const revenue = computeCourseRevenue(course, today, year) * revenueShare;

    const key = course.훈련과정ID || course.과정명; // 훈련과정ID를 우선 사용, 없으면 과정명 사용
    if (!map.has(key)) {
      map.set(key, {
        과정명: course.과정명,
        훈련과정ID: course.훈련과정ID, // 훈련과정ID 추가
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
      internal._completionEnrollmentSum += (course['수강신청 인원'] ?? 0) * studentShare;
      internal._completionSum += (course['수료인원'] ?? 0) * studentShare;
      internal._completionWeight += studentShare; // 수료율 가중치 적용
    }

    // 만족도 평균 (만족도가 0이 아닌 경우에만 모수에 포함)
    if (course.만족도 && course.만족도 > 0) {
      internal._satSum += course.만족도 * revenueShare;
      internal._satWeight += revenueShare;
    }

    // 기존 로직 유지
    agg.총수강신청인원 += (course['수강신청 인원'] ?? 0) * studentShare;
    agg.총수료인원 += (course['수료인원'] ?? 0) * studentShare;
    agg.총누적매출 += revenue;
    agg.총훈련생수 += (course['수강신청 인원'] ?? 0) * studentShare;
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

// NCS별 통계 계산
export const calculateNcsStats = (data: CourseData[], year?: number): NcsStat[] => {
  // 연도 필터
  const filtered = year
    ? data.filter(c => new Date(c.과정시작일).getFullYear() === year)
    : data;

  const map = new Map<string, NcsStat>();

  filtered.forEach(course => {
    const key = course.NCS명 || '기타';
    if (!map.has(key)) {
      map.set(key, {
        ncsName: key,
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
    // 누적 평균 만족도
    const idx = stat.courses.length;
    stat.avgSatisfaction = ((stat.avgSatisfaction * (idx - 1)) + (course.만족도 || 0)) / idx;
  });

  // completion rate 계산
  map.forEach(stat => {
    stat.completionRate = stat.totalStudents > 0 ? (stat.completedStudents / stat.totalStudents) * 100 : 0;
  });

  return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
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
      internal._completionEnrollmentSum += (course['수강신청 인원'] ?? 0) * studentShare;
      internal._completionSum += (course['수료인원'] ?? 0) * studentShare;
      internal._completionWeight += studentShare; // 수료율 가중치 적용
    }

    // 만족도 평균 (만족도가 0이 아닌 경우에만 모수에 포함)
    if (course.만족도 && course.만족도 > 0) {
      internal._satSum += course.만족도 * revenueShare;
      internal._satWeight += revenueShare;
    }

    // 기존 로직 유지
    agg.총수강신청인원 += (course['수강신청 인원'] ?? 0) * studentShare;
    agg.총수료인원 += (course['수료인원'] ?? 0) * studentShare;
    agg.총누적매출 += revenue;
    agg.총훈련생수 += (course['수강신청 인원'] ?? 0) * studentShare;
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