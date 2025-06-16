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
import { CourseDetailDialog } from "@/components/CourseDetailDialog";

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
      const courseName = course.과정명 || '알 수 없는 과정명';
      if (!aggregated[courseName]) {
        aggregated[courseName] = {
          courseName: courseName,
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
          aggregated[courseName].totalRevenue += adjustedYearlyRevenue;
        }
      });

      aggregated[courseName].count += 1;
      aggregated[courseName].totalStudents += course['수강신청 인원'] ?? 0;
      aggregated[courseName].totalCompletedStudents += course['수료인원'] ?? 0;
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

  const handleCourseUpdate = (updatedCourse: CourseData) => {
    // 전체 데이터에서 해당 과정을 찾아 업데이트
    setData(prevData => {
      const newData = prevData.map(course => 
        course.과정ID === updatedCourse.과정ID ? updatedCourse : course
      );
      
      // 연도별 통계 재계산
      const stats = generateYearlyStats(newData);
      setYearlyStats(stats);
      
      return newData;
    });

    // 선택된 연도의 과정 목록도 업데이트
    setSelectedYearCourses(prevCourses => 
      prevCourses.map(course => 
        course.과정ID === updatedCourse.과정ID ? updatedCourse : course
      )
    );
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
                const currentDate = new Date();
                const twentyOneDaysAgo = new Date(currentDate.getTime() - 21 * 24 * 60 * 60 * 1000);
                
                // Python 코드와 동일한 로직 적용
                let filteredCourses;
                if (stat.year) {
                  // 해당 연도에 종료된 과정만 필터링
                  filteredCourses = stat.courses.filter(course => {
                    const endDate = new Date(course.과정종료일);
                    return endDate.getFullYear() === stat.year && endDate < twentyOneDaysAgo;
                  });
                } else {
                  // 전체 기간 중 종료된 과정만 필터링 (현재 날짜 이전)
                  filteredCourses = stat.courses.filter(course => {
                    const endDate = new Date(course.과정종료일);
                    return endDate <= currentDate && endDate < twentyOneDaysAgo;
                  });
                }

                // 수료인원이 0인 과정 제외
                const validCourses = filteredCourses.filter(course => (course['수료인원'] ?? 0) > 0);

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

                // Python 코드와 동일하게 수료율 계산
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
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedYearForModal}년 과정 상세</DialogTitle>
            <DialogDescription>
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
                    <TableHead>상세보기</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregatedCoursesForModal.map((aggCourse, index) => {
                    const course = selectedYearCourses.find(c => c.과정명 === aggCourse.courseName);
                    return (
                      <TableRow key={index}>
                        <TableCell>{aggCourse.courseName}</TableCell>
                        <TableCell>{formatCurrency(aggCourse.totalRevenue)}</TableCell>
                        <TableCell>{aggCourse.count}개</TableCell>
                        <TableCell>{aggCourse.totalStudents}명</TableCell>
                        <TableCell>{aggCourse.totalCompletedStudents}명</TableCell>
                        <TableCell>
                          {course && (
                            <CourseDetailDialog
                              course={course}
                              isOpen={true}
                              onClose={() => {}}
                              onUpdate={handleCourseUpdate}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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