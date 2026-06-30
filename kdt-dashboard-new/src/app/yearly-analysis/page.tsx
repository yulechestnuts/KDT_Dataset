'use client';

import { useEffect, useState } from 'react';
import { kdtAPI, CourseAnalysisRow } from "@/lib/api-client";
import { YearlyAnalysis } from "@/components/YearlyAnalysis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface YearlyStatsData {
  year: number;
  revenue: number;
  contractRevenue: number;
  contractStudents: number;
  totalStudents: number;
  completedStudents: number;
  completionRate: number;
  courseCount: number;
  courses: CourseAnalysisRow[];
}

export default function YearlyAnalysisPage() {
  const [data, setData] = useState<CourseAnalysisRow[]>([]);
  const [yearlyStats, setYearlyStats] = useState<YearlyStatsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedYearCourses, setSelectedYearCourses] = useState<CourseAnalysisRow[]>([]);
  const [selectedYearForModal, setSelectedYearForModal] = useState<number | null>(null);

  const aggregateCoursesByName = (courses: CourseAnalysisRow[]) => {
    const aggregated: { [key: string]: { courseName: string, totalRevenue: number, count: number, institution: string, totalStudents: number, totalCompletedStudents: number } } = {};

    courses.forEach(course => {
      const courseKey = course['훈련과정 ID'] || course.과정명 || '알 수 없는 과정명';
      if (!aggregated[courseKey]) {
        aggregated[courseKey] = {
          courseName: course.과정명,
          totalRevenue: course.total_revenue || 0,
          count: 0,
          institution: course.훈련기관,
          totalStudents: 0,
          totalCompletedStudents: 0,
        };
      }

      aggregated[courseKey].count += 1;
      aggregated[courseKey].totalStudents += course['수강신청 인원'] ?? 0;
      aggregated[courseKey].totalCompletedStudents += course.수료인원 ?? 0;
    });
    return Object.values(aggregated).sort((a, b) => b.totalRevenue - a.totalRevenue);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 현재 계산된 매출 데이터 조회
        const resultCurrent = await kdtAPI.getCourseAnalysis({ revenueMode: 'current' });
        const currentCourses = resultCurrent.data || [];

        // 수주 매출 데이터 조회
        const resultMax = await kdtAPI.getCourseAnalysis({ revenueMode: 'max' });
        const maxCourses = resultMax.data || [];

        setData(currentCourses);

        // 클라이언트에서 연도별 집계
        const yearMap: { [year: number]: YearlyStatsData } = {};

        // 2021~2026년 초기화
        for (let year = 2021; year <= 2026; year++) {
          yearMap[year] = {
            year,
            revenue: 0,
            contractRevenue: 0,
            contractStudents: 0,
            totalStudents: 0,
            completedStudents: 0,
            completionRate: 0,
            courseCount: 0,
            courses: [],
          };
        }

        // 현재 매출: 조정된 연도별 매출로 집계
        currentCourses.forEach((course) => {
          const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'] as const;
          
          yearColumns.forEach((yearCol) => {
            const year = parseInt(yearCol, 10);
            const adjustedRevenue = course[`조정_${yearCol}` as keyof CourseAnalysisRow];
            
            if (adjustedRevenue && typeof adjustedRevenue === 'number' && adjustedRevenue > 0) {
              // 이 과정이 해당 연도에 매출이 있으면 포함
              if (!yearMap[year].courses.find(c => c.고유값 === course.고유값)) {
                yearMap[year].courses.push(course);
              }
              yearMap[year].revenue += adjustedRevenue;
            }
          });
        });

        // 수주 매출: 과정 시작일 기준으로 집계 (max mode 사용)
        const courseStartYearMap: { [year: number]: Set<string> } = {};
        for (let year = 2021; year <= 2026; year++) {
          courseStartYearMap[year] = new Set();
        }

        maxCourses.forEach((course) => {
          // 과정 시작일에서 연도 추출
          const courseData = currentCourses.find(c => c.고유값 === course.고유값);
          if (!courseData) return;

          const startDateStr = String(courseData.과정시작일 ?? '');
          let startYear: number | null = null;

          // YYYY-MM-DD 형식 시도
          if (/^\d{4}-\d{2}-\d{2}/.test(startDateStr)) {
            startYear = parseInt(startDateStr.substring(0, 4), 10);
          } else if (/^\d{4}/.test(startDateStr)) {
            // YYYY로 시작하는 다른 형식
            startYear = parseInt(startDateStr.substring(0, 4), 10);
          }

          if (startYear && startYear >= 2021 && startYear <= 2026) {
            const uniqueId = course.고유값;
            if (!courseStartYearMap[startYear].has(uniqueId)) {
              courseStartYearMap[startYear].add(uniqueId);
              const maxRevenue = course['매출 최대'] ?? 0;
              const contractStudents = courseData['수강신청 인원'] ?? 0;
              yearMap[startYear].contractRevenue += maxRevenue;
              yearMap[startYear].contractStudents += contractStudents;
            }
          }
        });

        // 각 연도별로 수료율 계산
        Object.values(yearMap).forEach((stat) => {
          stat.courseCount = stat.courses.length;
          stat.totalStudents = stat.courses.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
          stat.completedStudents = stat.courses.reduce((sum, c) => sum + (c.수료인원 ?? 0), 0);
          
          if (stat.totalStudents > 0) {
            stat.completionRate = (stat.completedStudents / stat.totalStudents) * 100;
          }
        });

        const stats = Object.values(yearMap).sort((a, b) => a.year - b.year);
        setYearlyStats(stats);

      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error instanceof Error ? error.message : '데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRowClick = (year: number, courses: CourseData[]) => {
    setSelectedYearForModal(year);
    setSelectedYearCourses(courses);
    setIsModalOpen(true);
  };

  const aggregatedCoursesForModal = aggregateCoursesByName(selectedYearCourses);

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex justify-center items-center">
        <p>데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8 flex justify-center items-center text-red-500">
        <p>오류: {error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">연도별 분석</h1>
      
      {/* 연도별 분석 그래프 */}
      <div className="mb-8">
        <YearlyAnalysis data={yearlyStats} />
      </div>

      {/* 연도별 상세 통계 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>연도별 상세 통계</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>연도</TableHead>
                <TableHead>총 매출</TableHead>
                <TableHead>총 수주인원</TableHead>
                <TableHead>수주 매출</TableHead>
                <TableHead>총 수강인원</TableHead>
                <TableHead>총 수료인원</TableHead>
                <TableHead>평균 수료율</TableHead>
                <TableHead>과정 수</TableHead>
                <TableHead>상세보기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearlyStats.map((stat) => {
                return (
                  <TableRow key={stat.year}>
                    <TableCell>{stat.year}년</TableCell>
                    <TableCell>{formatCurrency(stat.revenue || 0)}</TableCell>
                    <TableCell>{formatNumber(stat.contractStudents || 0)}명</TableCell>
                    <TableCell>{formatCurrency(stat.contractRevenue || 0)}</TableCell>
                    <TableCell>{formatNumber(stat.totalStudents || 0)}명</TableCell>
                    <TableCell>{formatNumber(stat.completedStudents || 0)}명</TableCell>
                    <TableCell>{stat.completionRate.toFixed(1)}%</TableCell>
                    <TableCell>{stat.courseCount}개</TableCell>
                    <TableCell>
                      <Button 
                        onClick={() => {
                          setSelectedYearForModal(stat.year);
                          setSelectedYearCourses(stat.courses);
                          setIsModalOpen(true);
                        }}
                        variant="outline" 
                        size="sm"
                      >
                        보기
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1E1E1E] text-gray-950 dark:text-[#F5F5F5] border-2 border-gray-400 dark:border-gray-600 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)]">
          <DialogHeader>
            <DialogTitle>{selectedYearForModal}년 과정 상세</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              선택된 연도의 훈련 과정 상세 정보입니다. 과정명이 같은 과정은 매출이 합산됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {aggregatedCoursesForModal.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>과정명</TableHead>
                    <TableHead>총 누적매출</TableHead>
                    <TableHead>과정 수</TableHead>
                    <TableHead>총 수강신청 인원</TableHead>
                    <TableHead>총 수료인원</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregatedCoursesForModal.map((aggCourse, index) => (
                    <TableRow key={index}>
                      <TableCell>{aggCourse.courseName}</TableCell>
                      <TableCell>{formatCurrency(aggCourse.totalRevenue)}</TableCell>
                      <TableCell>{aggCourse.count}개</TableCell>
                      <TableCell>{aggCourse.totalStudents}명</TableCell>
                      <TableCell>{aggCourse.totalCompletedStudents}명</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p>선택된 연도에 과정 데이터가 없습니다.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 