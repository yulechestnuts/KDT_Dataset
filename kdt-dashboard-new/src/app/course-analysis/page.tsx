'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense, useRef } from 'react';
import { kdtAPI } from '@/lib/api-client';
import {
  CourseData,
  RevenueMode,
  computeCourseRevenueByMode,
  aggregateCoursesByCourseIdWithLatestInfo,
} from "@/lib/data-utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useGlobalFilters } from "@/contexts/FilterContext";

interface CourseStats {
  totalRevenue: number;
  courseCount: number;
  totalStudents: number;
  totalGraduates: number;
}

type YearColumn = '2021년' | '2022년' | '2023년' | '2024년' | '2025년' | '2026년';
type ViewRevenueMode = RevenueMode | 'contract';

// 디바운싱 훅
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// allCourseDetails를 추가하는 헬퍼 함수
function enrichAggregatedCoursesWithDetails(aggregated: any[], allCourses: CourseData[]) {
  // 훈련과정 ID별로 원본 과정들을 그룹화
  const courseGroups = new Map<string, CourseData[]>();
  allCourses.forEach(course => {
    const key = course['훈련과정 ID']?.trim();
    if (key) {
      if (!courseGroups.has(key)) courseGroups.set(key, []);
      courseGroups.get(key)!.push(course);
    }
  });

  // aggregated 결과에 allCourseDetails 추가
  return aggregated.map(agg => {
    const key = agg['훈련과정 ID']?.trim();
    if (key && courseGroups.has(key)) {
      const group = courseGroups.get(key)!;
      const latest = group.reduce((a, b) => new Date(a.과정시작일) > new Date(b.과정시작일) ? a : b);
      return {
        ...agg,
        allCourseDetails: group.sort((a, b) => new Date(a.과정시작일).getTime() - new Date(b.과정시작일).getTime()),
        과정페이지링크: latest.과정페이지링크,
      };
    }
    // Fallback: 훈련과정 ID가 없는 경우 과정명으로 그룹화 시도
    const nameKey = agg.과정명?.trim();
    if (nameKey) {
      const nameGroup = allCourses.filter(c => c.과정명?.trim() === nameKey);
      if (nameGroup.length > 0) {
        const latest = nameGroup.reduce((a, b) => new Date(a.과정시작일) > new Date(b.과정시작일) ? a : b);
        return {
          ...agg,
          allCourseDetails: nameGroup.sort((a, b) => new Date(a.과정시작일).getTime() - new Date(b.과정시작일).getTime()),
          과정페이지링크: latest.과정페이지링크,
        };
      }
    }
    return {
      ...agg,
      allCourseDetails: [],
      과정페이지링크: null,
    };
  });
}

