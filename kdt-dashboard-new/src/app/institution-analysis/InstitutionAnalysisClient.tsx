'use client';

import { useEffect, useState, useMemo } from 'react';
import { CourseData, InstitutionStat, AggregatedCourseData, calculateInstitutionStats, aggregateCoursesByCourseIdWithLatestInfo, getIndividualInstitutionsInGroup, calculateInstitutionDetailedRevenue, getPreferredEmploymentCount } from "@/lib/data-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber, formatRevenue } from "@/utils/formatters";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GetInstitutionYearlyStatsResult {
  studentStr: string;
  graduateStr: string;
  openCountStr: string;
  operatedCourseCount: number;
  openedCourseCount: number;
  completionRate: string;
  employmentRate: string;
  avgSatisfaction: number;
  x: number;
  y: number;
  xg: number;
  yg: number;
  xc: number;
  yc: number;
}
export interface AggregatedCourseDataWithOpenCount extends AggregatedCourseData {
  openedInYearCount?: number;
}

interface InstitutionAnalysisClientProps {
  initialInstitutionStats: InstitutionStat[];
  availableYears: number[];
  originalData: CourseData[];
}

// 공통 집계 함수: 기관명, 연도, 원본 row를 받아 x, y, x(y) 표기, 수료율, 과정수 등 반환
function getInstitutionYearlyStats({
  rows,
  institutionName,
  year,
  month // 월 파라미터 추가
}: {
  rows: CourseData[];
  institutionName: string;
  year: number | undefined;
  month: number | 'all'; // 월 타입 추가
}): GetInstitutionYearlyStatsResult {
  const filtered = rows.filter(c => {
    const isLeadingWithPartner = c.isLeadingCompanyCourse && c.leadingCompanyPartnerInstitution;
    if (
      isLeadingWithPartner &&
      c.훈련기관 === institutionName &&
      c.훈련기관 !== c.leadingCompanyPartnerInstitution
    ) return false;
    return c.훈련기관 === institutionName || c.파트너기관 === institutionName;
  });

  let finalFilteredRows = filtered;

  // 연도와 월이 모두 선택된 경우 해당 연도/월에 시작된 과정만 필터링
  if (year !== undefined && month !== 'all') {
    finalFilteredRows = filtered.filter(c => {
      const startDate = new Date(c.과정시작일);
      return startDate.getFullYear() === year && (startDate.getMonth() + 1) === month;
    });
  } else if (year !== undefined) {
    // 연도만 선택된 경우 해당 연도에 시작된 과정과 이전 연도에 시작하여 해당 연도에 종료된 과정 포함
    finalFilteredRows = filtered.filter(c => {
      const startDate = new Date(c.과정시작일);
      const endDate = new Date(c.과정종료일);
      return startDate.getFullYear() === year || (startDate.getFullYear() < year && endDate.getFullYear() === year);
    });

    // === 수료율 계산 방식 변경 ===
    // 1. 해당 연도에 종료된 과정만 필터링
    const endedThisYear = filtered.filter(c => new Date(c.과정종료일).getFullYear() === year);
    // 1-1. 수료인원이 1명 이상인 과정만 필터링
    const endedThisYearWithGraduates = endedThisYear.filter(c => (c['수료인원'] ?? 0) > 0);
    // 2. 분모: 해당 연도에 종료된 과정(수료인원 1명 이상)의 입과생
    const entryForEndedThisYear = endedThisYearWithGraduates.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
    // 3. 분자: 해당 연도에 종료된 과정(수료인원 1명 이상)의 수료인원
    const graduatedThisYear = endedThisYearWithGraduates.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
    // 4. 수료율
    const completionRate = entryForEndedThisYear > 0 ? (graduatedThisYear / entryForEndedThisYear) * 100 : 0;
    const completionRateStr = `${completionRate.toFixed(1)}% (${graduatedThisYear}/${entryForEndedThisYear})`;

    const employedThisYear = endedThisYearWithGraduates.reduce((sum, c) => sum + getPreferredEmploymentCount(c), 0);
    const employmentRate = graduatedThisYear > 0 ? (employedThisYear / graduatedThisYear) * 100 : 0;
    const employmentRateStr = `${employmentRate.toFixed(1)}% (${employedThisYear}/${graduatedThisYear})`;

    // 훈련생 수 표기: 올해 입과생 + (작년 입과, 올해 종료 과정의 입과생)
    const startedThisYear = filtered.filter(c => new Date(c.과정시작일).getFullYear() === year);
    const entryThisYear = startedThisYear.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
    const prevYearEntryEndedThisYear = endedThisYear
      .filter(c => new Date(c.과정시작일).getFullYear() < year)
      .reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
    const entryStr = prevYearEntryEndedThisYear > 0
      ? `${formatNumber(entryThisYear)}(${formatNumber(prevYearEntryEndedThisYear)})`
      : `${formatNumber(entryThisYear)}`;

    // 수료인원 표기: 올해 시작, 올해 종료 과정의 수료인원 + (작년 입과, 올해 종료 과정의 수료인원)
    const gradThisYear = startedThisYear.filter(c => new Date(c.과정종료일).getFullYear() === year).reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
    const gradPrevYearEndedThisYear = endedThisYear
      .filter(c => new Date(c.과정시작일).getFullYear() < year)
      .reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
    const gradStr = gradPrevYearEndedThisYear > 0
      ? `${formatNumber(gradThisYear)}(${formatNumber(gradPrevYearEndedThisYear)})`
      : `${formatNumber(gradThisYear)}`;

    // 개강 회차수 표기: 올해 시작 + (작년 시작, 올해 종료)
    const openStartSum = startedThisYear.length;
    const openEndSum = endedThisYear.filter(c => new Date(c.과정시작일).getFullYear() < year).length;
    const openCountStr = openEndSum > 0
      ? `${openStartSum}(${openEndSum})`
      : `${openStartSum}`;

    // 운영중인 과정 수: 해당 연도에 운영된 고유한 과정명 수
    const uniqueCourseNamesForYear = new Set([...startedThisYear, ...endedThisYear].map(c => c.과정명));
    const operatedCourseCount = uniqueCourseNamesForYear.size;
    const openedCourseCount = openStartSum + openEndSum;

    // 평균 만족도 계산 (올해 종료 과정 기준)
    const validSatisfaction = endedThisYear.filter(c => c.만족도 && c.만족도 > 0);
    const totalWeighted = validSatisfaction.reduce((sum, c) => sum + (c.만족도 ?? 0) * (c['수료인원'] ?? 0), 0);
    const totalWeight = validSatisfaction.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
    const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;

    return {
      studentStr: entryStr,
      graduateStr: gradStr,
      openCountStr: openCountStr,
      operatedCourseCount,
      openedCourseCount: openedCourseCount,
      avgSatisfaction: avgSatisfaction ? parseFloat(avgSatisfaction.toFixed(1)) : 0,
      completionRate: completionRateStr,
      employmentRate: employmentRateStr,
      x: entryThisYear,
      y: prevYearEntryEndedThisYear,
      xg: gradThisYear,
      yg: gradPrevYearEndedThisYear,
      xc: openStartSum,
      yc: openEndSum
    };
  }

  // 전체 연도 + 전체 월일 때는 전체 합계만 표기 (x(y) 표기 대신)
  if (year === undefined && month === 'all') {
    const totalStudents = finalFilteredRows.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
    const totalGraduates = finalFilteredRows.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
  const totalEmployed = finalFilteredRows.reduce((sum, c) => sum + getPreferredEmploymentCount(c), 0);
    const totalCourses = finalFilteredRows.length;
    const uniqueCourseNames = new Set(finalFilteredRows.map(c => c.과정명));
    const validRows = finalFilteredRows.filter(c => (c['수강신청 인원'] ?? 0) > 0 && (c['수료인원'] ?? 0) > 0);
    const validStudents = validRows.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
    const validGraduates = validRows.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
    const completionRate = validStudents > 0 ? (validGraduates / validStudents) * 100 : 0;
    const employmentRate = validGraduates > 0 ? (totalEmployed / validGraduates) * 100 : 0;
    // 평균 만족도 계산
    const validSatisfaction = validRows.filter(c => c.만족도 && c.만족도 > 0);
    const totalWeighted = validSatisfaction.reduce((sum, c) => sum + (c.만족도 ?? 0) * (c['수료인원'] ?? 0), 0);
    const totalWeight = validSatisfaction.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
    const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
    return {
      studentStr: formatNumber(totalStudents),
      graduateStr: formatNumber(totalGraduates),
      openCountStr: formatNumber(totalCourses),
      operatedCourseCount: uniqueCourseNames.size,
      openedCourseCount: totalCourses,
      completionRate: completionRate === 0 ? '-' : `${completionRate.toFixed(1)}%`,
      employmentRate: employmentRate === 0 ? '-' : `${employmentRate.toFixed(1)}%`,
      avgSatisfaction: avgSatisfaction || 0,
      x: totalStudents,
      y: 0,
      xg: totalGraduates,
      yg: 0,
      xc: totalCourses,
      yc: 0
    };
  }

  const totalStudents = finalFilteredRows.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
  const totalGraduates = finalFilteredRows.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
  const totalEmployed = finalFilteredRows.reduce((sum, c) => sum + getPreferredEmploymentCount(c), 0);
  const totalCourses = finalFilteredRows.length;
  const uniqueCourseNames = new Set(finalFilteredRows.map(c => c.과정명));
  const validRows = finalFilteredRows.filter(c => (c['수강신청 인원'] ?? 0) > 0 && (c['수료인원'] ?? 0) > 0);
  const validStudents = validRows.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
  const validGraduates = validRows.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
  const completionRate = validStudents > 0 ? (validGraduates / validStudents) * 100 : 0;
  const employmentRate = validGraduates > 0 ? (totalEmployed / validGraduates) * 100 : 0;

  // x(y) 표기법을 따르지 않는 경우 (연도+월 선택 시)
  if (year !== undefined && month !== 'all') {
    // 평균 만족도 계산
    const validSatisfaction = finalFilteredRows.filter(c => c.만족도 && c.만족도 > 0);
    const totalWeighted = validSatisfaction.reduce((sum, c) => sum + (c.만족도 ?? 0) * (c['수료인원'] ?? 0), 0);
    const totalWeight = validSatisfaction.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
    const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
    
    return {
      studentStr: `${formatNumber(totalStudents)}`,
      graduateStr: `${formatNumber(totalGraduates)}`,
      openCountStr: `${totalCourses}`,
      operatedCourseCount: uniqueCourseNames.size,
      openedCourseCount: totalCourses,
      completionRate: completionRate === 0 ? '-' : `${completionRate.toFixed(1)}%`,
      employmentRate: employmentRate === 0 ? '-' : `${employmentRate.toFixed(1)}%`,
      avgSatisfaction: avgSatisfaction || 0,
      x: totalStudents,
      y: 0,
      xg: totalGraduates,
      yg: 0,
      xc: totalCourses,
      yc: 0
    };
  }

  // 기존 x(y) 표기법 로직 (연도만 선택되거나 전체 기간일 때)
  const startRows = filtered.filter(c => new Date(c.과정시작일).getFullYear() === year);
  const endRows = filtered.filter(c => new Date(c.과정시작일).getFullYear() !== year && new Date(c.과정종료일).getFullYear() === year);
  const startSum = startRows.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
  const endSum = endRows.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
  const gradStartSum = startRows.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
  const gradEndSum = endRows.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
  const openStartSum = startRows.length;
  const openEndSum = endRows.length;

  const studentStr = startSum > 0 && endSum > 0 ? `${formatNumber(startSum)}(${formatNumber(endSum)})` : startSum > 0 ? `${formatNumber(startSum)}` : endSum > 0 ? `(${formatNumber(endSum)})` : '';
  const graduateStr = gradStartSum > 0 && gradEndSum > 0 ? `${formatNumber(gradStartSum)}(${formatNumber(gradEndSum)})` : gradStartSum > 0 ? `${formatNumber(gradStartSum)}` : gradEndSum > 0 ? `(${formatNumber(gradEndSum)})` : '';
  const openCountStr = openStartSum > 0 && openEndSum > 0 ? `${openStartSum}(${openEndSum})` : openStartSum > 0 ? `${openStartSum}` : openEndSum > 0 ? `(${openEndSum})` : '';

  // 운영중인 과정 수: 해당 연도에 운영된 고유한 과정명 수
  const uniqueCourseNamesForYear = new Set([...startRows, ...endRows].map(c => c.과정명));
  const operatedCourseCount = uniqueCourseNamesForYear.size;
  const openedCourseCount = openStartSum + openEndSum; // 개강 과정 수: 올해 개강 + 작년 개강/올해 종료 (회차 수)
  const validRowsForCompletion = [...startRows, ...endRows].filter(c => (c['수강신청 인원'] ?? 0) > 0 && (c['수료인원'] ?? 0) > 0);
  const validStudentsForCompletion = validRowsForCompletion.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
  const validGraduatesForCompletion = validRowsForCompletion.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
  const completionRateForYear = validStudentsForCompletion > 0 ? (validGraduatesForCompletion / validStudentsForCompletion) * 100 : 0;
  const totalEmployedForYear = validRowsForCompletion.reduce((sum, c) => sum + getPreferredEmploymentCount(c), 0);
  const employmentRateForYear = validGraduatesForCompletion > 0 ? (totalEmployedForYear / validGraduatesForCompletion) * 100 : 0;

  // 평균 만족도 계산
  const validSatisfaction = [...startRows, ...endRows].filter(c => c.만족도 && c.만족도 > 0);
  const totalWeighted = validSatisfaction.reduce((sum, c) => sum + (c.만족도 ?? 0) * (c['수료인원'] ?? 0), 0);
  const totalWeight = validSatisfaction.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
  const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;

  return {
    studentStr,
    graduateStr,
    openCountStr, // x<br/>(y) 표기
    operatedCourseCount, // 운영 과정 수
    openedCourseCount: openedCourseCount,
      avgSatisfaction: avgSatisfaction ? parseFloat(avgSatisfaction.toFixed(1)) : 0,
    completionRate: completionRateForYear === 0 ? '-' : `${completionRateForYear.toFixed(1)}%`,
    employmentRate: employmentRateForYear === 0 ? '-' : `${employmentRateForYear.toFixed(1)}%`,
    x: startSum,
    y: endSum,
    xg: gradStartSum,
    yg: gradEndSum,
    xc: openStartSum,
    yc: openEndSum
  };
}

