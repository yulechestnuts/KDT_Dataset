"use client";

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { CourseData } from '@/lib/data-utils';
import { loadDataFromGithub, preprocessData } from '@/utils/data-utils';

const CourseDetail = () => {
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allCourses, setAllCourses] = useState<CourseData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await loadDataFromGithub();
        const parsedData = Papa.parse(data, { header: true });
        const processedData = preprocessData(parsedData.data);
        setAllCourses(processedData);

        // URL에서 과정 ID 가져오기
        const courseId = window.location.pathname.split('/').pop();
        const course = processedData.find((c: CourseData) => c.고유값 === courseId);

        if (course) {
          setCourseData(course);
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

  // 취업률 통계 계산
  const calculateEmploymentStats = () => {
    if (!allCourses.length) return null;

    const validCourses = allCourses.filter(course => 
      course.취업인원 > 0 && course.수료인원 > 0
    );

    if (validCourses.length === 0) return null;

    const totalEmployment = validCourses.reduce((sum, course) => sum + course.취업인원, 0);
    const totalCompletion = validCourses.reduce((sum, course) => sum + course.수료인원, 0);
    const avgEmploymentRate = totalCompletion > 0 ? (totalEmployment / totalCompletion) * 100 : 0;

    return {
      totalEmployment,
      totalCompletion,
      avgEmploymentRate,
      validCoursesCount: validCourses.length
    };
  };

  const employmentStats = calculateEmploymentStats();

  return (
    <div className="container mx-auto px-4 py-8">
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center">{error}</div>
      ) : courseData ? (
        <div className="space-y-6">
          {/* 헤더 섹션 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-3xl font-bold mb-4">{courseData.과정명}</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-600">훈련기관</p>
                <p className="font-medium">{courseData.훈련기관}</p>
              </div>
              <div>
                <p className="text-gray-600">훈련과정 ID</p>
                <p className="font-medium">{courseData['훈련과정 ID']}</p>
              </div>
              <div>
                <p className="text-gray-600">훈련유형</p>
                <p className="font-medium">{courseData.훈련유형}</p>
              </div>
            </div>
          </div>

          {/* 취업률 대시보드 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 현재 과정 취업 정보 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">현재 과정 취업 현황</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{courseData.취업인원}명</p>
                  <p className="text-sm text-gray-600">취업인원</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{courseData.취업률.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600">취업률</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{courseData.수료인원}명</p>
                  <p className="text-sm text-gray-600">수료인원</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{courseData.수료율.toFixed(1)}%</p>
                  <p className="text-sm text-gray-600">수료율</p>
                </div>
              </div>
            </div>

            {/* 전체 평균 취업률 */}
            {employmentStats && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4">전체 평균 취업 현황</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <p className="text-2xl font-bold text-indigo-600">{employmentStats.totalEmployment.toLocaleString()}명</p>
                    <p className="text-sm text-gray-600">총 취업인원</p>
                  </div>
                  <div className="text-center p-4 bg-teal-50 rounded-lg">
                    <p className="text-2xl font-bold text-teal-600">{employmentStats.avgEmploymentRate.toFixed(1)}%</p>
                    <p className="text-sm text-gray-600">평균 취업률</p>
                  </div>
                  <div className="text-center p-4 bg-pink-50 rounded-lg">
                    <p className="text-2xl font-bold text-pink-600">{employmentStats.totalCompletion.toLocaleString()}명</p>
                    <p className="text-sm text-gray-600">총 수료인원</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{employmentStats.validCoursesCount}개</p>
                    <p className="text-sm text-gray-600">유효 과정 수</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 기간별 취업 현황 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">기간별 취업 현황</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 전체 취업 현황 */}
              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-800 mb-4">전체 취업 현황</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-3xl font-bold text-blue-600">{courseData.취업인원}명</p>
                    <p className="text-sm text-gray-600">취업인원</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{courseData.취업률.toFixed(1)}%</p>
                    <p className="text-sm text-gray-600">취업률</p>
                  </div>
                </div>
              </div>

              {/* 3개월 취업 현황 */}
              <div className="text-center p-6 bg-green-50 rounded-lg">
                <h3 className="text-lg font-semibold text-green-800 mb-4">3개월 취업 현황</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-3xl font-bold text-green-600">{courseData['취업인원 (3개월)']}명</p>
                    <p className="text-sm text-gray-600">취업인원</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-700">{courseData['취업률 (3개월)'].toFixed(1)}%</p>
                    <p className="text-sm text-gray-600">취업률</p>
                  </div>
                </div>
              </div>

              {/* 6개월 취업 현황 */}
              <div className="text-center p-6 bg-purple-50 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-800 mb-4">6개월 취업 현황</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-3xl font-bold text-purple-600">{courseData['취업인원 (6개월)']}명</p>
                    <p className="text-sm text-gray-600">취업인원</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-700">{courseData['취업률 (6개월)'].toFixed(1)}%</p>
                    <p className="text-sm text-gray-600">취업률</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 과정 상세 정보 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">과정 상세 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">기본 정보</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">과정 시작일:</span>
                    <span>{courseData.과정시작일}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">과정 종료일:</span>
                    <span>{courseData.과정종료일}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">총 훈련일수:</span>
                    <span>{courseData.총훈련일수}일</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">총 훈련시간:</span>
                    <span>{courseData.총훈련시간}시간</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-2">수강 정보</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">정원:</span>
                    <span>{courseData.정원}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">수강신청 인원:</span>
                    <span>{courseData['수강신청 인원']}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">수료인원:</span>
                    <span>{courseData.수료인원}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">수료율:</span>
                    <span>{courseData.수료율.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-2">취업 정보</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">취업인원:</span>
                    <span>{courseData.취업인원}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">취업률:</span>
                    <span>{courseData.취업률.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">3개월 취업인원:</span>
                    <span>{courseData['취업인원 (3개월)']}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">3개월 취업률:</span>
                    <span>{courseData['취업률 (3개월)'].toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">6개월 취업인원:</span>
                    <span>{courseData['취업인원 (6개월)']}명</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">6개월 취업률:</span>
                    <span>{courseData['취업률 (6개월)'].toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">만족도:</span>
                    <span>{courseData.만족도.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">훈련비:</span>
                    <span>{courseData.훈련비.toLocaleString()}원</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* NCS 정보 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">NCS 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">NCS명</p>
                <p className="font-medium">{courseData.NCS명}</p>
              </div>
              <div>
                <p className="text-gray-600">NCS코드</p>
                <p className="font-medium">{courseData.NCS코드}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CourseDetail; 