'use client';

import { useEffect, useState, Suspense } from 'react';
import { loadDataFromGithub, preprocessData, applyRevenueAdjustment, calculateCompletionRate } from "@/utils/data-utils";
import { CourseData } from "@/lib/data-utils";
import Papa from "papaparse";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/utils/formatters";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface CourseStats {
  totalRevenue: number;
  courseCount: number;
  totalStudents: number;
  totalGraduates: number;
}

type YearColumn = '2021년' | '2022년' | '2023년' | '2024년' | '2025년' | '2026년';

// 집계 함수 추가
function aggregateCoursesByCourseIdWithLatestInfo(courses: CourseData[]) {
  // 1. 훈련과정 ID별로 그룹화
  const groupMap = new Map<string, CourseData[]>();
  courses.forEach(course => {
    const key = course['훈련과정 ID']?.trim();
    if (!key) return;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(course);
  });

  // 2. 각 그룹에서 최신 과정 추출 및 집계
  const result: any[] = [];
  groupMap.forEach((group, courseId) => {
    // 최신 과정
    const latest = group.reduce((a, b) => new Date(a.과정시작일) > new Date(b.과정시작일) ? a : b);
    // 합산
    const totalRevenue = group.reduce((sum, c) => sum + (c.조정_누적매출 ?? c.누적매출 ?? 0), 0);
    const totalStudents = group.reduce((sum, c) => sum + (c['수강신청 인원'] || 0), 0);
    const totalGraduates = group.reduce((sum, c) => sum + (c.수료인원 || 0), 0);
    const courseCount = group.length;
    result.push({
      courseId,
      과정명: latest.과정명,
      '훈련과정 ID': courseId,
      총수강신청인원: totalStudents,
      총수료인원: totalGraduates,
      총누적매출: totalRevenue,
      최소과정시작일: group.reduce((min, c) => new Date(c.과정시작일) < new Date(min) ? c.과정시작일 : min, group[0].과정시작일),
      최대과정종료일: group.reduce((max, c) => new Date(c.과정종료일) > new Date(max) ? c.과정종료일 : max, group[0].과정종료일),
      훈련유형: latest.훈련유형,
      원천과정수: courseCount,
      평균만족도: latest.만족도,
      평균수료율: latest.수료율,
      allCourseDetails: group.sort((a, b) => new Date(a.과정시작일).getTime() - new Date(b.과정시작일).getTime()),
      과정페이지링크: latest.과정페이지링크,
    });
  });
  return result.sort((a, b) => b.총누적매출 - a.총누적매출);
}

