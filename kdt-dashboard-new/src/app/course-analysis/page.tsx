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

interface CourseStats {
  totalRevenue: number;
  courseCount: number;
  totalStudents: number;
  totalGraduates: number;
}

type YearColumn = '2021년' | '2022년' | '2023년' | '2024년' | '2025년' | '2026년';

function CourseAnalysisContent() {
  const searchParams = useSearchParams();
  const selectedCourse = searchParams.get('course');

  const [courseData, setCourseData] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseStats, setCourseStats] = useState<Record<string, CourseStats>>({});
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

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
          const courseName = course.과정명 || '';
          if (!stats[courseName]) {
            stats[courseName] = {
              totalRevenue: 0,
              courseCount: 0,
              totalStudents: 0,
              totalGraduates: 0
            };
          }

          // 보정된 누적매출 합산 (없으면 원본 누적매출 사용)
          stats[courseName].totalRevenue += course.조정_누적매출 ?? course.누적매출 ?? 0;

          stats[courseName].courseCount += 1;
          stats[courseName].totalStudents += course['수강신청 인원'] || 0;
          stats[courseName].totalGraduates += course.수료인원 || 0;
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

  // 과정별 통계를 누적매출 기준으로 정렬
  const sortedCourseStats = Object.entries(courseStats)
    .sort(([, a], [, b]) => b.totalRevenue - a.totalRevenue)
    .filter(([courseName]) => !selectedCourse || courseName === selectedCourse);

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

      <div className="grid gap-6">
        {sortedCourseStats.map(([courseName, stats]) => {
          const isExpanded = expandedCourses.has(courseName);
          const allCourseDetails = courseData.filter(c => c.과정명 === courseName)
            .sort((a, b) => new Date(a.과정시작일).getTime() - new Date(b.과정시작일).getTime());

          return (
            <Card key={courseName}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCourseExpansion(courseName)}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  {courseName}
                  {allCourseDetails[0]?.과정페이지링크 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openLinkSafe(allCourseDetails[0].과정페이지링크)}
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
                    <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">과정 수</h3>
                    <p className="text-2xl font-bold">{stats.courseCount}개</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">총 훈련생</h3>
                    <p className="text-2xl font-bold">{stats.totalStudents}명</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">총 수료생</h3>
                    <p className="text-2xl font-bold">{stats.totalGraduates}명</p>
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
                          <TableHead>매출</TableHead>
                          <TableHead>과정 페이지</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allCourseDetails.map((detail, detailIdx) => (
                          <TableRow key={detailIdx}>
                            <TableCell>{detail.회차}</TableCell>
                            <TableCell>{detail.훈련기관}</TableCell>
                            <TableCell>{new Date(detail.과정시작일).toLocaleDateString()}</TableCell>
                            <TableCell>{new Date(detail.과정종료일).toLocaleDateString()}</TableCell>
                            <TableCell>{detail['수강신청 인원']}명</TableCell>
                            <TableCell>{detail.수료인원}명</TableCell>
                            <TableCell>{((detail.수료인원 || 0) / (detail['수강신청 인원'] || 1) * 100).toFixed(1)}%</TableCell>
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
        })}
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