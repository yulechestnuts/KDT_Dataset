'use client';

import { useEffect, useState } from 'react';
import { loadDataFromGithub, preprocessData, applyRevenueAdjustment, calculateCompletionRate } from "@/utils/data-utils";
import { CourseData, RawCourseData, InstitutionStat, calculateInstitutionStats, aggregateCoursesByCourseNameForInstitution, AggregatedCourseData, csvParseOptions, aggregateCoursesByCourseIdWithLatestInfo } from "@/lib/data-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber, formatRevenue } from "@/utils/formatters";
import { parse as parseCsv } from 'papaparse';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function InstitutionAnalysis() {
  const [institutionStats, setInstitutionStats] = useState<InstitutionStat[]>([]);
  const [filteredInstitutionStats, setFilteredInstitutionStats] = useState<InstitutionStat[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstitutionCourses, setSelectedInstitutionCourses] = useState<AggregatedCourseData[]>([]);
  const [selectedInstitutionName, setSelectedInstitutionName] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'leading' | 'tech'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all'); // 월 선택 상태 추가
  const [searchTerm, setSearchTerm] = useState('');

  // 신기술 과정 정의: 선도기업 과정이 아닌 모든 과정
  const isNewTechCourse = (course: CourseData) => !course.isLeadingCompanyCourse;

  const recalcStats = async () => {
    try {
      const rawDataString = await loadDataFromGithub();
      const parsedData: any = parseCsv(rawDataString as string, csvParseOptions);
      const processedData = preprocessData(parsedData.data as RawCourseData[]);
      const overallCompletion = calculateCompletionRate(processedData);
      const adjustedCourses = applyRevenueAdjustment(processedData, overallCompletion);

      // 연도 목록은 전체 기준 한 번만 세팅 (if not already)
      if (availableYears.length === 0) {
        const years = Array.from(new Set(adjustedCourses.map((c) => c.훈련연도)))
          .filter((y) => y !== 0)
          .sort((a, b) => a - b);
        setAvailableYears(years as number[]);
      }

      // filter by type
      let filtered = adjustedCourses;
      if (filterType === 'leading') {
        filtered = adjustedCourses.filter((c) => c.isLeadingCompanyCourse);
      } else if (filterType === 'tech') {
        filtered = adjustedCourses.filter(isNewTechCourse);
      }

      // 월별 필터링 추가
      let finalFiltered = filtered;
      if (selectedYear !== 'all' && selectedMonth !== 'all') {
        finalFiltered = filtered.filter(course => {
          const courseStartDate = new Date(course.과정시작일);
          return courseStartDate.getFullYear() === selectedYear && (courseStartDate.getMonth() + 1) === selectedMonth;
        });
      } else if (selectedMonth !== 'all') {
        // 연도 선택 없이 월만 선택된 경우, 모든 연도에서 해당 월의 과정 필터링
        finalFiltered = filtered.filter(course => {
          const courseStartDate = new Date(course.과정시작일);
          return (courseStartDate.getMonth() + 1) === selectedMonth;
        });
      }

      const stats = calculateInstitutionStats(
        finalFiltered, // 필터링된 데이터 사용
        selectedYear === 'all' ? undefined : selectedYear,
      );
      setInstitutionStats(stats);
      setFilteredInstitutionStats(stats); // 초기에 필터링된 목록도 전체 목록으로 설정
    } catch (error) {
      console.error('데이터 로드 중 오류 발생:', error);
    }
  };

  // initial load and when deps change
  useEffect(() => {
    recalcStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, filterType, selectedMonth]); // selectedMonth 추가

  useEffect(() => {
    const filtered = institutionStats.filter(stat => 
      stat.institutionName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredInstitutionStats(filtered);
  }, [searchTerm, institutionStats]);

  const handleViewDetails = (institutionName: string, courses: CourseData[]) => {
    setSelectedInstitutionName(institutionName);

    let filteredCourses;
    if (selectedYear === 'all') {
      filteredCourses = courses;
    } else {
      // 선택된 연도에 매출이 발생한 과정만 필터링 (수정된 로직)
      filteredCourses = courses.filter(course => {
        const yearlyRevenueKey = `조정_${selectedYear}년` as keyof CourseData;
        const revenue = course[yearlyRevenueKey] as number | undefined;
        return revenue !== undefined && revenue > 0;
      });
    }
    
    // 월별 필터링 추가
    if (selectedMonth !== 'all') {
      filteredCourses = filteredCourses.filter(course => {
        const courseStartDate = new Date(course.과정시작일);
        return (courseStartDate.getMonth() + 1) === selectedMonth;
      });
    }

    // apply filterType again for modal consistency
    if (filterType === 'leading') {
      filteredCourses = filteredCourses.filter((c) => c.isLeadingCompanyCourse);
    } else if (filterType === 'tech') {
      filteredCourses = filteredCourses.filter(isNewTechCourse);
    }

    // aggregateCoursesByCourseIdWithLatestInfo 함수는 이미 훈련과정ID를 기준으로 집계하도록 수정됨
    // applyRevenueAdjustment는 이미 recalcStats에서 처리되었으므로 여기서는 다시 호출하지 않음
    const aggregated = aggregateCoursesByCourseIdWithLatestInfo(filteredCourses);
    setSelectedInstitutionCourses(aggregated);
    setIsModalOpen(true);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">훈련기관별 분석</h1>

      {/* 연도 선택 */}
      <div className="mb-10 relative z-10 flex gap-6 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">연도 선택</label>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(value === 'all' ? 'all' : parseInt(value))}
          >
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="연도 선택" />
            </SelectTrigger>
            <SelectContent className="bg-white z-20">
              <SelectItem value="all">전체 연도</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 월 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">월 선택</label>
          <Select
            value={selectedMonth.toString()}
            onValueChange={(value) => setSelectedMonth(value === 'all' ? 'all' : parseInt(value))}
          >
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="월 선택" />
            </SelectTrigger>
            <SelectContent className="bg-white z-20">
              <SelectItem value="all">전체 월</SelectItem>
              {[...Array(12)].map((_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>{i + 1}월</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 유형 필터 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">유형 필터</label>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="w-[200px] bg-white">
              <SelectValue placeholder="유형 선택" />
            </SelectTrigger>
            <SelectContent className="bg-white z-20">
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="leading">선도기업 과정만</SelectItem>
              <SelectItem value="tech">신기술 과정만</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 검색창 추가 */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">훈련기관 검색</label>
          <input
            id="search"
            type="text"
            placeholder="기관명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-[200px] bg-white p-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      {/* 매출액 차트 */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">훈련기관별 매출액 (억원)</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredInstitutionStats.slice(0, 10)}>
              <XAxis 
                dataKey="institutionName" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                tick={{ fontSize: 12 }}
                tickFormatter={(value: string, index: number) => {
                  const rank = index + 1;
                  let displayValue = `${rank}. ${value}`;
                  if (value === '주식회사 코드스테이츠') {
                    displayValue += ' (2023년 감사를 통해 훈련비 전액 반환)';
                  }
                  return displayValue;
                }}
              />
              <YAxis 
                tickFormatter={formatRevenue}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number) => [formatRevenue(value), '매출액']}
                labelFormatter={(label) => {
                  let institutionName = label.replace(/\d+\. /, '').replace(/ \(2023년 감사를 통해 훈련비 전액 반환\)/, '');
                  if (institutionName === '주식회사 코드스테이츠') {
                      return `기관명: ${institutionName} (2023년 감사를 통해 훈련비 전액 반환)`;
                  }
                  return `기관명: ${institutionName}`;
                }}
              />
              <Bar dataKey="totalRevenue" fill="#4F46E5" name="매출액" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 상세 통계 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">순위 및 훈련기관</th>
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
              {filteredInstitutionStats.map((stat, index) => (
                <tr key={stat.institutionName}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {index + 1}. {stat.institutionName}
                          {stat.institutionName === '주식회사 코드스테이츠' && (
                            <span className="ml-2 text-xs text-red-600">(2023년 감사를 통해 훈련비 전액 반환)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatRevenue(stat.totalRevenue)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatNumber(stat.totalCourses)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatNumber(stat.totalStudents)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatNumber(stat.completedStudents)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{stat.completionRate.toFixed(1)}%</td>
                  <td className="px-6 py-4 whitespace-nowrap">{stat.avgSatisfaction.toFixed(1)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDetails(stat.institutionName, stat.courses)}
                          className="text-indigo-600 hover:text-indigo-900"
                          style={{
                            backgroundColor: '#E0E7FF', // indigo-100
                            color: '#4338CA', // indigo-800
                            fontWeight: '500',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #C7D2FE' // indigo-200
                          }}
                        >
                          상세 보기
                        </button>
                      </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상세 모달 */}
      <Dialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      >
        <DialogContent className="mx-auto max-w-[80vw] max-h-[85vh] w-full bg-white rounded-xl shadow-lg p-0 overflow-y-auto">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-900">
              {selectedInstitutionName} - 훈련과정 상세
              {selectedYear !== 'all' && ` (${selectedYear}년)`}
            </DialogTitle>
            <DialogDescription>
              선택된 훈련기관의 {selectedYear === 'all' ? '모든' : `${selectedYear}년`} 훈련과정 목록입니다. (매출액 기준 내림차순 정렬)
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            {/* 통계 요약 */}
            <div className="grid grid-cols-5 gap-4 mb-6"> {/* 컬럼 수 원복 */}
              {(() => {
                // 메인 페이지의 institutionStats에서 해당 기관의 통계 가져오기
                const currentInstitutionStat = institutionStats.find(stat => stat.institutionName === selectedInstitutionName);
                if (!currentInstitutionStat) return null; // 통계를 찾지 못하면 렌더링하지 않음

                return (
                  <>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">훈련과정 수</div>
                      <div className="text-lg font-semibold">{currentInstitutionStat.totalCourses}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">훈련생 수</div>
                      <div className="text-lg font-semibold">{currentInstitutionStat.totalStudents}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">수료인원</div>
                      <div className="text-lg font-semibold">{currentInstitutionStat.completedStudents}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">매출액</div>
                      <div className="text-lg font-semibold">{formatRevenue(currentInstitutionStat.totalRevenue)}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">평균 만족도</div>
                      <div className="text-lg font-semibold">{currentInstitutionStat.avgSatisfaction.toFixed(1)}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg"> {/* 평균 수료율 추가 */}
                      <div className="text-sm text-gray-500">평균 수료율</div>
                      <div className="text-lg font-semibold">{currentInstitutionStat.completionRate.toFixed(1)}%</div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="overflow-x-auto max-h-[65vh]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]">과정명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">훈련유형</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">훈련생 수</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">수료인원</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">수료율</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">매출액</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">만족도</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">원천과정수</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedInstitutionCourses.map((course) => (
                    <tr key={course['훈련과정 ID'] || course.과정명} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {course.과정명}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.훈련유형들?.join(', ') || '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.총훈련생수}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.총수료인원}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {course.평균수료율 === 0
                          ? '-'
                          : `${course.평균수료율.toFixed(1)}%`}
                      </td>
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
            <button
              type="button"
              className="bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
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