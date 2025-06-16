import { RawCourseData, CourseData, YearlyStats, MonthlyStats } from "@/lib/data-utils";
import Papa from 'papaparse';
import { parseNumber, parsePercentage, parseDate, transformRawDataToCourseData } from "@/lib/data-utils";

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
  const processedData = rawData.map((row: any) => {
    // 각 row를 CourseData 형식으로 변환
    return transformRawDataToCourseData(row);
  });
  return processedData;
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
//  • 1‒6단계의 로그형 완만한 곡선을 형성
export const calculateRevenueAdjustmentFactor = (completionRate: number): number => {
  // 0~100 사이로 클램프
  const rate = Math.max(0, Math.min(100, completionRate));

  const minFactor = 0.5;   // 단계 6(최저)
  const maxFactor = 1.25;  // 단계 1(최고)
  const k = 1.6;           // 곡선 정도(≈50%→0.75 만족)

  const factor = minFactor + (maxFactor - minFactor) * Math.pow(rate / 100, k);
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
  const currentDate = new Date();

  // 연도 범위 결정
  const startYear = year ?? 2021;
  const endYear = year ?? currentDate.getFullYear();

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
    if ((course.수료인원 ?? 0) > 0) {
      const courseId = course.과정ID || course.과정명;
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

// 원본 매출이 없거나 과정이 시작 전이면 원본 유지
// 수강신청 인원이 없으면 원본 유지
// 실제 수료율(0~1). 진행 중인 과정은 전체 평균*진행률 로 추정
// 새 로그형 계수 적용 (completionRate는 % 단위)
export const calculateAdjustedRevenueForCourse = (
  course: CourseData,
  overallCompletionRate: number,
  currentDate: Date
): number => {
  if ((course.누적매출 ?? 0) === 0 || new Date(course.과정시작일) > currentDate) {
    return course.누적매출 ?? 0;
  }

  if ((course['수강신청 인원'] ?? 0) === 0) {
    return course.누적매출 ?? 0;
  }

  let actualCompletionRate = (course['수료인원'] ?? 0) / (course['수강신청 인원'] ?? 1);

  if (new Date(course.과정종료일) > currentDate) {
    const totalDuration = (new Date(course.과정종료일).getTime() - new Date(course.과정시작일).getTime());
    const elapsedDuration = (currentDate.getTime() - new Date(course.과정시작일).getTime());
    const progressRatio = totalDuration > 0 ? Math.min(Math.max(elapsedDuration / totalDuration, 0), 1) : 0;

    if ((course['수료인원'] ?? 0) === 0) {
      actualCompletionRate = (overallCompletionRate / 100) * progressRatio;
    }
  }

  const adjustmentFactor = calculateRevenueAdjustmentFactor(actualCompletionRate * 100);

  return (course.누적매출 ?? 0) * adjustmentFactor;
};

// Main function to apply revenue adjustments to a list of courses
export const applyRevenueAdjustment = (
  courses: CourseData[],
  overallCompletionRate: number
): CourseData[] => {
  const currentDate = new Date();

  return courses.map(course => {
    // Calculate adjusted 누적매출
    const adjustedTotalRevenue = calculateAdjustedRevenueForCourse(course, overallCompletionRate, currentDate);

    // Calculate adjusted yearly revenues
    const adjustedYearlyRevenues: { [key: string]: number | undefined } = {};
    const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'];
    yearColumns.forEach(yearCol => {
      const originalYearlyRevenue = course[yearCol] as number | undefined; // Access directly as number or undefined
      if (originalYearlyRevenue !== undefined) {
        adjustedYearlyRevenues[`조정_${yearCol}`] = adjustYearlyRevenue(
          course,
          originalYearlyRevenue
        );
      }
    });

    return {
      ...course,
      조정_누적매출: adjustedTotalRevenue,
      ...adjustedYearlyRevenues, // Add adjusted yearly revenues
    };
  });
};

// `yearly-analysis/page.tsx`에서 이 인터페이스를 사용할 수 있도록 명시적으로 내보냅니다.
export type { YearlyStats, MonthlyStats };

export function calculateCompletionRate(data: CourseData[], year?: number): number {
  const currentDate = new Date();
  // 21일 전 날짜 계산
  const twentyOneDaysAgo = new Date(currentDate.getTime() - 21 * 24 * 60 * 60 * 1000);

  // 1. 과정종료일 기준으로 필터링
  let filteredData = data.filter(course => {
    const endDate = new Date(course.과정종료일);
    // 2. 과정종료일이 현재 날짜 기준으로 21일 이전인 과목만 포함
    return endDate <= twentyOneDaysAgo;
  });

  // 3. 수료인원이 0명인 경우 제외
  filteredData = filteredData.filter(course => (course['수료인원'] ?? 0) > 0);

  if (filteredData.length === 0) {
    return 0;
  }

  // 전체 수료인원과 수강신청 인원 계산
  const totalCompletion = filteredData.reduce((sum, course) => sum + (course['수료인원'] ?? 0), 0);
  const totalEnrollment = filteredData.reduce((sum, course) => sum + (course['수강신청 인원'] ?? 0), 0);

  if (totalEnrollment === 0) {
    return 0;
  }

  // 수료율 계산 (소수점 첫째자리까지)
  const completionRate = (totalCompletion / totalEnrollment) * 100;
  return Number(completionRate.toFixed(1));
}

// 훈련기관 그룹화 함수 (Python의 group_institutions_advanced를 TypeScript로 변환)
export const groupInstitutions = (data: CourseData[]): CourseData[] => {
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
    '이스트소프트': ['이스트소프트','(주)이스트소프트']
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