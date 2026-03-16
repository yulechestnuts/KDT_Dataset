"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { CourseData } from '@/lib/data-utils';
import { loadDataFromGithub, preprocessData } from '@/utils/data-utils';
import { useGlobalFilters } from '@/contexts/FilterContext';

const EmploymentAnalysis = () => {

  const [courseData, setCourseData] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    filters: { selectedYear, yearType, periodOption, filterZero },
    setSelectedYear,
    setYearType,
    setPeriodOption,
    setFilterZero,
  } = useGlobalFilters();
  const [sortKey, setSortKey] = useState<'totalEmployment' | 'totalTargetPop' | 'avgRate' | 'totalCompletion' | 'courseCount'>('totalEmployment');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [ncsSortKey, setNcsSortKey] = useState<'totalEmployment' | 'totalTargetPop' | 'avgRate' | 'totalCompletion' | 'courseCount'>('totalEmployment');
  const [ncsSortOrder, setNcsSortOrder] = useState<'asc' | 'desc'>('desc');

  // 연도 목록 생성 (종료일 우선, 없으면 시작일)
  const yearList = useMemo(() => {
    const years = new Set<number>();
    for (const course of courseData) {
      const endYear = new Date(course.과정종료일).getFullYear();
      const startYear = new Date(course.과정시작일).getFullYear();
      const y = Number.isFinite(endYear) ? endYear : startYear;
      if (Number.isFinite(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [courseData]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const rawData = await loadDataFromGithub();
        const processedData = preprocessData(rawData);
        setCourseData(processedData);
        setError(null);
      } catch (err) {
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        console.error('Data loading error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ...

  const getKstNow = () => {
    const now = new Date();
    return new Date(now.getTime() + now.getTimezoneOffset() * 60_000 + 9 * 60 * 60_000);
  };

  const parseYmdToKstDate = (ymd: string) => {
    const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(String(ymd || '').trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    // KST 기준 자정
    return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0) + 9 * 60 * 60_000);
  };

  const isEmploymentMatured = (course: CourseData, monthsAfterEnd: 3 | 6) => {
    const end = parseYmdToKstDate(course.과정종료일);
    if (!end) return false;
    const maturedAt = new Date(end.getTime());
    maturedAt.setMonth(maturedAt.getMonth() + monthsAfterEnd);
    return getKstNow().getTime() >= maturedAt.getTime();
  };

  // 필터링된 데이터 (연도/기준 + 0 제외)
  const filteredData = useMemo(() => {
    const base = courseData.filter((course) => {
      if (selectedYear === null) return true;
      const dateStr = yearType === 'ended' ? course.과정종료일 : course.과정시작일;
      if (!dateStr) return false;
      const y = new Date(dateStr).getFullYear();
      return Number.isFinite(y) && y === selectedYear;
    });

    if (!filterZero) return base;
    return base.filter((course) => (course.취업대상인원 || 0) > 0 && (course.통합취업인원 || 0) > 0);
  }, [courseData, selectedYear, yearType, filterZero]);

  // 상단 통계/테이블 집계는 반드시 동일한 배열(summaryCourses) 기준
  const maturityMonths = periodOption === '6개월' ? 6 : 3;

  const getRateForPeriod = (course: CourseData) => {
    if (periodOption === '6개월') {
      return Number(course['취업률 (6개월)'] ?? 0) || 0;
    }
    return Number(course['취업률 (3개월)'] ?? 0) || 0;
  };

  const summaryCourses = useMemo(() => {
    return filteredData.filter((course) => {
      const targetPop = course.취업대상인원 || 0;
      const employed = course.통합취업인원 || 0;
      if (targetPop <= 0) return false;
      if (!isEmploymentMatured(course, maturityMonths)) return false;
      if (filterZero) {
        if (employed <= 0) return false;
        const rate = getRateForPeriod(course);
        if (rate <= 0) return false;
      }
      return true;
    });
  }, [filteredData, maturityMonths, filterZero, periodOption]);

  const totalCompletedStudents = useMemo(
    () => summaryCourses.reduce((sum, course) => sum + (course['수료인원'] || 0), 0),
    [summaryCourses]
  );
  const totalTargetPop = useMemo(
    () => summaryCourses.reduce((sum, course) => sum + (course.취업대상인원 || 0), 0),
    [summaryCourses]
  );
  const totalEmployment = useMemo(
    () => summaryCourses.reduce((sum, course) => sum + (course.통합취업인원 || 0), 0),
    [summaryCourses]
  );
  const avgEmploymentRate = useMemo(
    () => (totalTargetPop > 0 ? (totalEmployment / totalTargetPop) * 100 : 0),
    [totalEmployment, totalTargetPop]
  );

  // 기본 통계 계산
  const calculateBasicStats = () => {
    const eligible = summaryCourses;
    const roundedAvgEmploymentRate = totalTargetPop > 0 ? (totalEmployment / totalTargetPop * 10) / 10 : 0;
    const totalCompletion = totalTargetPop;
    const employmentCompletionRate = totalTargetPop > 0 ? (totalEmployment / totalTargetPop * 100) : 0;

    const coursesWithEmployment = eligible.length;
    const employmentCourseRate = filteredData.length > 0 ? (coursesWithEmployment / filteredData.length * 100) : 0;

    return {
      totalEmployment,
      avgEmploymentRate: roundedAvgEmploymentRate,
      totalCompletion,
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
      totalTargetPop: number;
      avgRate: number;
      courseCount: number;
      totalCompletion: number;
    }>();

    summaryCourses.forEach(course => {

      let instName = course.훈련기관;
      if (
        course.선도기업 && course.선도기업.trim() !== '' &&
        course.leadingCompanyPartnerInstitution &&
        course.leadingCompanyPartnerInstitution.trim() !== course.훈련기관.trim()
      ) {
        instName = course.leadingCompanyPartnerInstitution.trim();
      }
      // 그 외는 훈련기관 그대로
      if (!institutionMap.has(instName)) {
        institutionMap.set(instName, {
          totalEmployment: 0,
          totalTargetPop: 0,
          avgRate: 0,
          courseCount: 0,
          totalCompletion: 0
        });
      }
      const inst = institutionMap.get(instName)!;
      const tp = course.취업대상인원 || 0;
      const employed = course.통합취업인원 || 0;
      if (tp > 0) {
        inst.totalEmployment += employed;
        inst.totalTargetPop += tp;
        inst.totalCompletion += tp;
      }
      inst.courseCount += 1;
    });

    // 평균 계산 (가중 평균)
    institutionMap.forEach(inst => {
      inst.avgRate = inst.totalTargetPop > 0 ? (inst.totalEmployment / inst.totalTargetPop * 100) : 0;
    });

    return Array.from(institutionMap.entries())
      .map(([name, stats]) => ({ name, ...stats, totalCompletion: stats.totalTargetPop }))
      .filter(item => item.totalTargetPop > 0)
      .sort((a, b) => b[sortKey] - a[sortKey]);
  };

  const institutionStats = calculateInstitutionStats();

  // NCS별 취업인원 많은 순으로 전체 보여주기 (훈련기관 분석과 동일한 표 구조)
  const calculateNcsStats = () => {

    const ncsMap = new Map<string, {
      totalEmployment: number;
      totalTargetPop: number;
      totalCompletion: number;
      avgRate: number;
      courseCount: number;
    }>();

    summaryCourses.forEach(course => {

      if (!ncsMap.has(course.NCS명)) {
        ncsMap.set(course.NCS명, {
          totalEmployment: 0,
          totalTargetPop: 0,
          totalCompletion: 0,
          avgRate: 0,
          courseCount: 0
        });
      }

      const ncs = ncsMap.get(course.NCS명)!;
      const tp = course.취업대상인원 || 0;
      const employed = course.통합취업인원 || 0;
      if (tp > 0) {
        ncs.totalEmployment += employed;
        ncs.totalTargetPop += tp;
        ncs.totalCompletion += tp;
      }
      ncs.courseCount += 1;
    });

    // 평균 계산 (가중 평균)
    ncsMap.forEach(ncs => {
      ncs.avgRate = ncs.totalTargetPop > 0 ? (ncs.totalEmployment / ncs.totalTargetPop * 100) : 0;
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

      {/* 상단 통계 UI (총 수강인원, 총 취업대상 인원, 총 취업인원, 취업대상자 대비 취업률) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">총 수료생</h3>
          <p className="text-3xl font-bold text-blue-600">{(totalCompletedStudents ?? 0).toLocaleString()}명</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">총 취업대상 인원</h3>
          <p className="text-3xl font-bold text-green-600">{(totalTargetPop ?? 0).toLocaleString()}명</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">총 취업인원</h3>
          <p className="text-3xl font-bold text-purple-600">{(totalEmployment ?? 0).toLocaleString()}명</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">취업대상자 대비 취업률</h3>
          <p className="text-3xl font-bold text-orange-600">{avgEmploymentRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* 훈련기관별 표 헤더 클릭 시 정렬 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">훈련기관별 취업인원/취업률/취업대상 인원/과정수 정렬</h2>
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
                  총 취업대상 인원 {sortKey === 'totalCompletion' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
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
                  <td className="px-4 py-2 text-right">{(inst.totalEmployment ?? 0).toLocaleString()}명</td>
                  <td className="px-4 py-2 text-right">{(inst.totalCompletion ?? 0).toLocaleString()}명</td>
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
                  총 취업대상 인원 {ncsSortKey === 'totalCompletion' ? (ncsSortOrder === 'desc' ? '▼' : '▲') : ''}
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
                  <td className="px-4 py-2 text-right">{(ncs.totalEmployment ?? 0).toLocaleString()}명</td>
                  <td className="px-4 py-2 text-right">{(ncs.totalCompletion ?? 0).toLocaleString()}명</td>
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