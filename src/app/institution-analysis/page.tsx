"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CourseData, InstitutionStats, calculateInstitutionStats, aggregateCoursesByCourseName } from '@/lib/data-utils';
import { formatNumber } from '@/lib/utils';

export default function InstitutionAnalysis() {
  const [courseData, setCourseData] = useState<CourseData[]>([]);
  const [institutionStats, setInstitutionStats] = useState<InstitutionStats[]>([]);
  const [showLeadingOnly, setShowLeadingOnly] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string | number>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstitutionName, setSelectedInstitutionName] = useState('');
  const [selectedInstitutionDetail, setSelectedInstitutionDetail] = useState<InstitutionStats | null>(null);
  const [selectedInstitutionCourses, setSelectedInstitutionCourses] = useState<any[]>([]);

  const availableYears = Array.from(new Set(courseData.map(course => course.훈련연도))).sort() as number[];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/courses');
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const data = await response.json();
        setCourseData(data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (courseData.length === 0) return;

    let filteredCourses = courseData;

    if (showLeadingOnly) {
      filteredCourses = filteredCourses.filter(course => course.isLeadingCompanyCourse);
    }

    if (selectedYear !== 'all') {
      filteredCourses = filteredCourses.filter(course => course.훈련연도 === selectedYear);
    }

    const stats = calculateInstitutionStats(filteredCourses);
    setInstitutionStats(stats);

  }, [selectedYear, showLeadingOnly, courseData]);

  const handleViewDetails = (stat: InstitutionStats) => {
    setSelectedInstitutionName(stat.institutionName);
    setSelectedInstitutionDetail(stat);
    
    const filteredAndAdjustedCourses = stat.courses.filter(course => {
      if (showLeadingOnly && !course.isLeadingCompanyCourse) return false;
      if (selectedYear !== 'all' && course.훈련연도 !== selectedYear) return false;
      return true;
    }).map(course => {
      let adjustedRevenue = course.훈련비;
      if (course.isLeadingCompanyCourse && course.파트너기관명 && course.파트너기관명 !== course.훈련기관명) {
        if (stat.institutionName === course.훈련기관명) {
          // Original training institution for a leading company course with a different partner
          adjustedRevenue = course.훈련비 * 0.1; // Gets 10%
        } else if (stat.institutionName === course.파트너기관명) {
          // Partner institution for a leading company course with a different partner
          adjustedRevenue = course.훈련비 * 0.9; // Gets 90%
        }
      }
      return { ...course, 훈련비: adjustedRevenue };
    });
    
    const aggregated = aggregateCoursesByCourseName(filteredAndAdjustedCourses);
    setSelectedInstitutionCourses(aggregated);
    setIsModalOpen(true);
  };

  const totalOverallRevenue = institutionStats.reduce((sum, stat) => sum + stat.totalRevenue, 0);
  
  const totalLeadingCompanyRevenue = institutionStats.reduce((sum, stat) => {
    // 이 기관이 선도기업 훈련 과정을 포함하는지 확인
    const hasLeadingCompanyCourse = stat.courses.some(course => course.isLeadingCompanyCourse);
    if (hasLeadingCompanyCourse) {
      return sum + stat.totalRevenue; // totalRevenue는 이미 조정됨
    }
    return sum;
  }, 0);

  const overallCompletionRateFiltered = calculateCompletionRate(courseData.filter(course => {
    if (showLeadingOnly && !course.isLeadingCompanyCourse) return false;
    if (selectedYear !== 'all' && course.훈련연도 !== selectedYear) return false;
    return true;
  }), undefined);

  const totalAverageSatisfaction = institutionStats.length > 0 
    ? institutionStats.reduce((sum, stat) => sum + stat.averageSatisfaction, 0) / institutionStats.length
    : 0;

  const formatRevenue = (value: number) => {
    // 이미 억 단위로 변환된 값이므로 바로 조 단위로 변환
    if (value >= 10000) {
      const trillion = Math.floor(value / 10000);
      const remainingBillion = value % 10000;
      if (remainingBillion === 0) {
        return `${trillion}조`;
      }
      return `${trillion}조 ${remainingBillion.toFixed(1)}억`;
    }
    
    return `${value.toFixed(1)}억`;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">훈련기관별 분석</h1>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="leading-only"
                checked={showLeadingOnly}
                onCheckedChange={(checked: boolean) => setShowLeadingOnly(checked)}
                className="data-[state=checked]:bg-blue-600"
              />
              <Label
                htmlFor="leading-only"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                선도기업과정만보기
              </Label>
            </div>
            <Button
              variant={showLeadingOnly ? "default" : "outline"}
              className={`${showLeadingOnly ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
              onClick={() => setShowLeadingOnly(!showLeadingOnly)}
            >
              {showLeadingOnly ? '선도기업과정만보기' : '전체과정보기'}
            </Button>
          </div>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(value === 'all' ? 'all' : parseInt(value))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="연도 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 연도</SelectItem>
              {availableYears.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>총 매출액</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatRevenue(totalOverallRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>선도기업 매출액</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatRevenue(totalLeadingCompanyRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>총 수료율</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {(overallCompletionRateFiltered).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>총 평균 만족도</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalAverageSatisfaction.toFixed(1)}점
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">훈련기관별 매출액 (억원)</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={institutionStats.slice(0, 10)}>
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
            {institutionStats.map((stat, index) => (
              <tr key={stat.institutionName} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {index + 1}. {stat.institutionName}
                  {stat.courses.some(course => course.isLeadingCompanyCourse && course.파트너기관명 === course.훈련기관명) && (
                    <span className="ml-2 text-blue-500 text-xs">(선도기업 훈련)</span>
                  )}
                  {stat.institutionName === '주식회사 코드스테이츠' && (
                    <span className="ml-2 text-red-500 text-xs">(2023년 감사를 통해 훈련비 전액 반환)</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatRevenue(stat.totalRevenue)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.totalCourses}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.totalStudents}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.completedStudents}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.averageCompletionRate.toFixed(1)}%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.averageSatisfaction.toFixed(1)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => handleViewDetails(stat)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    상세보기
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      >
        <DialogContent className="mx-auto max-w-[90vw] w-full bg-white rounded-xl shadow-lg p-0">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-900">
              {selectedInstitutionName} - 훈련과정 상세
              {selectedYear !== 'all' && ` (${selectedYear}년)`}
            </DialogTitle>
            <DialogDescription>
              선택된 훈련기관의 {selectedYear === 'all' ? '모든' : `${selectedYear}년`} 훈련과정 목록입니다. (매출액 기준 내림차순 정렬)
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {selectedInstitutionDetail && (
                <>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">훈련과정 수</div>
                    <div className="text-lg font-semibold">{selectedInstitutionDetail.totalCourses}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">훈련생 수</div>
                    <div className="text-lg font-semibold">{selectedInstitutionDetail.totalStudents}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">수료생 수</div>
                    <div className="text-lg font-semibold">{selectedInstitutionDetail.completedStudents}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">총 매출</div>
                    <div className="text-lg font-semibold">{formatRevenue(selectedInstitutionDetail.totalRevenue)}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-500">평균 만족도</div>
                    <div className="text-lg font-semibold">{selectedInstitutionDetail.averageSatisfaction.toFixed(1)}점</div>
                  </div>
                </>
              )}
            </div>

            <h3 className="text-xl font-bold mb-4">과정 목록</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>과정명</TableHead>
                  <TableHead>훈련유형</TableHead>
                  <TableHead>훈련생 수</TableHead>
                  <TableHead>수료인원</TableHead>
                  <TableHead>수료율</TableHead>
                  <TableHead>매출액</TableHead>
                  <TableHead>만족도</TableHead>
                  <TableHead>훈련과정 수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedInstitutionCourses.map((course, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{course.과정명}</TableCell>
                    <TableCell>{course.훈련유형들.join(', ')}</TableCell>
                    <TableCell>{course.총훈련생수}</TableCell>
                    <TableCell>{course.총수료인원}</TableCell>
                    <TableCell>{((course.총수료인원 / course.총훈련생수) * 100).toFixed(1)}%</TableCell>
                    <TableCell>{formatRevenue(course.총누적매출)}</TableCell>
                    <TableCell>{course.평균만족도.toFixed(1)}점</TableCell>
                    <TableCell>{course.원천과정수}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 수료율 계산 함수 추가
const calculateCompletionRate = (courses: CourseData[], institutionName?: string) => {
  const filteredCourses = institutionName 
    ? courses.filter(course => course.훈련기관명 === institutionName)
    : courses;

  const totalStudents = filteredCourses.reduce((sum, course) => sum + course.훈련생수, 0);
  const completedStudents = filteredCourses.reduce((sum, course) => sum + course.수료인원, 0);

  return totalStudents > 0 ? (completedStudents / totalStudents) * 100 : 0;
}; 