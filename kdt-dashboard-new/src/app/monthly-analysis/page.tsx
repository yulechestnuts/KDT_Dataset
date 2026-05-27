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

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const original = value;
    const cleaned = original
      .replace(/\([^)]*\)/g, '')
      .replace(/[^0-9+\-\.]/g, '')
      .trim();
    if (cleaned === '' || cleaned === '-' || cleaned.toLowerCase() === 'n/a') {
      console.log('[toFiniteNumber] empty/invalid string -> fallback', { original, cleaned });
      return fallback;
    }
    const num = Number(cleaned);
    if (!Number.isFinite(num)) {
      console.log('[toFiniteNumber] non-finite after parse -> fallback', { original, cleaned, num });
      return fallback;
    }
    return num;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    console.log('[toFiniteNumber] non-finite non-string -> fallback', { value, num });
    return fallback;
  }
  return num;
}

export default function MonthlyAnalysisPage() {
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [compareBaseYear, setCompareBaseYear] = useState<number | null>(2021);
  const [compareTargetYear, setCompareTargetYear] = useState<number | null>(2022);
  const [compareTopLimit, setCompareTopLimit] = useState<20 | 30>(20);
  const [compareViewMode, setCompareViewMode] = useState<'table' | 'chart'>('table');
  const [compareChartMetric, setCompareChartMetric] = useState<'students' | 'contract'>('students');
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

  const parseMonthKey = (month: string): number => {
    const [yearText, monthText] = month.split('-');
    const y = Number(yearText);
    const m = Number(monthText);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return 0;
    return y * 100 + m;
  };

  const displayedMonthlyStats = [...monthlyStats].sort((a, b) => {
    const aKey = parseMonthKey(a.month);
    const bKey = parseMonthKey(b.month);
    return sortOrder === 'latest' ? bKey - aKey : aKey - bKey;
  });

  // 연도별 집계 (수주금액/매출/훈련생 수 추세)
  const yearlyAggregates = monthlyStats.reduce((acc: Record<number, {
    revenue: number;
    contract: number;
    students: number;
  }>, stat) => {
    const [yearText] = stat.month.split('-');
    const y = Number(yearText);
    if (!Number.isFinite(y)) return acc;
    if (!acc[y]) {
      acc[y] = { revenue: 0, contract: 0, students: 0 };
    }
    acc[y].revenue += toFiniteNumber(stat.revenue, 0);
    acc[y].contract += toFiniteNumber((stat as any).contract_revenue, 0);
    acc[y].students += toFiniteNumber(stat.total_students, 0);
    return acc;
  }, {});

  const sortedYearKeys = Object.keys(yearlyAggregates)
    .map((y) => Number(y))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);

  const safeCompareBaseYear = compareBaseYear ?? sortedYearKeys[0] ?? null;
  const safeCompareTargetYear =
    compareTargetYear ?? sortedYearKeys[1] ?? sortedYearKeys[0] ?? null;

  // 월(1~12) 기준 모집/수주 강도 집계 (연도와 무관하게 달 자체의 패턴)
  const monthOfYearAggregates = monthlyStats.reduce((acc: Record<number, {
    contract: number;
    students: number;
  }>, stat) => {
    const [, monthText] = stat.month.split('-');
    const m = Number(monthText);
    if (!Number.isFinite(m)) return acc;
    if (!acc[m]) {
      acc[m] = { contract: 0, students: 0 };
    }
    acc[m].contract += toFiniteNumber((stat as any).contract_revenue, 0);
    acc[m].students += toFiniteNumber(stat.total_students, 0);
    return acc;
  }, {});

  const sortedMonthKeys = Object.keys(monthOfYearAggregates)
    .map((m) => Number(m))
    .filter((m) => Number.isFinite(m))
    .sort((a, b) => a - b);

  // 과정명 기준 연도별 모집 현황 (Top 과정 × 연도 매트릭스)
  const courseYearMatrix = monthlyStats.reduce((acc: Record<string, Record<number, {
    students: number;
    contract: number;
  }>>, stat) => {
    const [yearText] = stat.month.split('-');
    const y = Number(yearText);
    if (!Number.isFinite(y) || !stat.courses) return acc;
    for (const rawCourse of stat.courses as any[]) {
      const name = String(rawCourse.과정명 ?? '미상').trim() || '미상';
      const students = toFiniteNumber(rawCourse['수강신청 인원'], 0);
      const contract = toFiniteNumber(rawCourse.월별수주매출 ?? rawCourse['매출 최대'], 0);
      if (!acc[name]) acc[name] = {};
      if (!acc[name][y]) acc[name][y] = { students: 0, contract: 0 };
      acc[name][y].students += students;
      acc[name][y].contract += contract;
    }
    return acc;
  }, {});

  const buildYearComparisonRows = (metric: 'students' | 'contract') => {
    if (safeCompareBaseYear === null || safeCompareTargetYear === null) return [];

    return Object.entries(courseYearMatrix)
      .map(([name, yearMap]) => {
        const baseValue = toFiniteNumber(yearMap[safeCompareBaseYear]?.[metric] ?? 0, 0);
        const targetValue = toFiniteNumber(yearMap[safeCompareTargetYear]?.[metric] ?? 0, 0);
        const delta = targetValue - baseValue;
        const deltaRate = baseValue > 0 ? (delta / baseValue) * 100 : null;
        return { name, baseValue, targetValue, delta, deltaRate };
      })
      .filter((row) => row.baseValue > 0 || row.targetValue > 0)
      .sort((a, b) => {
        if (b.targetValue !== a.targetValue) return b.targetValue - a.targetValue;
        return b.baseValue - a.baseValue;
      })
      .slice(0, compareTopLimit);
  };

  const topCoursesByStudentsForYears = buildYearComparisonRows('students');
  const topCoursesByContractForYears = buildYearComparisonRows('contract');
  const activeCompareRows =
    compareChartMetric === 'students' ? topCoursesByStudentsForYears : topCoursesByContractForYears;
  const compareChartMaxValue = activeCompareRows.reduce((max, row) => {
    const localMax = Math.max(row.baseValue, row.targetValue);
    return localMax > max ? localMax : max;
  }, 0);

  const selectedMonthStat = monthlyStats.find((s) => s.month === selectedMonth) ?? null;

  const topCoursesByContract = Object.entries(
    selectedMonthDetails.reduce((acc: Record<string, number>, course: any) => {
      const name = String(course.과정명 ?? '미상').trim() || '미상';
      const contract = toFiniteNumber(course.월별수주매출 ?? course['매출 최대'] ?? 0, 0);
      acc[name] = (acc[name] ?? 0) + contract;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topInstitutionsByContract = Object.entries(
    selectedMonthDetails.reduce((acc: Record<string, number>, course: any) => {
      const institution = String(course.훈련기관 ?? '미상').trim() || '미상';
      const contract = toFiniteNumber(course.월별수주매출 ?? course['매출 최대'] ?? 0, 0);
      acc[institution] = (acc[institution] ?? 0) + contract;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

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
        <div className="flex gap-2">
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
          <Select
            value={sortOrder}
            onValueChange={(value) => setSortOrder(value as 'latest' | 'oldest')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="정렬" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">최신 월 우선</SelectItem>
              <SelectItem value="oldest">과거 월 우선</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                <TableHead>수주금액</TableHead>
                <TableHead>과정 수</TableHead>
                <TableHead>훈련생 수</TableHead>
                <TableHead>수료인원</TableHead>
                <TableHead>수료율</TableHead>
                <TableHead>상세보기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedMonthlyStats.map((stat) => (
                <TableRow key={stat.month}>
                  <TableCell>{stat.month}</TableCell>
                  <TableCell>{formatCurrency(toFiniteNumber(stat.revenue, 0))}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatCurrency(toFiniteNumber(stat.contract_revenue, 0))}</TableCell>
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

      {/* 연도별 추세 요약 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>연도별 추세 (매출·수주·훈련생)</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedYearKeys.length === 0 ? (
            <p className="text-sm text-gray-500">데이터가 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>연도</TableHead>
                  <TableHead className="text-right">매출 합계</TableHead>
                  <TableHead className="text-right">수주금액 합계</TableHead>
                  <TableHead className="text-right">훈련생 수 합계</TableHead>
                  <TableHead className="text-right">전년 대비 (수주)</TableHead>
                  <TableHead className="text-right">전년 대비 (훈련생)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedYearKeys.map((year, idx) => {
                  const current = yearlyAggregates[year];
                  const prev = idx > 0 ? yearlyAggregates[sortedYearKeys[idx - 1]] : undefined;
                  const contractYoY =
                    prev && prev.contract > 0
                      ? ((current.contract - prev.contract) / prev.contract) * 100
                      : null;
                  const studentsYoY =
                    prev && prev.students > 0
                      ? ((current.students - prev.students) / prev.students) * 100
                      : null;
                  return (
                    <TableRow key={year}>
                      <TableCell>{year}년</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(current.revenue)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(current.contract)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(current.students)}
                      </TableCell>
                      <TableCell className="text-right">
                        {contractYoY === null ? '-' : `${contractYoY.toFixed(1)}%`}
                      </TableCell>
                      <TableCell className="text-right">
                        {studentsYoY === null ? '-' : `${studentsYoY.toFixed(1)}%`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 월(1~12) 기준 모집/수주 강도 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>월별 모집·수주 패턴 (전체 기간 기준)</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedMonthKeys.length === 0 ? (
            <p className="text-sm text-gray-500">데이터가 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>월</TableHead>
                  <TableHead className="text-right">수주금액 합계</TableHead>
                  <TableHead className="text-right">훈련생 수 합계</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMonthKeys.map((m) => {
                  const aggr = monthOfYearAggregates[m];
                  return (
                    <TableRow key={m}>
                      <TableCell>{m}월</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrency(aggr.contract)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(aggr.students)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 연도 비교 기반 과정 Top 분석 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>연도 비교 과정 분석 (모집 인원 / 수주금액 Top 20~30)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2">
            <Select
              value={safeCompareBaseYear?.toString() ?? ''}
              onValueChange={(value) => setCompareBaseYear(Number(value))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="기준 연도" />
              </SelectTrigger>
              <SelectContent>
                {sortedYearKeys.map((year) => (
                  <SelectItem key={`base-${year}`} value={year.toString()}>
                    {year}년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={safeCompareTargetYear?.toString() ?? ''}
              onValueChange={(value) => setCompareTargetYear(Number(value))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="비교 연도" />
              </SelectTrigger>
              <SelectContent>
                {sortedYearKeys.map((year) => (
                  <SelectItem key={`target-${year}`} value={year.toString()}>
                    {year}년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(compareTopLimit)}
              onValueChange={(value) => setCompareTopLimit((Number(value) === 30 ? 30 : 20))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Top 개수" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">Top 20</SelectItem>
                <SelectItem value="30">Top 30</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1 ml-2">
              <Button
                variant={compareViewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCompareViewMode('table')}
              >
                표
              </Button>
              <Button
                variant={compareViewMode === 'chart' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCompareViewMode('chart')}
              >
                그래프
              </Button>
            </div>
          </div>

          {safeCompareBaseYear === null || safeCompareTargetYear === null ? (
            <p className="text-sm text-gray-500">비교 가능한 연도 데이터가 없습니다.</p>
          ) : compareViewMode === 'chart' ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={compareChartMetric === 'students' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCompareChartMetric('students')}
                >
                  모집 인원
                </Button>
                <Button
                  variant={compareChartMetric === 'contract' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCompareChartMetric('contract')}
                >
                  수주금액
                </Button>
              </div>
              <div className="text-sm text-gray-600">
                Top {compareTopLimit} 과정을 대상으로 {safeCompareBaseYear}년과 {safeCompareTargetYear}년 값을
                가로 막대로 비교합니다.
              </div>
              <div className="space-y-3">
                {activeCompareRows.map((row, index) => {
                  const baseWidth =
                    compareChartMaxValue > 0 ? (row.baseValue / compareChartMaxValue) * 100 : 0;
                  const targetWidth =
                    compareChartMaxValue > 0 ? (row.targetValue / compareChartMaxValue) * 100 : 0;
                  return (
                    <div key={`chart-${compareChartMetric}-${row.name}`} className="border rounded-md p-3">
                      <div className="flex justify-between items-center gap-2 mb-2">
                        <div className="text-sm font-medium min-w-0 truncate">
                          {index + 1}. {row.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {row.deltaRate === null ? '-' : `${row.deltaRate.toFixed(1)}%`}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>{safeCompareBaseYear}년</span>
                            <span className="whitespace-nowrap">
                              {compareChartMetric === 'students'
                                ? formatNumber(row.baseValue)
                                : formatCurrency(row.baseValue)}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded">
                            <div
                              className="h-2 bg-slate-400 rounded"
                              style={{ width: `${baseWidth}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>{safeCompareTargetYear}년</span>
                            <span className="whitespace-nowrap">
                              {compareChartMetric === 'students'
                                ? formatNumber(row.targetValue)
                                : formatCurrency(row.targetValue)}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded">
                            <div
                              className="h-2 bg-indigo-500 rounded"
                              style={{ width: `${targetWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div>
                <h3 className="font-semibold mb-2">
                  모집 인원 기준 Top {compareTopLimit} (과정명 기준 합산)
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>순위</TableHead>
                      <TableHead>과정명</TableHead>
                      <TableHead className="text-right">{safeCompareBaseYear}년 인원</TableHead>
                      <TableHead className="text-right">{safeCompareTargetYear}년 인원</TableHead>
                      <TableHead className="text-right">증감</TableHead>
                      <TableHead className="text-right">증감률</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCoursesByStudentsForYears.map((row, index) => (
                      <TableRow key={`students-${row.name}`}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="max-w-[420px] truncate">{row.name}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.baseValue)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.targetValue)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.delta)}</TableCell>
                        <TableCell className="text-right">
                          {row.deltaRate === null ? '-' : `${row.deltaRate.toFixed(1)}%`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="font-semibold mb-2">
                  수주금액 기준 Top {compareTopLimit} (과정명 기준 합산)
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>순위</TableHead>
                      <TableHead>과정명</TableHead>
                      <TableHead className="text-right">{safeCompareBaseYear}년 수주</TableHead>
                      <TableHead className="text-right">{safeCompareTargetYear}년 수주</TableHead>
                      <TableHead className="text-right">증감</TableHead>
                      <TableHead className="text-right">증감률</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCoursesByContractForYears.map((row, index) => (
                      <TableRow key={`contract-${row.name}`}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="max-w-[420px] truncate">{row.name}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(row.baseValue)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(row.targetValue)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(row.delta)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.deltaRate === null ? '-' : `${row.deltaRate.toFixed(1)}%`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 상세 정보 모달 */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{selectedMonth} 상세 과정</DialogTitle>
            <DialogDescription>
              수주금액 중심으로 해당 월의 과정/기관 성과를 확인합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">해당 월 수주금액</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-lg font-semibold text-yellow-600">
                {formatCurrency(toFiniteNumber(selectedMonthStat?.contract_revenue, 0))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">해당 월 과정 수</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-lg font-semibold">
                {formatNumber(toFiniteNumber(selectedMonthStat?.course_count, 0))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">해당 월 훈련생 수</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-lg font-semibold">
                {formatNumber(toFiniteNumber(selectedMonthStat?.total_students, 0))}명
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">수주금액 상위 과정 Top 10</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {topCoursesByContract.length === 0 ? (
                  <p className="text-sm text-gray-500">데이터가 없습니다.</p>
                ) : (
                  topCoursesByContract.map(([name, contract], index) => (
                    <div key={`${name}-${index}`} className="flex justify-between items-center gap-2 text-sm">
                      <span className="min-w-0 truncate pr-2">{index + 1}. {name}</span>
                      <span className="font-medium text-yellow-600 whitespace-nowrap flex-shrink-0">
                        {formatCurrency(toFiniteNumber(contract, 0))}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">수주금액 상위 훈련기관 Top 10</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {topInstitutionsByContract.length === 0 ? (
                  <p className="text-sm text-gray-500">데이터가 없습니다.</p>
                ) : (
                  topInstitutionsByContract.map(([institution, contract], index) => (
                    <div key={`${institution}-${index}`} className="flex justify-between items-center gap-2 text-sm">
                      <span className="min-w-0 truncate pr-2">{index + 1}. {institution}</span>
                      <span className="font-medium text-yellow-600 whitespace-nowrap flex-shrink-0">
                        {formatCurrency(toFiniteNumber(contract, 0))}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>과정명</TableHead>
                <TableHead>훈련기관</TableHead>
                <TableHead>시작일</TableHead>
                <TableHead>종료일</TableHead>
                <TableHead className="text-right">수강신청</TableHead>
                <TableHead className="text-right">수료</TableHead>
                <TableHead className="text-right">수주금액</TableHead>
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
                  <TableCell className="text-right whitespace-nowrap">
                    {formatCurrency(toFiniteNumber(course.월별수주매출 ?? course['매출 최대'], 0))}
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