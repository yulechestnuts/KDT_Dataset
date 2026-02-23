'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { kdtAPI, MonthlyStat } from '@/lib/api-client';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { ExternalLink } from "lucide-react";

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export default function MonthlyAnalysisPage() {
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonthDetails, setSelectedMonthDetails] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 연도 목록 생성 (2021년부터 현재 연도까지)
  const years = Array.from(
    { length: new Date().getFullYear() - 2020 },
    (_, i) => 2021 + i
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await kdtAPI.getMonthlyStats(undefined);
        setMonthlyStats(result?.data ?? []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : '데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // 초기 로딩 시에만 실행

  // 연도 선택 시 통계 업데이트 (API에서 재조회)
  useEffect(() => {
    const fetchYear = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await kdtAPI.getMonthlyStats(selectedYear ?? undefined);
        setMonthlyStats(result?.data ?? []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : '데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchYear();
  }, [selectedYear]);

  const handleViewDetails = (monthStr: string) => {
    setSelectedMonth(monthStr);
    setIsModalOpen(true);

    const stat = monthlyStats.find((s) => s.month === monthStr);
    setSelectedMonthDetails(stat?.courses ?? []);
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
                <TableHead>과정 수</TableHead>
                <TableHead>훈련생 수</TableHead>
                <TableHead>수료인원</TableHead>
                <TableHead>수료율</TableHead>
                <TableHead>상세보기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyStats.map((stat) => (
                <TableRow key={stat.month}>
                  <TableCell>{stat.month}</TableCell>
                  <TableCell>{formatCurrency(toFiniteNumber(stat.revenue, 0))}</TableCell>
                  <TableCell>{formatNumber(toFiniteNumber(stat.course_count, 0))}</TableCell>
                  <TableCell>{formatNumber(toFiniteNumber(stat.total_students, 0))}</TableCell>
                  <TableCell>{formatNumber(toFiniteNumber(stat.completed_students, 0))}</TableCell>
                  <TableCell>{toFiniteNumber(stat.completion_rate, 0).toFixed(1)}%</TableCell>
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
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{selectedMonth} 상세 과정</DialogTitle>
            <DialogDescription>
              서버에서 제공한 월별 통계 기준으로 해당 월에 연결된 과정 목록을 표시합니다.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>과정명</TableHead>
                <TableHead>훈련기관</TableHead>
                <TableHead>시작일</TableHead>
                <TableHead>종료일</TableHead>
                <TableHead className="text-right">수강신청</TableHead>
                <TableHead className="text-right">수료</TableHead>
                <TableHead className="text-right">매출</TableHead>
                <TableHead>링크</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(selectedMonthDetails ?? []).map((course: any, idx: number) => (
                <TableRow key={course.고유값 ?? `${idx}`}>
                  <TableCell className="font-medium">{course.과정명 ?? '-'}</TableCell>
                  <TableCell>{course.훈련기관 ?? '-'}</TableCell>
                  <TableCell>{course.과정시작일 ?? '-'}</TableCell>
                  <TableCell>{course.과정종료일 ?? '-'}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(toFiniteNumber(course['수강신청 인원'], 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(toFiniteNumber(course.수료인원, 0))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(toFiniteNumber(course.총누적매출 ?? course.누적매출, 0))}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            `/course-analysis?course=${encodeURIComponent(course.과정명 ?? '')}`,
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
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}