export default function InstitutionAnalysisClient({ initialInstitutionStats, availableYears, originalData }: InstitutionAnalysisClientProps) {
  const [institutionStats, setInstitutionStats] = useState<InstitutionStat[]>(initialInstitutionStats);
  const [filteredInstitutionStats, setFilteredInstitutionStats] = useState<InstitutionStat[]>(initialInstitutionStats);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstitutionCourses, setSelectedInstitutionCourses] = useState<AggregatedCourseDataWithOpenCount[]>([]);
  const [selectedInstitutionName, setSelectedInstitutionName] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'leading' | 'tech'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInstitutionRawCourses, setSelectedInstitutionRawCourses] = useState<CourseData[]>([]);
  
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedGroupName, setSelectedGroupName] = useState<string>('');
  const [individualInstitutions, setIndividualInstitutions] = useState<InstitutionStat[]>([]);

  const isNewTechCourse = (course: CourseData) => !course.isLeadingCompanyCourse;

  // 필터링 로직을 useMemo로 감싸 성능 최적화
  useEffect(() => {
    let currentFilteredStats = initialInstitutionStats;

    // 유형 필터링
    if (filterType === 'leading') {
      currentFilteredStats = currentFilteredStats.filter((stat) =>
        stat.courses.some((c) => c.훈련유형?.includes('선도기업형 훈련'))
      );
    } else if (filterType === 'tech') {
      currentFilteredStats = currentFilteredStats.filter((stat) =>
        stat.courses.some((c) => !c.훈련유형?.includes('선도기업형 훈련'))
      );
    }

    // 연도 및 월 필터링 (서버에서 이미 연도별로 계산된 통계를 사용)
    // 클라이언트에서는 selectedYear와 selectedMonth에 따라 initialInstitutionStats를 다시 필터링
    if (selectedYear !== 'all' || selectedMonth !== 'all') {
      // 상세 보기와 동일한 기준으로 매출을 계산하기 위해, originalData에 동일한 필터를 선적용
      let filteredOriginalForRevenue = originalData;
      if (filterType === 'leading') {
        filteredOriginalForRevenue = filteredOriginalForRevenue.filter((c) => c.훈련유형?.includes('선도기업형 훈련'));
      } else if (filterType === 'tech') {
        filteredOriginalForRevenue = filteredOriginalForRevenue.filter((c) => !c.훈련유형?.includes('선도기업형 훈련'));
      }

      if (selectedMonth !== 'all') {
        filteredOriginalForRevenue = filteredOriginalForRevenue.filter(course => {
          const courseStartDate = new Date(course.과정시작일);
          if (selectedYear !== 'all') {
            return courseStartDate.getFullYear() === selectedYear && (courseStartDate.getMonth() + 1) === selectedMonth;
          }
          return (courseStartDate.getMonth() + 1) === selectedMonth;
        });
      }

      currentFilteredStats = initialInstitutionStats.filter(stat => {
        // stat.courses는 해당 기관의 모든 과정 데이터를 포함하고 있음
        // 이 과정들을 다시 필터링하여 선택된 연도와 월에 해당하는 통계를 계산해야 함
        const filteredCoursesForStat = stat.courses.filter(course => {
          const courseStartDate = new Date(course.과정시작일);
          const courseEndDate = new Date(course.과정종료일);

          let yearMatch = true;
          if (selectedYear !== 'all') {
            if (selectedMonth !== 'all') {
              yearMatch = courseStartDate.getFullYear() === selectedYear;
            } else {
              yearMatch = courseStartDate.getFullYear() === selectedYear || (courseStartDate.getFullYear() < selectedYear && courseEndDate.getFullYear() === selectedYear);
            }
          }

          let monthMatch = true;
          if (selectedMonth !== 'all') {
            monthMatch = (courseStartDate.getMonth() + 1) === selectedMonth;
          }
          return yearMatch && monthMatch;
        });

        // 필터링된 과정이 없으면 해당 기관은 제외
        if (filteredCoursesForStat.length === 0) return false;

        // 필터링된 과정으로 해당 기관의 통계를 다시 계산
        const reCalculatedStats = getInstitutionYearlyStats({
          rows: filteredCoursesForStat,
          institutionName: stat.institutionName,
          year: selectedYear === 'all' ? undefined : selectedYear,
          month: selectedMonth
        });

        // 필터링된 과정 기준으로 매출액도 재계산
        const revenueYearForCalculation = selectedMonth !== 'all'
          ? undefined
          : (selectedYear === 'all' ? undefined : selectedYear);

        const detailed = calculateInstitutionDetailedRevenue(
          filteredOriginalForRevenue,
          stat.institutionName,
          revenueYearForCalculation
        );
        const aggregatedForRevenue = aggregateCoursesByCourseIdWithLatestInfo(
          detailed.courses,
          revenueYearForCalculation,
          stat.institutionName
        );
        const totalRevenue = aggregatedForRevenue.reduce((sum: number, c: any) => sum + (c.총누적매출 ?? 0), 0);

        // 기존 stat 객체를 업데이트
        stat.totalCourses = reCalculatedStats.operatedCourseCount;
        stat.totalStudents = reCalculatedStats.x + reCalculatedStats.y;
        stat.completedStudents = reCalculatedStats.xg + reCalculatedStats.yg;
        stat.completionRate = parseFloat(reCalculatedStats.completionRate.replace('%', ''));
        stat.employmentRate = parseFloat(reCalculatedStats.employmentRate.replace('%', ''));
        stat.avgSatisfaction = reCalculatedStats.avgSatisfaction;
        stat.totalRevenue = totalRevenue;
        
        return true; // 필터링된 과정이 있으면 포함
      });
    }

    // 검색어 필터링
    const finalFiltered = currentFilteredStats.filter(stat => 
      stat.institutionName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 매출액 기준으로 다시 정렬
    finalFiltered.sort((a, b) => b.totalRevenue - a.totalRevenue);

    setFilteredInstitutionStats(finalFiltered);
  }, [selectedYear, filterType, selectedMonth, searchTerm, initialInstitutionStats, originalData]);

  const handleViewDetails = (institutionName: string) => {
    setSelectedInstitutionName(institutionName);
    
    let filteredOriginalData = originalData;
    
    if (filterType === 'leading') {
      filteredOriginalData = filteredOriginalData.filter((c) => c.훈련유형?.includes('선도기업형 훈련'));
    } else if (filterType === 'tech') {
      filteredOriginalData = filteredOriginalData.filter((c) => !c.훈련유형?.includes('선도기업형 훈련'));
    }
    
    if (selectedMonth !== 'all') {
      filteredOriginalData = filteredOriginalData.filter(course => {
        const courseStartDate = new Date(course.과정시작일);
        if (selectedYear !== 'all') {
          return courseStartDate.getFullYear() === selectedYear && (courseStartDate.getMonth() + 1) === selectedMonth;
        }
        return (courseStartDate.getMonth() + 1) === selectedMonth;
      });
    }
    
    const yearForCalculation = selectedMonth !== 'all'
      ? undefined
      : (selectedYear === 'all' ? undefined : selectedYear);
    const detailedStats = calculateInstitutionDetailedRevenue(filteredOriginalData, institutionName, yearForCalculation);
    
    const aggregated = aggregateCoursesByCourseIdWithLatestInfo(detailedStats.courses, yearForCalculation, institutionName);
    
    setSelectedInstitutionCourses(aggregated as any);
    setSelectedInstitutionRawCourses(detailedStats.courses);
    setIsModalOpen(true);
  };

  const handleViewGroupDetails = (groupName: string) => {
    setSelectedGroupName(groupName);
    
    let filteredOriginalData = originalData;
    
    if (filterType === 'leading') {
      filteredOriginalData = filteredOriginalData.filter((c) => c.훈련유형?.includes('선도기업형 훈련'));
    } else if (filterType === 'tech') {
      filteredOriginalData = filteredOriginalData.filter((c) => !c.훈련유형?.includes('선도기업형 훈련'));
    }
    
    if (selectedMonth !== 'all') {
      filteredOriginalData = filteredOriginalData.filter(course => {
        const courseStartDate = new Date(course.과정시작일);
        if (selectedYear !== 'all') {
          return courseStartDate.getFullYear() === selectedYear && (courseStartDate.getMonth() + 1) === selectedMonth;
        }
        return (courseStartDate.getMonth() + 1) === selectedMonth;
      });
    }
    
    const individualStats = getIndividualInstitutionsInGroup(
      filteredOriginalData, // 필터링된 데이터 전달
      groupName,
      selectedYear === 'all' ? undefined : selectedYear
    );
    
    setIndividualInstitutions(individualStats);
    setIsGroupModalOpen(true);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">훈련기관별 분석</h1>

      {/* 연도 선택 */}
      <div className="mb-10 relative z-10 flex gap-6 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">연도 선택</label>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(value === 'all' ? 'all' : parseInt(value))}
          >
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="연도 선택" />
            </SelectTrigger>
            <SelectContent className="bg-white z-20">
              <SelectItem value="all">전체 연도</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 월 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">월 선택</label>
          <Select
            value={selectedMonth.toString()}
            onValueChange={(value) => setSelectedMonth(value === 'all' ? 'all' : parseInt(value))}
          >
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="월 선택" />
            </SelectTrigger>
            <SelectContent className="bg-white z-20">
              <SelectItem value="all">전체 월</SelectItem>
              {[...Array(12)].map((_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>{i + 1}월</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 유형 필터 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">유형 필터</label>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="w-[200px] bg-white">
              <SelectValue placeholder="유형 선택" />
            </SelectTrigger>
            <SelectContent className="bg-white z-20">
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="leading">선도기업 과정만</SelectItem>
              <SelectItem value="tech">신기술 과정만</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 검색창 추가 */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">훈련기관 검색</label>
          <input
            id="search"
            type="text"
            placeholder="기관명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-[200px] bg-white p-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      {/* 안내 문구 추가 */}
      <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-4 py-2">
        ※ 과정이 2개년도에 걸쳐있는 경우, 각 년도에 차지하는 비율에 맞추어 매출이 분배됩니다.
      </div>

      {/* 매출액 차트 */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">훈련기관별 매출액 (억원)</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredInstitutionStats.slice(0, 10)}>
              <XAxis
                dataKey="institutionName"
                angle={0}
                textAnchor="middle"
                height={100}
                tick={{ fontSize: 14 }}
                interval={0}
                tickFormatter={(value: string, index: number) => {
                  const rank = index + 1;
                  let displayValue = `${value}`;
                  if (value === '주식회사 코드스테이츠') {
                    displayValue += ' (2023년 감사를 통해 훈련비 전액 반환)';
                  }
                  if (displayValue.length > 15) {
                    displayValue = displayValue.substring(0, 12) + '...';
                  }
                  return `🏅 ${rank}위\n${displayValue}`;
                }}
                dy={20}
              />
              <YAxis 
                tickFormatter={formatRevenue}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number) => [formatRevenue(value), '매출액']}
                labelFormatter={(label) => {
                  let institutionName = label.replace(/\d+\. /, '').replace(/ \(2023년 감사를 통해 훈련비 전액 반환\)/, '');
                  if (institutionName === '주식회사 코드스테이츠') {
                      return `기관명: ${institutionName} (2023년 감사를 통해 훈련비 전액 반환)`;
                  }
                  return `기관명: ${institutionName}`;
                }}
              />
              <Bar dataKey="totalRevenue" fill="#4F46E5" name="매출액" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 안내 문구 */}
      {selectedYear !== 'all' && (
        <div className="mb-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded px-4 py-3">
          <div>* 수료율은 과정 종료일 기준으로 계산하였으며, 분자는 {selectedYear}년 기준 {selectedYear}년의 수료생, 분모는 {selectedYear}년 기준 {selectedYear}년에 끝나는 과정이 있는 모든 과정의 입과생입니다.</div>
          <div>* ()는 전 해년 입과, 당 해년 수료 인원을 표기하였습니다.</div>
        </div>
      )}

      {/* 상세 통계 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">순위 및 훈련기관</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">매출액</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">훈련과정 수</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">훈련생 수</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수료인원</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수료율</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">취업율</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">평균 만족도</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상세</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInstitutionStats.map((stat, index) => (
                <tr key={stat.institutionName}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {index + 1}. {stat.institutionName}
                          {stat.institutionName === '주식회사 코드스테이츠' && (
                            <span className="ml-2 text-xs text-red-600">(2023년 감사를 통해 훈련비 전액 반환)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatRevenue(stat.totalRevenue)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const filteredRows = originalData.filter((c) => {
                        if (filterType === 'leading') return c.훈련유형?.includes('선도기업형 훈련');
                        if (filterType === 'tech') return !c.훈련유형?.includes('선도기업형 훈련');
                        return true;
                      });
                      const stats = getInstitutionYearlyStats({
                        rows: filteredRows,
                        institutionName: stat.institutionName,
                        year: selectedYear === 'all' ? undefined : selectedYear,
                        month: selectedMonth
                      });
                      return <span dangerouslySetInnerHTML={{__html: stats.openCountStr}} />;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const filteredRows = originalData.filter((c) => {
                        if (filterType === 'leading') return c.훈련유형?.includes('선도기업형 훈련');
                        if (filterType === 'tech') return !c.훈련유형?.includes('선도기업형 훈련');
                        return true;
                      });
                      const stats = getInstitutionYearlyStats({
                        rows: filteredRows,
                        institutionName: stat.institutionName,
                        year: selectedYear === 'all' ? undefined : selectedYear,
                        month: selectedMonth
                      });
                      return <span dangerouslySetInnerHTML={{__html: stats.studentStr}} />;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const filteredRows = originalData.filter((c) => {
                        if (filterType === 'leading') return c.훈련유형?.includes('선도기업형 훈련');
                        if (filterType === 'tech') return !c.훈련유형?.includes('선도기업형 훈련');
                        return true;
                      });
                      const stats = getInstitutionYearlyStats({
                        rows: filteredRows,
                        institutionName: stat.institutionName,
                        year: selectedYear === 'all' ? undefined : selectedYear,
                        month: selectedMonth
                      });
                      return <span dangerouslySetInnerHTML={{__html: stats.graduateStr}} />;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{(() => {
                    const filteredRows = originalData.filter((c) => {
                      if (filterType === 'leading') return c.훈련유형?.includes('선도기업형 훈련');
                      if (filterType === 'tech') return !c.훈련유형?.includes('선도기업형 훈련');
                      return true;
                      });
                    const stats = getInstitutionYearlyStats({
                      rows: filteredRows,
                      institutionName: stat.institutionName,
                      year: selectedYear === 'all' ? undefined : selectedYear,
                      month: selectedMonth
                    });
                    return stats.completionRate;
                  })()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{(() => {
                    const filteredRows = originalData.filter((c) => {
                      if (filterType === 'leading') return c.훈련유형?.includes('선도기업형 훈련');
                      if (filterType === 'tech') return !c.훈련유형?.includes('선도기업형 훈련');
                      return true;
                      });
                    const stats = getInstitutionYearlyStats({
                      rows: filteredRows,
                      institutionName: stat.institutionName,
                      year: selectedYear === 'all' ? undefined : selectedYear,
                      month: selectedMonth
                    });
                    return stats.employmentRate;
                  })()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{(() => {
                    const filteredRows = originalData.filter((c) => {
                      if (filterType === 'leading') return c.훈련유형?.includes('선도기업형 훈련');
                      if (filterType === 'tech') return !c.훈련유형?.includes('선도기업형 훈련');
                      return true;
                      });
                    const stats = getInstitutionYearlyStats({
                      rows: filteredRows,
                      institutionName: stat.institutionName,
                      year: selectedYear === 'all' ? undefined : selectedYear,
                      month: selectedMonth
                    });
                    return (typeof stats.avgSatisfaction === 'number' && !isNaN(stats.avgSatisfaction)) ? stats.avgSatisfaction.toFixed(1) : '-';
                  })()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDetails(stat.institutionName)}
                          className="text-indigo-600 hover:text-indigo-900"
                          style={{
                            backgroundColor: '#E0E7FF',
                            color: '#4338CA',
                            fontWeight: '500',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #C7D2FE'
                          }}
                        >
                          상세 보기
                        </button>
                        {['이젠아카데미', '그린컴퓨터아카데미', '더조은아카데미', '코리아IT아카데미', '비트교육센터', '하이미디어', '아이티윌', '메가스터디', '에이콘아카데미', '한국ICT인재개발원', 'MBC아카데미 컴퓨터 교육센터', '쌍용아카데미', 'KH정보교육원', '(주)솔데스크'].includes(stat.institutionName) && (
                          <button
                            onClick={() => handleViewGroupDetails(stat.institutionName)}
                            className="text-green-600 hover:text-green-900"
                            style={{
                              backgroundColor: '#D1FAE5',
                              color: '#065F46',
                              fontWeight: '500',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid #A7F3D0',
                              fontSize: '0.75rem'
                            }}
                          >
                            ▽ 개별기관
                          </button>
                        )}
                      </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상세 모달 */}
      <Dialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      >
        <DialogContent className="mx-auto max-w-[80vw] max-h-[85vh] w-full bg-white rounded-xl shadow-lg p-0 overflow-y-auto">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-900">
              {selectedInstitutionName} - 훈련과정 상세
              {filterType === 'leading' && ' (선도기업 과정)'}
              {filterType === 'tech' && ' (신기술 과정)'}
              {selectedYear !== 'all' && ` (${selectedYear}년)`}
            </DialogTitle>
            <DialogDescription>
              선택된 훈련기관의 {selectedYear === 'all' ? '모든' : `${selectedYear}년`} 훈련과정 목록입니다.
              {filterType === 'leading' && ' (선도기업 과정만)'}
              {filterType === 'tech' && ' (신기술 과정만)'}
              (매출액 기준 내림차순 정렬)
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            {/* 통계 요약 */}
            <div className="grid grid-cols-6 lg:grid-cols-9 gap-4 mb-6">
              {(() => {
                const filteredRows = originalData.filter((c) => {
                  if (filterType === 'leading') return c.훈련유형?.includes('선도기업형 훈련');
                  if (filterType === 'tech') return !c.훈련유형?.includes('선도기업형 훈련');
                  return true;
                });
                const stats = getInstitutionYearlyStats({
                  rows: filteredRows,
                  institutionName: selectedInstitutionName,
                  year: selectedYear === 'all' ? undefined : selectedYear,
                  month: selectedMonth
                });
                const totals = (() => {
                  const revenueSum = selectedInstitutionCourses.reduce((sum: number, c: any) => sum + (c.총누적매출 ?? 0), 0);
                  // 헤더의 평균 모집률은 x(y)에서 x 기준: 과정 집계의 연도정원/연도훈련생수 합으로 계산
                  const capacitySum = selectedInstitutionCourses.reduce((sum: number, c: any) => sum + (c.연도정원 ?? 0), 0);
                  const enrolledStartOnly = selectedInstitutionCourses.reduce((sum: number, c: any) => sum + (c.연도훈련생수 ?? 0), 0);
                  const avgRecruitRate = capacitySum > 0 ? (enrolledStartOnly / capacitySum) * 100 : 0;
                  return { revenueSum, capacitySum, enrolledStartOnly, avgRecruitRate };
                })();
                return (
                  <>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">운영 중인 과정 수</div>
                      <div className="text-lg font-semibold">{stats.operatedCourseCount}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">{selectedYear === 'all' ? '전체 개강 회차수' : `${selectedYear}년 개강 회차수`}</div>
                      <div className="text-lg font-semibold">{stats.openedCourseCount}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">합계 정원</div>
                      <div className="text-lg font-semibold">{formatNumber(totals.capacitySum)}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">평균 모집률</div>
                      <div className="text-lg font-semibold">
                        {totals.capacitySum > 0 ? `${totals.avgRecruitRate.toFixed(1)}% (${formatNumber(totals.enrolledStartOnly)}/${formatNumber(totals.capacitySum)})` : '-'}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">훈련생 수</div>
                      <div className="text-lg font-semibold">{stats.studentStr}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">수료인원</div>
                      <div className="text-lg font-semibold">{stats.graduateStr}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">평균 수료율</div>
                      <div className="text-lg font-semibold">{stats.completionRate}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">평균 취업율</div>
                      <div className="text-lg font-semibold">{stats.employmentRate}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">합계 매출액</div>
                      <div className="text-lg font-semibold">{formatRevenue(totals.revenueSum)}</div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="overflow-x-auto max-h-[65vh]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">과정명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">훈련유형</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">모집률</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">훈련생 수</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">수료인원</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">수료율</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">취업율</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">매출액</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">만족도</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">개강 회차수</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedInstitutionCourses.map((course: any) => (
                    <tr key={course['훈련과정 ID']} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{course.과정명}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.훈련유형들?.join(', ') || '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {(() => {
                          const isYearSelected = selectedYear !== 'all';
                          const quota = isYearSelected ? (course.연도정원 ?? 0) : (course.총정원 ?? 0);
                          const enrolled = isYearSelected ? (course.연도훈련생수 ?? 0) : (course.총훈련생수 ?? 0);
                          if (!quota || quota === 0) return '-';
                          const rate = (enrolled / quota) * 100;
                          return `${rate.toFixed(1)}% (${formatNumber(enrolled)}/${formatNumber(quota)})`;
                        })()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.studentsStr}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.graduatesStr}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.평균수료율 ? course.평균수료율.toFixed(1) : '0.0'}% ({course.총수료인원}/{course.총수강신청인원})</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.평균취업율 ? course.평균취업율.toFixed(1) : '0.0'}% ({course.총취업인원}/{course.총수료인원})</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatRevenue(course.총누적매출)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.평균만족도 ? course.평균만족도.toFixed(1) : '0.0'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.openCountStr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-3 flex justify-end">
            <button
              type="button"
              className="bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={() => setIsModalOpen(false)}
            >
              닫기
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 개별 기관 정보 모달 */}
      <Dialog
        open={isGroupModalOpen}
        onOpenChange={setIsGroupModalOpen}
      >
        <DialogContent className="mx-auto max-w-[80vw] max-h-[85vh] w-full bg-white rounded-xl shadow-lg p-0 overflow-y-auto">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-900">
              {selectedGroupName} - 개별 기관 상세
              {selectedYear !== 'all' && ` (${selectedYear}년)`}
            </DialogTitle>
            <DialogDescription>
              {selectedGroupName} 그룹에 속하는 개별 기관들의 상세 정보입니다. (매출액 기준 내림차순 정렬)
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <div className="overflow-x-auto max-h-[65vh]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">순위</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">기관명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">매출액</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">훈련과정 수</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">훈련생 수</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수료인원</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수료율</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">취업율</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">평균 만족도</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {individualInstitutions.map((institution, index) => (
                    <tr key={institution.institutionName} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {institution.institutionName}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatRevenue(institution.totalRevenue)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatNumber(institution.totalCourses)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {selectedYear !== 'all' && selectedMonth === 'all' && institution.prevYearStudents > 0
                          ? (
                            <div>
                              <div>{formatNumber(institution.totalStudents)}</div>
                              <div className="text-xs text-gray-500">({formatNumber(institution.prevYearStudents)})</div>
                            </div>
                          )
                          : formatNumber(institution.totalStudents)
                        }
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {selectedYear !== 'all' && selectedMonth === 'all' && institution.prevYearCompletedStudents > 0
                          ? (
                            <div>
                              <div>{formatNumber(institution.completedStudents)}</div>
                              <div className="text-xs text-gray-500">({formatNumber(institution.prevYearCompletedStudents)})</div>
                            </div>
                          )
                          : formatNumber(institution.completedStudents)
                        }
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{institution.completionRate ? institution.completionRate.toFixed(1) : '0.0'}%</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{institution.employmentRate ? institution.employmentRate.toFixed(1) : '0.0'}%</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{institution.avgSatisfaction ? institution.avgSatisfaction.toFixed(1) : '0.0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-3 flex justify-end">
            <button
              type="button"
              className="bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={() => setIsGroupModalOpen(false)}
            >
              닫기
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Custom Tick 컴포넌트 (필요시 사용)
const CustomTick = (props: any) => {
  const { x, y, payload, index } = props;
  const value = payload.value;
  const rank = index + 1;
  let displayValue = `${value}`;
  if (value === '주식회사 코드스테이츠') {
    displayValue += ' (2023년 감사를 통해 훈련비 전액 반환)';
  }
  if (displayValue.length > 15) {
    displayValue = displayValue.substring(0, 12) + '...';
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#666" fontSize={10}>
        <tspan x={0} dy="-1.2em">🥇 {rank}위</tspan>
        <tspan x={0} dy="1.2em">{displayValue}</tspan>
      </text>
    </g>
  );
};