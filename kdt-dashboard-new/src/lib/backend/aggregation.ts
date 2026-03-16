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
  computeCourseRevenue,
  computeCourseRevenueByMode,
  computeCourseRevenueForMonth,
  calculateRevenueShare,
  calculateStudentShare,
} from './revenue-engine';
import {
  getPreferredEmploymentCount,
  formatXyDisplay,
  formatRateDetail,
  calculateEmploymentRate,
  getSafeEmploymentData,
} from './performance-engine';
import { extractYearMonth, parseDate } from './parsers';

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function inferYearFromRevenue(course: ProcessedCourseData, year: number): boolean {
  const yearCol = `${year}년` as keyof ProcessedCourseData;
  const adjCol = `조정_${year}년` as keyof ProcessedCourseData;
  const adjVal = toFiniteNumber((course[adjCol] as number) ?? 0, 0);
  const origVal = toFiniteNumber(
    (course[yearCol] as number) ?? ((course as any)[String(year)] as number) ?? 0,
    0
  );
  return adjVal > 0 || origVal > 0;
}

function getSafeYearFromDateOrRevenue(
  course: ProcessedCourseData,
  dateStr: string,
  targetYear?: number
): number | null {
  const d = parseDate(dateStr);
  if (Number.isFinite(d.getTime())) {
    return d.getFullYear();
  }
  if (targetYear !== undefined && inferYearFromRevenue(course, targetYear)) {
    return targetYear;
  }
  return null;
}

function inferMostLikelyRevenueYear(course: ProcessedCourseData): number | null {
  const yearCandidates = new Set<number>();
  for (const k of Object.keys(course)) {
    const m = k.match(/^(?:조정_)?(\d{4})년$/);
    if (m) {
      yearCandidates.add(parseInt(m[1], 10));
    }
  }
  const years = Array.from(yearCandidates).filter((y) => Number.isFinite(y)).sort((a, b) => b - a);
  for (const y of years) {
    if (inferYearFromRevenue(course, y)) return y;
  }
  return null;
}

function getStartYearMonthOrFallback(course: ProcessedCourseData): { year: number | null; month: number | null } {
  const extracted = extractYearMonth(course.과정시작일);
  if (extracted.year !== null) {
    return extracted;
  }
  const inferredYear = inferMostLikelyRevenueYear(course);
  if (inferredYear !== null) {
    return { year: inferredYear, month: 1 };
  }
  return { year: null, month: null };
}

/**
 * 기관별 상세 매출 계산
 */
export function calculateInstitutionDetailedRevenue(
  allCourses: ProcessedCourseData[],
  institutionName: string,
  year?: number,
  month?: number,
  revenueMode: RevenueMode = 'current'
): {
  courses: ProcessedCourseData[];
  totalRevenue: number;
  totalMaxRevenue: number;
  totalAdjustedRevenue: number;
  totalExpectedRevenueAllYears: number;
} {
  let totalRevenue = 0.0;
  let totalMaxRevenue = 0.0;
  let totalAdjustedRevenue = 0.0;
  let totalExpectedRevenueAllYears = 0.0;
  const coursesForInstitution: ProcessedCourseData[] = [];

  const overlapsYear = (course: ProcessedCourseData, y: number): boolean => {
    const start = parseDate(course.과정시작일);
    const end = parseDate(course.과정종료일);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return inferYearFromRevenue(course, y);
    }

    const yearStart = new Date(y, 0, 1);
    const yearEnd = new Date(y, 11, 31);
    return start <= yearEnd && end >= yearStart;
  };

  for (const course of allCourses) {
    const revenueShare = calculateRevenueShare(course, institutionName, groupInstitutionsAdvanced);

    if (revenueShare > 0) {
      if (year !== undefined && !overlapsYear(course, year)) {
        continue;
      }

      const courseMaxRevenue = toFiniteNumber(course['매출 최대'] || 0, 0) * revenueShare;
      const courseAdjustedRevenue =
        toFiniteNumber(course.조정_실매출대비 || 0, 0) * revenueShare;

      totalMaxRevenue += courseMaxRevenue;
      totalAdjustedRevenue += courseAdjustedRevenue;

      const selected = (() => {
        if (revenueMode === 'max') return courseMaxRevenue;

        // 월 필터(수주 기준)일 때는 pro-rata만 제외하고 기존 current 산식 유지
        // (해당 월에 시작한 과정들의 "전체 운영기간"에 대한 current 산식을 그대로 집계)
        if (month !== undefined) {
          const expectedAllYears = computeCourseRevenue(course, undefined) * revenueShare;
          totalExpectedRevenueAllYears += expectedAllYears;
          return expectedAllYears;
        }

        return computeCourseRevenueByMode(course, year, revenueMode) * revenueShare;
      })();
      totalRevenue += selected;

      // 매출을 할당하여 과정 복사
      const courseCopy = { ...course, 총누적매출: selected };
      coursesForInstitution.push(courseCopy);
    }
  }

  return {
    courses: coursesForInstitution,
    totalRevenue,
    totalMaxRevenue,
    totalAdjustedRevenue,
    totalExpectedRevenueAllYears,
  };
}

