'use client';

import { useEffect, useState } from 'react';
import {
  loadDataFromGithub,
  preprocessData,
  applyRevenueAdjustment,
  calculateCompletionRate,
} from '@/utils/data-utils';
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

export default function LeadingCompanyAnalysis() {
  const [stats, setStats] = useState<LeadingCompanyStat[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [years, setYears] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<AggregatedCourseData[]>([]);

  // helper
  const formatRevenue = (v: number) => `${(v / 1e8).toFixed(1)}억`;

  // load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const rawStr = await loadDataFromGithub();
        const parsed: any = parseCsv(rawStr as string, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          trimHeaders: true,
        });
        const processed = preprocessData(parsed.data as RawCourseData[]);
        const overallCompletion = calculateCompletionRate(processed);
        const adjusted = applyRevenueAdjustment(processed, overallCompletion);

        const yrs = Array.from(new Set(adjusted.map((c) => c.훈련연도)))
          .filter((y) => y !== 0)
          .sort((a, b) => a - b);
        setYears(yrs);

        setStats(calculateLeadingCompanyStats(adjusted));
      } catch (e) {
        console.error('data load error:', e);
      }
    };
    fetchData();
  }, []);

  // reload on year change
  useEffect(() => {
    const fetchData = async () => {
      try {
        const rawStr = await loadDataFromGithub();
        const parsed: any = parseCsv(rawStr as string, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          trimHeaders: true,
        });
        const processed = preprocessData(parsed.data as RawCourseData[]);
        const overallCompletion = calculateCompletionRate(processed);
        const adjusted = applyRevenueAdjustment(processed, overallCompletion);

        setStats(
          calculateLeadingCompanyStats(
            adjusted,
            selectedYear === 'all' ? undefined : selectedYear,
          ),
        );
      } catch (e) {
        console.error('data load error:', e);
      }
    };
    fetchData();
  }, [selectedYear]);

  const handleViewDetails = (company: string, courses: CourseData[]) => {
    setSelectedCompany(company);
    const year = selectedYear === 'all' ? undefined : selectedYear;
    const agg = aggregateCoursesByCourseNameForLeadingCompany(courses, company, year);
    setSelectedCourses(agg);
    setIsModalOpen(true);
  };

  const summarize = (courses: AggregatedCourseData[]) => {
    return {
      totalCourses: courses.length,
      totalStudents: courses.reduce((s, c) => s + c.총훈련생수, 0),
      totalCompleted: courses.reduce((s, c) => s + c.총수료인원, 0),
      totalRevenue: courses.reduce((s, c) => s + c.총누적매출, 0),
      avgSatisfaction: courses.reduce((s, c) => s + c.평균만족도, 0) / courses.length,
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.avgSatisfaction.toFixed(1)}</td>
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
        <DialogContent className="mx-auto max-w-[80vw] max-h-[85vh] w-full bg-white rounded-xl shadow-lg p-0 overflow-y-auto">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-900">
              {selectedCompany} - 훈련과정 상세{selectedYear !== 'all' && ` (${selectedYear}년)`}
            </DialogTitle>
            <DialogDescription>
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
                    <div className="bg-gray-50 p-4 rounded-lg"><div className="text-sm text-gray-500">훈련과정 수</div><div className="text-lg font-semibold">{s.totalCourses}</div></div>
                    <div className="bg-gray-50 p-4 rounded-lg"><div className="text-sm text-gray-500">훈련생 수</div><div className="text-lg font-semibold">{s.totalStudents}</div></div>
                    <div className="bg-gray-50 p-4 rounded-lg"><div className="text-sm text-gray-500">수료인원</div><div className="text-lg font-semibold">{s.totalCompleted}</div></div>
                    <div className="bg-gray-50 p-4 rounded-lg"><div className="text-sm text-gray-500">매출액</div><div className="text-lg font-semibold">{formatRevenue(s.totalRevenue)}</div></div>
                    <div className="bg-gray-50 p-4 rounded-lg"><div className="text-sm text-gray-500">평균 만족도</div><div className="text-lg font-semibold">{s.avgSatisfaction.toFixed(1)}</div></div>
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
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.평균만족도.toFixed(1)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.원천과정수}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-3 flex justify-end">
            <button type="button" className="bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50" onClick={() => setIsModalOpen(false)}>닫기</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
