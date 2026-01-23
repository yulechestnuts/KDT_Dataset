// 집계 로직

import {
  ProcessedCourseData,
  InstitutionStat,
  YearlyStat,
  MonthlyStat,
  RevenueMode,
} from './types';
import { groupInstitutionsAdvanced } from './institution-grouping';
import {
  computeCourseRevenueByMode,
  calculateRevenueShare,
  calculateStudentShare,
} from './revenue-engine';
import {
  calculateCompletionRate,
  calculateEmploymentRate,
  calculateWeightedSatisfaction,
  getPreferredEmploymentCount,
  classifyYearValues,
  formatXyDisplay,
  formatRateDetail,
  isCourseOldEnoughForCompletionRate,
} from './performance-engine';
import { parseDate } from './parsers';

/**
 * 기관별 상세 매출 계산
 */
export function calculateInstitutionDetailedRevenue(
  allCourses: ProcessedCourseData[],
  institutionName: string,
  year?: number,
  revenueMode: RevenueMode = 'current'
): {
  courses: ProcessedCourseData[];
  totalRevenue: number;
} {
  let totalRevenue = 0.0;
  const coursesForInstitution: ProcessedCourseData[] = [];

  for (const course of allCourses) {
    const revenueShare = calculateRevenueShare(course, institutionName, groupInstitutionsAdvanced);

    if (revenueShare > 0) {
      const courseRevenue =
        computeCourseRevenueByMode(course, year, revenueMode) * revenueShare;
      totalRevenue += courseRevenue;

      // 매출을 할당하여 과정 복사
      const courseCopy = { ...course, 총누적매출: courseRevenue };
      coursesForInstitution.push(courseCopy);
    }
  }

  return {
    courses: coursesForInstitution,
    totalRevenue,
  };
}

/**
 * 기관별 통계 계산
 */
