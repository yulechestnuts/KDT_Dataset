'use client';

import { useEffect, useState } from 'react';
import { loadDataFromGithub, preprocessData, applyRevenueAdjustment, calculateCompletionRate } from "@/utils/data-utils";
import { CourseData, RawCourseData, InstitutionStat, calculateInstitutionStats, aggregateCoursesByCourseNameForInstitution, AggregatedCourseData, csvParseOptions, aggregateCoursesByCourseIdWithLatestInfo, getIndividualInstitutionsInGroup, calculateInstitutionDetailedRevenue } from "@/lib/data-utils";
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

export interface AggregatedCourseDataWithOpenCount extends AggregatedCourseData {
  openedInYearCount?: number;
}

export default function InstitutionAnalysis() {
  const [institutionStats, setInstitutionStats] = useState<InstitutionStat[]>([]);
  const [filteredInstitutionStats, setFilteredInstitutionStats] = useState<InstitutionStat[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstitutionCourses, setSelectedInstitutionCourses] = useState<AggregatedCourseDataWithOpenCount[]>([]);
  const [selectedInstitutionName, setSelectedInstitutionName] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'leading' | 'tech'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all'); // 월 선택 상태 추가
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInstitutionRawCourses, setSelectedInstitutionRawCourses] = useState<CourseData[]>([]);
  
  // 원본 데이터 저장 (그룹화 전)
  const [originalData, setOriginalData] = useState<CourseData[]>([]);
  
  // 드롭다운 상태
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedGroupName, setSelectedGroupName] = useState<string>('');
  const [individualInstitutions, setIndividualInstitutions] = useState<InstitutionStat[]>([]);

  // 신기술 과정 정의: 선도기업 과정이 아닌 모든 과정
  const isNewTechCourse = (course: CourseData) => !course.isLeadingCompanyCourse;

  const recalcStats = async () => {
    try {
      const rawDataString = await loadDataFromGithub();
      const parsedData: any = parseCsv(rawDataString as string, csvParseOptions);
      const processedData = preprocessData(parsedData.data as RawCourseData[]);
      const overallCompletion = calculateCompletionRate(processedData);
      const adjustedCourses = applyRevenueAdjustment(processedData, overallCompletion);

      // 원본 데이터 저장 (그룹화 전)
      setOriginalData(adjustedCourses);

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
    
    // 필터링된 원본 데이터 사용 (그룹화 전)
    let filteredOriginalData = originalData;
    
    // 유형 필터링
    if (filterType === 'leading') {
      filteredOriginalData = filteredOriginalData.filter((c) => c.isLeadingCompanyCourse);
    } else if (filterType === 'tech') {
      filteredOriginalData = filteredOriginalData.filter(isNewTechCourse);
    }
    
    // 월별 필터링
    if (selectedMonth !== 'all') {
      filteredOriginalData = filteredOriginalData.filter(course => {
        const courseStartDate = new Date(course.과정시작일);
        return (courseStartDate.getMonth() + 1) === selectedMonth;
      });
    }
    
    // 통합된 함수 사용하여 해당 기관의 상세 매출 계산
    const yearForCalculation = selectedYear === 'all' ? undefined : selectedYear;
    const detailedStats = calculateInstitutionDetailedRevenue(filteredOriginalData, institutionName, yearForCalculation);
    
    // aggregateCoursesByCourseIdWithLatestInfo 함수에 연도 정보와 기관명 전달
    const aggregated = aggregateCoursesByCourseIdWithLatestInfo(detailedStats.courses, yearForCalculation, institutionName);
    
    // 개강 과정 수 계산 로직 추가
    const finalAggregated = aggregated.map(agg => {
      const originalCourses = detailedStats.courses.filter(c => (c['훈련과정 ID'] || c.과정명) === (agg['훈련과정 ID'] || agg.과정명));
      const openedInYearCount = selectedYear === 'all' 
        ? originalCourses.length 
        : originalCourses.filter(c => new Date(c.과정시작일).getFullYear() === selectedYear).length;
      return { ...agg, openedInYearCount };
    });
    
    setSelectedInstitutionCourses(finalAggregated);
    setSelectedInstitutionRawCourses(detailedStats.courses);
    setIsModalOpen(true);
  };

  // 그룹화된 기관의 개별 기관 정보 보기
  const handleViewGroupDetails = (groupName: string) => {
    setSelectedGroupName(groupName);
    
    // 필터링된 원본 데이터 사용
    let filteredOriginalData = originalData;
    
    // 유형 필터링
    if (filterType === 'leading') {
      filteredOriginalData = filteredOriginalData.filter((c) => c.isLeadingCompanyCourse);
    } else if (filterType === 'tech') {
      filteredOriginalData = filteredOriginalData.filter(isNewTechCourse);
    }
    
    // 월별 필터링
    if (selectedMonth !== 'all') {
      filteredOriginalData = filteredOriginalData.filter(course => {
        const courseStartDate = new Date(course.과정시작일);
        return (courseStartDate.getMonth() + 1) === selectedMonth;
      });
    }
    
    const individualStats = getIndividualInstitutionsInGroup(
      filteredOriginalData,
      groupName,
      selectedYear === 'all' ? undefined : selectedYear
    );
    
    setIndividualInstitutions(individualStats);
    setIsGroupModalOpen(true);
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

      {/* 안내 문구 추가 */}
      <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-4 py-2">
        ※ 과정이 2개년도에 걸쳐있는 경우, 각 년도에 차지하는 비율에 맞추어 매출이 분배됩니다.
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

      {/* 안내 문구 */}
      {selectedYear !== 'all' && (
        <div className="mb-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded px-4 py-3">
          <div>* 수료율은 과정 종료일 기준으로 포함하여 계산되었습니다.</div>
          <div>* ()는 전 해년 입과, 당 해년 수료 인원을 표기하였습니다.</div>
        </div>
      )}

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
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  <td className="px-6 py-4 whitespace-nowrap">
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
                        {/* 그룹화된 기관인지 확인하고 드롭다운 버튼 추가 */}
                        {['이젠아카데미', '그린컴퓨터아카데미', '더조은아카데미', '코리아IT아카데미', '비트교육센터', '하이미디어', '아이티윌', '메가스터디', '에이콘아카데미', '한국ICT인재개발원', 'MBC아카데미 컴퓨터 교육센터', '쌍용아카데미', 'KH정보교육원', '(주)솔데스크'].includes(stat.institutionName) && (
                          <button
                            onClick={() => handleViewGroupDetails(stat.institutionName)}
                            className="text-green-600 hover:text-green-900"
                            style={{
                              backgroundColor: '#D1FAE5', // green-100
                              color: '#065F46', // green-800
                              fontWeight: '500',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid #A7F3D0', // green-200
                              fontSize: '0.75rem'
                            }}
                          >
                            ▽ 개별기관
                          </button>
                        )}
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

                // 상세 테이블의 매출액 합계를 계산하여 상단 카드와 일치시킴
                const modalTotalRevenue = selectedInstitutionCourses.reduce((sum, course) => sum + course.총누적매출, 0);

                // === 연도별 훈련생/수료인원/수료율 계산 명확화 ===
                // 예시:
                // const yearNum = selectedYear === 'all' ? undefined : selectedYear;
                // const onlyThisYear = selectedInstitutionRawCourses.filter(c => new Date(c.과정시작일).getFullYear() === yearNum);
                // const totalStudents = onlyThisYear.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
                // const totalGraduates = onlyThisYear.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
                // const completionRate = totalStudents > 0 ? (totalGraduates / totalStudents) * 100 : 0;
                // const prevYear = yearNum - 1;
                // const prevYearCourses = selectedInstitutionRawCourses.filter(c => new Date(c.과정시작일).getFullYear() === prevYear && new Date(c.과정종료일).getFullYear() === yearNum);
                // const prevYearStudents = prevYearCourses.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
                // const prevYearGraduates = prevYearCourses.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
                // const displayStudents = `${totalStudents}${prevYearStudents ? `(${prevYearStudents})` : ''}`;
                // const displayGraduates = `${totalGraduates}${prevYearGraduates ? `(${prevYearGraduates})` : ''}`;

                // 연도 정보
                const yearNum = selectedYear === 'all' ? undefined : selectedYear;

                // 운영 중인 과정: 해당 연도에 한 번이라도 운영된 과정
                const operatedCourses = selectedInstitutionCourses.filter(course => {
                  if (!yearNum) return true;
                  // 과정이 해당 연도에 운영 중인지 확인
                  const start = new Date(course.최소과정시작일);
                  const end = new Date(course.최대과정종료일);
                  return start.getFullYear() <= yearNum && end.getFullYear() >= yearNum;
                });
                const operatedCourseCount = operatedCourses.length;

                // 해당 연도 개강 과정: 시작일이 해당 연도인 과정
                const openedCourses = selectedInstitutionCourses.filter(course => {
                  if (!yearNum) return true;
                  const start = new Date(course.최소과정시작일);
                  return start.getFullYear() === yearNum;
                });
                const openedCourseCount = openedCourses.length;

                // 상단 요약 카드: 해당 연도 개강 과정(숫자 부분)만 합산, 괄호(이전 연도 인원)는 표기만
                let totalStudents = 0;
                let totalGraduates = 0;
                let totalOpenedCourses = 0;
                let otherYearStudents: {[year: number]: number} = {};
                let otherYearGraduates: {[year: number]: number} = {};
                let otherYearOpenedCourses: {[year: number]: number} = {};
                if (yearNum) {
                  // 해당 연도 개강 과정만 합산
                  totalStudents = selectedInstitutionRawCourses
                    .filter(c => new Date(c.과정시작일).getFullYear() === yearNum)
                    .reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
                  totalGraduates = selectedInstitutionRawCourses
                    .filter(c => new Date(c.과정시작일).getFullYear() === yearNum)
                    .reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
                  totalOpenedCourses = selectedInstitutionRawCourses
                    .filter(c => new Date(c.과정시작일).getFullYear() === yearNum).length;
                  // 괄호 표기용: 이전 연도 개강+해당 연도 종료
                  selectedInstitutionRawCourses.forEach(c => {
                    const startYear = new Date(c.과정시작일).getFullYear();
                    const endYear = new Date(c.과정종료일).getFullYear();
                    if (startYear !== yearNum && endYear === yearNum) {
                      otherYearStudents[startYear] = (otherYearStudents[startYear] || 0) + (c['수강신청 인원'] ?? 0);
                      otherYearGraduates[startYear] = (otherYearGraduates[startYear] || 0) + (c['수료인원'] ?? 0);
                      otherYearOpenedCourses[startYear] = (otherYearOpenedCourses[startYear] || 0) + 1;
                    }
                  });
                } else {
                  // 전체 연도: 모든 과정 합산
                  totalStudents = selectedInstitutionRawCourses.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
                  totalGraduates = selectedInstitutionRawCourses.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
                  totalOpenedCourses = selectedInstitutionRawCourses.length;
                }
                // 괄호 표기용 문자열 생성
                const otherYearStudentsStr = Object.entries(otherYearStudents).length > 0
                  ? ' (' + Object.entries(otherYearStudents).map(([y, n]) => `${y}년: ${n}명`).join(', ') + ')'
                  : '';
                const otherYearGraduatesStr = Object.entries(otherYearGraduates).length > 0
                  ? ' (' + Object.entries(otherYearGraduates).map(([y, n]) => `${y}년: ${n}명`).join(', ') + ')'
                  : '';
                const otherYearOpenedCoursesStr = Object.entries(otherYearOpenedCourses).length > 0
                  ? ' (' + Object.entries(otherYearOpenedCourses).map(([y, n]) => `${y}년: ${n}개`).join(', ') + ')'
                  : '';

                return (
                  <>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">운영 중인 과정 수</div>
                      <div className="text-lg font-semibold">{operatedCourseCount}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">{yearNum ? `${yearNum}년 개강 과정 수` : '개강 과정 수'}</div>
                      <div className="text-lg font-semibold">{totalOpenedCourses}{otherYearOpenedCoursesStr}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">훈련생 수</div>
                      <div className="text-lg font-semibold">{totalStudents}{otherYearStudentsStr}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">수료인원</div>
                      <div className="text-lg font-semibold">{totalGraduates}{otherYearGraduatesStr}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">매출액</div>
                      <div className="text-lg font-semibold">{formatRevenue(modalTotalRevenue)}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500">평균 만족도</div>
                      <div className="text-lg font-semibold">{currentInstitutionStat.avgSatisfaction.toFixed(1)}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg"> {/* 평균 수료율 추가 */}
                      <div className="text-sm text-gray-500">평균 수료율</div>
                      <div className="text-lg font-semibold">{calculateCompletionRate(selectedInstitutionRawCourses, selectedYear === 'all' ? undefined : selectedYear).toFixed(1)}%</div>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">개강 과정수</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedInstitutionCourses.map((course) => {
                    const isAll = selectedYear === 'all';
                    let studentStr: string = '';
                    let graduateStr: string = '';
                    let openCountStr: string = '';
                    const rawCourses = selectedInstitutionRawCourses;
                    if (!isAll) {
                      // 같은 과정ID/과정명으로 그룹핑된 원본 row들 추출
                      const originalCourses = rawCourses.filter(c => (c['훈련과정 ID'] || c.과정명) === (course['훈련과정 ID'] || course.과정명));
                      // 해당 연도 개강 인원 합계
                      const startSum = originalCourses.filter(c => new Date(c.과정시작일).getFullYear() === selectedYear)
                        .reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
                      const gradStartSum = originalCourses.filter(c => new Date(c.과정시작일).getFullYear() === selectedYear)
                        .reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
                      const openStartSum = originalCourses.filter(c => new Date(c.과정시작일).getFullYear() === selectedYear).length;
                      // 이전 연도 개강+해당 연도 종료 인원 합계
                      const endSum = originalCourses.filter(c => new Date(c.과정시작일).getFullYear() !== selectedYear && new Date(c.과정종료일).getFullYear() === selectedYear)
                        .reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
                      const gradEndSum = originalCourses.filter(c => new Date(c.과정시작일).getFullYear() !== selectedYear && new Date(c.과정종료일).getFullYear() === selectedYear)
                        .reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
                      const openEndSum = originalCourses.filter(c => new Date(c.과정시작일).getFullYear() !== selectedYear && new Date(c.과정종료일).getFullYear() === selectedYear).length;
                      // 표기
                      studentStr = startSum > 0 && endSum > 0 ? `${startSum}(${endSum})` : startSum > 0 ? `${startSum}` : endSum > 0 ? `(${endSum})` : '';
                      graduateStr = gradStartSum > 0 && gradEndSum > 0 ? `${gradStartSum}(${gradEndSum})` : gradStartSum > 0 ? `${gradStartSum}` : gradEndSum > 0 ? `(${gradEndSum})` : '';
                      openCountStr = openStartSum > 0 && openEndSum > 0 ? `${openStartSum}(${openEndSum})` : openStartSum > 0 ? `${openStartSum}` : openEndSum > 0 ? `(${openEndSum})` : '';
                    } else {
                      studentStr = `${course.총훈련생수}`;
                      graduateStr = `${course.총수료인원}`;
                      openCountStr = `${course.openedInYearCount ?? course.원천과정수}`;
                    }
                    return (
                      <tr key={course['훈련과정 ID'] || course.과정명} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          {course.과정명}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.훈련유형들?.join(', ') || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{studentStr}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{graduateStr}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                          {course.평균수료율 === 0
                            ? '-'
                            : `${course.평균수료율.toFixed(1)}%`}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatRevenue(course.총누적매출)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.평균만족도.toFixed(1)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{openCountStr}</td>
                      </tr>
                    );
                  })}
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

      {/* 개별 기관 정보 모달 */}
      <Dialog
        open={isGroupModalOpen}
        onOpenChange={setIsGroupModalOpen}
      >
        <DialogContent className="mx-auto max-w-[80vw] max-h-[85vh] w-full bg-white rounded-xl shadow-lg p-0 overflow-y-auto">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-900">
              {selectedGroupName} - 개별 기관 상세
              {selectedYear !== 'all' && ` (${selectedYear}년)`}
            </DialogTitle>
            <DialogDescription>
              {selectedGroupName} 그룹에 속하는 개별 기관들의 상세 정보입니다. (매출액 기준 내림차순 정렬)
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <div className="overflow-x-auto max-h-[65vh]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">순위</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">기관명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">매출액</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">훈련과정 수</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">훈련생 수</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수료인원</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수료율</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">평균 만족도</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {individualInstitutions.map((institution, index) => (
                    <tr key={institution.institutionName} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {institution.institutionName}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatRevenue(institution.totalRevenue)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatNumber(institution.totalCourses)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {selectedYear !== 'all' && institution.prevYearStudents > 0 
                          ? (
                            <div>
                              <div>{formatNumber(institution.totalStudents)}</div>
                              <div className="text-xs text-gray-500">({formatNumber(institution.prevYearStudents)})</div>
                            </div>
                          )
                          : formatNumber(institution.totalStudents)
                        }
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {selectedYear !== 'all' && institution.prevYearCompletedStudents > 0 
                          ? (
                            <div>
                              <div>{formatNumber(institution.completedStudents)}</div>
                              <div className="text-xs text-gray-500">({formatNumber(institution.prevYearCompletedStudents)})</div>
                            </div>
                          )
                          : formatNumber(institution.completedStudents)
                        }
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{institution.completionRate.toFixed(1)}%</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{institution.avgSatisfaction.toFixed(1)}</td>
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
              onClick={() => setIsGroupModalOpen(false)}
            >
              닫기
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}