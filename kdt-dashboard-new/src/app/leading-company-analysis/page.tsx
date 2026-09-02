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
  calculateLeadingCompanyStats,
  aggregateCoursesByCourseNameForLeadingCompany,
  LeadingCompanyStat,
  AggregatedCourseData,
  CourseData,
  RawCourseData,
} from '@/lib/data-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function LeadingCompanyAnalysis() {
  const [stats, setStats] = useState<LeadingCompanyStat[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [years, setYears] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<AggregatedCourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 전체 과정 목록. 연도 필터는 클라이언트에서 적용한다(재조회 불필요).
  const [allCourses, setAllCourses] = useState<CourseData[]>([]);

  // helper
  const formatRevenue = (v: number) => `${(v / 1e8).toFixed(1)}억`;

  // load data
  //
  // 이전에는 GitHub 의 result_kdtdata_202512.csv 를 받았는데 그 파일이 리포지토리에서
  // 사라져 404 였다. 다른 분석 페이지와 같은 Supabase 기반 API 로 통일한다.
  // (매출 보정은 서버에서 이미 적용된 값이 내려온다)
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
        setYears((res?.meta?.available_years ?? []).filter((y) => y !== 0));
        setStats(calculateLeadingCompanyStats(courses));
      } catch (e) {
        if (cancelled) return;
        console.error('data load error:', e);
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

  // reload on year change
  // 연도만 바뀌는데 데이터를 다시 받을 이유가 없다. 받아둔 목록으로 재계산한다.
  useEffect(() => {
    if (allCourses.length === 0) return;
    setStats(
      calculateLeadingCompanyStats(allCourses, selectedYear === 'all' ? undefined : selectedYear)
    );
  }, [selectedYear, allCourses]);

  const handleViewDetails = (company: string, courses: CourseData[]) => {
    setSelectedCompany(company);
    const year = selectedYear === 'all' ? undefined : selectedYear;
    // 이 함수는 인자가 1개다. company/year 를 넘겨도 무시되므로 필터링은 여기서 한다.
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
    const agg = aggregateCoursesByCourseNameForLeadingCompany(scoped);
    setSelectedCourses(agg);
    setIsModalOpen(true);
  };

  const summarize = (courses: AggregatedCourseData[]) => {
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">선도기업형 과정 분석</h1>

      {/* year select */}
      <div className="mb-10 relative z-10">
        <label className="block text-sm font-medium text-gray-700 mb-2">연도 선택</label>
        <Select
          value={selectedYear.toString()}
          onValueChange={(v) => setSelectedYear(v === 'all' ? 'all' : parseInt(v))}
        >
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="연도 선택" />
          </SelectTrigger>
          <SelectContent className="bg-white z-20">
            <SelectItem value="all">전체 연도</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>{y}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* chart */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">선도기업별 매출액 (억원)</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="leadingCompany" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatRevenue} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [formatRevenue(v), '매출액']} labelFormatter={(l) => `선도기업: ${l}`} />
              <Bar dataKey="totalRevenue" fill="#06b6d4" name="매출액" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* table */}
      <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">순위 & 선도기업</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">매출액</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">훈련과정 수</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">훈련생 수</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수료인원</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수료율</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">평균 만족도</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상세</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.map((stat, idx) => (
                <tr key={stat.leadingCompany} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {idx + 1}. {stat.leadingCompany}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatRevenue(stat.totalRevenue)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.totalCourses}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.totalStudents}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.completedStudents}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.completionRate.toFixed(1)}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatSatisfaction(stat.avgSatisfaction)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button className="text-indigo-600 hover:text-indigo-900" onClick={() => handleViewDetails(stat.leadingCompany, stat.courses)}>상세보기</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="mx-auto max-w-[90vw] max-h-[90vh] w-full bg-white dark:bg-[#1E1E1E] text-gray-950 dark:text-[#F5F5F5] rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] p-0 overflow-y-auto border-2 border-gray-400 dark:border-gray-600">
          <DialogHeader className="p-6 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-950 dark:text-gray-100">
              {selectedCompany} - 훈련과정 상세{selectedYear !== 'all' && ` (${selectedYear}년)`}
            </DialogTitle>
            <DialogDescription className="text-gray-700 dark:text-gray-400">
              선택된 선도기업의 {selectedYear === 'all' ? '모든' : `${selectedYear}년`} 훈련과정 목록입니다. (매출액 기준 내림차순 정렬)
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            {/* summary */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              {(() => {
                const s = summarize(selectedCourses);
                return (
                  <>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700"><div className="text-sm text-gray-500 dark:text-gray-400">훈련과정 수</div><div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{s.totalCourses}</div></div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700"><div className="text-sm text-gray-500 dark:text-gray-400">훈련생 수</div><div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{s.totalStudents}</div></div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700"><div className="text-sm text-gray-500 dark:text-gray-400">수료인원</div><div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{s.totalCompleted}</div></div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700"><div className="text-sm text-gray-500 dark:text-gray-400">매출액</div><div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatRevenue(s.totalRevenue)}</div></div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700"><div className="text-sm text-gray-500 dark:text-gray-400">평균 만족도</div><div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatSatisfaction(s.avgSatisfaction)}</div></div>
                  </>
                );
              })()}
            </div>

            <div className="overflow-x-auto max-h-[65vh]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">과정명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">훈련유형</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">훈련생 수</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">수료인원</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">수료율</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">매출액</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">만족도</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">원천과정수</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedCourses.map((course) => (
                    <tr key={course.과정명} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{course.과정명}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.훈련유형들?.join(', ') || '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.총훈련생수}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.총수료인원}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.총수료인원 === 0 ? '-' : `${((course.총수료인원 / course.총훈련생수) * 100).toFixed(1)}%`}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatRevenue(course.총누적매출)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatSatisfaction(course.평균만족도)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.원천과정수}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-3 flex justify-end">
            <button type="button" className="bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200" onClick={() => setIsModalOpen(false)}>닫기</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