function CourseAnalysisContent() {
  const searchParams = useSearchParams();
  const selectedCourse = searchParams ? searchParams.get('course') : null;

  const [courseData, setCourseData] = useState<CourseData[]>([]);
  const [rawCourses, setRawCourses] = useState<CourseData[]>([]); // 원본 데이터 보관
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'leading' | 'tech'>('all');
  // 훈련기관 검색 상태 추가
  const [institutionSearch, setInstitutionSearch] = useState('');
  // 검색 상태 추가
  const [searchQuery, setSearchQuery] = useState('');
  // 디바운싱된 검색어
  const debouncedSearchQuery = useDebounce(institutionSearch, 300);
  // 매출 기준 상태 추가
  const [revenueMode, setRevenueMode] = useState<ViewRevenueMode>('current');
  const {
    filters: { selectedYear: globalSelectedYear },
    setSelectedYear: setGlobalSelectedYear,
  } = useGlobalFilters();
  const selectedYear: number | 'all' = globalSelectedYear === null ? 'all' : globalSelectedYear;
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  // 표시할 과정 수 제한
  const [displayLimit, setDisplayLimit] = useState(30);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const year = selectedYear === 'all' ? undefined : selectedYear;
        const apiRevenueMode: RevenueMode = revenueMode === 'contract' ? 'max' : revenueMode;
        const result = await kdtAPI.getCourseAnalysis({
          year,
          trainingType: filterType,
          revenueMode: apiRevenueMode,
        });

        setCourseData((result?.data ?? []) as unknown as CourseData[]);
        setRawCourses((result?.data ?? []) as unknown as CourseData[]); // 원본 데이터 보관
        setAvailableYears(result?.meta?.available_years ?? []);
        console.log('[course-analysis] API response setCourseData first 3 rows:', (result?.data ?? []).slice(0, 3).map((d: any) => ({
          고유값: d.고유값,
          과정명: d.과정명,
          '훈련과정 ID': d['훈련과정 ID'],
          과정시작일: d.과정시작일,
          total_revenue: d.total_revenue,
          '2026년': d['2026년'],
        })));
      } catch (err) {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [revenueMode, filterType, selectedYear]);

  // 필터링된 courseData 반환
  const getFilteredCourseData = () => {
    let filtered = rawCourses; // rawCourses 사용
    if (filterType === 'leading') {
      filtered = rawCourses.filter((c) => c.isLeadingCompanyCourse);
    } else if (filterType === 'tech') {
      filtered = rawCourses.filter((c) => !c.isLeadingCompanyCourse);
    }
    return filtered;
  };

  // 훈련기관명 기준으로 필터링 (선도기업 과정은 파트너기관 기준)
  const getInstitutionFilteredCourses = useCallback((courses: CourseData[]) => {
    if (!debouncedSearchQuery.trim()) return courses;
    const search = debouncedSearchQuery.trim().toLowerCase();
    return courses.filter((c) => {
      // 선도기업 과정이면 파트너기관 기준, 아니면 훈련기관 기준
      if (c.isLeadingCompanyCourse && c.leadingCompanyPartnerInstitution) {
        return c.leadingCompanyPartnerInstitution.toLowerCase().includes(search);
      } else {
        return (c.훈련기관 || '').toLowerCase().includes(search);
      }
    });
  }, [debouncedSearchQuery]); // useCallback으로 메모이제이션

  // 수주 매출(contract) 모드에서는 과정시작일 기반 필터링
  const getContractFilteredCourses = useCallback((courses: CourseData[]) => {
    if (revenueMode !== 'contract') return courses;
    if (selectedYear === 'all') return courses;
    
    // selectedYear에 시작한 과정만 필터링
    return courses.filter(c => {
      const startDate = new Date(c.과정시작일);
      return startDate.getFullYear() === selectedYear;
    });
  }, [revenueMode, selectedYear]);

  // 집계 결과 생성 (검색 필터 반영, revenueMode 적용)
  // @/lib/data-utils.ts의 함수 사용 (year는 undefined로 전달하여 전체 연도 매출 합산)
  const filteredCourses = useMemo(() => {
    console.log('[course-analysis] Filtering courses with search:', debouncedSearchQuery);
    const baseFiltered = getFilteredCourseData();
    const institutionFiltered = getInstitutionFilteredCourses(baseFiltered);
    const contractFiltered = getContractFilteredCourses(institutionFiltered);
    return contractFiltered;
  }, [rawCourses, debouncedSearchQuery, selectedYear, filterType, getContractFilteredCourses]); // debouncedSearchQuery 사용

  const aggregatedCourses = useMemo(() => {
    console.log('[course-analysis] filteredCourses count before aggregation:', filteredCourses.length);
    console.log('[course-analysis] revenueMode:', revenueMode);
    if (selectedYear === 2026 || selectedYear === 'all') {
      console.log('[course-analysis] 2026/all sample before aggregation:', filteredCourses.slice(0, 3).map((c: any) => ({
        과정명: c.과정명,
        '훈련과정 ID': c['훈련과정 ID'],
        과정시작일: c.과정시작일,
        '2026년': c['2026년'],
        total_revenue: c.total_revenue,
      })));
    }
    
    const aggregated = aggregateCoursesByCourseIdWithLatestInfo(
      filteredCourses,
      selectedYear === 'all' ? undefined : selectedYear,
      undefined, // institutionName: 기관 필터링 없음
      revenueMode === 'contract' ? 'max' : revenueMode
    );
    
    console.log('[course-analysis] aggregatedCourses count after aggregation:', aggregated.length);
    if (selectedYear === 2026 || selectedYear === 'all') {
      console.log('[course-analysis] 2026/all sample after aggregation:', aggregated.slice(0, 3).map((a: any) => ({
        과정명: a.과정명,
        '훈련과정 ID': a['훈련과정 ID'],
        총누적매출: a.총누적매출,
        allCourseDetails_count: a.allCourseDetails?.length ?? 0,
      })));
    }
    
    const enriched = enrichAggregatedCoursesWithDetails(aggregated, filteredCourses);
    console.log('[course-analysis] enrichAggregatedCoursesWithDetails debug:', enriched.map((a: any) => ({
      과정명: a.과정명,
      '훈련과정 ID': a['훈련과정 ID'],
      hasDetails: Boolean(a.allCourseDetails),
      detailsCount: a.allCourseDetails?.length ?? 0,
      firstDetailName: a.allCourseDetails?.[0]?.과정명,
      firstDetailLink: a.allCourseDetails?.[0]?.과정페이지링크,
    })));
    
    return enriched;
  }, [filteredCourses, selectedYear, revenueMode]);

  // 표시할 과정들만 제한 (Virtualization 대체)
  const displayCourses = useMemo(() => {
    return aggregatedCourses.slice(0, displayLimit);
  }, [aggregatedCourses, displayLimit]);

  // 더보기 핸들러
  const handleLoadMore = useCallback(() => {
    setDisplayLimit(prev => Math.min(prev + 30, aggregatedCourses.length));
  }, [aggregatedCourses.length]);

  // 메모이제이션된 CourseCard 컴포넌트