function CourseAnalysisContent() {
  const searchParams = useSearchParams();
  const selectedCourse = searchParams.get('course');

  const [courseData, setCourseData] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseStats, setCourseStats] = useState<Record<string, CourseStats>>({});
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'leading' | 'tech'>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await loadDataFromGithub();
        const parsedData = Papa.parse(data, { header: true });
        const processedData = preprocessData(parsedData.data);

        // ===== 매출 보정 적용 =====
        const overallCompletionRate = calculateCompletionRate(processedData);
        const adjustedData = applyRevenueAdjustment(processedData, overallCompletionRate);

        // 과정별 통계 계산
        const stats: Record<string, CourseStats> = {};

        adjustedData.forEach((course: CourseData) => {
          // 훈련과정 ID || 과정명 기준으로 집계 (둘 다 없으면 제외)
          const courseKey = course['훈련과정 ID']?.trim() || course.과정명?.trim();
          if (!courseKey) return;
          if (!stats[courseKey]) {
            stats[courseKey] = {
              totalRevenue: 0,
              courseCount: 0,
              totalStudents: 0,
              totalGraduates: 0
            };
          }
          stats[courseKey].totalRevenue += course.조정_누적매출 ?? course.누적매출 ?? 0;
          stats[courseKey].courseCount += 1;
          stats[courseKey].totalStudents += course['수강신청 인원'] || 0;
          stats[courseKey].totalGraduates += course.수료인원 || 0;
        });

        setCourseStats(stats);
        setCourseData(adjustedData);
      } catch (err) {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleCourseExpansion = (courseId: string) => {
    const newExpanded = new Set(expandedCourses);
    if (newExpanded.has(courseId)) {
      newExpanded.delete(courseId);
    } else {
      newExpanded.add(courseId);
    }
    setExpandedCourses(newExpanded);
  };

  // 필터링된 courseData 반환
  const getFilteredCourseData = () => {
    if (filterType === 'leading') {
      return courseData.filter((c) => c.isLeadingCompanyCourse);
    } else if (filterType === 'tech') {
      return courseData.filter((c) => !c.isLeadingCompanyCourse);
    }
    return courseData;
  };

  // 집계 결과 생성
  const aggregatedCourses = aggregateCoursesByCourseIdWithLatestInfo(getFilteredCourseData());

  // 안전한 링크 열기 (http/https 미포함 시 https 추가)
  const openLinkSafe = (url?: string) => {
    if (!url) return;
    let link = url.trim();
    if (link && !/^https?:\/\//i.test(link)) {
      link = `https://${link}`;
    }
    window.open(link, '_blank');
  };

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
      {/* 유형 필터 UI */}
      <div className="mb-6 flex gap-4 items-center">
        <label className="block text-sm font-medium text-gray-700">유형 필터</label>
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
      <div className="grid gap-6">
        {aggregatedCourses.length === 0 ? (
          <div className="text-center text-gray-500 py-20">표시할 데이터가 없습니다.</div>
        ) : (
          aggregatedCourses.map((agg) => {
            const isExpanded = expandedCourses.has(agg['훈련과정 ID']);
            return (
              <Card key={agg['훈련과정 ID']}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCourseExpansion(agg['훈련과정 ID'])}
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
                      <h3 className="text-sm font-medium text-gray-500">총 매출</h3>
                      <p className="text-2xl font-bold">{formatCurrency(agg.총누적매출)}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">과정 수</h3>
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
                      <h3 className="text-lg font-semibold mb-4">회차별 상세 정보</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>회차</TableHead>
                            <TableHead>훈련기관</TableHead>
                            <TableHead>시작일</TableHead>
                            <TableHead>종료일</TableHead>
                            <TableHead>훈련생 수</TableHead>
                            <TableHead>수료인원</TableHead>
                            <TableHead>수료율</TableHead>
                            <TableHead className="text-center">
                              <div>취업인원</div>
                              <div className="text-xs text-gray-500">(3개월)</div>
                            </TableHead>
                            <TableHead className="text-center">
                              <div>취업인원</div>
                              <div className="text-xs text-gray-500">(6개월)</div>
                            </TableHead>
                            <TableHead className="text-center">
                              <div>총 일수</div>
                            </TableHead>
                            <TableHead className="text-center">
                              <div>총 시간</div>
                            </TableHead>
                            <TableHead>매출</TableHead>
                            <TableHead>과정 페이지</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agg.allCourseDetails.map((detail: CourseData, detailIdx: number) => (
                            <TableRow key={detailIdx}>
                              <TableCell>{detail.회차}</TableCell>
                              <TableCell>{detail.훈련기관}</TableCell>
                              <TableCell>{new Date(detail.과정시작일).toLocaleDateString()}</TableCell>
                              <TableCell>{new Date(detail.과정종료일).toLocaleDateString()}</TableCell>
                              <TableCell>{detail['수강신청 인원']}명</TableCell>
                              <TableCell>{detail.수료인원}명</TableCell>
                              <TableCell>{((detail.수료인원 || 0) / (detail['수강신청 인원'] || 1) * 100).toFixed(1)}%</TableCell>
                              <TableCell className="text-center">{detail['취업인원 (3개월)']}명</TableCell>
                              <TableCell className="text-center">{detail['취업인원 (6개월)']}명</TableCell>
                              <TableCell className="text-center">{detail.총훈련일수}일</TableCell>
                              <TableCell className="text-center">{detail.총훈련시간}시간</TableCell>
                              <TableCell>{formatCurrency(detail.조정_누적매출 ?? detail.누적매출)}</TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!detail.과정페이지링크}
                                  onClick={() => openLinkSafe(detail.과정페이지링크)}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  바로가기
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function CourseAnalysisPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <CourseAnalysisContent />
    </Suspense>
  );
}