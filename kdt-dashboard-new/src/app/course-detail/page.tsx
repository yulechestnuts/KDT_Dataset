"use client";

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { CourseData } from '@/lib/data-utils';
import { loadDataFromGithub, preprocessData, adjustYearlyRevenueForCourse } from '@/utils/data-utils';

const CourseDetail = () => {
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overallCompletionRate, setOverallCompletionRate] = useState<number>(0);
  const [adjustedYearlyRevenues, setAdjustedYearlyRevenues] = useState<{ [key: string]: number }>({});
  const [totalAdjustedRevenue, setTotalAdjustedRevenue] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await loadDataFromGithub();
        const parsedData = Papa.parse(data, { header: true });
        const processedData = preprocessData(parsedData.data);
        
        // 전체 수료율 계산
        const totalCompletionRate = processedData.reduce((acc: number, course: CourseData) => acc + (course.수료율 || 0), 0) / processedData.length;
        setOverallCompletionRate(totalCompletionRate);

        // URL에서 과정 ID 가져오기
        const courseId = window.location.pathname.split('/').pop();
        const course = processedData.find((c: CourseData) => c.과정ID === courseId);

        if (course) {
          setCourseData(course);
          
          // 조정된 연간 매출액 계산
          const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'];
          const adjustedYearly: { [key: string]: number } = {};
          let totalRevenue = 0;

          yearColumns.forEach(yearCol => {
            const originalYearlyRevenue = course[yearCol] as number | undefined;
            if (originalYearlyRevenue !== undefined) {
              const adjustedRevenue = adjustYearlyRevenueForCourse(
                course,
                originalYearlyRevenue,
                new Date(),
                totalCompletionRate
              );
              adjustedYearly[yearCol] = adjustedRevenue;
              totalRevenue += adjustedRevenue;
            }
          });

          setAdjustedYearlyRevenues(adjustedYearly);
          setTotalAdjustedRevenue(totalRevenue);
        } else {
          setError('과정을 찾을 수 없습니다.');
        }
      } catch (err) {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center">{error}</div>
      ) : courseData ? (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-6">{courseData.과정명}</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">기본 정보</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600">과정 ID</p>
                    <p className="font-medium">{courseData.과정ID}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">과정 유형</p>
                    <p className="font-medium">{courseData.과정유형}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">수료율</p>
                    <p className="font-medium">{courseData.수료율}%</p>
                  </div>
                  <div>
                    <p className="text-gray-600">총 누적매출</p>
                    <p className="font-medium">
                      {totalAdjustedRevenue.toLocaleString()}원
                      <span className="text-sm text-gray-500 ml-2">
                        (실 매출 대비 조정)
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">연간 매출</h2>
                <div className="space-y-2">
                  {Object.entries(adjustedYearlyRevenues).map(([year, revenue]) => (
                    <div key={year} className="flex justify-between items-center">
                      <span className="text-gray-600">{year}</span>
                      <span className="font-medium">
                        {revenue.toLocaleString()}원
                        <span className="text-sm text-gray-500 ml-2">
                          (실 매출 대비 조정)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">과정 상세</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600">시작일</p>
                    <p className="font-medium">{courseData.시작일}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">종료일</p>
                    <p className="font-medium">{courseData.종료일}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">교육기관</p>
                    <p className="font-medium">{courseData.교육기관}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">교육장소</p>
                    <p className="font-medium">{courseData.교육장소}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CourseDetail; 