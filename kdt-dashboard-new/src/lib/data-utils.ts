import { formatNumber } from "@/utils/formatters";
import { parsePercentageNullable } from "@/lib/backend/parsers";

// ============================================================================
// 취업대상자 역산 로직: 절대 명제
// 1. 취업률 확인이 안 되는 과정 → 0/0으로 처리 (임의의 데이터 대입 금지)
// 2. 취업률(%)과 취업인원이 있으면 역산: targetPop = employed / (rate / 100)
// ============================================================================

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
  취업대상인원: number;
  통합취업인원: number;
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

export interface InstitutionStat {
  institutionName: string;
  totalRevenue: number;
  totalCourses: string;
  totalStudents: string;
  completedStudents: string;
  totalEmployed: number;
  completionRate: number;
  employmentRate: number;
  총취업대상인원?: number;
  총통합취업인원?: number;
  avgSatisfaction: number;
  courses: CourseData[];
  prevYearStudents: number;
  prevYearCompletedStudents: number;
  currentYearCoursesCount: number;
  prevYearCoursesCount: number;
  currentYearStudents: number;
  currentYearCompletedStudents: number;
}

export interface AggregatedCourseData {
  과정명: string;
  '훈련과정 ID'?: string;
  총수강신청인원: number;
  총수료인원: number;
  총취업인원: number;
  총누적매출: number;
  최소과정시작일: string;
  최대과정종료일: string;
  훈련유형들: string[];
  원천과정수: number;
  총훈련생수: number;
  평균만족도: number;
  평균수료율: number;
  평균취업율: number;
  총취업대상인원?: number;
  총통합취업인원?: number;
}

export interface LeadingCompanyStat {
  leadingCompany: string;
  totalRevenue: number;
  totalCourses: number;
  totalStudents: number;
  completedStudents: number;
  completionRate: number;
  avgSatisfaction: number;
  employmentRate: number;
  총취업대상인원?: number;
  총통합취업인원?: number;
  courses: CourseData[];
}

export interface NcsStat {
  ncsName: string;
  totalRevenue: number;
  totalCourses: number;
  totalStudents: number;
  completedStudents: number;
  prevYearStudents: number;
  prevYearCompletedStudents: number;
  completionRate: number;
  avgSatisfaction: number;
  employmentRate: number;
  총취업대상인원?: number;
  총통합취업인원?: number;
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
    currentDate: string;
    year?: number;
  };
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

// 훈련기관 매핑 유틸리티
const institutionMap: { [key: string]: string } = {
  '대한상공회의소': '대한상공회의소',
  '부산상공회의소': '대한상공회의소',
  '인천상공회의소': '대한상공회의소',
  '광주상공회의소': '대한상공회의소',
  '전북상공회의소': '대한상공회의소',
  '익산상공회의소': '대한상공회의소',
  '충남상공회의소': '대한상공회의소',
  '충북상공회의소': '대한상공회의소',
  '강원상공회의소': '대한상공회의소',
  '경북상공회의소': '대한상공회의소',
  '경남상공회의소': '대한상공회의소',
  '전남상공회의소': '대한상공회의소',
  '제주상공회의소': '대한상공회의소',
};

// 훈련기관 그룹화 함수 (개선된 버전)
export const groupInstitutionsAdvanced = (course: any): string => {
  if (!course) return '';
  const name = typeof course === 'string' ? course : (course.훈련기관 || '');
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  
  if (!trimmedName) return '';
  
  if (trimmedName.includes('상공회의소')) return '대한상공회의소';
  if (trimmedName.includes('멀티캠퍼스')) return '멀티캠퍼스';
  if (trimmedName.includes('경북산업직업전문학교')) return '경북산업직업전문학교';
  if (trimmedName.includes('에이치아카데미')) return '에이치아카데미';
  if (trimmedName.includes('그린컴퓨터')) return '그린컴퓨터';
  if (trimmedName.includes('SBS아카데미')) return 'SBS아카데미';
  if (trimmedName.includes('코리아IT')) return '코리아IT';
  
  return trimmedName;
};

// 숫자 파싱 유틸리티
export const parseNumber = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return 0;
  const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
};

// 퍼센트 파싱 유틸리티
export const parsePercentage = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return 0;
  const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
};

// 취업률 선택 유틸리티 (선호도 순: 6개월 > 3개월 > 전체)
export const getPreferredEmploymentCount = (course: CourseData): number => {
  if (course['취업인원 (6개월)'] > 0) return course['취업인원 (6개월)'];
  if (course['취업인원 (3개월)'] > 0) return course['취업인원 (3개월)'];
  return course.취업인원 || 0;
};

