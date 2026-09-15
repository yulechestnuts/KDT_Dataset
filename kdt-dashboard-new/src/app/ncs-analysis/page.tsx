'use client';

import { formatSatisfaction } from '@/lib/satisfaction-rule';
/** 만족도가 실측된 과정만 평균낸다. 표본이 없으면 null. */
function meanObservedSatisfaction(courses: Array<{ 평균만족도?: number }>): number | null {
  const vals = courses
    .map((c) => Number(c?.평균만족도 ?? 0))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}


import { useEffect, useState } from 'react';
import { kdtAPI } from '@/lib/api-client';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 원본 과정 목록 (연도 필터는 클라이언트에서 적용 — API 는 전체를 한 번만 받는다)
  const [allCourses, setAllCourses] = useState<CourseData[]>([]);

  // Fetch initial data
  //
  // 이전에는 GitHub 의 result_kdtdata_202512.csv 를 받아 클라이언트에서 파싱·보정했는데,
  // 그 파일이 리포지토리에서 사라져 404 가 나면서 페이지가 통째로 오류였다.
  // 지금은 다른 분석 페이지와 같은 Supabase 기반 API 를 쓴다.
  // (매출 보정은 서버의 applyRevenueAdjustment 이 이미 적용해 내려준다)
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await kdtAPI.getCourseAnalysis({});
        if (cancelled) return;

        const courses = (res?.data ?? []) as unknown as CourseData[];
        setAllCourses(courses);

        const years = (res?.meta?.available_years ?? []).filter((y) => y !== 0);
        setAvailableYears(years);
        setNcsStats(calculateNcsStats(courses));
      } catch (e) {
        if (cancelled) return;
        console.error('데이터 로드 오류:', e);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Update when year changes
  // 연도만 바뀌는데 데이터를 다시 받을 이유가 없다. 이미 받아둔 목록으로 재계산한다.
  useEffect(() => {
    if (allCourses.length === 0) return;
    setNcsStats(calculateNcsStats(allCourses, selectedYear === 'all' ? undefined : selectedYear));
  }, [selectedYear, allCourses]);

  const handleViewDetails = (ncsName: string, courses: CourseData[]) => {
    setSelectedNcsName(ncsName);
    const year = selectedYear === 'all' ? undefined : selectedYear;
    // aggregateCoursesByCourseNameForNcs 는 인자가 1개다. ncsName/year 를 넘겨도 무시되므로
    // 필터링은 여기서 직접 한다.
    const scoped = year
      ? courses.filter((c) => {
          const start = new Date(c.과정시작일);
          const end = new Date(c.과정종료일);
          return (
            start.getFullYear() === year ||
            (start.getFullYear() < year && end.getFullYear() >= year)
          );
        })
      : courses;
    const aggregated = aggregateCoursesByCourseNameForNcs(scoped);
    setSelectedNcsCourses(aggregated);
    setIsModalOpen(true);
  };

  const calculateSelectedNcsStats = (courses: AggregatedCourseData[]) => {
    return {
      totalCourses: courses.length,
      totalStudents: courses.reduce((s, c) => s + c.총훈련생수, 0),
      totalCompleted: courses.reduce((s, c) => s + c.총수료인원, 0),
      totalRevenue: courses.reduce((s, c) => s + c.총누적매출, 0),
      // 만족도는 실측이 없는 과정이 있어 0 이 섞인다. 그대로 평균내면 0 쪽으로 끌린다.
      // 관측된 값만 평균한다 (@/lib/satisfaction-rule 의 방침과 동일).
      avgSatisfaction: meanObservedSatisfaction(courses),
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
                    {formatSatisfaction(stat.avgSatisfaction)}
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
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatSatisfaction(stats.avgSatisfaction)}</div>
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
                        {formatSatisfaction(course.평균만족도)}
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