/**
 * 기관별 통계 계산
 */
export function calculateInstitutionStats(
  allCourses: ProcessedCourseData[],
  year?: number,
  revenueMode: RevenueMode = 'current',
  month?: number
): InstitutionStat[] {
  const institutionToCourses = new Map<string, ProcessedCourseData[]>();
  const institutionToCourseKeys = new Map<string, Set<string>>();

  const getCourseKey = (course: ProcessedCourseData): string => {
    const rawId = (course as any).고유값 ?? (course as any)['훈련과정 ID'] ?? '';
    const id = String(rawId).trim();
    if (id) return id;
    return `${String(course.과정명 ?? '').trim()}|${String(course.과정시작일 ?? '').trim()}|${String(
      course.과정종료일 ?? ''
    ).trim()}|${String(course.훈련기관 ?? '').trim()}`;
  };

  const addCourse = (name: string, course: ProcessedCourseData) => {
    const key = getCourseKey(course);
    const keys = institutionToCourseKeys.get(name) ?? new Set<string>();
    if (keys.has(key)) return;
    keys.add(key);
    institutionToCourseKeys.set(name, keys);

    const arr = institutionToCourses.get(name);
    if (arr) arr.push(course);
    else institutionToCourses.set(name, [course]);
  };

  for (const course of allCourses) {
    const trainingGroup = groupInstitutionsAdvanced(course.훈련기관);
    const partnerGroup = course.leadingCompanyPartnerInstitution
      ? groupInstitutionsAdvanced(String(course.leadingCompanyPartnerInstitution))
      : undefined;

    addCourse(trainingGroup, course);
    if (partnerGroup && partnerGroup !== trainingGroup) {
      addCourse(partnerGroup, course);
    }
  }

  const result: InstitutionStat[] = [];
  const targetYear = year || new Date().getFullYear();
  const isCumulativeAllYears = year === undefined && month === undefined;

  const today = new Date();
  const threeWeeksAgo = new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000);

  for (const [institutionName, relevantCourses] of institutionToCourses.entries()) {

    if (relevantCourses.length === 0) continue;

    const detailed = calculateInstitutionDetailedRevenue(
      relevantCourses,
      institutionName,
      month !== undefined ? undefined : year,
      month,
      revenueMode
    );

    const courses = detailed.courses;
    const totalRevenue = detailed.totalRevenue;
    const totalMaxRevenue = detailed.totalMaxRevenue;
    const totalAdjustedRevenue = detailed.totalAdjustedRevenue;
    const totalExpectedRevenueAllYears = detailed.totalExpectedRevenueAllYears;

    if (courses.length === 0) {
      continue;
    }

    let currentYearCoursesCount = 0;
    let prevYearCoursesCount = 0;
    let currentYearStudents = 0;
    let prevYearStudents = 0;
    let currentYearCompletedStudents = 0;
    let prevYearCompletedStudents = 0;

    let currentYearCompleted = 0;
    let carriedOverCompleted = 0;

    let totalEmployed = 0;

    const employmentCourses: ProcessedCourseData[] = [];

    let totalValidStudentsForCompletion = 0;
    let totalValidGraduatesForCompletion = 0;
    let totalWeightedSatisfaction = 0;
    let totalWeightSatisfaction = 0;

    for (const course of courses) {
      const trainingGroup = groupInstitutionsAdvanced(course.훈련기관);
      const partnerGroup = course.leadingCompanyPartnerInstitution
        ? groupInstitutionsAdvanced(String(course.leadingCompanyPartnerInstitution))
        : undefined;

      if (!(trainingGroup === institutionName || partnerGroup === institutionName)) {
        continue;
      }

      const enrollment = toFiniteNumber(course['수강신청 인원'] ?? 0, 0);
      const completed = toFiniteNumber(course.수료인원 ?? 0, 0);
      const employed = toFiniteNumber(getPreferredEmploymentCount(course) ?? 0, 0);

      const satisfaction = toFiniteNumber(course.만족도 ?? 0, 0);

      const isLeadingWithPartner = Boolean(
        course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution
      );

      const belongsToInstitutionForCounts = isLeadingWithPartner
        ? partnerGroup === institutionName
        : trainingGroup === institutionName;

      if (!belongsToInstitutionForCounts) {
        continue;
      }

      totalEmployed += employed;
      employmentCourses.push(course);

      if (month !== undefined || isCumulativeAllYears) {
        currentYearCoursesCount += 1;
        currentYearStudents += enrollment;
        currentYearCompletedStudents += completed;
        currentYearCompleted += completed;
      } else {
        const courseStartDate = parseDate(course.과정시작일);
        const courseEndDate = parseDate(course.과정종료일);
        const startYear = Number.isFinite(courseStartDate.getTime())
          ? courseStartDate.getFullYear()
          : getSafeYearFromDateOrRevenue(course, course.과정시작일, year);
        const endYear = Number.isFinite(courseEndDate.getTime())
          ? courseEndDate.getFullYear()
          : getSafeYearFromDateOrRevenue(course, course.과정종료일, year);

        const isCurrentYearStart = startYear === targetYear;
        const isPrevYearStartAndOngoing =
          startYear !== null && endYear !== null
            ? startYear < targetYear && endYear >= targetYear
            : false;

        if (isCurrentYearStart) {
          currentYearCoursesCount += 1;
          currentYearStudents += enrollment;
          currentYearCompletedStudents += completed;
        } else if (isPrevYearStartAndOngoing) {
          prevYearCoursesCount += 1;
          prevYearStudents += enrollment;
          prevYearCompletedStudents += completed;
        }

        if (endYear !== null && endYear === targetYear) {
          if (startYear !== null && startYear === targetYear) {
            currentYearCompleted += completed;
          } else if (startYear !== null && startYear < targetYear) {
            carriedOverCompleted += completed;
          }
        }
      }

      const canUseForCompletion = completed > 0 && enrollment > 0;
      const canUseForSatisfaction = satisfaction > 0 && completed > 0;

      if (month !== undefined || isCumulativeAllYears) {
        if (canUseForCompletion) {
          totalValidStudentsForCompletion += enrollment;
          totalValidGraduatesForCompletion += completed;
        }
        if (canUseForSatisfaction) {
          totalWeightedSatisfaction += satisfaction * completed;
          totalWeightSatisfaction += completed;
        }
      } else {
        if (canUseForCompletion) {
          const courseEndDate = parseDate(course.과정종료일);
          if (Number.isFinite(courseEndDate.getTime()) && courseEndDate <= threeWeeksAgo) {
            totalValidStudentsForCompletion += enrollment;
            totalValidGraduatesForCompletion += completed;
          }
        }
        if (canUseForSatisfaction) {
          totalWeightedSatisfaction += satisfaction * completed;
          totalWeightSatisfaction += completed;
        }
      }
    }

    if (month !== undefined || isCumulativeAllYears) {
      prevYearCoursesCount = 0;
      prevYearStudents = 0;
      prevYearCompletedStudents = 0;
    }

    if (month !== undefined || isCumulativeAllYears || year === undefined) {
      currentYearCompleted = Math.round(toFiniteNumber(currentYearCompletedStudents, 0));
      carriedOverCompleted = 0;
    } else {
      currentYearCompleted = Math.round(toFiniteNumber(currentYearCompleted, 0));
      carriedOverCompleted = Math.round(toFiniteNumber(carriedOverCompleted, 0));
    }

    const completedDisplay = (() => {
      const total = currentYearCompleted + carriedOverCompleted;
      if (carriedOverCompleted > 0) return `${total}(${carriedOverCompleted})`;
      return `${total}`;
    })();

    const completionRate =
      totalValidStudentsForCompletion > 0
        ? (totalValidGraduatesForCompletion / totalValidStudentsForCompletion) * 100
        : 0.0;

    const avgSatisfaction =
      totalWeightSatisfaction > 0 ? totalWeightedSatisfaction / totalWeightSatisfaction : 0.0;

    const totalCapacity = courses.reduce((sum, c) => {
      const studentShare = calculateStudentShare(c, institutionName, groupInstitutionsAdvanced);
      return sum + toFiniteNumber(c.정원 || 0, 0) * studentShare;
    }, 0);
    const recruitmentRate =
      totalCapacity > 0 ? ((currentYearStudents + prevYearStudents) / totalCapacity) * 100 : 0.0;

    // HRD-Net 통합 취업률 로직 적용 (가중 평균)
    let totalTargetPop = 0;
    let totalIntegratedEmployed = 0;

    courses.forEach((c) => {
      const empData = getSafeEmploymentData(c);
      totalTargetPop += empData.targetPop;
      totalIntegratedEmployed += empData.employed;
    });

    const employmentRate = totalTargetPop > 0 ? (totalIntegratedEmployed / totalTargetPop) * 100 : 0.0;

    const safeTotalRevenue = toFiniteNumber(Math.round(totalRevenue * 100) / 100, 0);
    const safeTotalEmployed = Math.round(toFiniteNumber(totalIntegratedEmployed, 0));
    const safeCompletionRate = toFiniteNumber(Math.round(completionRate * 10) / 10, 0);
    const safeEmploymentRate = toFiniteNumber(Math.round(employmentRate * 10) / 10, 0);
    const safeAvgSatisfaction = toFiniteNumber(avgSatisfaction, 0);
    const safeRecruitmentRate = toFiniteNumber(recruitmentRate, 0);
    const safeValidGraduates = Math.round(toFiniteNumber(totalValidGraduatesForCompletion, 0));
    const safeValidStudents = Math.round(toFiniteNumber(totalValidStudentsForCompletion, 0));
    const safeCompletedForEmployment = Math.round(toFiniteNumber(totalTargetPop, 0));
    const safeCapacity = Math.round(toFiniteNumber(totalCapacity, 0));

    result.push({
      institution_name: institutionName,
      total_revenue: safeTotalRevenue,
      total_max_revenue: toFiniteNumber(Math.round(totalMaxRevenue * 100) / 100, 0),
      total_adjusted_revenue: toFiniteNumber(Math.round(totalAdjustedRevenue * 100) / 100, 0),
      total_expected_revenue_all_years:
        month !== undefined
          ? toFiniteNumber(Math.round(totalExpectedRevenueAllYears * 100) / 100, 0)
          : undefined,
      expected_attribution_percent:
        month !== undefined
          ? toFiniteNumber(
              totalMaxRevenue > 0 ? (totalExpectedRevenueAllYears / totalMaxRevenue) * 100 : 0,
              0
            )
          : undefined,
      total_courses_display: formatXyDisplay(currentYearCoursesCount, prevYearCoursesCount),
      total_students_display: formatXyDisplay(
        Math.round(currentYearStudents),
        Math.round(prevYearStudents)
      ),
      completed_students_display: completedDisplay,
      current_year_completed: currentYearCompleted,
      carried_over_completed: carriedOverCompleted,
      total_employed: safeTotalEmployed,
      completion_rate: safeCompletionRate,
      employment_rate: safeEmploymentRate,
      total_target_pop: totalTargetPop,
      total_integrated_employed: totalIntegratedEmployed,
      avg_satisfaction: safeAvgSatisfaction,
      completion_rate_detail: formatRateDetail(
        safeValidGraduates,
        safeValidStudents,
        safeCompletionRate
      ),
      employment_rate_detail: formatRateDetail(
        safeTotalEmployed,
        safeCompletedForEmployment,
        safeEmploymentRate
      ),
      recruitment_rate_detail: formatRateDetail(
        Math.round(currentYearStudents + prevYearStudents),
        safeCapacity,
        safeRecruitmentRate
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
    const ym = getStartYearMonthOrFallback(course);
    return ym.year === year;
  });

  const totalStudents = yearData.reduce((sum, course) => sum + (course['수강신청 인원'] || 0), 0);
  const completedStudents = yearData.reduce((sum, course) => sum + (course.수료인원 || 0), 0);
  const totalEmployed = yearData.reduce((sum, course) => sum + getSafeEmploymentData(course).employed, 0);
  const totalMaxRevenue = yearData.reduce(
    (sum, course) => sum + toFiniteNumber(course['매출 최대'] || 0, 0),
    0
  );
  const totalAdjustedRevenue = yearData.reduce(
    (sum, course) => sum + toFiniteNumber(course.조정_실매출대비 || 0, 0),
    0
  );

  const completionRate = calculateCompletionRate(courses, year);
  const employmentRate = calculateEmploymentRate(yearData);
  const avgSatisfaction = calculateWeightedSatisfaction(yearData);

  const institutions = new Set(yearData.map((c) => c.훈련기관));

  return {
    year,
    total_revenue: totalAdjustedRevenue,
    total_max_revenue: totalMaxRevenue,
    total_adjusted_revenue: totalAdjustedRevenue,
    total_students: totalStudents,
    completed_students: completedStudents,
    total_employed: totalEmployed,
    overall_completion_rate: completionRate,
    overall_employment_rate: employmentRate,
    total_target_pop: yearData.reduce((sum, c) => sum + getSafeEmploymentData(c).targetPop, 0),
    total_integrated_employed: yearData.reduce((sum, c) => sum + getSafeEmploymentData(c).employed, 0),
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
  let startYear = year ?? 2021;
  let endYear = year ?? 2026;

  if (year === undefined) {
    let minYear = Number.POSITIVE_INFINITY;
    let maxYear = Number.NEGATIVE_INFINITY;

    for (const c of courses) {
      const ym = getStartYearMonthOrFallback(c);
      if (ym.year === null) continue;
      minYear = Math.min(minYear, ym.year);
      maxYear = Math.max(maxYear, ym.year);
    }

    if (minYear !== Number.POSITIVE_INFINITY && maxYear !== Number.NEGATIVE_INFINITY) {
      startYear = minYear;
      endYear = maxYear;
    }
  }

  // 선택된 연도 범위의 모든 월 초기화
  for (let y = startYear; y <= endYear; y++) {
    for (let i = 0; i < 12; i++) {
      const monthName = `${y}-${String(i + 1).padStart(2, '0')}`;
      monthlyMap.set(monthName, {
        month: monthName,
        revenue: 0,
        max_revenue: 0,
        adjusted_revenue: 0,
        total_students: 0,
        completed_students: 0,
        completion_rate: 0,
        course_count: 0,
        courses: [],
      });
    }
  }

  const getOverlapMonthsInYear = (params: {
    courseStart: Date;
    courseEnd: Date;
    year: number;
  }): string[] => {
    const { courseStart, courseEnd, year } = params;
    if (!Number.isFinite(courseStart.getTime()) || !Number.isFinite(courseEnd.getTime())) {
      return [];
    }

    const startMonth = year === courseStart.getFullYear() ? courseStart.getMonth() : 0;
    const endMonth = year === courseEnd.getFullYear() ? courseEnd.getMonth() : 11;

    const months: string[] = [];
    for (let monthIndex = startMonth; monthIndex <= endMonth; monthIndex++) {
      const monthStart = new Date(year, monthIndex, 1);
      const monthEnd = new Date(year, monthIndex + 1, 0);
      if (monthStart <= courseEnd && monthEnd >= courseStart) {
        months.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}`);
      }
    }
    return months;
  };

  const getAdjustedRevenueForYearWithoutFactor = (course: ProcessedCourseData, y: number): number => {
    const yearKey = `${y}년` as keyof ProcessedCourseData;
    const adjKey = `조정_${y}년` as keyof ProcessedCourseData;
    const adjVal = toFiniteNumber((course as any)[adjKey] ?? 0, 0);
    const origVal = toFiniteNumber((course as any)[yearKey] ?? (course as any)[String(y)] ?? 0, 0);
    return adjVal > 0 ? adjVal : origVal;
  };

  // 과정 기간 overlap 기준 pro-rata 매출 합산
  for (const course of courses) {
    const safeParse = (s: string): Date => {
      const d = parseDate(s);
      if (Number.isFinite(d.getTime())) return d;
      const native = new Date(s);
      return native;
    };

    const courseStartDate = safeParse(course.과정시작일);
    const courseEndDate = safeParse(course.과정종료일);

    if (!Number.isFinite(courseStartDate.getTime()) || !Number.isFinite(courseEndDate.getTime())) {
      continue;
    }

    // 학생 수 및 과정 정보는 과정 시작 월에만 추가 (레거시 유지)
    const courseStartMonthName = `${courseStartDate.getFullYear()}-${String(
      courseStartDate.getMonth() + 1
    ).padStart(2, '0')}`;
    if (monthlyMap.has(courseStartMonthName) && (year === undefined || courseStartDate.getFullYear() === year)) {
      const stats = monthlyMap.get(courseStartMonthName)!;
      stats.total_students += toFiniteNumber(course['수강신청 인원'] || 0, 0);
      stats.completed_students += toFiniteNumber(course.수료인원 || 0, 0);
      stats.course_count += 1;
      if (!stats.courses) stats.courses = [];
      stats.courses.push(course);
    }

    // 매출은 연도별로 과정 기간 overlap 월에 균등 분배
    for (let y = startYear; y <= endYear; y++) {
      if (year !== undefined && y !== year) continue;

      const yearlyRevenue = computeCourseRevenue(course, y);
      const yearlyMaxRevenue = computeCourseRevenueByMode(course, y, 'max');
      const yearlyAdjustedRevenue = getAdjustedRevenueForYearWithoutFactor(course, y);

      if (yearlyRevenue <= 0 && yearlyMaxRevenue <= 0 && yearlyAdjustedRevenue <= 0) continue;

      const monthNames = getOverlapMonthsInYear({ courseStart: courseStartDate, courseEnd: courseEndDate, year: y });
      if (monthNames.length <= 0) continue;

      const revenuePerMonth = yearlyRevenue > 0 ? yearlyRevenue / monthNames.length : 0;
      const maxPerMonth = yearlyMaxRevenue > 0 ? yearlyMaxRevenue / monthNames.length : 0;
      const adjustedPerMonth = yearlyAdjustedRevenue > 0 ? yearlyAdjustedRevenue / monthNames.length : 0;

      for (const monthName of monthNames) {
        const stats = monthlyMap.get(monthName);
        if (!stats) continue;
        stats.revenue += revenuePerMonth;
        stats.max_revenue += maxPerMonth;
        stats.adjusted_revenue += adjustedPerMonth;
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
        const totalCompletion = validCourses.reduce(
          (sum, course) => sum + toFiniteNumber(course.수료인원 || 0, 0),
          0
        );
        const totalEnrollment = validCourses.reduce(
          (sum, course) => sum + toFiniteNumber(course['수강신청 인원'] || 0, 0),
          0
        );
        stats.completion_rate =
          totalEnrollment > 0 ? toFiniteNumber((totalCompletion / totalEnrollment) * 100, 0) : 0;
      }
    }

    // 응답 안정성: 숫자 필드는 항상 finite number가 되도록 정규화
    stats.revenue = toFiniteNumber(stats.revenue, 0);
    stats.max_revenue = toFiniteNumber(stats.max_revenue, 0);
    stats.adjusted_revenue = toFiniteNumber(stats.adjusted_revenue, 0);
    stats.total_students = toFiniteNumber(stats.total_students, 0);
    stats.completed_students = toFiniteNumber(stats.completed_students, 0);
    stats.completion_rate = toFiniteNumber(stats.completion_rate, 0);
    stats.course_count = toFiniteNumber(stats.course_count, 0);
  }

  return Array.from(monthlyMap.values()).sort((a, b) => {
    const [aYear, aMonth] = a.month.split('-').map(Number);
    const [bYear, bMonth] = b.month.split('-').map(Number);
    return aYear === bYear ? aMonth - bMonth : aYear - bYear;
  });
}