// 1. 퍼센트 문자열을 안전하게 숫자로 변환하는 헬퍼 함수 (강화 v2)
export const parsePercentageSafe = (value: any): number => {
  if (value === null || value === undefined || value === '-' || value === 'N/A') return 0;
  const cleaned = String(value).replace(/[^0-9.]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// 강화된 디버깅 가능한 취업률 파싱 함수
export const parseRateWithDebug = (value: any, debug: boolean = false): { rate: number | null; raw: string } => {
  if (value === null || value === undefined) {
    if (debug) console.log('[parseRateWithDebug] Input is null/undefined');
    return { rate: null, raw: '' };
  }

  const raw = String(value).trim();
  const cleaned = raw.replace(/[^0-9.]/g, '').trim();
  
  if (!cleaned) {
    if (debug) console.log(`[parseRateWithDebug] No digits found in "${raw}"`);
    return { rate: null, raw };
  }

  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) {
    if (debug) console.warn(`[parseRateWithDebug] parseFloat failed for "${cleaned}"`);
    return { rate: null, raw };
  }

  if (debug) {
    console.log(`[parseRateWithDebug] "${raw}" → "${cleaned}" → ${parsed}`);
  }

  return { rate: parsed, raw };
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

// 2. 과정별 안전한 취업 데이터 추출 및 모수 역산 함수 (개선 v3 - with debug)
// ★ 절대 명제 적용:
//   1. 취업률 확인 불가 → 0/0 처리 (임의 데이터 대입 금지)
//   2. 취업률(%) + 취업인원 있음 → 역산: targetPop = employed / (rate / 100)
// ★ Supabase DB 컬럼명 매핑:
//   - DB 컬럼명에 공백이 포함되어 있으므로 대괄호 표기법 필수
//   - 예: course['취업인원 (6개월)'] ← 점 표기법(course.취업인원) 사용 불가

// Global debug flag (환경변수로 제어 가능)
const EMPLOYMENT_DEBUG = typeof window !== 'undefined' && (window as any).__EMPLOYMENT_DEBUG_MODE__ === true;

export const getSafeEmploymentData = (course: any, forceDebug: boolean = false) => {
  const isDebug = EMPLOYMENT_DEBUG || forceDebug;
  
  // 모든 Key를 배열로 추출 및 디버깅
  const keys = Object.keys(course || {});
  if (isDebug) {
    console.group('[getSafeEmploymentData] 🔍 디버깅 시작');
    console.log('입력 course 키 전체:', keys);
  }

  // ★ 개선된 로직: 6개월 우선, 없으면 3개월로 fallback
  let employed = 0;
  let rate = 0;
  let source: '6개월' | '3개월' | null = null;

  // Step 1: 6개월 데이터 명시적으로 찾기
  const count6Key = keys.find(k => k.includes('취업인원') && k.includes('6개월'));
  const rate6Key = keys.find(k => k.includes('취업률') && k.includes('6개월'));
  
  if (count6Key && rate6Key) {
    const emp6 = Number(course[count6Key]) || 0;
    const rawRate6 = course[rate6Key];
    
    if (emp6 > 0 && rawRate6 != null) {
      const parseResult = parseRateWithDebug(rawRate6, isDebug);
      const rate6 = parseResult.rate ?? 0;
      
      if (rate6 > 0) {
        employed = emp6;
        rate = rate6;
        source = '6개월';
        if (isDebug) {
          console.log(`✅ 6개월 데이터 사용: employed=${employed}, rate=${rate}`);
        }
      }
    }
  }

  // Step 2: 6개월이 없으면 3개월로 fallback (2021년 초기 과정 대응)
  if (!source) {
    const count3Key = keys.find(k => k.includes('취업인원') && k.includes('3개월'));
    const rate3Key = keys.find(k => k.includes('취업률') && k.includes('3개월'));
    
    if (count3Key && rate3Key) {
      const emp3 = Number(course[count3Key]) || 0;
      const rawRate3 = course[rate3Key];
      
      if (emp3 > 0 && rawRate3 != null) {
        const parseResult = parseRateWithDebug(rawRate3, isDebug);
        const rate3 = parseResult.rate ?? 0;
        
        if (rate3 > 0) {
          employed = emp3;
          rate = rate3;
          source = '3개월';
          if (isDebug) {
            console.log(`⚠️ 6개월 데이터 없음. 3개월로 fallback: employed=${employed}, rate=${rate}`);
          }
        }
      }
    }
  }

  if (isDebug) {
    console.log(`source="${source}"`);
  }

  // Step 3: 역산 로직
  let result: any;

  // 경우 A: employed > 0 && rate > 0 → 정상 역산
  if (employed > 0 && rate > 0) {
    const targetPop = Math.round(employed / (rate / 100));
    if (isDebug) {
      console.log(`✅ 역산 성공 → targetPop=${targetPop} (employed=${employed} ÷ ${rate}% = ${targetPop})`);
    }
    result = { employed, targetPop, rate, source };
  }
  // 경우 B: 취업 데이터 없음
  else {
    if (isDebug) {
      console.warn(`⚠️ 취업 데이터 없음: employed=${employed}, rate=${rate}`);
    }
    result = { employed: null, targetPop: null, rate: null, source: null };
  }

  if (isDebug) {
    console.log('📊 최종 결과:', result);
    console.groupEnd();
  }

  return result;
};

// 원본 데이터를 CourseData로 변환
export const transformRawDataToCourseData = (rawData: RawCourseData): CourseData => {
  const startDate = rawData.과정시작일 instanceof Date ? rawData.과정시작일 : new Date(rawData.과정시작일);
  const endDate = rawData.과정종료일 instanceof Date ? rawData.과정종료일 : new Date(rawData.과정종료일);
  
  const startDateStr = !isNaN(startDate.getTime()) ? startDate.toISOString().split('T')[0] : '';
  const endDateStr = !isNaN(endDate.getTime()) ? endDate.toISOString().split('T')[0] : '';
  
  const completionCount = parseNumber(rawData.수료인원);
  const enrollmentCount = parseNumber(rawData.수강신청인원);
  const completionRate = enrollmentCount > 0 ? (completionCount / enrollmentCount) * 100 : 0;

  // 안전한 취업 데이터 추출 및 모수 역산
  const empData = getSafeEmploymentData(rawData);
  const emp3Raw = (rawData as any)['취업인원 (3개월)'] ?? (rawData as any)['취업인원(3개월)'];
  const rate3Raw = (rawData as any)['취업률 (3개월)'] ?? (rawData as any)['취업률(3개월)'];
  const emp6Raw = (rawData as any)['취업인원 (6개월)'] ?? (rawData as any)['취업인원(6개월)'];
  const rate6Raw = (rawData as any)['취업률 (6개월)'] ?? (rawData as any)['취업률(6개월)'];
  
  return {
    고유값: rawData.고유값,
    훈련기관: groupInstitutionsAdvanced(rawData.훈련기관),
    원본훈련기관: rawData.훈련기관,
    '훈련과정 ID': rawData.훈련과정ID,
    과정명: rawData.과정명,
    과정시작일: startDateStr,
    과정종료일: endDateStr,
    '수강신청 인원': enrollmentCount,
    '수료인원': completionCount,
    '수료율': completionRate,
    총훈련일수: parseNumber(rawData.총훈련일수),
    총훈련시간: parseNumber(rawData.총훈련시간),
    훈련비: parseNumber(rawData.훈련비),
    정원: parseNumber(rawData.정원),
    만족도: parsePercentage(rawData.만족도),
    취업인원: empData.employed,
    취업률: empData.rate,
    취업대상인원: empData.targetPop,
    통합취업인원: empData.employed,
    '취업인원 (3개월)': parseNumber(emp3Raw),
    '취업률 (3개월)': parsePercentageNullable(rate3Raw),
    '취업인원 (6개월)': parseNumber(emp6Raw),
    '취업률 (6개월)': parsePercentageNullable(rate6Raw),
    훈련연도: startDate.getFullYear(),
    훈련유형: '',
    NCS명: rawData.NCS명,
    NCS코드: rawData.NCS코드,
    선도기업: rawData.선도기업,
    파트너기관: rawData.파트너기관,
    '실 매출 대비': parseNumber(rawData.실매출대비),
    '매출 최대': parseNumber(rawData.매출최대),
    '매출 최소': parseNumber(rawData.매출최소),
    '2021년': parseNumber(rawData['2021년']),
    '2022년': parseNumber(rawData['2022년']),
    '2023년': parseNumber(rawData['2023년']),
    '2024년': parseNumber(rawData['2024년']),
    '2025년': parseNumber(rawData['2025년']),
    '2026년': parseNumber(rawData['2026년']),
  };
};

export const transformRawData = (data: any[]): CourseData[] => {
  let transformedData = data.map(item => transformRawDataToCourseData(item as RawCourseData));
  
  // 최신 과정명 적용 로직 (훈련과정 ID 기준)
  if (transformedData.length > 0 && transformedData[0]['훈련과정 ID']) {
    const latestCourseNames = new Map<string, string>();
    const courseGroups = new Map<string, CourseData[]>();
    transformedData.forEach(course => {
      if (course['훈련과정 ID']) {
        if (!courseGroups.has(course['훈련과정 ID'])) {
          courseGroups.set(course['훈련과정 ID'], []);
        }
        courseGroups.get(course['훈련과정 ID'])!.push(course);
      }
    });

    courseGroups.forEach((courses, courseId) => {
      const latestCourse = courses.reduce((latest, current) => {
        return new Date(current.과정시작일) > new Date(latest.과정시작일) ? current : latest;
      });
      latestCourseNames.set(courseId, latestCourse.과정명);
    });
    
    transformedData = transformedData.map(course => {
      return {
        ...course,
        과정명: course['훈련과정 ID'] ? latestCourseNames.get(course['훈련과정 ID']) || course.과정명 : course.과정명
      };
    });
  }

  return transformedData;
};

// CSV 파싱 옵션
export const csvParseOptions = {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false,
  delimitersToGuess: [',', '\t', '|', ';'],
  trimHeaders: true,
  transform: (value: string) => typeof value === 'string' ? value.trim() : value
};

// 수료율 계산
export function calculateCompletionRate(data: CourseData[], year?: number): number {
  let filteredData = data;
  if (year) {
    filteredData = data.filter(course => new Date(course.과정종료일).getFullYear() === year);
  }

  const today = new Date();
  const threeWeeksAgo = new Date(today.getTime() - (21 * 24 * 60 * 60 * 1000));

  const validData = filteredData.filter(course => {
    const endDate = new Date(course.과정종료일);
    return course['수료인원'] > 0 && course['수강신청 인원'] > 0 && endDate <= threeWeeksAgo;
  });

  if (validData.length === 0) return 0;

  const totalCompletion = validData.reduce((sum, course) => sum + course['수료인원'], 0);
  const totalEnrollment = validData.reduce((sum, course) => sum + course['수강신청 인원'], 0);

  return totalEnrollment > 0 ? Number(((totalCompletion / totalEnrollment) * 100).toFixed(1)) : 0;
}

// 매출 보정 계수
export function calculateRevenueAdjustmentFactor(completionRate: number): number {
  if (completionRate >= 100) return 1.25;
  if (completionRate >= 75) return 1.0 + (0.25 * (completionRate - 75) / 25);
  if (completionRate >= 50) return 0.75 + (0.25 * (completionRate - 50) / 25);
  return 0.75;
}

// 개별 과정 매출 계산
export const computeCourseRevenue = (course: CourseData, year?: number): number => {
  if (year) {
    const adjKey = `조정_${year}년`;
    const yearlyKey = `${year}년`;
    let baseRevenue = course[adjKey] ?? course[yearlyKey] ?? 0;
    if (course[adjKey] === undefined) {
      baseRevenue *= calculateRevenueAdjustmentFactor(course['수료율'] ?? 0);
    }
    return baseRevenue;
  }

  const adjustedCols = ['조정_2021년', '조정_2022년', '조정_2023년', '조정_2024년', '조정_2025년', '조정_2026년'];
  let baseRevenue = adjustedCols.reduce((sum, key) => sum + (course[key] || 0), 0);
  
  if (baseRevenue === 0) {
    baseRevenue = course.조정_실매출대비 ?? course['실 매출 대비'] ?? course.누적매출 ?? 0;
  }

  if (!Object.keys(course).some(k => k.startsWith('조정_'))) {
    baseRevenue *= calculateRevenueAdjustmentFactor(course['수료율'] ?? 0);
  }
  return baseRevenue;
};

export type RevenueMode = 'current' | 'max';

export const computeCourseRevenueByMode = (course: CourseData, year: number | undefined, revenueMode: RevenueMode): number => {
  if (revenueMode === 'current') return computeCourseRevenue(course, year);
  
  const maxRevenue = course['매출 최대'] || 0;
  if (!year) return maxRevenue;

  const yearRevenue = computeCourseRevenue(course, year);
  const totalRevenueBase = computeCourseRevenue(course);
  return Math.min(maxRevenue, yearRevenue);
};

// 기관별 상세 매출 계산
export const calculateInstitutionDetailedRevenue = (data: CourseData[], institutionName: string, year?: number, revenueMode: RevenueMode = 'current'): { courses: CourseData[]; totalRevenue: number } => {
  const filtered = data.filter(c => {
    const inst = groupInstitutionsAdvanced(c);
    const partner = c.leadingCompanyPartnerInstitution ? groupInstitutionsAdvanced(c.leadingCompanyPartnerInstitution) : undefined;
    const isLeading = c.isLeadingCompanyCourse && partner;
    return isLeading ? partner === institutionName : inst === institutionName;
  });

  if (year) {
    const yearFiltered = filtered.filter(c => {
      const start = new Date(c.과정시작일), end = new Date(c.과정종료일);
      return start.getFullYear() === year || (start.getFullYear() < year && end.getFullYear() >= year);
    });
    const totalRevenue = yearFiltered.reduce((sum, c) => sum + computeCourseRevenueByMode(c, year, revenueMode), 0);
    return { courses: yearFiltered, totalRevenue };
  }

  const totalRevenue = filtered.reduce((sum, c) => sum + computeCourseRevenueByMode(c, year, revenueMode), 0);
  return { courses: filtered, totalRevenue };
};

// 기관별 통계 계산
export const calculateInstitutionStats = (data: CourseData[], year?: number, revenueMode: RevenueMode = 'current'): InstitutionStat[] => {
  const institutionNames = Array.from(new Set(data.flatMap(c => {
    const names = [groupInstitutionsAdvanced(c)];
    if (c.leadingCompanyPartnerInstitution) names.push(groupInstitutionsAdvanced(c.leadingCompanyPartnerInstitution));
    return names;
  })));

  const result: InstitutionStat[] = [];

  institutionNames.forEach(institutionName => {
    const detailed = calculateInstitutionDetailedRevenue(data, institutionName, year, revenueMode);
    if (detailed.courses.length === 0) return;

    const aggregated = aggregateCoursesByCourseIdWithLatestInfo(detailed.courses, year, institutionName, revenueMode);
    const totalRevenue = detailed.totalRevenue;

    let totalStudents = 0, completedStudents = 0, totalEmployed = 0;
    let currentYearCoursesCount = 0, prevYearCoursesCount = 0;
    let currentYearStudents = 0, prevYearStudents = 0;
    let currentYearCompletedStudents = 0, prevYearCompletedStudents = 0;

    let totalTargetPop = 0, totalIntegratedEmployed = 0;

    const currentYear = year || new Date().getFullYear();

    detailed.courses.forEach(course => {
      const start = new Date(course.과정시작일), end = new Date(course.과정종료일);
      const isCurrent = start.getFullYear() === currentYear;
      const isPrev = start.getFullYear() < currentYear && end.getFullYear() >= currentYear;

      const empData = getSafeEmploymentData(course);
      
      totalStudents += course['수강신청 인원'] || 0;
      completedStudents += course['수료인원'] || 0;
      if (empData.targetPop !== null && empData.targetPop > 0) {
        totalTargetPop += empData.targetPop;
        totalIntegratedEmployed += empData.employed;
      }

      if (isCurrent) {
        currentYearCoursesCount++;
        currentYearStudents += course['수강신청 인원'] || 0;
        currentYearCompletedStudents += course['수료인원'] || 0;
      } else if (isPrev) {
        prevYearCoursesCount++;
        prevYearStudents += course['수강신청 인원'] || 0;
        prevYearCompletedStudents += course['수료인원'] || 0;
      }
    });

    // 수료율/취업율/만족도 가중 평균
    const completionRate = calculateCompletionRate(detailed.courses, year);
    // ★ [취업인원 / 역산된 구직자수]로 통일 ★
    const employmentRate = totalTargetPop > 0 ? (totalIntegratedEmployed / totalTargetPop) * 100 : 0;

    let satSum = 0, satWeight = 0;
    detailed.courses.forEach(c => {
      if (c.만족도 > 0 && c['수료인원'] > 0) {
        satSum += c.만족도 * c['수료인원'];
        satWeight += c['수료인원'];
      }
    });
    const avgSatisfaction = satWeight > 0 ? satSum / satWeight : 0;

    result.push({
      institutionName,
      totalRevenue,
      totalCourses: `${currentYearCoursesCount}(${prevYearCoursesCount})`,
      totalStudents: `${currentYearStudents}(${prevYearStudents})`,
      completedStudents: `${currentYearCompletedStudents}(${prevYearCompletedStudents})`,
      totalEmployed: totalIntegratedEmployed,
      completionRate,
      employmentRate,
      총취업대상인원: totalTargetPop,
      총통합취업인원: totalIntegratedEmployed,
      avgSatisfaction,
      courses: detailed.courses,
      prevYearStudents,
      prevYearCompletedStudents,
      currentYearCoursesCount,
      prevYearCoursesCount,
      currentYearStudents,
      currentYearCompletedStudents
    });
  });

  return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

export const aggregateCoursesByCourseIdWithLatestInfo = (courses: CourseData[], year?: number, institutionName?: string, revenueMode: RevenueMode = 'current'): AggregatedCourseData[] => {
  const filtered = institutionName ? courses.filter(c => {
    const inst = groupInstitutionsAdvanced(c);
    const partner = c.leadingCompanyPartnerInstitution ? groupInstitutionsAdvanced(c.leadingCompanyPartnerInstitution) : undefined;
    return (c.isLeadingCompanyCourse && partner) ? partner === institutionName : inst === institutionName;
  }) : courses;

  const map = new Map<string, AggregatedCourseData>();
  filtered.forEach(course => {
    const key = String(course['훈련과정 ID'] || course.과정명).trim();
    if (!map.has(key)) {
      map.set(key, {
        과정명: course.과정명, '훈련과정 ID': course['훈련과정 ID'],
        총수강신청인원: 0, 총수료인원: 0, 총취업인원: 0, 총누적매출: 0,
        최소과정시작일: course.과정시작일, 최대과정종료일: course.과정종료일,
        훈련유형들: [], 원천과정수: 0, 총훈련생수: 0, 평균만족도: 0, 평균수료율: 0, 평균취업율: 0
      });
    }
    const agg = map.get(key)!;
    agg.총누적매출 += computeCourseRevenueByMode(course, year, revenueMode);
    agg.총수강신청인원 += course['수강신청 인원'] || 0;
    agg.총수료인원 += course['수료인원'] || 0;
    agg.총취업인원 += getPreferredEmploymentCount(course);
    agg.원천과정수++;
    agg.총훈련생수 += course['수강신청 인원'] || 0;
    if (course.훈련유형 && !agg.훈련유형들.includes(course.훈련유형)) agg.훈련유형들.push(course.훈련유형);
    if (new Date(course.과정시작일) < new Date(agg.최소과정시작일)) agg.최소과정시작일 = course.과정시작일;
    if (new Date(course.과정종료일) > new Date(agg.최대과정종료일)) agg.최대과정종료일 = course.과정종료일;
  });

  map.forEach(agg => {
    const key = String(agg['훈련과정 ID'] || agg.과정명).trim();
    const cList = filtered.filter(c => String(c['훈련과정 ID'] || c.과정명).trim() === key);
    let satSum = 0, satWeight = 0, compSum = 0, compEnroll = 0, targetPop = 0, integratedEmp = 0;
    cList.forEach(c => {
      const empData = getSafeEmploymentData(c);
      if (c.만족도 > 0 && c['수료인원'] > 0) { satSum += c.만족도 * c['수료인원']; satWeight += c['수료인원']; }
      if (c['수료인원'] > 0 && c['수강신청 인원'] > 0) { compSum += c['수료인원']; compEnroll += c['수강신청 인원']; }
      if (empData.targetPop !== null && empData.targetPop > 0) {
        targetPop += empData.targetPop;
        integratedEmp += empData.employed;
      }
    });
    agg.평균만족도 = satWeight > 0 ? satSum / satWeight : 0;
    agg.평균수료율 = compEnroll > 0 ? (compSum / compEnroll) * 100 : 0;
    agg.평균취업율 = targetPop > 0 ? (integratedEmp / targetPop) * 100 : 0;
    agg.총취업대상인원 = targetPop;
    agg.총통합취업인원 = integratedEmp;
  });

  return Array.from(map.values()).sort((a, b) => b.총누적매출 - a.총누적매출);
};

export const calculateLeadingCompanyStats = (courses: CourseData[], year?: number): LeadingCompanyStat[] => {
  const filtered = year ? courses.filter(c => {
    const start = new Date(c.과정시작일), end = new Date(c.과정종료일);
    return start.getFullYear() === year || (start.getFullYear() < year && end.getFullYear() >= year);
  }) : courses;

  const map = new Map<string, any>();
  filtered.forEach(course => {
    const company = course.선도기업;
    if (!company) return;
    if (!map.has(company)) {
      map.set(company, {
        courses: [], totalRevenue: 0, totalCourses: 0, totalStudents: 0, completedStudents: 0,
        compEnrollSum: 0, compSum: 0, satSum: 0, satWeight: 0
      });
    }
    const stat = map.get(company)!;
    stat.courses.push(course);
    stat.totalRevenue += computeCourseRevenue(course, year);
    stat.totalCourses++;
    stat.totalStudents += course['수강신청 인원'] || 0;
    stat.completedStudents += course['수료인원'] || 0;
    if (course['수료인원'] > 0 && course['수강신청 인원'] > 0) {
      stat.compEnrollSum += course['수강신청 인원'];
      stat.compSum += course['수료인원'];
    }
    if (course.만족도 > 0 && course['수료인원'] > 0) {
      stat.satSum += course.만족도 * course['수료인원'];
      stat.satWeight += course['수료인원'];
    }
  });

  return Array.from(map.entries()).map(([leadingCompany, v]) => {
    let targetPop = 0, integratedEmp = 0;
    v.courses.forEach((c: any) => {
      const empData = getSafeEmploymentData(c);
      if (empData.targetPop !== null && empData.targetPop > 0) {
        targetPop += empData.targetPop;
        integratedEmp += empData.employed;
      }
    });
    return {
      leadingCompany,
      totalRevenue: v.totalRevenue,
      totalCourses: v.totalCourses,
      totalStudents: v.totalStudents,
      completedStudents: v.completedStudents,
      completionRate: v.compEnrollSum > 0 ? (v.compSum / v.compEnrollSum) * 100 : 0,
      avgSatisfaction: v.satWeight > 0 ? v.satSum / v.satWeight : 0,
      employmentRate: targetPop > 0 ? (integratedEmp / targetPop) * 100 : 0,
      총취업대상인원: targetPop,
      총통합취업인원: integratedEmp,
      courses: v.courses
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);
};

export const calculateNcsStats = (courses: CourseData[], year?: number): NcsStat[] => {
  const filtered = courses.filter(c => {
    if (!year) return true;
    const start = new Date(c.과정시작일), end = new Date(c.과정종료일);
    return start.getFullYear() === year || (start.getFullYear() < year && end.getFullYear() >= year);
  });

  const ncsMap = new Map<string, {
    ncsName: string;
    totalRevenue: number;
    totalCourses: number;
    totalStudents: number;
    completedStudents: number;
    prevYearStudents: number;
    prevYearCompletedStudents: number;
    compSum: number;
    compEnrollSum: number;
    satSum: number;
    satWeight: number;
    targetPop: number;
    integratedEmp: number;
    courses: CourseData[];
  }>();

  filtered.forEach(c => {
    const key = c.NCS명 || '미분류';
    if (!ncsMap.has(key)) {
      ncsMap.set(key, {
        ncsName: key,
        totalRevenue: 0, totalCourses: 0, totalStudents: 0, completedStudents: 0,
        prevYearStudents: 0, prevYearCompletedStudents: 0,
        compSum: 0, compEnrollSum: 0, satSum: 0, satWeight: 0,
        targetPop: 0, integratedEmp: 0,
        courses: []
      });
    }
    const stat = ncsMap.get(key)!;
    stat.totalRevenue += (c.조정_누적매출 ?? c.누적매출 ?? 0);
    stat.totalCourses += 1;
    
    const empData = getSafeEmploymentData(c);

    const startYear = new Date(c.과정시작일).getFullYear();
    if (year && startYear < year) {
      stat.prevYearStudents += (c['수강신청 인원'] ?? 0);
      stat.prevYearCompletedStudents += (c.수료인원 ?? 0);
    } else {
      stat.totalStudents += (c['수강신청 인원'] ?? 0);
      stat.completedStudents += (c.수료인원 ?? 0);
    }

    stat.compSum += (c.수료인원 ?? 0);
    stat.compEnrollSum += (c['수강신청 인원'] ?? 0);
    stat.satSum += (c.만족도 ?? 0) * (c.수료인원 ?? 0);
    stat.satWeight += (c.수료인원 ?? 0);
    if (empData.targetPop !== null && empData.targetPop > 0) {
      stat.targetPop += empData.targetPop;
      stat.integratedEmp += empData.employed;
    }
    stat.courses.push(c);
  });

  return Array.from(ncsMap.values()).map(v => ({
    ncsName: v.ncsName,
    totalRevenue: v.totalRevenue,
    totalCourses: v.totalCourses,
    totalStudents: v.totalStudents,
    completedStudents: v.completedStudents,
    prevYearStudents: v.prevYearStudents,
    prevYearCompletedStudents: v.prevYearCompletedStudents,
    completionRate: v.compEnrollSum > 0 ? (v.compSum / v.compEnrollSum) * 100 : 0,
    avgSatisfaction: v.satWeight > 0 ? v.satSum / v.satWeight : 0,
    employmentRate: v.targetPop > 0 ? (v.integratedEmp / v.targetPop) * 100 : 0,
    총취업대상인원: v.targetPop,
    총통합취업인원: v.integratedEmp,
    courses: v.courses
  })).sort((a, b) => b.totalRevenue - a.totalRevenue);
};

// 월별 통계 계산
export const calculateMonthlyStats = (data: CourseData[], year: number): MonthlyStats[] => {
  const monthMap = new Map<string, MonthlyStats>();
  
  data.forEach(course => {
    const startDate = new Date(course.과정시작일);
    if (startDate.getFullYear() !== year) return;
    
    const monthKey = `${year}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthKey,
        revenue: 0,
        totalStudents: 0,
        completedStudents: 0,
        courses: [],
        completionRate: 0
      });
    }
    
    const monthly = monthMap.get(monthKey)!;
    monthly.revenue += computeCourseRevenue(course, year);
    monthly.totalStudents += course['수강신청 인원'] || 0;
    monthly.completedStudents += course['수료인원'] || 0;
    monthly.courses.push(course);
  });

  monthMap.forEach((monthly) => {
    monthly.completionRate = monthly.totalStudents > 0 ? (monthly.completedStudents / monthly.totalStudents) * 100 : 0;
  });

  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
};

// 연도별 통계 계산
export const calculateYearlyStats = (data: CourseData[]): YearlyStats[] => {
  const yearMap = new Map<number, YearlyStats>();
  
  data.forEach(course => {
    const year = new Date(course.과정시작일).getFullYear();
    if (!yearMap.has(year)) {
      yearMap.set(year, {
        year,
        revenue: 0,
        totalStudents: 0,
        completedStudents: 0,
        courses: []
      });
    }
    
    const yearly = yearMap.get(year)!;
    yearly.revenue += computeCourseRevenue(course, year);
    yearly.totalStudents += course['수강신청 인원'] || 0;
    yearly.completedStudents += course['수료인원'] || 0;
    yearly.courses.push(course);
  });

  return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
};

// 날짜 파싱 함수
export const parseDate = (value: any): string => {
  if (typeof value === 'string') {
    try {
      const date = new Date(value);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return '';
};

// 원본 데이터 배열 변환(그룹화 포함)
export const transformRawDataArray = (data: any[]): CourseData[] => {
  return transformRawData(data);
};

// 선도기업별 과정 집계
export const aggregateCoursesByCourseNameForLeadingCompany = (courses: CourseData[]): AggregatedCourseData[] => {
  const map = new Map<string, AggregatedCourseData>();
  
  courses.forEach(course => {
    if (!course.선도기업) return;
    const key = String(course['훈련과정 ID'] || course.과정명).trim();
    if (!map.has(key)) {
      map.set(key, {
        과정명: course.과정명, '훈련과정 ID': course['훈련과정 ID'],
        총수강신청인원: 0, 총수료인원: 0, 총취업인원: 0, 총누적매출: 0,
        최소과정시작일: course.과정시작일, 최대과정종료일: course.과정종료일,
        훈련유형들: [], 원천과정수: 0, 총훈련생수: 0, 평균만족도: 0, 평균수료율: 0, 평균취업율: 0
      });
    }
    const agg = map.get(key)!;
    agg.총누적매출 += computeCourseRevenue(course);
    agg.총수강신청인원 += course['수강신청 인원'] || 0;
    agg.총수료인원 += course['수료인원'] || 0;
    agg.총취업인원 += getPreferredEmploymentCount(course);
    agg.원천과정수++;
    agg.총훈련생수 += course['수강신청 인원'] || 0;
    if (course.훈련유형 && !agg.훈련유형들.includes(course.훈련유형)) agg.훈련유형들.push(course.훈련유형);
    if (new Date(course.과정시작일) < new Date(agg.최소과정시작일)) agg.최소과정시작일 = course.과정시작일;
    if (new Date(course.과정종료일) > new Date(agg.최대과정종료일)) agg.최대과정종료일 = course.과정종료일;
  });

  map.forEach(agg => {
    const key = String(agg['훈련과정 ID'] || agg.과정명).trim();
    const cList = courses.filter(c => c.선도기업 && String(c['훈련과정 ID'] || c.과정명).trim() === key);
    let satSum = 0, satWeight = 0, compSum = 0, compEnroll = 0, targetPop = 0, integratedEmp = 0;
    cList.forEach(c => {
      const empData = getSafeEmploymentData(c);
      if (c.만족도 > 0 && c['수료인원'] > 0) { satSum += c.만족도 * c['수료인원']; satWeight += c['수료인원']; }
      if (c['수료인원'] > 0 && c['수강신청 인원'] > 0) { compSum += c['수료인원']; compEnroll += c['수강신청 인원']; }
      if (empData.targetPop !== null && empData.targetPop > 0) {
        targetPop += empData.targetPop;
        integratedEmp += empData.employed;
      }
    });
    agg.평균만족도 = satWeight > 0 ? satSum / satWeight : 0;
    agg.평균수료율 = compEnroll > 0 ? (compSum / compEnroll) * 100 : 0;
    agg.평균취업율 = targetPop > 0 ? (integratedEmp / targetPop) * 100 : 0;
    agg.총취업대상인원 = targetPop;
    agg.총통합취업인원 = integratedEmp;
  });

  return Array.from(map.values()).sort((a, b) => b.총누적매출 - a.총누적매출);
};

// NCS별 과정 집계
export const aggregateCoursesByCourseNameForNcs = (courses: CourseData[]): AggregatedCourseData[] => {
  const map = new Map<string, AggregatedCourseData>();
  
  courses.forEach(course => {
    const key = String(course['훈련과정 ID'] || course.과정명).trim();
    if (!map.has(key)) {
      map.set(key, {
        과정명: course.과정명, '훈련과정 ID': course['훈련과정 ID'],
        총수강신청인원: 0, 총수료인원: 0, 총취업인원: 0, 총누적매출: 0,
        최소과정시작일: course.과정시작일, 최대과정종료일: course.과정종료일,
        훈련유형들: [], 원천과정수: 0, 총훈련생수: 0, 평균만족도: 0, 평균수료율: 0, 평균취업율: 0
      });
    }
    const agg = map.get(key)!;
    agg.총누적매출 += computeCourseRevenue(course);
    agg.총수강신청인원 += course['수강신청 인원'] || 0;
    agg.총수료인원 += course['수료인원'] || 0;
    agg.총취업인원 += getPreferredEmploymentCount(course);
    agg.원천과정수++;
    agg.총훈련생수 += course['수강신청 인원'] || 0;
    if (course.훈련유형 && !agg.훈련유형들.includes(course.훈련유형)) agg.훈련유형들.push(course.훈련유형);
    if (new Date(course.과정시작일) < new Date(agg.최소과정시작일)) agg.최소과정시작일 = course.과정시작일;
    if (new Date(course.과정종료일) > new Date(agg.최대과정종료일)) agg.최대과정종료일 = course.과정종료일;
  });

  map.forEach(agg => {
    const key = String(agg['훈련과정 ID'] || agg.과정명).trim();
    const cList = courses.filter(c => String(c['훈련과정 ID'] || c.과정명).trim() === key);
    let satSum = 0, satWeight = 0, compSum = 0, compEnroll = 0, targetPop = 0, integratedEmp = 0;
    cList.forEach(c => {
      const empData = getSafeEmploymentData(c);
      if (c.만족도 > 0 && c['수료인원'] > 0) { satSum += c.만족도 * c['수료인원']; satWeight += c['수료인원']; }
      if (c['수료인원'] > 0 && c['수강신청 인원'] > 0) { compSum += c['수료인원']; compEnroll += c['수강신청 인원']; }
      if (empData.targetPop !== null && empData.targetPop > 0) {
        targetPop += empData.targetPop;
        integratedEmp += empData.employed;
      }
    });
    agg.평균만족도 = satWeight > 0 ? satSum / satWeight : 0;
    agg.평균수료율 = compEnroll > 0 ? (compSum / compEnroll) * 100 : 0;
    agg.평균취업율 = targetPop > 0 ? (integratedEmp / targetPop) * 100 : 0;
    agg.총취업대상인원 = targetPop;
    agg.총통합취업인원 = integratedEmp;
  });

  return Array.from(map.values()).sort((a, b) => b.총누적매출 - a.총누적매출);
};

// 기관 그룹의 개별 기관 조회
export const getIndividualInstitutionsInGroup = (groupName: string, data: CourseData[]): string[] => {
  const institutions = new Set<string>();
  data.forEach(course => {
    if (groupInstitutionsAdvanced(course) === groupName) {
      institutions.add(course.원본훈련기관 || course.훈련기관);
    }
  });
  return Array.from(institutions).sort();
};
