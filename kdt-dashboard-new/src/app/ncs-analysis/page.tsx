'use client';

import { useEffect, useState } from 'react';
import {
  loadDataFromGithub,
  preprocessData,
  applyRevenueAdjustment,
  calculateCompletionRate,
} from '@/utils/data-utils';
import {
  calculateNcsStats,
  aggregateCoursesByCourseNameForNcs,
  CourseData,
  RawCourseData,
  AggregatedCourseData,
  NcsStat,
} from '@/lib/data-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { parse as parseCsv } from 'papaparse';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function NcsAnalysis() {
  const [ncsStats, setNcsStats] = useState<NcsStat[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNcsName, setSelectedNcsName] = useState('');
  const [selectedNcsCourses, setSelectedNcsCourses] = useState<AggregatedCourseData[]>([]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const csvStr = await loadDataFromGithub();
        const parsed: any = parseCsv(csvStr as string, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          trimHeaders: true,
        });
        const processed = preprocessData(parsed.data as RawCourseData[]);
        const overallCompletion = calculateCompletionRate(processed);
        const adjusted = applyRevenueAdjustment(processed, overallCompletion);

        // year list
        const years = Array.from(new Set(adjusted.map((c) => c.훈련연도)))
          .filter((y) => y !== 0)
          .sort((a, b) => a - b);
        setAvailableYears(years);

        setNcsStats(calculateNcsStats(adjusted));
      } catch (e) {
        console.error('데이터 로드 오류:', e);
      }
    };
    fetchData();
  }, []);

  // Update when year changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const csvStr = await loadDataFromGithub();
        const parsed: any = parseCsv(csvStr as string, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          trimHeaders: true,
        });
        const processed = preprocessData(parsed.data as RawCourseData[]);
        const overallCompletion = calculateCompletionRate(processed);
        const adjusted = applyRevenueAdjustment(processed, overallCompletion);
        setNcsStats(
          calculateNcsStats(
            adjusted,
            selectedYear === 'all' ? undefined : selectedYear,
          ),
        );
      } catch (e) {
        console.error('데이터 로드 오류:', e);
      }
    };
    fetchData();
  }, [selectedYear]);

  const handleViewDetails = (ncsName: string, courses: CourseData[]) => {
    setSelectedNcsName(ncsName);
    const year = selectedYear === 'all' ? undefined : selectedYear;
    const aggregated = aggregateCoursesByCourseNameForNcs(courses, ncsName, year);
    setSelectedNcsCourses(aggregated);
    setIsModalOpen(true);
  };

  const calculateSelectedNcsStats = (courses: AggregatedCourseData[]) => {
    return {
      totalCourses: courses.length,
      totalStudents: courses.reduce((s, c) => s + c.총훈련생수, 0),
      totalCompleted: courses.reduce((s, c) => s + c.총수료인원, 0),
      totalRevenue: courses.reduce((s, c) => s + c.총누적매출, 0),
      avgSatisfaction: courses.reduce((s, c) => s + c.평균만족도, 0) / courses.length,
    };
  };

  const formatRevenue = (v: number) => `${(v / 1e8).toFixed(1)}억`;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">NCS별 분석</h1>

      {/* Year selector */}
      <div className="mb-10 relative z-10">
        <label
          htmlFor="year-select"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          연도 선택
        </label>
        <Select
          value={selectedYear.toString()}
          onValueChange={(val) =>
            setSelectedYear(val === 'all' ? 'all' : parseInt(val))
          }
        >
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="연도 선택" />
          </SelectTrigger>
          <SelectContent className="bg-white z-20">
            <SelectItem value="all">전체 연도</SelectItem>
            {availableYears.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bar chart */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          NCS별 매출액 (억원)
        </h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ncsStats.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ncsName" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatRevenue} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [formatRevenue(v), '매출액']} labelFormatter={(l) => `NCS: ${l}`} />
              <Bar dataKey="totalRevenue" fill="#EF4444" name="매출액" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 안내 문구 */}
      {selectedYear !== 'all' && (
        <div className="mb-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded px-4 py-3">
          <div>* 수료율은 과정 종료일 기준으로 포함하여 계산되었습니다.</div>
          <div>* ()는 전 해년 입과, 당 해년 수료 인원을 표기하였습니다.</div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  순위 & NCS명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  매출액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  훈련과정 수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  훈련생 수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  수료인원
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  수료율
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  평균 만족도
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상세
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ncsStats.map((stat, idx) => (
                <tr key={stat.ncsName} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {idx + 1}. {stat.ncsName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatRevenue(stat.totalRevenue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stat.totalCourses}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {selectedYear !== 'all' && stat.prevYearStudents > 0 
                      ? (
                        <div>
                          <div>{formatNumber(stat.totalStudents)}</div>
                          <div className="text-xs text-gray-500">({formatNumber(stat.prevYearStudents)})</div>
                        </div>
                      )
                      : formatNumber(stat.totalStudents)
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {selectedYear !== 'all' && stat.prevYearCompletedStudents > 0 
                      ? (
                        <div>
                          <div>{formatNumber(stat.completedStudents)}</div>
                          <div className="text-xs text-gray-500">({formatNumber(stat.prevYearCompletedStudents)})</div>
                        </div>
                      )
                      : formatNumber(stat.completedStudents)
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stat.completionRate.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stat.avgSatisfaction.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      className="text-indigo-600 hover:text-indigo-900"
                      onClick={() => handleViewDetails(stat.ncsName, stat.courses)}
                    >
                      상세보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="mx-auto max-w-[90vw] max-h-[90vh] w-full bg-white dark:bg-[#1E1E1E] text-gray-950 dark:text-[#F5F5F5] rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] p-0 overflow-y-auto border-2 border-gray-400 dark:border-gray-600">
          <DialogHeader className="p-6 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-950 dark:text-gray-100">
              {selectedNcsName} - 훈련과정 상세
              {selectedYear !== 'all' && ` (${selectedYear}년)`}
            </DialogTitle>
            <DialogDescription className="text-gray-700 dark:text-gray-400">
              선택된 NCS의 {selectedYear === 'all' ? '모든' : `${selectedYear}년`} 훈련과정 목록입니다. (매출액 기준 내림차순 정렬)
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            {/* Summary */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              {(() => {
                const stats = calculateSelectedNcsStats(selectedNcsCourses);
                return (
                  <>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-sm text-gray-500 dark:text-gray-400">훈련과정 수</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.totalCourses}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-sm text-gray-500 dark:text-gray-400">훈련생 수</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.totalStudents}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-sm text-gray-500 dark:text-gray-400">수료인원</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.totalCompleted}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-sm text-gray-500 dark:text-gray-400">매출액</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatRevenue(stats.totalRevenue)}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-sm text-gray-500 dark:text-gray-400">평균 만족도</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.avgSatisfaction.toFixed(1)}</div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="overflow-x-auto max-h-[65vh]">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[25%]">
                      과정명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[15%]">
                      훈련유형
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">
                      훈련생 수
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">
                      수료인원
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">
                      수료율
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">
                      매출액
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">
                      만족도
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">
                      원천과정수
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-[#1E1E1E] divide-y divide-gray-200 dark:divide-gray-700">
                  {selectedNcsCourses.map((course) => (
                    <tr key={course.과정명} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {course.과정명}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {course.훈련유형들?.join(', ') || '-'}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {course.총훈련생수}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {course.총수료인원}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {course.총수료인원 === 0
                          ? '-'
                          : `${((course.총수료인원 / course.총훈련생수) * 100).toFixed(1)}%`}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatRevenue(course.총누적매출)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {course.평균만족도.toFixed(1)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {course.원천과정수}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-3 flex justify-end border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              className="bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
              onClick={() => setIsModalOpen(false)}
            >
              닫기
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
