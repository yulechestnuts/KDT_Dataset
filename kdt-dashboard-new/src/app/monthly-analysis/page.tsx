'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { calculateMonthlyStatistics, calculateCompletionRate, applyRevenueAdjustment } from "@/lib/data-utils";
import { loadDataFromGithub, preprocessData } from "@/utils/data-loader";
import { CourseData } from "@/lib/data-utils";
import { MonthlyStats } from "@/lib/data-utils";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import Papa from 'papaparse';
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

export default function MonthlyAnalysisPage() {
  const [data, setData] = useState<CourseData[]>([]); // 원본 데이터
  const [processedAdjustedData, setProcessedAdjustedData] = useState<CourseData[]>([]); // 전처리 및 조정된 데이터
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonthDetails, setSelectedMonthDetails] = useState<CourseData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

  // 연도 목록 생성 (2021년부터 현재 연도까지)
  const years = Array.from(
    { length: new Date().getFullYear() - 2020 },
    (_, i) => 2021 + i
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const rawData = await loadDataFromGithub();
        const parsedData = Papa.parse(rawData, { header: true });
        let initialProcessedData = preprocessData(parsedData.data);
        
        if (!Array.isArray(initialProcessedData) || initialProcessedData.length === 0) {
          throw new Error('처리된 데이터가 유효하지 않습니다.');
        }

        // 전체 수료율을 calculateCompletionRate 함수를 사용하여 계산 (초기 1회만)
        const overallCompletionRate = calculateCompletionRate(initialProcessedData);
        const adjustedData = applyRevenueAdjustment(initialProcessedData, overallCompletionRate);

        setData(initialProcessedData); // 원본 데이터 저장
        setProcessedAdjustedData(adjustedData); // 조정된 데이터 저장

        // 초기 월별 통계 계산 (전체 기간)
        const initialStats = calculateMonthlyStatistics(adjustedData, undefined); // 초기에는 selectedYear 없이 호출
        setMonthlyStats(initialStats);

      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : '데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // 초기 로딩 시에만 실행

  // 연도 선택 시 통계 업데이트 (processedAdjustedData가 준비된 후에만 실행)
  useEffect(() => {
    if (processedAdjustedData.length > 0) {
      const stats = calculateMonthlyStatistics(processedAdjustedData, selectedYear ?? undefined);
      setMonthlyStats(stats);
    }
  }, [selectedYear, processedAdjustedData]); // selectedYear 또는 조정된 데이터가 변경될 때만 실행

  const handleViewDetails = (monthStr: string) => {
    setSelectedMonth(monthStr);
    setIsModalOpen(true);
    
    // Filter data for the selected month
    const [year, month] = monthStr.split('-').map(Number);
    const filtered = processedAdjustedData
      .filter(course => {
        const startDate = new Date(course.과정시작일);
        return (
          startDate.getFullYear() === year &&
          startDate.getMonth() + 1 === month
        );
      })
      // 매출액(조정_누적매출 > 누적매출) 기준 내림차순 정렬
      .sort(
        (a, b) =>
          (b.조정_누적매출 ?? b.누적매출 ?? 0) -
          (a.조정_누적매출 ?? a.누적매출 ?? 0)
      );

    setSelectedMonthDetails(filtered);
  };

  const toggleCourseExpansion = (courseId: string) => {
    const newExpanded = new Set(expandedCourses);
    if (newExpanded.has(courseId)) {
      newExpanded.delete(courseId);
    } else {
      newExpanded.add(courseId);
    }
    setExpandedCourses(newExpanded);
  };

  if (isLoading) {
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">월별 분석</h1>
        <Select
          value={selectedYear?.toString() ?? "all"}
          onValueChange={(value) => setSelectedYear(value === "all" ? null : parseInt(value))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="연도 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 기간</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* 월별 매출 추이 그래프 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>월별 매출 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart data={monthlyStats} />
        </CardContent>
      </Card>

      {/* 월별 상세 통계 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>월별 상세 통계</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>월</TableHead>
                <TableHead>매출</TableHead>
                <TableHead>훈련생 수</TableHead>
                <TableHead>과정 수</TableHead>
                <TableHead>수료인원</TableHead>
                <TableHead>수료율</TableHead>
                <TableHead>상세보기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyStats.map((stat) => (
                <TableRow key={stat.month}>
                  <TableCell>{stat.month}</TableCell>
                  <TableCell>{formatCurrency(stat.revenue)}</TableCell>
                  <TableCell>{formatNumber(stat.totalStudents)}</TableCell>
                  <TableCell>{formatNumber(stat.courses.length)}</TableCell>
                  <TableCell>{formatNumber(stat.completedStudents)}</TableCell>
                  <TableCell>{stat.completionRate.toFixed(1)}%</TableCell>
                  <TableCell>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewDetails(stat.month)}
                    >
                      보기
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 상세 정보 모달 */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMonth} 상세 분석</DialogTitle>
            <DialogDescription>
              선택된 월의 과정 상세 목록입니다.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>과정명</TableHead>
                <TableHead>훈련기관</TableHead>
                <TableHead>회차</TableHead>
                <TableHead>시작일</TableHead>
                <TableHead>종료일</TableHead>
                <TableHead>훈련생 수</TableHead>
                <TableHead>수료인원</TableHead>
                <TableHead>수료율</TableHead>
                <TableHead>매출</TableHead>
                <TableHead>과정 페이지</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedMonthDetails.map((course, idx) => {
                // 고유 key 생성을 위해 idx 추가
                const courseId = `${course.과정명}-${course.회차}-${idx}`;
                const isExpanded = expandedCourses.has(courseId);
                const allCourseDetails = processedAdjustedData.filter(c => c.과정명 === course.과정명)
                  .sort((a, b) => new Date(a.과정시작일).getTime() - new Date(b.과정시작일).getTime());

                return (
                  <React.Fragment key={courseId}>
                    <TableRow key={`${courseId}-main`}>
                      <TableCell>
                        {course.과정명}
                      </TableCell>
                      <TableCell>{course.훈련기관}</TableCell>
                      <TableCell>{course.회차}</TableCell>
                      <TableCell>{new Date(course.과정시작일).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(course.과정종료일).toLocaleDateString()}</TableCell>
                      <TableCell>{formatNumber(course['수강신청 인원'])}</TableCell>
                      <TableCell>{formatNumber(course.수료인원)}</TableCell>
                      <TableCell>{((course.수료인원 || 0) / (course['수강신청 인원'] || 1) * 100).toFixed(1)}%</TableCell>
                      <TableCell>{formatCurrency(course.조정_누적매출 ?? course.누적매출)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `/course-analysis?course=${encodeURIComponent(course.과정명)}`,
                                '_blank'
                              )}
                          >
                            상세분석
                          </Button>
                          {course.과정페이지링크 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(course.과정페이지링크, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              바로가기
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded &&
                      allCourseDetails.map((detail, detailIdx) => (
                        <TableRow
                          key={`${courseId}-${detail.회차}-${detailIdx}`}
                          className="bg-gray-50"
                        >
                          <TableCell className="pl-12">{detail.과정명}</TableCell>
                          <TableCell>{detail.훈련기관}</TableCell>
                          <TableCell>{detail.회차}</TableCell>
                          <TableCell>{new Date(detail.과정시작일).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(detail.과정종료일).toLocaleDateString()}</TableCell>
                          <TableCell>{formatNumber(detail['수강신청 인원'])}</TableCell>
                          <TableCell>{formatNumber(detail.수료인원)}</TableCell>
                          <TableCell>{((detail.수료인원 || 0) / (detail['수강신청 인원'] || 1) * 100).toFixed(1)}%</TableCell>
                          <TableCell>{formatCurrency(detail.조정_누적매출 ?? detail.누적매출)}</TableCell>
                          <TableCell>
                            {detail.과정페이지링크 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(detail.과정페이지링크, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                바로가기
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
} 