export function calculateInstitutionStats(
  allCourses: ProcessedCourseData[],
  year?: number,
  revenueMode: RevenueMode = 'current'
): InstitutionStat[] {
  // 모든 기관명 추출 (그룹화된 기관명 기준)
  const allInstitutionNames = new Set<string>();

  for (const course of allCourses) {
    const trainingInstitution = groupInstitutionsAdvanced(course.훈련기관);
    allInstitutionNames.add(trainingInstitution);

    if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
      const partnerInstitution = groupInstitutionsAdvanced(course.leadingCompanyPartnerInstitution);
      allInstitutionNames.add(partnerInstitution);
    }
  }

  const result: InstitutionStat[] = [];
  const targetYear = year || new Date().getFullYear();

  for (const institutionName of allInstitutionNames) {
    // 상세 매출 계산
    const detailed = calculateInstitutionDetailedRevenue(
      allCourses,
      institutionName,
      year,
      revenueMode
    );

    const courses = detailed.courses;
    const totalRevenue = detailed.totalRevenue;

    if (courses.length === 0) {
      continue;
    }

    // 학생수/수료인원/과정수 계산
    let currentYearCoursesCount = 0;
    let prevYearCoursesCount = 0;
    let currentYearStudents = 0;
    let prevYearStudents = 0;
    let currentYearCompletedStudents = 0;
    let prevYearCompletedStudents = 0;
    let totalEmployed = 0;

    for (const course of courses) {
      const yearClassification = classifyYearValues(course, targetYear);
      const studentShare = calculateStudentShare(course, institutionName, groupInstitutionsAdvanced);

      const enrollment = course['수강신청 인원'] || 0;
      const completed = course.수료인원 || 0;
      const employed = getPreferredEmploymentCount(course);

      if (yearClassification.is_current_year_start) {
        currentYearCoursesCount += studentShare > 0 ? 1 : 0;
        currentYearStudents += enrollment * studentShare;
        if (yearClassification.is_current_year_end) {
          currentYearCompletedStudents += completed * studentShare;
          totalEmployed += employed * studentShare;
        }
      } else if (yearClassification.is_prev_year_start_ongoing) {
        prevYearCoursesCount += studentShare > 0 ? 1 : 0;
        prevYearStudents += enrollment * studentShare;
        if (yearClassification.is_current_year_end) {
          prevYearCompletedStudents += completed * studentShare;
          totalEmployed += employed * studentShare;
        }
      }
    }

    // 수료율 계산 (3주 규칙 적용)
    const validCoursesForCompletion = courses.filter((c) => {
      return (
        c.수료인원 > 0 &&
        c['수강신청 인원'] > 0 &&
        isCourseOldEnoughForCompletionRate(c)
      );
    });

    let totalValidStudents = 0;
    let totalValidGraduates = 0;

    for (const course of validCoursesForCompletion) {
      const studentShare = calculateStudentShare(course, institutionName, groupInstitutionsAdvanced);
      totalValidStudents += (course['수강신청 인원'] || 0) * studentShare;
      totalValidGraduates += (course.수료인원 || 0) * studentShare;
    }

    const completionRate =
      totalValidStudents > 0 ? (totalValidGraduates / totalValidStudents) * 100 : 0.0;

    // 취업율 계산
    const totalCompletedForEmployment = currentYearCompletedStudents + prevYearCompletedStudents;
    const employmentRate =
      totalCompletedForEmployment > 0 ? (totalEmployed / totalCompletedForEmployment) * 100 : 0.0;

    // 평균 만족도 계산
    const avgSatisfaction = calculateWeightedSatisfaction(courses);

    // 모집률 계산
    const totalCapacity = courses.reduce((sum, c) => {
      const studentShare = calculateStudentShare(c, institutionName, groupInstitutionsAdvanced);
      return sum + (c.정원 || 0) * studentShare;
    }, 0);
    const recruitmentRate =
      totalCapacity > 0 ? ((currentYearStudents + prevYearStudents) / totalCapacity) * 100 : 0.0;

    result.push({
      institution_name: institutionName,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_courses_display: formatXyDisplay(currentYearCoursesCount, prevYearCoursesCount),
      total_students_display: formatXyDisplay(
        Math.round(currentYearStudents),
        Math.round(prevYearStudents)
      ),
      completed_students_display: formatXyDisplay(
        Math.round(currentYearCompletedStudents),
        Math.round(prevYearCompletedStudents)
      ),
      total_employed: Math.round(totalEmployed),
      completion_rate: Math.round(completionRate * 10) / 10,
      employment_rate: Math.round(employmentRate * 10) / 10,
      avg_satisfaction: avgSatisfaction,
      completion_rate_detail: formatRateDetail(
        Math.round(totalValidGraduates),
        Math.round(totalValidStudents),
        completionRate
      ),
      employment_rate_detail: formatRateDetail(
        Math.round(totalEmployed),
        Math.round(totalCompletedForEmployment),
        employmentRate
      ),
      recruitment_rate_detail: formatRateDetail(
        Math.round(currentYearStudents + prevYearStudents),
        Math.round(totalCapacity),
        recruitmentRate
      ),
      courses: courses,
      year: year,
      revenue_mode: revenueMode,
    });
  }

  // 매출액 기준 내림차순 정렬
  result.sort((a, b) => b.total_revenue - a.total_revenue);

  return result;
}

/**
 * 연도별 통계 계산
 */
export function calculateYearlyStats(
  courses: ProcessedCourseData[],
  year: number
): YearlyStat {
  const yearData = courses.filter((course) => {
    const startDate = parseDate(course.과정시작일);
    return startDate.getFullYear() === year;
  });

  const totalStudents = yearData.reduce((sum, course) => sum + (course['수강신청 인원'] || 0), 0);
  const completedStudents = yearData.reduce((sum, course) => sum + (course.수료인원 || 0), 0);
  const totalEmployed = yearData.reduce(
    (sum, course) => sum + getPreferredEmploymentCount(course),
    0
  );
  const revenue = yearData.reduce((sum, course) => {
    const yearKey = `${year}년` as keyof ProcessedCourseData;
    return sum + ((course[yearKey] as number) || 0);
  }, 0);

  const completionRate = calculateCompletionRate(courses, year);
  const employmentRate = calculateEmploymentRate(courses);
  const avgSatisfaction = calculateWeightedSatisfaction(courses);

  const institutions = new Set(yearData.map((c) => c.훈련기관));

  return {
    year,
    total_revenue: revenue,
    total_students: totalStudents,
    completed_students: completedStudents,
    total_employed: totalEmployed,
    overall_completion_rate: completionRate,
    overall_employment_rate: employmentRate,
    avg_satisfaction: avgSatisfaction,
    course_count: yearData.length,
    institution_count: institutions.size,
  };
}

