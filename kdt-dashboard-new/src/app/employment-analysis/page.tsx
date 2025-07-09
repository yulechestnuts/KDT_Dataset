"use client";

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { CourseData } from '@/lib/data-utils';
import { loadDataFromGithub, preprocessData } from '@/utils/data-utils';

const EmploymentAnalysis = () => {
  const [courseData, setCourseData] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodOption, setPeriodOption] = useState<'3개월' | '6개월'>('3개월');
  const [filterZero, setFilterZero] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [yearType, setYearType] = useState<'started' | 'ended'>('started');
  const [sortKey, setSortKey] = useState<'totalEmployment' | 'avgRate' | 'totalCompletion' | 'courseCount'>('totalEmployment');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [ncsSortKey, setNcsSortKey] = useState<'totalEmployment' | 'avgRate' | 'totalCompletion' | 'courseCount'>('totalEmployment');
  const [ncsSortOrder, setNcsSortOrder] = useState<'desc' | 'asc'>('desc');

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

  // 연도 목록 추출
  const yearList = Array.from(new Set(courseData.map(c => c.훈련연도))).filter(Boolean).sort((a, b) => b - a);

  // 연도 및 기준별 필터링
  const yearFilteredData = selectedYear
    ? courseData.filter(course => {
        if (yearType === 'started') {
          return course.훈련연도 === selectedYear;
        } else {
          // 종료일 기준: 종료일의 연도 추출
          const endYear = course.과정종료일 ? new Date(course.과정종료일).getFullYear() : null;
          return endYear === selectedYear;
        }
      })
    : courseData;

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
          empCol: '취업인원 (3개월)',
          rateCol: '취업률 (3개월)'
        };
    }
  };

  const { empCol, rateCol } = getEmploymentColumns();

  // 필터링된 데이터 (0제외 등)
  const filteredData = filterZero 
    ? yearFilteredData.filter(course => course[empCol] > 0 && course[rateCol] > 0)
    : yearFilteredData;

  // 상단 통계: 수강인원/수료인원/취업인원/취업률만 표시
  const totalApplicants = filteredData.reduce((sum, course) => sum + (course['수강신청 인원'] || 0), 0);
  const totalCompletion = filteredData.reduce((sum, course) => sum + (course['수료인원'] || 0), 0);
  const totalEmployment = filteredData.reduce((sum, course) => sum + (course[empCol] || 0), 0);
  const avgEmploymentRate = totalCompletion > 0 ? (totalEmployment / totalCompletion * 100) : 0;

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

  // 훈련기관별 표는 선도기업/파트너기관/훈련기관 기준으로 집계
  const calculateInstitutionStats = () => {
    const institutionMap = new Map<string, {
      totalEmployment: number;
      totalCompletion: number;
      avgRate: number;
      courseCount: number;
    }>();

    yearFilteredData.forEach(course => {
      let instName = course.훈련기관;
      if (
        course.선도기업 && course.선도기업.trim() !== '' &&
        course.파트너기관 && course.파트너기관.trim() !== '' &&
        course.파트너기관.trim() !== course.훈련기관.trim()
      ) {
        instName = course.파트너기관.trim();
      }
      // 그 외는 훈련기관 그대로
      if (!institutionMap.has(instName)) {
        institutionMap.set(instName, {
          totalEmployment: 0,
          totalCompletion: 0,
          avgRate: 0,
          courseCount: 0
        });
      }
      const inst = institutionMap.get(instName)!;
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
      .sort((a, b) => b[sortKey] - a[sortKey]);
  };

  const institutionStats = calculateInstitutionStats();

  // NCS별 취업인원 많은 순으로 전체 보여주기 (훈련기관 분석과 동일한 표 구조)
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
      .sort((a, b) => b.totalEmployment - a.totalEmployment); // 취업인원 많은 순
  };

  const ncsStats = calculateNcsStats();

  // 훈련기관별 표 정렬 함수
  const sortedInstitutionStats = [...institutionStats].sort((a, b) => {
    if (sortOrder === 'desc') {
      return b[sortKey] - a[sortKey];
    } else {
      return a[sortKey] - b[sortKey];
    }
  });

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  // NCS별 표 정렬 함수
  const sortedNcsStats = [...ncsStats].sort((a, b) => {
    if (ncsSortOrder === 'desc') {
      return b[ncsSortKey] - a[ncsSortKey];
    } else {
      return a[ncsSortKey] - b[ncsSortKey];
    }
  });

  const handleNcsSort = (key: typeof ncsSortKey) => {
    if (ncsSortKey === key) {
      setNcsSortOrder(ncsSortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setNcsSortKey(key);
      setNcsSortOrder('desc');
    }
  };

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
      {/* 연도/기준 선택 UI */}
      <div className="flex flex-wrap gap-4 items-center mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">연도 선택</label>
          <select
            value={selectedYear ?? ''}
            onChange={e => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
            className="px-2 py-1 border rounded"
          >
            <option value="">전체</option>
            {yearList.map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">기준 선택</label>
          <select
            value={yearType}
            onChange={e => setYearType(e.target.value as 'started' | 'ended')}
            className="px-2 py-1 border rounded"
          >
            <option value="started">시작된 과정 기준</option>
            <option value="ended">종료된 과정 기준</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">취업률 기준 선택</label>
          <div className="flex gap-4">
            {(['3개월', '6개월'] as const).map((option) => (
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
              onChange={e => setFilterZero(e.target.checked)}
              className="mr-2"
            />
            취업/취업률 0 제외
          </label>
        </div>
      </div>

      {/* 상단 통계 UI (총 수강인원, 총 수료인원, 총 취업인원, 수료대비 취업률만 남김) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">총 수강인원</h3>
          <p className="text-3xl font-bold text-blue-600">{totalApplicants.toLocaleString()}명</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">총 수료인원</h3>
          <p className="text-3xl font-bold text-green-600">{totalCompletion.toLocaleString()}명</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">총 취업인원</h3>
          <p className="text-3xl font-bold text-purple-600">{totalEmployment.toLocaleString()}명</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">수료 대비 취업률</h3>
          <p className="text-3xl font-bold text-orange-600">{avgEmploymentRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* 훈련기관별 표 헤더 클릭 시 정렬 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">훈련기관별 취업인원/취업률/수료인원/과정수 정렬</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">순위</th>
                <th className="px-4 py-2 text-left">훈련기관</th>
                <th className="px-4 py-2 text-right cursor-pointer" onClick={() => handleSort('avgRate')}>
                  평균 취업률 {sortKey === 'avgRate' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th className="px-4 py-2 text-right cursor-pointer" onClick={() => handleSort('totalEmployment')}>
                  총 취업인원 {sortKey === 'totalEmployment' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th className="px-4 py-2 text-right cursor-pointer" onClick={() => handleSort('totalCompletion')}>
                  총 수료인원 {sortKey === 'totalCompletion' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th className="px-4 py-2 text-right cursor-pointer" onClick={() => handleSort('courseCount')}>
                  과정 수 {sortKey === 'courseCount' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedInstitutionStats.map((inst, index) => (
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

      {/* NCS별 표 구조 훈련기관 분석과 동일하게 */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">NCS별 취업인원 많은 순</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">순위</th>
                <th className="px-4 py-2 text-left">NCS명</th>
                <th className="px-4 py-2 text-right cursor-pointer" onClick={() => handleNcsSort('avgRate')}>
                  평균 취업률 {ncsSortKey === 'avgRate' ? (ncsSortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th className="px-4 py-2 text-right cursor-pointer" onClick={() => handleNcsSort('totalEmployment')}>
                  총 취업인원 {ncsSortKey === 'totalEmployment' ? (ncsSortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th className="px-4 py-2 text-right cursor-pointer" onClick={() => handleNcsSort('totalCompletion')}>
                  총 수료인원 {ncsSortKey === 'totalCompletion' ? (ncsSortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th className="px-4 py-2 text-right cursor-pointer" onClick={() => handleNcsSort('courseCount')}>
                  과정 수 {ncsSortKey === 'courseCount' ? (ncsSortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedNcsStats.map((ncs, index) => (
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