const CourseCard = React.memo(({ 
  agg, 
  selectedYear, 
  revenueMode: propRevenueMode 
}: {
  agg: any;
  selectedYear: number | 'all';
  revenueMode: ViewRevenueMode;
}) => {
  // 개별 카드의 확장 상태 (독립적 관리)
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 개별 카드의 상세 정보 표시 수 제한
  const [displayCount, setDisplayCount] = useState(10);
  
  // 수주 매출 모드 체크
  const isContractMode = propRevenueMode === 'contract';
  
  // 개별 카드의 상세 정보만 필요할 때 계산
  // 수주 매출 모드라면 선택된 연도 시작 과정만 필터링
  const courseDetails = useMemo(() => {
    if (!isExpanded) return [];
    let details = agg.allCourseDetails || [];
    
    // 수주 매출 모드에서는 해당 연도에 시작한 과정만 표시
    if (isContractMode && selectedYear !== 'all') {
      details = details.filter((course: CourseData) => {
        const startYear = new Date(course.과정시작일).getFullYear();
        return startYear === selectedYear;
      });
    }
    
    return details.slice(0, displayCount);
  }, [agg.allCourseDetails, isExpanded, displayCount, isContractMode, selectedYear]);

  // 확장 토글 핸들러
  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // 더보기 핸들러
  const handleShowMore = useCallback(() => {
    setDisplayCount(prev => prev + 20);
  }, []);

  const openLinkSafe = useCallback((url?: string) => {
    if (!url) return;
    let link = url.trim();
    if (link && !/^https?:\/\//i.test(link)) {
      link = `https://${link}`;
    }
    window.open(link, '_blank');
  }, []);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggle}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {agg.과정명}
            {agg.과정페이지링크 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLinkSafe(agg.과정페이지링크)}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                과정 페이지
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">
                {isContractMode ? '수주 매출' : '총 매출'}
              </h3>
              <p className="text-2xl font-bold">{formatCurrency(agg.총누적매출)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">
                {isContractMode && selectedYear !== 'all' ? `${selectedYear}년 시작 과정 수` : '과정 수'}
              </h3>
              <p className="text-2xl font-bold">{agg.원천과정수}개</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">총 훈련생</h3>
              <p className="text-2xl font-bold">{agg.총수강신청인원}명</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">총 수료생</h3>
              <p className="text-2xl font-bold">{agg.총수료인원}명</p>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">
                {isContractMode && selectedYear !== 'all' 
                  ? `${selectedYear}년 시작 과정 상세 정보` 
                  : '회차별 상세 정보'}
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>회차</TableHead>
                    <TableHead>훈련기관</TableHead>
                    <TableHead>시작일</TableHead>
                    <TableHead>종료일</TableHead>
                    <TableHead>정원</TableHead>
                    <TableHead>훈련생 수</TableHead>
                    <TableHead>수료인원</TableHead>
                    <TableHead>취업인원 (3개월)</TableHead>
                    <TableHead>취업인원 (6개월)</TableHead>
                    <TableHead className="text-center">
                      <div>총 일수</div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div>총 시간</div>
                    </TableHead>
                    <TableHead>{isContractMode ? '수주매출' : '매출'}</TableHead>
                    <TableHead>과정 페이지</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseDetails.length === 0 && isContractMode && selectedYear !== 'all' ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-4 text-gray-500">
                        {selectedYear}년에 시작한 과정이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    courseDetails.map((detail: CourseData, detailIdx: number) => {
                      const rowKey = `${detail['훈련과정 ID'] || 'unknown'}-${detailIdx}`;
                      console.log('[course-analysis] rendering detail row:', {
                        rowKey,
                        과정명: detail.과정명,
                        '훈련과정 ID': detail['훈련과정 ID'],
                        수료인원: detail.수료인원,
                        '수강신청 인원': detail['수강신청 인원'],
                        정원: detail.정원,
                        과정페이지링크: detail.과정페이지링크,
                      });
                      return (
                        <TableRow key={rowKey}>
                          <TableCell>{detail.회차}</TableCell>
                          <TableCell>
                            {detail.isLeadingCompanyCourse && detail.leadingCompanyPartnerInstitution ? (
                              <span>
                                {detail.leadingCompanyPartnerInstitution}
                                {detail.훈련기관 && (
                                  <span> (<span style={{ whiteSpace: 'pre' }}>{detail.훈련기관}</span>)</span>
                                )}
                              </span>
                            ) : (
                              detail.훈련기관
                            )}
                          </TableCell>
                          <TableCell>{new Date(detail.과정시작일).toLocaleDateString('ko-KR')}</TableCell>
                          <TableCell>{new Date(detail.과정종료일).toLocaleDateString('ko-KR')}</TableCell>
                          <TableCell>{formatNumber(detail.정원 || 0)}</TableCell>
                          <TableCell>{formatNumber(detail['수강신청 인원'] || 0)}</TableCell>
                          <TableCell>{formatNumber(detail.수료인원 || 0)}</TableCell>
                          <TableCell>{formatNumber(detail['취업인원 (3개월)'] || 0)}</TableCell>
                          <TableCell>{formatNumber(detail['취업인원 (6개월)'] || 0)}</TableCell>
                          <TableCell className="text-center">
                            {formatNumber(detail.총훈련일수 || 0)}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatNumber(detail.총훈련시간 || 0)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(
                              computeCourseRevenueByMode(
                                detail,
                                selectedYear === 'all' ? undefined : selectedYear,
                                propRevenueMode === 'contract' ? 'max' : propRevenueMode
                              )
                            )}
                          </TableCell>
                          <TableCell>
                            {detail.과정페이지링크 && (
                              <Button
                                variant="link"
                              size="sm"
                              onClick={() => openLinkSafe(detail.과정페이지링크)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                  )}
                  {courseDetails.length < (agg.allCourseDetails?.length || 0) && (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleShowMore}
                          className="px-4 py-1"
                        >
                          더보기 ({(agg.allCourseDetails?.length || 0) - courseDetails.length}개 항목)
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  });

  if (loading) {
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
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">
        {selectedCourse ? `${selectedCourse} 상세 분석` : '훈련과정별 상세 분석'}
      </h1>
      {/* 필터 UI */}
      <div className="mb-6 flex gap-6 items-end">
        {/* 연도 필터 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">연도 선택</label>
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setGlobalSelectedYear(v === 'all' ? null : parseInt(v, 10))}
          >
            <SelectTrigger className="w-[200px] bg-white">
              <SelectValue placeholder="연도 선택" />
            </SelectTrigger>
            <SelectContent className="bg-white z-20">
              <SelectItem value="all">전체 연도</SelectItem>
              {(availableYears.length > 0 ? availableYears : [2021, 2022, 2023, 2024, 2025, 2026]).map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}년
                </SelectItem>
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
        
        {/* 매출 기준 토글 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">매출 기준</label>
          <Select value={revenueMode} onValueChange={(v) => setRevenueMode(v as ViewRevenueMode)}>
            <SelectTrigger className="w-[200px] bg-white">
              <SelectValue placeholder="매출 기준" />
            </SelectTrigger>
            <SelectContent className="bg-white z-20">
              <SelectItem value="current">현재 계산된 매출</SelectItem>
              <SelectItem value="max">최대 매출</SelectItem>
              <SelectItem value="contract">수주 매출</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 훈련기관 검색 UI */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">훈련기관 검색</label>
          <input
            type="text"
            value={institutionSearch}
            onChange={e => setInstitutionSearch(e.target.value)}
            placeholder="기관명 검색..."
            className="w-[250px] px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="mb-4 text-sm text-foreground bg-muted border border-border rounded px-4 py-2 space-y-1">
        <div>※ 매출액: 과정이 2개년도에 걸쳐있는 경우, 각 년도에 차지하는 비율에 맞추어 매출이 분배됩니다.</div>
        <div>※ 수주 매출: 과정시작일(=위탁계약 수주 시점)이 선택 연도에 속한 과정의 매출 최대 합계입니다. 분배되지 않고 수주 연도에 전액 귀속됩니다.</div>
      </div>

      <div className="grid gap-6">
        {displayCourses.length === 0 ? (
          <div className="text-center text-gray-500 py-20">표시할 데이터가 없습니다.</div>
        ) : (
          displayCourses.map((agg) => {
            const rawKey = String(agg['훈련과정 ID'] ?? '').trim();
            const compositeKey = rawKey ? `${rawKey}|${agg.과정명}` : `fallback|${agg.과정명}`;
            
            return (
              <CourseCard
                key={compositeKey}
                agg={agg}
                selectedYear={selectedYear}
                revenueMode={revenueMode}
              />
            );
          })
        )}
        {displayCourses.length < aggregatedCourses.length && (
          <div className="text-center py-4">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              className="px-6 py-2"
            >
              더보기 ({aggregatedCourses.length - displayCourses.length}개 항목)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CourseAnalysisPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CourseAnalysisContent />
    </Suspense>
  );
}
