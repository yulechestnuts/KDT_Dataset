import { RawCourseData, CourseData, YearlyStats, MonthlyStats } from "@/lib/data-utils";
import Papa from 'papaparse';
import { parseNumber, parsePercentage, parseDate, transformRawDataToCourseData, transformRawDataArray } from "@/lib/data-utils";

// 메인 데이터 로딩 함수
export const loadDataFromGithub = async (): Promise<string> => {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Error loading data:', error);
    throw error;
  }
};

// 데이터 전처리
export const preprocessData = (rawData: any[]): CourseData[] => {
  // transformRawDataArray를 사용하여 그룹화까지 포함한 전처리 수행
  return transformRawDataArray(rawData);
};

export const generateYearlyStats = (data: CourseData[]): YearlyStats[] => {
  const yearlyMap = new Map<number, YearlyStats>();
  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'];

  // 모든 관련 연도에 대해 yearlyMap 초기화
  yearColumns.forEach(yearCol => {
    const year = parseInt(yearCol.replace('년', ''));
    yearlyMap.set(year, {
      year: year,
      revenue: 0,
      totalStudents: 0,
      completedStudents: 0,
      courses: [],
    });
  });

  data.forEach((course) => {
    // 각 과정의 조정된 연도별 매출을 해당 연도에 합산
    yearColumns.forEach(yearCol => {
      const year = parseInt(yearCol.replace('년', ''));
      // 조정된 연도별 매출(예: '조정_2021년')이 있으면 사용하고, 없으면 원본 연도별 매출(예: '2021년') 사용
      const adjustedYearlyRevenue = course[`조정_${yearCol}`] ?? course[yearCol];
      
      if (typeof adjustedYearlyRevenue === 'number' && yearlyMap.has(year)) {
        const stats = yearlyMap.get(year)!;
        stats.revenue += adjustedYearlyRevenue;
      }
    });

    // 학생 수와 과정 정보는 과정 시작 연도에만 합산 (이전 로직 유지)
    const startYear = new Date(course.과정시작일).getFullYear();
    if (yearlyMap.has(startYear)) {
      const stats = yearlyMap.get(startYear)!;
      stats.totalStudents += course['수강신청 인원'] ?? 0;
      stats.completedStudents += course.수료인원 ?? 0;
      stats.courses.push(course);
    }
  });

  return Array.from(yearlyMap.values()).sort((a, b) => a.year - b.year);
};

// 수료율(%)에 따른 매출액 조정 계수 계산
// 요구 사항:
//  • 0%  → 0.5배 이하
//  • 50% → 0.75배
//  • 100%→ 1.25배 (최대)
//  • p=2 기반 지수함수형 곡선
export const calculateRevenueAdjustmentFactor = (completionRate: number): number => {
  // 0~100 사이로 클램프
  const rate = Math.max(0, Math.min(100, completionRate));
  
  // p=2 기반 지수함수형 보정 (y = min + (max-min)*(1 - a^(-b*rate)))
  const minFactor = 0.5;   // 최소값
  const maxFactor = 1.25;  // 최대값
  const a = 2;             // 지수함수 기수
  const b = 2;             // p값 (곡선 강도)
  
  const normalizedRate = rate / 100; // 0~1 범위로 정규화
  const expFactor = 1 - Math.pow(a, -b * normalizedRate);
  const factor = minFactor + (maxFactor - minFactor) * expFactor;
  
  return Math.min(Math.max(factor, minFactor), maxFactor);
};

