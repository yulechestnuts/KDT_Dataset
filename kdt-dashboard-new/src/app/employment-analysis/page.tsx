"use client";

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { CourseData } from '@/lib/data-utils';
import { loadDataFromGithub, preprocessData } from '@/utils/data-utils';

const EmploymentAnalysis = () => {
  const [courseData, setCourseData] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodOption, setPeriodOption] = useState<'3개월' | '6개월' | '전체'>('전체');
  const [filterZero, setFilterZero] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await loadDataFromGithub();
        const parsedData = Papa.parse(data, { header: true });
        const processedData = preprocessData(parsedData.data);
        setCourseData(processedData);
      } catch (err) {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 기준별 컬럼명 매핑
  const getEmploymentColumns = () => {
    switch (periodOption) {
      case '3개월':
        return {
          empCol: '취업인원 (3개월)',
          rateCol: '취업률 (3개월)'
        };
      case '6개월':
        return {
          empCol: '취업인원 (6개월)',
          rateCol: '취업률 (6개월)'
        };
      default:
        return {
          empCol: '취업인원',
          rateCol: '취업률'
        };
    }
  };

  const { empCol, rateCol } = getEmploymentColumns();

  // 필터링된 데이터
  const filteredData = filterZero 
    ? courseData.filter(course => course[empCol] > 0 && course[rateCol] > 0)
    : courseData;

  // 기본 통계 계산
  const calculateBasicStats = () => {
    const totalEmployment = filteredData.reduce((sum, course) => sum + course[empCol], 0);
    const avgEmploymentRate = filteredData.reduce((sum, course) => sum + course[rateCol], 0) / filteredData.length;
    const totalCompletion = filteredData.reduce((sum, course) => sum + course.수료인원, 0);
    const employmentCompletionRate = totalCompletion > 0 ? (totalEmployment / totalCompletion * 100) : 0;
    const coursesWithEmployment = filteredData.filter(course => course[empCol] > 0).length;
    const employmentCourseRate = filteredData.length > 0 ? (coursesWithEmployment / filteredData.length * 100) : 0;

    return {
      totalEmployment,
      avgEmploymentRate,
      employmentCompletionRate,
      employmentCourseRate,
      coursesWithEmployment,
      totalCourses: filteredData.length
    };
  };

  const stats = calculateBasicStats();

  // 훈련기관별 평균 취업률
  const calculateInstitutionStats = () => {
    const institutionMap = new Map<string, {
      totalEmployment: number;
      totalCompletion: number;
      avgRate: number;
      courseCount: number;
    }>();

    filteredData.forEach(course => {
      if (!institutionMap.has(course.훈련기관)) {
        institutionMap.set(course.훈련기관, {
          totalEmployment: 0,
          totalCompletion: 0,
          avgRate: 0,
          courseCount: 0
        });
      }

      const inst = institutionMap.get(course.훈련기관)!;
      inst.totalEmployment += course[empCol];
      inst.totalCompletion += course.수료인원;
      inst.avgRate += course[rateCol];
      inst.courseCount += 1;
    });

    // 평균 계산
    institutionMap.forEach(inst => {
      inst.avgRate = inst.courseCount > 0 ? inst.avgRate / inst.courseCount : 0;
    });

    return Array.from(institutionMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .filter(item => item.totalCompletion > 0)
      .sort((a, b) => b.avgRate - a.avgRate)
      .slice(0, 20);
  };

  const institutionStats = calculateInstitutionStats();

  // NCS별 평균 취업률
  const calculateNcsStats = () => {
    const ncsMap = new Map<string, {
      totalEmployment: number;
      totalCompletion: number;
      avgRate: number;
      courseCount: number;
    }>();

    filteredData.forEach(course => {
      if (!ncsMap.has(course.NCS명)) {
        ncsMap.set(course.NCS명, {
          totalEmployment: 0,
          totalCompletion: 0,
          avgRate: 0,
          courseCount: 0
        });
      }

      const ncs = ncsMap.get(course.NCS명)!;
      ncs.totalEmployment += course[empCol];
      ncs.totalCompletion += course.수료인원;
      ncs.avgRate += course[rateCol];
      ncs.courseCount += 1;
    });

    // 평균 계산
    ncsMap.forEach(ncs => {
      ncs.avgRate = ncs.courseCount > 0 ? ncs.avgRate / ncs.courseCount : 0;
    });

    return Array.from(ncsMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .filter(item => item.totalCompletion > 0)
      .sort((a, b) => b.avgRate - a.avgRate)
      .slice(0, 15);
  };

  const ncsStats = calculateNcsStats();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">취업률 분석</h1>

      {/* 기준 선택 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">취업률 기준 선택</label>
            <div className="flex gap-4">
              {(['3개월', '6개월', '전체'] as const).map((option) => (
                <label key={option} className="flex items-center">
                  <input
                    type="radio"
                    value={option}
                    checked={periodOption === option}
                    onChange={(e) => setPeriodOption(e.target.value as any)}
                    className="mr-2"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filterZero}
                onChange={(e) => setFilterZero(e.target.checked)}
                className="mr-2"
              />
              취업률 0% 또는 취업인원 0명 과정 제외
            </label>
          </div>
        </div>
      </div>

      {/* 기본 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">총 취업인원</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalEmployment.toLocaleString()}명</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">평균 취업률</h3>
          <p className="text-3xl font-bold text-green-600">{stats.avgEmploymentRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">수료 대비 취업률</h3>
          <p className="text-3xl font-bold text-purple-600">{stats.employmentCompletionRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">취업 과정 비율</h3>
          <p className="text-3xl font-bold text-orange-600">{stats.employmentCourseRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* 훈련기관별 평균 취업률 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">훈련기관별 평균 취업률 (상위 20개)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">순위</th>
                <th className="px-4 py-2 text-left">훈련기관</th>
                <th className="px-4 py-2 text-right">평균 취업률</th>
                <th className="px-4 py-2 text-right">총 취업인원</th>
                <th className="px-4 py-2 text-right">총 수료인원</th>
                <th className="px-4 py-2 text-right">과정 수</th>
              </tr>
            </thead>
            <tbody>
              {institutionStats.map((inst, index) => (
                <tr key={inst.name} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{index + 1}</td>
                  <td className="px-4 py-2 font-medium">{inst.name}</td>
                  <td className="px-4 py-2 text-right font-bold text-green-600">{inst.avgRate.toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right">{inst.totalEmployment.toLocaleString()}명</td>
                  <td className="px-4 py-2 text-right">{inst.totalCompletion.toLocaleString()}명</td>
                  <td className="px-4 py-2 text-right">{inst.courseCount}개</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NCS별 평균 취업률 */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">NCS별 평균 취업률 (상위 15개)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">순위</th>
                <th className="px-4 py-2 text-left">NCS명</th>
                <th className="px-4 py-2 text-right">평균 취업률</th>
                <th className="px-4 py-2 text-right">총 취업인원</th>
                <th className="px-4 py-2 text-right">총 수료인원</th>
                <th className="px-4 py-2 text-right">과정 수</th>
              </tr>
            </thead>
            <tbody>
              {ncsStats.map((ncs, index) => (
                <tr key={ncs.name} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{index + 1}</td>
                  <td className="px-4 py-2 font-medium">{ncs.name}</td>
                  <td className="px-4 py-2 text-right font-bold text-blue-600">{ncs.avgRate.toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right">{ncs.totalEmployment.toLocaleString()}명</td>
                  <td className="px-4 py-2 text-right">{ncs.totalCompletion.toLocaleString()}명</td>
                  <td className="px-4 py-2 text-right">{ncs.courseCount}개</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmploymentAnalysis; 