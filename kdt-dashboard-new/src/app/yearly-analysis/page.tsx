'use client';

import { useEffect, useState } from 'react';
import { loadDataFromGithub, preprocessData, generateYearlyStats, applyRevenueAdjustment, calculateCompletionRate } from "@/utils/data-utils";
import { CourseData } from "@/lib/data-utils";
import { YearlyStats } from "@/utils/data-utils";
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
import Papa from 'papaparse';

export default function YearlyAnalysisPage() {
  const [data, setData] = useState<CourseData[]>([]);
  const [yearlyStats, setYearlyStats] = useState<YearlyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedYearCourses, setSelectedYearCourses] = useState<CourseData[]>([]);
  const [selectedYearForModal, setSelectedYearForModal] = useState<number | null>(null);

  const aggregateCoursesByName = (courses: CourseData[]) => {
    const aggregated: { [key: string]: { courseName: string, totalRevenue: number, count: number, institution: string, startDate: Date, endDate: Date, totalStudents: number, totalCompletedStudents: number } } = {};

    courses.forEach(course => {
      const courseKey = course['훈련과정 ID'] || course.과정명 || '알 수 없는 과정명';
      if (!aggregated[courseKey]) {
        // 훈련과정 ID가 있는 경우, 해당 ID의 모든 과정 중 훈련시작일이 가장 늦은 과정의 과정명 사용
        let displayCourseName = course.과정명;
        if (course['훈련과정 ID']) {
          const coursesWithSameId = courses.filter(c => c['훈련과정 ID'] === course['훈련과정 ID']);
          if (coursesWithSameId.length > 0) {
            const latestCourse = coursesWithSameId.reduce((latest, current) => {
              return new Date(current.과정시작일) > new Date(latest.과정시작일) ? current : latest;
            });
            displayCourseName = latestCourse.과정명;
          }
        }

        aggregated[courseKey] = {
          courseName: displayCourseName,
          totalRevenue: 0,
          count: 0,
          institution: course.훈련기관,
          startDate: new Date(course.과정시작일),
          endDate: new Date(course.과정종료일),
          totalStudents: 0,
          totalCompletedStudents: 0,
        };
      }
      
      // 연도별 조정 매출을 합산하여 총 누적 매출 계산
      const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'] as const;
      yearColumns.forEach(yearCol => {
        const adjustedYearlyRevenue = course[`조정_${yearCol}` as keyof CourseData] as number | undefined;
        if (adjustedYearlyRevenue !== undefined) {
          aggregated[courseKey].totalRevenue += adjustedYearlyRevenue;
        }
      });

      aggregated[courseKey].count += 1;
      aggregated[courseKey].totalStudents += course['수강신청 인원'] ?? 0;
      aggregated[courseKey].totalCompletedStudents += course['수료인원'] ?? 0;
    });
    return Object.values(aggregated).sort((a, b) => b.totalRevenue - a.totalRevenue);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/data');
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        const rawCsvData = await response.text();
        const parsedData = Papa.parse(rawCsvData, { header: true });
        
        let processedData = preprocessData(parsedData.data);

        // 전체 수료율을 calculateCompletionRate 함수를 사용하여 계산
        const overallCompletionRate = calculateCompletionRate(processedData); 

        // Apply revenue adjustment
        processedData = applyRevenueAdjustment(processedData, overallCompletionRate);
        
        // 데이터가 유효한지 확인
        if (!Array.isArray(processedData) || processedData.length === 0) {
          throw new Error('처리된 데이터가 유효하지 않습니다.');
        }

        setData(processedData);
        const stats = generateYearlyStats(processedData);
        
        // 통계 데이터가 유효한지 확인
        if (!Array.isArray(stats) || stats.length === 0) {
          throw new Error('연도별 통계 데이터를 생성할 수 없습니다.');
        }

        console.log("Yearly Stats:", stats);
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
                <TableHead>총 수강인원</TableHead>
                <TableHead>총 수료인원</TableHead>
                <TableHead>평균 수료율</TableHead>
                <TableHead>과정 수</TableHead>
                <TableHead>상세보기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearlyStats.map((stat) => {
                // 해당 연도의 과정들 중에서 수료율 계산 대상 필터링
                let filteredCourses;
                if (stat.year) {
                  // 해당 연도에 종료된 과정만 필터링
                  filteredCourses = stat.courses.filter(course => {
                    const endDate = new Date(course.과정종료일);
                    return endDate.getFullYear() === stat.year;
                  });
                } else {
                  // 전체 기간의 모든 과정 포함
                  filteredCourses = stat.courses;
                }

                // 수료인원이 0인 과정과 수강신청 인원이 0인 과정 제외
                const validCourses = filteredCourses.filter(course => 
                  (course['수료인원'] ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0
                );

                if (validCourses.length === 0) {
                  return (
                    <TableRow key={stat.year}>
                      <TableCell>{stat.year}년</TableCell>
                      <TableCell>{formatCurrency(stat.revenue || 0)}</TableCell>
                      <TableCell>{formatNumber(stat.totalStudents || 0)}명</TableCell>
                      <TableCell>{formatNumber(stat.completedStudents || 0)}명</TableCell>
                      <TableCell>0.0%</TableCell>
                      <TableCell>{stat.courses?.length || 0}개</TableCell>
                      <TableCell>
                        <Button 
                          onClick={() => handleRowClick(stat.year, stat.courses || [])}
                          variant="outline" 
                          size="sm"
                        >
                          보기
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }

                // 수료율 계산
                const totalCompletion = validCourses.reduce((sum, course) => sum + (course['수료인원'] ?? 0), 0);
                const totalEnrollment = validCourses.reduce((sum, course) => sum + (course['수강신청 인원'] ?? 0), 0);
                const completionRate = (totalCompletion / totalEnrollment * 100).toFixed(1);

                return (
                  <TableRow key={stat.year}>
                    <TableCell>{stat.year}년</TableCell>
                    <TableCell>{formatCurrency(stat.revenue || 0)}</TableCell>
                    <TableCell>{formatNumber(stat.totalStudents || 0)}명</TableCell>
                    <TableCell>{formatNumber(stat.completedStudents || 0)}명</TableCell>
                    <TableCell>{completionRate}%</TableCell>
                    <TableCell>{stat.courses?.length || 0}개</TableCell>
                    <TableCell>
                      <Button 
                        onClick={() => handleRowClick(stat.year, stat.courses || [])}
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