export const adjustYearlyRevenue = (course: CourseData, yearlyRevenue: number): number => {
  const completionRate = course.수료율 ?? 0;
  const adjustmentFactor = calculateRevenueAdjustmentFactor(completionRate);
  return yearlyRevenue * adjustmentFactor;
};

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
      const adjustedYearlyRevenueKey = `조정_${yearColumn}` as keyof CourseData;
      const adjustedRevenue = course[adjustedYearlyRevenueKey] as number | undefined;

      if (adjustedRevenue !== undefined && adjustedRevenue > 0) {
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
      const validCourses = stats.courses.filter(course => (course.수료인원 ?? 0) > 0);
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

// 실제 수료율(0~1). 진행 중인 과정은 전체 평균*진행률 로 추정
// 새 로그형 계수 적용 (completionRate는 % 단위)
export const calculateAdjustedRevenueForCourse = (
  course: CourseData,
  overallCompletionRate: number,
  courseCompletionRate?: number, // 동일 훈련과정의 평균 수료율
  institutionCompletionRate?: number, // 동일 훈련기관의 평균 수료율
  isFirstTimeCourse?: boolean // 초회차 여부
): number => {
  // 1) 원본 매출값 결정: 누적매출을 우선 사용, 없으면 '실 매출 대비' 사용
  const originalRevenue = course.누적매출 ?? course['실 매출 대비'] ?? 0;

  // 2) 매출이 없으면 보정 없이 반환
  if (originalRevenue === 0) {
    return originalRevenue;
  }

  // 3) 수강신청 인원이 0이면 보정 계산이 불가능하므로 그대로 반환
  if ((course['수강신청 인원'] ?? 0) === 0) {
    return originalRevenue;
  }

  // 4) 실제 수료율 계산
  let actualCompletionRate = (course['수료인원'] ?? 0) / (course['수강신청 인원'] ?? 1);
  let usedCompletionRate = actualCompletionRate * 100;

  // 수료인원이 0인 경우, 또는 초회차인 경우 예상 수료율 결정
  if ((course['수료인원'] ?? 0) === 0 || isFirstTimeCourse) {
    let estimatedCompletionRate = 0;
    
    // 1순위: 동일 훈련과정ID의 평균 수료율
    if (courseCompletionRate !== undefined && courseCompletionRate > 0) {
      estimatedCompletionRate = courseCompletionRate;
    } 
    // 2순위: 동일 훈련기관의 평균 수료율
    else if (institutionCompletionRate !== undefined && institutionCompletionRate > 0) {
      estimatedCompletionRate = institutionCompletionRate;
    } 
    // 3순위: 전체 평균 수료율
    else {
      estimatedCompletionRate = overallCompletionRate;
    }
    
    actualCompletionRate = estimatedCompletionRate / 100; // %를 비율로 변환
    usedCompletionRate = estimatedCompletionRate;
  }

  const adjustmentFactor = calculateRevenueAdjustmentFactor(usedCompletionRate);
  const adjustedRevenue = originalRevenue * adjustmentFactor;

  return adjustedRevenue;
};

// Main function to apply revenue adjustments to a list of courses
export const applyRevenueAdjustment = (
  courses: CourseData[],
  overallCompletionRate: number
): CourseData[] => {
  // 1. 동일 훈련과정 ID별 평균 수료율 계산 (수료인원 0인 과정 제외)
  const courseCompletionRates = new Map<string, number>();
  if (courses.length > 0 && '훈련과정 ID' in courses[0]) {
    const validCoursesById = courses.filter(c => (c.수료인원 ?? 0) > 0 && (c['수강신청 인원'] ?? 0) > 0);
    validCoursesById.forEach(course => {
      const courseId = course['훈련과정 ID'];
      if (courseId) { // 훈련과정 ID가 유효한 경우에만 처리
        const currentSum = courseCompletionRates.get(courseId + '_sum') || 0;
        const currentCount = courseCompletionRates.get(courseId + '_count') || 0;
        courseCompletionRates.set(courseId + '_sum', currentSum + ((course.수료인원 ?? 0) / (course['수강신청 인원'] ?? 1) * 100));
        courseCompletionRates.set(courseId + '_count', currentCount + 1);
      }
    });
    courseCompletionRates.forEach((value, key) => {
      if (key.endsWith('_sum')) {
        const courseId = key.replace('_sum', '');
        if (courseId) { // courseId가 유효한 경우에만 처리
          const sum = value;
          const count = courseCompletionRates.get(courseId + '_count') || 1;
          courseCompletionRates.set(courseId, sum / count);
        }
      }
    });
  } else {
    console.warn("경고: '훈련과정 ID' 컬럼이 없어 과정별 평균 수료율을 계산할 수 없습니다.");
  }

  // 2. 동일 훈련기관별 평균 수료율 계산 (수료인원 0인 과정 제외)
  const institutionCompletionRates = new Map<string, number>();
  if (courses.length > 0 && '훈련기관' in courses[0]) {
    const validCoursesByInstitution = courses.filter(c => (c.수료인원 ?? 0) > 0 && (c['수강신청 인원'] ?? 0) > 0);
    validCoursesByInstitution.forEach(course => {
      const institutionName = course.훈련기관;
      if (institutionName) {
        const currentSum = institutionCompletionRates.get(institutionName + '_sum') || 0;
        const currentCount = institutionCompletionRates.get(institutionName + '_count') || 0;
        institutionCompletionRates.set(institutionName + '_sum', currentSum + ((course.수료인원 ?? 0) / (course['수강신청 인원'] ?? 1) * 100));
        institutionCompletionRates.set(institutionName + '_count', currentCount + 1);
      }
    });
    institutionCompletionRates.forEach((value, key) => {
      if (key.endsWith('_sum')) {
        const institutionName = key.replace('_sum', '');
        const sum = value;
        const count = institutionCompletionRates.get(institutionName + '_count') || 1;
        institutionCompletionRates.set(institutionName, sum / count);
      }
    });
  } else {
    console.warn("경고: '훈련기관' 컬럼이 없어 기관별 평균 수료율을 계산할 수 없습니다.");
  }

  // 3. 초회차 여부 판단 (훈련과정 ID와 과정시작일 기준)
  const firstTimeCourses = new Set<string>(); // 고유값 (unique ID)
  const courseIdStartDateMap = new Map<string, Date>(); // 훈련과정 ID -> 가장 빠른 시작일

  courses.forEach(course => {
    if (course['훈련과정 ID']) { // 훈련과정 ID가 유효한 경우에만 처리
      const currentStartDate = new Date(course.과정시작일);
      if (!courseIdStartDateMap.has(course['훈련과정 ID']) || currentStartDate < (courseIdStartDateMap.get(course['훈련과정 ID']) || new Date())) {
        courseIdStartDateMap.set(course['훈련과정 ID'], currentStartDate);
      }
    }
  });

  courses.forEach(course => {
    if (course['훈련과정 ID'] && courseIdStartDateMap.has(course['훈련과정 ID'])) { // 훈련과정 ID가 유효하고 맵에 존재하는 경우에만 처리
      if (new Date(course.과정시작일).getTime() === courseIdStartDateMap.get(course['훈련과정 ID'])!.getTime()) {
        firstTimeCourses.add(course.고유값); // 고유값으로 초회차 과정 식별
      }
    }
  });

  // 1차: 기존 보정 로직으로 코스별 조정 매출 산출
  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'] as const;

  // 1차 결과를 저장하고, 2차 스케일링 단계에서 재사용
  const intermediate = courses.map(course => {
    const isFirstTime = firstTimeCourses.has(course.고유값);
    const currentCourseCompletionRate = course['훈련과정 ID'] ? courseCompletionRates.get(course['훈련과정 ID']) : undefined;
    const currentInstitutionCompletionRate = course.훈련기관 ? institutionCompletionRates.get(course.훈련기관) : undefined;

    // Calculate adjusted 누적매출
    const adjustedTotalRevenue = calculateAdjustedRevenueForCourse(
      course,
      overallCompletionRate,
      currentCourseCompletionRate,
      currentInstitutionCompletionRate,
      isFirstTime
    );

    // Calculate adjusted yearly revenues
    const adjustedYearlyRevenues: { [key: string]: number | undefined } = {};
    yearColumns.forEach(yearCol => {
      const originalYearlyRevenue = course[yearCol] as number | undefined;
      if (originalYearlyRevenue !== undefined) {
        // 연도별 매출도 동일한 로직으로 조정
        adjustedYearlyRevenues[`조정_${yearCol}`] = calculateAdjustedRevenueForCourse(
          { ...course, 누적매출: originalYearlyRevenue, '실 매출 대비': originalYearlyRevenue }, // 임시로 누적매출과 실매출대비에 연도별 매출 할당
          overallCompletionRate,
          currentCourseCompletionRate,
          currentInstitutionCompletionRate,
          isFirstTime
        );
      }
    });

    return {
      ...course,
      조정_실매출대비: adjustedTotalRevenue,
      조정_누적매출: adjustedTotalRevenue,
      ...adjustedYearlyRevenues,
    };
  }); // ← intermediate

  /**
   * ===== 2차 스케일링 제거 =====
   *   p=2 기반 보정 효과만 유지
   */
  
  // 최종 조정된 데이터 반환 (1차 보정만 적용)
  return intermediate;
};

// `yearly-analysis/page.tsx`에서 이 인터페이스를 사용할 수 있도록 명시적으로 내보냅니다.
export type { YearlyStats, MonthlyStats };

export function calculateCompletionRate(data: CourseData[], year?: number): number {
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

// 훈련기관 그룹화 함수 (Python의 group_institutions_advanced를 TypeScript로 변환)
export const groupInstitutions = (data: CourseData[]): CourseData[] => {
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

  const groupedNames: { [key: string]: string } = {}; // clean_name -> group_name 매핑

  return data.map(course => {
    if (!course.훈련기관) return course;

    // 1. 훈련기관명 전처리 (특수문자 제거, 공백 정리, 대문자 변환)
    let cleanName = course.훈련기관.replace(/[^가-힣A-Za-z0-9\s()]/g, '');
    cleanName = cleanName.replace(/\s+/g, ' ').trim().toUpperCase();

    let assignedGroup = false;
    for (const groupName in institutionGroups) {
      if (institutionGroups.hasOwnProperty(groupName)) {
        const keywords = institutionGroups[groupName];
        for (const keyword of keywords) {
          if (cleanName.includes(keyword.toUpperCase())) {
            groupedNames[cleanName] = groupName;
            assignedGroup = true;
            break;
          }
        }
      }
      if (assignedGroup) {
        break;
      }
    }

    if (!assignedGroup) {
      groupedNames[cleanName] = cleanName; // 그룹에 속하지 않으면 원래 기관명 유지
    }

    return {
      ...course,
      훈련기관: groupedNames[cleanName] // 그룹화된 이름으로 업데이트
    };
  });
};

// 훈련기관 통계 계산 함수
export interface InstitutionStats {
  institutionName: string;
  totalRevenue: number;
  totalCourses: number;
  totalStudents: number;
  completedStudents: number;
  averageCompletionRate: number;
  averageSatisfaction: number;
}

export const calculateInstitutionStats = (data: CourseData[]): InstitutionStats[] => {
  const institutionMap = new Map<string, {
    revenue: number;
    courses: number;
    students: number;
    completed: number;
    satisfactionSum: number;
    satisfactionCount: number;
  }>();

  data.forEach(course => {
    const institutionName = course.훈련기관 || '알 수 없는 기관';
    if (!institutionMap.has(institutionName)) {
      institutionMap.set(institutionName, {
        revenue: 0,
        courses: 0,
        students: 0,
        completed: 0,
        satisfactionSum: 0,
        satisfactionCount: 0,
      });
    }
    const stats = institutionMap.get(institutionName)!;

    // 매출 합산 (조정된 연도별 매출 사용)
    const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'] as const;
    yearColumns.forEach(yearCol => {
      const adjustedRevenueKey = `조정_${yearCol}` as keyof CourseData;
      const adjustedRevenue = course[adjustedRevenueKey] as number | undefined;
      if (adjustedRevenue !== undefined) {
        stats.revenue += adjustedRevenue;
      }
    });

    stats.courses += 1;
    stats.students += course['수강신청 인원'] ?? 0;
    stats.completed += course.수료인원 ?? 0;

    // 만족도 가중 평균 계산을 위한 합산
    if ((course.만족도 ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
      stats.satisfactionSum += (course.만족도 ?? 0) * (course['수강신청 인원'] ?? 0);
      stats.satisfactionCount += (course['수강신청 인원'] ?? 0);
    }
  });

  const result: InstitutionStats[] = [];
  institutionMap.forEach((stats, name) => {
    const totalEnrollmentForCompletion = stats.students;
    const totalCompletionForCompletion = stats.completed;
    const averageCompletionRate = totalEnrollmentForCompletion > 0 
      ? (totalCompletionForCompletion / totalEnrollmentForCompletion) * 100 
      : 0;

    const averageSatisfaction = stats.satisfactionCount > 0 
      ? stats.satisfactionSum / stats.satisfactionCount 
      : 0;

    result.push({
      institutionName: name,
      totalRevenue: stats.revenue,
      totalCourses: stats.courses,
      totalStudents: stats.students,
      completedStudents: stats.completed,
      averageCompletionRate: parseFloat(averageCompletionRate.toFixed(1)),
      averageSatisfaction: parseFloat(averageSatisfaction.toFixed(1)),
    });
  });

  // 매출 기준으로 내림차순 정렬
  return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
};