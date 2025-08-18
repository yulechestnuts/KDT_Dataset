import { CourseData, YearlyStats, MonthlyStats, parseNumber, parsePercentage, parseDate, transformRawDataToCourseData, transformRawDataArray, calculateRevenueAdjustmentFactor, computeCourseRevenue, calculateMonthlyStatistics as libCalculateMonthlyStatistics, calculateCompletionRate as libCalculateCompletionRate, groupInstitutionsAdvanced, calculateInstitutionStats as libCalculateInstitutionStats, aggregateCoursesByCourseIdWithLatestInfo, calculateInstitutionDetailedRevenue, getPreferredEmploymentCount, calculateCompletionRate, calculateInstitutionStats, getIndividualInstitutionsInGroup } from "@/lib/data-utils";
import Papa from 'papaparse';

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

// lib/data-utils에서 임포트한 함수들을 다시 내보냅니다.
export { aggregateCoursesByCourseIdWithLatestInfo, calculateInstitutionDetailedRevenue, getPreferredEmploymentCount, calculateCompletionRate, calculateInstitutionStats, getIndividualInstitutionsInGroup };

export const getTopInstitutionByMonth = (
  data: CourseData[],
  year: number,
  month: number
): { month: string; institutionName: string; totalRevenue: number }[] => {
  const monthlyRevenueMap = new Map<string, Map<string, number>>(); // month -> institutionName -> revenue

  data.forEach(course => {
    const courseStartDate = new Date(course.과정시작일);
    const courseStartYear = courseStartDate.getFullYear();
    const courseStartMonth = courseStartDate.getMonth() + 1;

    // 요청된 연도와 월에 시작된 과정만 고려
    if (courseStartYear === year && courseStartMonth === month) {
      const institutionName = course.훈련기관;
      if (!institutionName) return;

      const monthKey = `${year}-${String(month).padStart(2, '0')}`;

      if (!monthlyRevenueMap.has(monthKey)) {
        monthlyRevenueMap.set(monthKey, new Map<string, number>());
      }
      const institutionRevenueMap = monthlyRevenueMap.get(monthKey)!;

      // 해당 과정의 총 매출액을 가져옴 (조정된 누적매출 또는 누적매출 사용)
      const courseRevenue = course.조정_누적매출 ?? course.누적매출 ?? 0;

      institutionRevenueMap.set(
        institutionName,
        (institutionRevenueMap.get(institutionName) || 0) + courseRevenue
      );
    }
  });

  const topInstitutions: { month: string; institutionName: string; totalRevenue: number }[] = [];

  monthlyRevenueMap.forEach((institutionRevenueMap, monthKey) => {
    let topInstitutionName = '';
    let maxRevenue = 0;

    institutionRevenueMap.forEach((revenue, institutionName) => {
      if (revenue > maxRevenue) {
        maxRevenue = revenue;
        topInstitutionName = institutionName;
      }
    });

    if (topInstitutionName) {
      topInstitutions.push({
        month: monthKey,
        institutionName: topInstitutionName,
        totalRevenue: maxRevenue,
      });
    }
  });

  // 월별로 정렬
  return topInstitutions.sort((a, b) => {
    const [aYear, aMonth] = a.month.split('-').map(Number);
    const [bYear, bMonth] = b.month.split('-').map(Number);
    if (aYear !== bYear) return aYear - bYear;
    return aMonth - bMonth;
  });
};