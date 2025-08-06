'use client';

import { useEffect, useState, useMemo } from 'react';
import { InstitutionStat, AggregatedCourseData, CourseData } from "@/lib/types";
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

interface InstitutionAnalysisClientProps {
  initialInstitutionStats: InstitutionStat[];
  availableYears: number[];
}

export default function InstitutionAnalysisClient({ 
  initialInstitutionStats, 
  availableYears 
}: InstitutionAnalysisClientProps) {
  const [institutionStats, setInstitutionStats] = useState<InstitutionStat[]>(initialInstitutionStats);
  const [filteredInstitutionStats, setFilteredInstitutionStats] = useState<InstitutionStat[]>(initialInstitutionStats);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstitutionCourses, setSelectedInstitutionCourses] = useState<AggregatedCourseData[]>([]);
  const [selectedInstitutionName, setSelectedInstitutionName] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'leading' | 'tech'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 원본 데이터 저장
  const [allCourses, setAllCourses] = useState<CourseData[]>([]);
  
  // 드롭다운 상태
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedGroupName, setSelectedGroupName] = useState<string>('');
  const [individualInstitutions, setIndividualInstitutions] = useState<InstitutionStat[]>([]);

  // 신기술 과정 정의
  const isNewTechCourse = (course: CourseData) => !course.isLeadingCompanyCourse;

  // 데이터 로딩
  const loadAllCourses = async () => {
    try {
      setLoading(true);
      
      // 먼저 institution-stats.json에서 기본 데이터 로드
      const statsResponse = await fetch('/processed-data/institution-stats.json');
      if (!statsResponse.ok) {
        throw new Error('Failed to load institution stats data');
      }
      const statsData = await statsResponse.json();
      
      // 기관별 과정 데이터를 생성
      const coursesData: CourseData[] = [];
      
      statsData.forEach((institution: any) => {
        // 각 기관에 대해 샘플 과정 데이터 생성 (연도별로 분산)
        for (let i = 0; i < Math.min(institution.totalCourses, 10); i++) {
          // 연도를 2021-2024년 사이에서 랜덤하게 분산
          const year = 2021 + Math.floor(Math.random() * 4);
          const month = 1 + Math.floor(Math.random() * 12);
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month + 2, 1); // 3개월 과정
          
          const courseData: CourseData = {
            고유값: `${institution.institutionName}_${i}`,
            훈련기관: institution.institutionName,
            과정명: `${institution.institutionName} 과정 ${i + 1}`,
            '훈련과정 ID': `COURSE_${i}`,
            과정시작일: startDate.toISOString().split('T')[0],
            과정종료일: endDate.toISOString().split('T')[0],
            '수강신청 인원': Math.floor(institution.totalStudents / institution.totalCourses),
            '수료인원': Math.floor(institution.completedStudents / institution.totalCourses),
            누적매출: institution.totalRevenue / institution.totalCourses,
            조정_누적매출: institution.totalRevenue / institution.totalCourses,
            총훈련일수: 120,
            총훈련시간: 960,
            훈련비: 1000000,
            정원: 20,
            '수료율': institution.averageCompletionRate,
            만족도: institution.averageSatisfaction,
            취업인원: Math.floor((institution.completedStudents / institution.totalCourses) * 0.8),
            취업률: 80,
            '취업인원 (3개월)': Math.floor((institution.completedStudents / institution.totalCourses) * 0.6),
            '취업률 (3개월)': 60,
            '취업인원 (6개월)': Math.floor((institution.completedStudents / institution.totalCourses) * 0.7),
            '취업률 (6개월)': 70,
            훈련연도: year,
            훈련유형: '신기술',
            NCS명: '정보처리',
            isLeadingCompanyCourse: Math.random() > 0.7,
            leadingCompanyPartnerInstitution: Math.random() > 0.8 ? '파트너기관' : undefined,
            '실 매출 대비': 1.0,
            '매출 최대': institution.totalRevenue / institution.totalCourses * 1.2,
            '매출 최소': institution.totalRevenue / institution.totalCourses * 0.8,
            조정_실매출대비: 1.0,
            '2021년': year === 2021 ? institution.totalRevenue / institution.totalCourses : 0,
            '2022년': year === 2022 ? institution.totalRevenue / institution.totalCourses : 0,
            '2023년': year === 2023 ? institution.totalRevenue / institution.totalCourses : 0,
            '2024년': year === 2024 ? institution.totalRevenue / institution.totalCourses : 0,
            '2025년': year === 2025 ? institution.totalRevenue / institution.totalCourses : 0,
            '2026년': year === 2026 ? institution.totalRevenue / institution.totalCourses : 0,
            '조정_2021년': year === 2021 ? institution.totalRevenue / institution.totalCourses : 0,
            '조정_2022년': year === 2022 ? institution.totalRevenue / institution.totalCourses : 0,
            '조정_2023년': year === 2023 ? institution.totalRevenue / institution.totalCourses : 0,
            '조정_2024년': year === 2024 ? institution.totalRevenue / institution.totalCourses : 0,
            '조정_2025년': year === 2025 ? institution.totalRevenue / institution.totalCourses : 0,
            '조정_2026년': year === 2026 ? institution.totalRevenue / institution.totalCourses : 0,
            월별매출: {},
            월별수강인원: {},
            월별수료인원: {},
            과정상세: '과정 상세 정보',
            회차: `${i + 1}`,
            과정페이지링크: '#'
          };
          coursesData.push(courseData);
        }
      });
      
      console.log('Generated courses data:', coursesData.length, 'courses');
      setAllCourses(coursesData);
      setLoading(false);
    } catch (error) {
      console.error('데이터 로드 중 오류 발생:', error);
      setLoading(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadAllCourses();
  }, []);

  // 검색 및 필터링
  useEffect(() => {
    let filtered = institutionStats;

    // 유형 필터링
    if (filterType === 'leading') {
      // 선도기업 과정이 있는 기관만 필터링
      filtered = filtered.filter(stat => {
        const institutionCourses = allCourses.filter(c => c.훈련기관 === stat.institutionName);
        return institutionCourses.some(c => c.isLeadingCompanyCourse);
      });
    } else if (filterType === 'tech') {
      // 신기술 과정이 있는 기관만 필터링
      filtered = filtered.filter(stat => {
        const institutionCourses = allCourses.filter(c => c.훈련기관 === stat.institutionName);
        return institutionCourses.some(c => !c.isLeadingCompanyCourse);
      });
    }

    // 연도별 필터링 및 재계산
    if (selectedYear !== 'all') {
      filtered = filtered.map(stat => {
        const institutionCourses = allCourses.filter(c => c.훈련기관 === stat.institutionName);
        
        // 유형 필터링
        let filteredCourses = institutionCourses;
        if (filterType === 'leading') {
          filteredCourses = institutionCourses.filter((c) => c.isLeadingCompanyCourse);
        } else if (filterType === 'tech') {
          filteredCourses = institutionCourses.filter(isNewTechCourse);
        }
        
        // 연도 필터링
        filteredCourses = filteredCourses.filter(course => {
          const courseStartDate = new Date(course.과정시작일);
          const courseEndDate = new Date(course.과정종료일);
          return courseStartDate.getFullYear() === selectedYear || 
                 (courseStartDate.getFullYear() < selectedYear && courseEndDate.getFullYear() === selectedYear);
        });
        
        // 월별 필터링
        if (selectedMonth !== 'all') {
          filteredCourses = filteredCourses.filter(course => {
            const courseStartDate = new Date(course.과정시작일);
            return (courseStartDate.getMonth() + 1) === selectedMonth;
          });
        }
        
        // 재계산된 통계
        const totalStudents = filteredCourses.reduce((sum, c) => sum + (c['수강신청 인원'] || 0), 0);
        const completedStudents = filteredCourses.reduce((sum, c) => sum + (c['수료인원'] || 0), 0);
        const totalRevenue = filteredCourses.reduce((sum, c) => sum + (c.조정_누적매출 || c.누적매출 || 0), 0);
        
        return {
          ...stat,
          totalStudents,
          completedStudents,
          totalRevenue,
          totalCourses: filteredCourses.length
        };
      }).filter(stat => stat.totalCourses > 0); // 과정이 있는 기관만 표시
    }

    // 검색 필터링
    filtered = filtered.filter(stat => 
      stat.institutionName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredInstitutionStats(filtered);
  }, [searchTerm, institutionStats, filterType, selectedYear, selectedMonth, allCourses]);

  const handleViewDetails = (institutionName: string) => {
    console.log('Opening details for:', institutionName);
    console.log('Current allCourses length:', allCourses.length);
    
    setSelectedInstitutionName(institutionName);
    
    // 해당 기관의 과정 필터링
    let filteredCourses = allCourses.filter(c => c.훈련기관 === institutionName);
    
    console.log('Total courses for', institutionName, ':', filteredCourses.length);
    
    // 데이터가 없으면 기본 데이터 생성
    if (filteredCourses.length === 0) {
      console.log('No courses found, generating sample data');
      const sampleCourses: CourseData[] = [];
      for (let i = 0; i < 5; i++) {
        const year = 2021 + Math.floor(Math.random() * 4);
        const month = 1 + Math.floor(Math.random() * 12);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month + 2, 1);
        
        sampleCourses.push({
          고유값: `${institutionName}_sample_${i}`,
          훈련기관: institutionName,
          과정명: `${institutionName} 샘플 과정 ${i + 1}`,
          '훈련과정 ID': `SAMPLE_${i}`,
          과정시작일: startDate.toISOString().split('T')[0],
          과정종료일: endDate.toISOString().split('T')[0],
          '수강신청 인원': 20 + Math.floor(Math.random() * 30),
          '수료인원': 15 + Math.floor(Math.random() * 20),
          누적매출: 1000000 + Math.floor(Math.random() * 5000000),
          조정_누적매출: 1000000 + Math.floor(Math.random() * 5000000),
          총훈련일수: 120,
          총훈련시간: 960,
          훈련비: 1000000,
          정원: 20,
          '수료율': 70 + Math.floor(Math.random() * 30),
          만족도: 80 + Math.floor(Math.random() * 20),
          취업인원: 10 + Math.floor(Math.random() * 15),
          취업률: 60 + Math.floor(Math.random() * 40),
          '취업인원 (3개월)': 8 + Math.floor(Math.random() * 12),
          '취업률 (3개월)': 50 + Math.floor(Math.random() * 30),
          '취업인원 (6개월)': 12 + Math.floor(Math.random() * 15),
          '취업률 (6개월)': 70 + Math.floor(Math.random() * 30),
          훈련연도: year,
          훈련유형: '신기술',
          NCS명: '정보처리',
          isLeadingCompanyCourse: Math.random() > 0.7,
          leadingCompanyPartnerInstitution: Math.random() > 0.8 ? '파트너기관' : undefined,
          '실 매출 대비': 1.0,
          '매출 최대': 1500000,
          '매출 최소': 800000,
          조정_실매출대비: 1.0,
          '2021년': year === 2021 ? 1000000 : 0,
          '2022년': year === 2022 ? 1000000 : 0,
          '2023년': year === 2023 ? 1000000 : 0,
          '2024년': year === 2024 ? 1000000 : 0,
          '2025년': year === 2025 ? 1000000 : 0,
          '2026년': year === 2026 ? 1000000 : 0,
          '조정_2021년': year === 2021 ? 1000000 : 0,
          '조정_2022년': year === 2022 ? 1000000 : 0,
          '조정_2023년': year === 2023 ? 1000000 : 0,
          '조정_2024년': year === 2024 ? 1000000 : 0,
          '조정_2025년': year === 2025 ? 1000000 : 0,
          '조정_2026년': year === 2026 ? 1000000 : 0,
          월별매출: {},
          월별수강인원: {},
          월별수료인원: {},
          과정상세: '샘플 과정 상세 정보',
          회차: `${i + 1}`,
          과정페이지링크: '#'
        });
      }
      filteredCourses = sampleCourses;
    }
    
    // 유형 필터링
    if (filterType === 'leading') {
      filteredCourses = filteredCourses.filter((c) => c.isLeadingCompanyCourse);
      console.log('After leading filter:', filteredCourses.length);
    } else if (filterType === 'tech') {
      filteredCourses = filteredCourses.filter(isNewTechCourse);
      console.log('After tech filter:', filteredCourses.length);
    }
    
    // 연도 필터링
    if (selectedYear !== 'all') {
      filteredCourses = filteredCourses.filter(course => {
        const courseStartDate = new Date(course.과정시작일);
        const courseEndDate = new Date(course.과정종료일);
        return courseStartDate.getFullYear() === selectedYear || 
               (courseStartDate.getFullYear() < selectedYear && courseEndDate.getFullYear() === selectedYear);
      });
      console.log('After year filter:', filteredCourses.length);
    }
    
    // 월별 필터링
    if (selectedMonth !== 'all') {
      filteredCourses = filteredCourses.filter(course => {
        const courseStartDate = new Date(course.과정시작일);
        return (courseStartDate.getMonth() + 1) === selectedMonth;
      });
      console.log('After month filter:', filteredCourses.length);
    }

    console.log('Final filtered courses for', institutionName, ':', filteredCourses.length);
    
    // 과정 집계
    const aggregated = aggregateCoursesByCourseId(filteredCourses);
    console.log('Aggregated courses:', aggregated.length);
    setSelectedInstitutionCourses(aggregated);
    setIsModalOpen(true);
  };

  // 과정 집계 함수
  const aggregateCoursesByCourseId = (courses: CourseData[]): AggregatedCourseData[] => {
    const courseMap = new Map<string, AggregatedCourseData>();

    courses.forEach(course => {
      const courseId = course['훈련과정 ID'] || course.과정명;
      
      if (!courseMap.has(courseId)) {
        courseMap.set(courseId, {
          과정명: course.과정명,
          '훈련과정 ID': course['훈련과정 ID'],
          총수강신청인원: 0,
          총수료인원: 0,
          총누적매출: 0,
          평균수료율: 0,
          평균만족도: 0,
          studentsStr: '',
          graduatesStr: '',
          openCountStr: '',
          최소과정시작일: course.과정시작일,
          최대과정종료일: course.과정종료일,
          훈련유형들: [],
          원천과정수: 0,
          총훈련생수: 0
        });
      }

      const aggregated = courseMap.get(courseId)!;
      aggregated.총수강신청인원 += course['수강신청 인원'] || 0;
      aggregated.총수료인원 += course['수료인원'] || 0;
      aggregated.총누적매출 += course.조정_누적매출 || course.누적매출 || 0;
      aggregated.원천과정수 += 1;
      
      // 만족도 계산을 위한 누적
      if (course.만족도 && course.만족도 > 0) {
        aggregated.평균만족도 += course.만족도 * (course['수료인원'] || 0);
        aggregated.총훈련생수 += course['수료인원'] || 0;
      }
      
      if (!aggregated.훈련유형들.includes(course.훈련유형)) {
        aggregated.훈련유형들.push(course.훈련유형);
      }

      // 날짜 범위 업데이트
      const startDate = new Date(course.과정시작일);
      const endDate = new Date(course.과정종료일);
      const aggregatedStartDate = new Date(aggregated.최소과정시작일);
      const aggregatedEndDate = new Date(aggregated.최대과정종료일);

      if (startDate < aggregatedStartDate) {
        aggregated.최소과정시작일 = course.과정시작일;
      }
      if (endDate > aggregatedEndDate) {
        aggregated.최대과정종료일 = course.과정종료일;
      }
    });

    // 평균 계산 및 문자열 생성
    const results = Array.from(courseMap.values()).map(course => {
      const avgCompletionRate = course.총수강신청인원 > 0 ? (course.총수료인원 / course.총수강신청인원) * 100 : 0;
      const avgSatisfaction = course.총훈련생수 > 0 ? course.평균만족도 / course.총훈련생수 : 0;
      
      return {
        ...course,
        평균수료율: avgCompletionRate,
        평균만족도: avgSatisfaction,
        studentsStr: formatNumber(course.총수강신청인원),
        graduatesStr: formatNumber(course.총수료인원),
        openCountStr: course.원천과정수.toString()
      };
    });

    return results.sort((a, b) => b.총누적매출 - a.총누적매출);
  };

  // 그룹화된 기관의 개별 기관 정보 보기
  const handleViewGroupDetails = (groupName: string) => {
    setSelectedGroupName(groupName);
    
    // 해당 그룹의 개별 기관들 필터링
    const individualStats = institutionStats.filter(stat => 
      stat.institutionName === groupName
    );
    
    // 개별 기관별로 상세 통계 계산
    const detailedIndividualStats = individualStats.map(stat => {
      const institutionCourses = allCourses.filter(c => c.훈련기관 === stat.institutionName);
      
      // 유형 필터링
      let filteredCourses = institutionCourses;
      if (filterType === 'leading') {
        filteredCourses = institutionCourses.filter((c) => c.isLeadingCompanyCourse);
      } else if (filterType === 'tech') {
        filteredCourses = institutionCourses.filter(isNewTechCourse);
      }
      
      // 연도 필터링
      if (selectedYear !== 'all') {
        filteredCourses = filteredCourses.filter(course => {
          const courseStartDate = new Date(course.과정시작일);
          const courseEndDate = new Date(course.과정종료일);
          return courseStartDate.getFullYear() === selectedYear || 
                 (courseStartDate.getFullYear() < selectedYear && courseEndDate.getFullYear() === selectedYear);
        });
      }
      
      // 월별 필터링
      if (selectedMonth !== 'all') {
        filteredCourses = filteredCourses.filter(course => {
          const courseStartDate = new Date(course.과정시작일);
          return (courseStartDate.getMonth() + 1) === selectedMonth;
        });
      }
      
      const totalStudents = filteredCourses.reduce((sum, c) => sum + (c['수강신청 인원'] || 0), 0);
      const completedStudents = filteredCourses.reduce((sum, c) => sum + (c['수료인원'] || 0), 0);
      const totalRevenue = filteredCourses.reduce((sum, c) => sum + (c.조정_누적매출 || c.누적매출 || 0), 0);
      const completionRate = totalStudents > 0 ? (completedStudents / totalStudents) * 100 : 0;
      
      // 평균 만족도 계산
      const validSatisfaction = filteredCourses.filter(c => c.만족도 && c.만족도 > 0);
      const totalWeighted = validSatisfaction.reduce((sum, c) => sum + (c.만족도 || 0) * (c['수료인원'] || 0), 0);
      const totalWeight = validSatisfaction.reduce((sum, c) => sum + (c['수료인원'] || 0), 0);
      const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
      
      return {
        ...stat,
        totalStudents,
        completedStudents,
        totalRevenue,
        completionRate,
        avgSatisfaction,
        totalCourses: filteredCourses.length
      };
    });
    
    setIndividualInstitutions(detailedIndividualStats);
    setIsGroupModalOpen(true);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">데이터 로딩 중...</div>
        </div>
      </div>
    );
  }

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
                angle={0}
                textAnchor="middle"
                height={100}
                tick={{ fontSize: 14 }}
                interval={0}
                tickFormatter={(value: string, index: number) => {
                  const rank = index + 1;
                  let displayValue = `${value}`;
                  if (value === '주식회사 코드스테이츠') {
                    displayValue += ' (2023년 감사를 통해 훈련비 전액 반환)';
                  }
                  if (displayValue.length > 15) {
                    displayValue = displayValue.substring(0, 12) + '...';
                  }
                  return `🏅 ${rank}위\n${displayValue}`;
                }}
                dy={20}
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
          <div>* 수료율은 과정 종료일 기준으로 계산하였으며, 분자는 {selectedYear}년 기준 {selectedYear}년의 수료생, 분모는 {selectedYear}년 기준 {selectedYear}년에 끝나는 과정이 있는 모든 과정의 입과생입니다.</div>
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
                  <td className="px-6 py-4 whitespace-nowrap">{formatNumber(stat.totalStudents)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatNumber(stat.completedStudents)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{(() => {
                    // 실제 계산된 수료율 사용
                    const completionRate = stat.totalStudents > 0 ? (stat.completedStudents / stat.totalStudents) * 100 : 0;
                    return completionRate > 0 ? `${completionRate.toFixed(1)}%` : '0.0%';
                  })()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{(() => {
                    // 실제 계산된 평균 만족도 사용
                    const institutionCourses = allCourses.filter(c => c.훈련기관 === stat.institutionName);
                    const validSatisfaction = institutionCourses.filter(c => c.만족도 && c.만족도 > 0);
                    const totalWeighted = validSatisfaction.reduce((sum, c) => sum + (c.만족도 || 0) * (c['수료인원'] || 0), 0);
                    const totalWeight = validSatisfaction.reduce((sum, c) => sum + (c['수료인원'] || 0), 0);
                    const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
                    return avgSatisfaction > 0 ? avgSatisfaction.toFixed(1) : '0.0';
                  })()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDetails(stat.institutionName)}
                          className="text-indigo-600 hover:text-indigo-900"
                          style={{
                            backgroundColor: '#E0E7FF',
                            color: '#4338CA',
                            fontWeight: '500',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #C7D2FE'
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
                              backgroundColor: '#D1FAE5',
                              color: '#065F46',
                              fontWeight: '500',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid #A7F3D0',
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
            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">운영 중인 과정 수</div>
                <div className="text-lg font-semibold">{selectedInstitutionCourses.length}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">{selectedYear === 'all' ? '전체 개강 회차수' : `${selectedYear}년 개강 회차수`}</div>
                <div className="text-lg font-semibold">{selectedInstitutionCourses.reduce((sum, c) => sum + (parseInt(c.openCountStr) || 0), 0)}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">훈련생 수</div>
                <div className="text-lg font-semibold">{formatNumber(selectedInstitutionCourses.reduce((sum, c) => sum + c.총수강신청인원, 0))}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">수료인원</div>
                <div className="text-lg font-semibold">{formatNumber(selectedInstitutionCourses.reduce((sum, c) => sum + c.총수료인원, 0))}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">평균 수료율</div>
                <div className="text-lg font-semibold">
                  {(() => {
                    const totalStudents = selectedInstitutionCourses.reduce((sum, c) => sum + c.총수강신청인원, 0);
                    const totalGraduates = selectedInstitutionCourses.reduce((sum, c) => sum + c.총수료인원, 0);
                    const completionRate = totalStudents > 0 ? (totalGraduates / totalStudents) * 100 : 0;
                    return completionRate > 0 ? `${completionRate.toFixed(1)}%` : '-';
                  })()}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">평균 만족도</div>
                <div className="text-lg font-semibold">
                  {(() => {
                    const validCourses = selectedInstitutionCourses.filter(c => c.평균만족도 && c.평균만족도 > 0);
                    const totalWeighted = validCourses.reduce((sum, c) => sum + c.평균만족도 * c.총수료인원, 0);
                    const totalWeight = validCourses.reduce((sum, c) => sum + c.총수료인원, 0);
                    const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
                    return avgSatisfaction > 0 ? avgSatisfaction.toFixed(1) : '-';
                  })()}
                </div>
              </div>
            </div>
            
            {/* 데이터가 없을 때 메시지 */}
            {selectedInstitutionCourses.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-500 text-lg">선택된 조건에 해당하는 과정이 없습니다.</div>
                <div className="text-gray-400 text-sm mt-2">연도, 월, 유형 필터를 확인해보세요.</div>
              </div>
            )}
            {selectedInstitutionCourses.length > 0 && (
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">개강 회차수</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedInstitutionCourses.map((course: any) => (
                      <tr key={course['훈련과정 ID']} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{course.과정명}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.훈련유형들?.join(', ') || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.studentsStr}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.graduatesStr}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.평균수료율 ? course.평균수료율.toFixed(1) : '0.0'}% ({course.총수료인원}/{course.총수강신청인원})</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{formatRevenue(course.총누적매출)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.평균만족도 ? course.평균만족도.toFixed(1) : '0.0'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{course.openCountStr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                        {selectedYear !== 'all' && selectedMonth === 'all' && institution.prevYearStudents > 0
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
                        {selectedYear !== 'all' && selectedMonth === 'all' && institution.prevYearCompletedStudents > 0
                          ? (
                            <div>
                              <div>{formatNumber(institution.completedStudents)}</div>
                              <div className="text-xs text-gray-500">({formatNumber(institution.prevYearCompletedStudents)})</div>
                            </div>
                          )
                          : formatNumber(institution.completedStudents)
                        }
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{institution.completionRate ? institution.completionRate.toFixed(1) : '0.0'}%</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{institution.avgSatisfaction ? institution.avgSatisfaction.toFixed(1) : '0.0'}</td>
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
            {/* 데이터가 없을 때 메시지 */}
            {individualInstitutions.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-500 text-lg">선택된 조건에 해당하는 개별 기관이 없습니다.</div>
                <div className="text-gray-400 text-sm mt-2">연도, 월, 유형 필터를 확인해보세요.</div>
              </div>
            )}
            
            {individualInstitutions.length > 0 && (
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
                          {selectedYear !== 'all' && selectedMonth === 'all' && institution.prevYearStudents > 0
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
                          {selectedYear !== 'all' && selectedMonth === 'all' && institution.prevYearCompletedStudents > 0
                            ? (
                              <div>
                                <div>{formatNumber(institution.completedStudents)}</div>
                                <div className="text-xs text-gray-500">({formatNumber(institution.prevYearCompletedStudents)})</div>
                              </div>
                            )
                            : formatNumber(institution.completedStudents)
                          }
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{institution.completionRate ? institution.completionRate.toFixed(1) : '0.0'}%</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{institution.avgSatisfaction ? institution.avgSatisfaction.toFixed(1) : '0.0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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