/**
 * 월별 통계 계산
 */
export function calculateMonthlyStatistics(
  courses: ProcessedCourseData[],
  year?: number
): MonthlyStat[] {
  const monthlyMap = new Map<string, MonthlyStat>();

  // 연도 범위 결정
  const startYear = year ?? 2021;
  const endYear = year ?? 2026;

  // 선택된 연도 범위의 모든 월 초기화
  for (let y = startYear; y <= endYear; y++) {
    for (let i = 0; i < 12; i++) {
      const monthName = `${y}-${String(i + 1).padStart(2, '0')}`;
      monthlyMap.set(monthName, {
        month: monthName,
        revenue: 0,
        total_students: 0,
        completed_students: 0,
        completion_rate: 0,
        course_count: 0,
        courses: [],
      });
    }
  }

  // 과정별 매출 분배
  for (const course of courses) {
    const courseStartDate = parseDate(course.과정시작일);
    const courseEndDate = parseDate(course.과정종료일);

    // 선택된 연도에 해당하는 과정만 처리
    for (let y = startYear; y <= endYear; y++) {
      const yearKey = `${y}년` as keyof ProcessedCourseData;
      const adjustedRevenue = (course[yearKey] as number) || 0;

      if (adjustedRevenue > 0) {
        let monthsInThisCourseYear = 0;
        const currentYearMonths: string[] = [];

        const iterStartMonth =
          y === courseStartDate.getFullYear() ? courseStartDate.getMonth() : 0;
        const iterEndMonth = y === courseEndDate.getFullYear() ? courseEndDate.getMonth() : 11;

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
          for (const monthName of currentYearMonths) {
            const stats = monthlyMap.get(monthName);
            if (stats) {
              stats.revenue += revenuePerMonth;
            }
          }
        }
      }

      // 학생 수 및 과정 정보는 과정 시작 월에만 추가
      const courseStartMonthName = `${courseStartDate.getFullYear()}-${String(
        courseStartDate.getMonth() + 1
      ).padStart(2, '0')}`;
      if (monthlyMap.has(courseStartMonthName) && courseStartDate.getFullYear() === y) {
        const stats = monthlyMap.get(courseStartMonthName)!;
        stats.total_students += course['수강신청 인원'] || 0;
        stats.completed_students += course.수료인원 || 0;
        stats.course_count += 1;
        if (!stats.courses) {
          stats.courses = [];
        }
        stats.courses.push(course);
      }
    }
  }

  // 각 월별 수료율 계산
  for (const stats of monthlyMap.values()) {
    if (stats.courses && stats.courses.length > 0) {
      const validCourses = stats.courses.filter(
        (course) => (course.수료인원 || 0) > 0 && (course['수강신청 인원'] || 0) > 0
      );
      if (validCourses.length > 0) {
        const totalCompletion = validCourses.reduce((sum, course) => sum + (course.수료인원 || 0), 0);
        const totalEnrollment = validCourses.reduce(
          (sum, course) => sum + (course['수강신청 인원'] || 0),
          0
        );
        stats.completion_rate = totalEnrollment > 0 ? (totalCompletion / totalEnrollment) * 100 : 0;
      }
    }
  }

  return Array.from(monthlyMap.values()).sort((a, b) => {
    const [aYear, aMonth] = a.month.split('-').map(Number);
    const [bYear, bMonth] = b.month.split('-').map(Number);
    return aYear === bYear ? aMonth - bMonth : aYear - bYear;
  });
}
