'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { kdtAPI } from '@/lib/api-client';
import { groupInstitutionsAdvanced } from '@/lib/backend/institution-grouping';
import { useGlobalFilters } from '@/contexts/FilterContext';

interface EmploymentStats {
  name: string;
  totalEmployment: number;
  totalTargetPop: number;
  avgRate: number;
  courseCount: number;
  totalCompletion: number;
}

interface NcsStats {
  name: string;
  totalEmployment: number;
  totalTargetPop: number;
  totalCompletion: number;
  avgRate: number;
  courseCount: number;
}

// 기간(3개월/6개월) 강제 + institution-analysis 역산 로직
// targetPop = employed / (rate/100), 데이터 없으면 null 반환
function getEmploymentDataByPeriod(
  course: any,
  period: '3개월' | '6개월'
): { employed: number; targetPop: number; rate: number } | null {
  const keys = Object.keys(course || {});
  const empKey = keys.find((k) => k.includes('취업인원') && k.includes(period));
  const rateKey = keys.find((k) => k.includes('취업률') && k.includes(period));
  if (!empKey || !rateKey) return null;

  const employed = Number(course[empKey] ?? 0) || 0;
  const rawRate = course[rateKey];
  if (employed <= 0 || rawRate == null) return null;

  const cleaned = String(rawRate).replace(/[^0-9.]/g, '').trim();
  const rate = parseFloat(cleaned);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const targetPop = Math.round(employed / (rate / 100));
  return { employed, targetPop, rate };
}

export default function EmploymentAnalysisClient() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    filters: { selectedYear, yearType, periodOption },
    setSelectedYear,
    setYearType,
    setPeriodOption,
  } = useGlobalFilters();

  const [sortKey, setSortKey] = useState<'totalEmployment' | 'totalTargetPop' | 'avgRate' | 'totalCompletion' | 'courseCount'>('totalEmployment');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [ncsSortKey, setNcsSortKey] = useState<'totalEmployment' | 'totalTargetPop' | 'avgRate' | 'totalCompletion' | 'courseCount'>('totalEmployment');
  const [ncsSortOrder, setNcsSortOrder] = useState<'asc' | 'desc'>('desc');

  // API에서 데이터 로드
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await kdtAPI.getCourseAnalysis({
          year: selectedYear || undefined,
        });
        
        if (cancelled) return;
        
        setCourses(res.data ?? []);
        setError(null);
      } catch (err) {
        console.error('API 호출 실패:', err);
        if (cancelled) return;
        setCourses([]);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  // 연도 목록 추출
  const yearList = useMemo(() => {
    const years = new Set<number>();
    for (const course of courses) {
      let y: number | null = null;
      
      if (yearType === 'ended') {
        const endDate = new Date(course.과정종료일);
        y = endDate.getFullYear();
      } else {
        const startDate = new Date(course.과정시작일);
        y = startDate.getFullYear();
      }
      
      if (Number.isFinite(y)) {
        years.add(y);
      }
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [courses, yearType]);

  // 필터링된 데이터 (연도/기준 기준)
  // institution-analysis와 동일하게: 성숙도/기간/0 제외 필터 없이 연도만 적용
  const summaryCourses = useMemo(() => {
    return courses.filter((course) => {
      if (selectedYear === null) return true;

      const dateStr = yearType === 'ended' ? course.과정종료일 : course.과정시작일;
      if (!dateStr) return false;

      const y = new Date(dateStr).getFullYear();
      return Number.isFinite(y) && y === selectedYear;
    });
  }, [courses, selectedYear, yearType]);

  // 상단 통계 계산 (institution-analysis aggregation.ts 로직과 동일)
  const totalCompletedStudents = useMemo(
    () => summaryCourses.reduce((sum, course) => sum + (Number(course['수료인원']) || 0), 0),
    [summaryCourses]
  );

  const { totalTargetPop, totalEmployment } = useMemo(() => {
    let targetSum = 0;
    let employedSum = 0;
    summaryCourses.forEach((course) => {
      const empData = getEmploymentDataByPeriod(course, periodOption);
      if (!empData || empData.targetPop <= 0) return;
      targetSum += empData.targetPop;
      employedSum += empData.employed;
    });
    return { totalTargetPop: targetSum, totalEmployment: employedSum };
  }, [summaryCourses, periodOption]);

  const avgEmploymentRate = useMemo(
    () => (totalTargetPop > 0 ? (totalEmployment / totalTargetPop) * 100 : 0),
    [totalEmployment, totalTargetPop]
  );

  // 훈련기관별 취업률 통계 (institution-analysis aggregation.ts와 동일 로직)
  const calculateInstitutionStats = (): EmploymentStats[] => {
    const institutionMap = new Map<string, {
      totalEmployment: number;
      totalTargetPop: number;
      avgRate: number;
      courseCount: number;
      totalCompletion: number;
    }>();

    summaryCourses.forEach((course) => {
      const trainingGroup = groupInstitutionsAdvanced(String(course?.훈련기관 ?? ''));
      const partnerRaw = String(course?.leadingCompanyPartnerInstitution ?? course?.파트너기관 ?? '').trim();
      const partnerGroup = partnerRaw ? groupInstitutionsAdvanced(partnerRaw) : undefined;
      const isLeadingWithPartner = Boolean(course?.isLeadingCompanyCourse && partnerRaw);
      const instName = isLeadingWithPartner && partnerGroup ? partnerGroup : trainingGroup;
      if (!instName) return;

      if (!institutionMap.has(instName)) {
        institutionMap.set(instName, {
          totalEmployment: 0,
          totalTargetPop: 0,
          avgRate: 0,
          courseCount: 0,
          totalCompletion: 0,
        });
      }

      const inst = institutionMap.get(instName)!;
      inst.courseCount += 1;

      const empData = getEmploymentDataByPeriod(course, periodOption);
      if (!empData || empData.targetPop <= 0) return;

      inst.totalEmployment += empData.employed;
      inst.totalTargetPop += empData.targetPop;
      inst.totalCompletion += empData.targetPop;
    });

    institutionMap.forEach((inst) => {
      inst.avgRate = inst.totalTargetPop > 0 ? (inst.totalEmployment / inst.totalTargetPop) * 100 : 0;
    });

    return Array.from(institutionMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .filter((item) => item.totalTargetPop > 0);
  };

  const institutionStats = useMemo(
    () => calculateInstitutionStats(),
    [summaryCourses, periodOption]
  );

  // NCS별 취업률 통계 (institution-analysis와 동일 로직)
  const calculateNcsStats = (): NcsStats[] => {
    const ncsMap = new Map<string, {
      totalEmployment: number;
      totalTargetPop: number;
      totalCompletion: number;
      avgRate: number;
      courseCount: number;
    }>();

    summaryCourses.forEach((course) => {
      const ncsName = course.NCS명 || '미분류';

      if (!ncsMap.has(ncsName)) {
        ncsMap.set(ncsName, {
          totalEmployment: 0,
          totalTargetPop: 0,
          totalCompletion: 0,
          avgRate: 0,
          courseCount: 0,
        });
      }

      const ncs = ncsMap.get(ncsName)!;
      ncs.courseCount += 1;

      const empData = getEmploymentDataByPeriod(course, periodOption);
      if (!empData || empData.targetPop <= 0) return;

      ncs.totalEmployment += empData.employed;
      ncs.totalTargetPop += empData.targetPop;
      ncs.totalCompletion += empData.targetPop;
    });

    ncsMap.forEach((ncs) => {
      ncs.avgRate = ncs.totalTargetPop > 0 ? (ncs.totalEmployment / ncs.totalTargetPop) * 100 : 0;
    });

    return Array.from(ncsMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .filter((item) => item.totalCompletion > 0)
      .sort((a, b) => b.totalEmployment - a.totalEmployment);
  };

  const ncsStats = useMemo(
    () => calculateNcsStats(),
    [summaryCourses, periodOption]
  );

  // 훈련기관별 정렬
  const sortedInstitutionStats = useMemo(() => {
    return [...institutionStats].sort((a, b) => {
      if (sortOrder === 'desc') {
        return b[sortKey] - a[sortKey];
      } else {
        return a[sortKey] - b[sortKey];
      }
    });
  }, [institutionStats, sortKey, sortOrder]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  // NCS 정렬
  const sortedNcsStats = useMemo(() => {
    return [...ncsStats].sort((a, b) => {
      if (ncsSortOrder === 'desc') {
        return b[ncsSortKey] - a[ncsSortKey];
      } else {
        return a[ncsSortKey] - b[ncsSortKey];
      }
    });
  }, [ncsStats, ncsSortKey, ncsSortOrder]);

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

      {/* 필터/옵션 UI */}
      <div className="flex flex-wrap gap-4 items-center mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">연도 선택</label>
          <select
            value={selectedYear ?? ''}
            onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
            className="px-2 py-1 border rounded"
          >
            <option value="">전체</option>
            {yearList.map((year) => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">기준 선택</label>
          <select
            value={yearType}
            onChange={(e) => setYearType(e.target.value as 'started' | 'ended')}
            className="px-2 py-1 border rounded"
          >
            <option value="started">시작된 과정 기준</option>
            <option value="ended">종료된 과정 기준</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">취업률 기준 선택</label>
          <div className="flex gap-4 pt-1">
            {(['3개월', '6개월'] as const).map((option) => (
              <label key={option} className="flex items-center">
                <input
                  type="radio"
                  value={option}
                  checked={periodOption === option}
                  onChange={(e) => setPeriodOption(e.target.value as '3개월' | '6개월')}
                  className="mr-2"
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 text-sm text-foreground bg-muted border border-border rounded px-4 py-2">
        ※ 취업률 기준 선택({periodOption})에 해당하는 데이터만 집계합니다.
        취업대상자(분모)는 취업인원 ÷ 취업률(%) 로 역산하며, 해당 기간 데이터가 없는 과정은 분모/분자에서 제외됩니다.
      </div>

      {/* 상단 통계 */}
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

      {/* 훈련기관별 취업률 표 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">훈련기관별 취업인원/취업률/취업대상 인원/과정수 정렬</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">순위</th>
                <th className="px-4 py-2 text-left">훈련기관</th>
                <th
                  className="px-4 py-2 text-right cursor-pointer"
                  onClick={() => handleSort('avgRate')}
                >
                  평균 취업률 {sortKey === 'avgRate' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th
                  className="px-4 py-2 text-right cursor-pointer"
                  onClick={() => handleSort('totalEmployment')}
                >
                  총 취업인원 {sortKey === 'totalEmployment' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th
                  className="px-4 py-2 text-right cursor-pointer"
                  onClick={() => handleSort('totalCompletion')}
                >
                  총 취업대상 인원 {sortKey === 'totalCompletion' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th
                  className="px-4 py-2 text-right cursor-pointer"
                  onClick={() => handleSort('courseCount')}
                >
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

      {/* NCS별 취업률 표 */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">NCS별 취업인원 많은 순</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">순위</th>
                <th className="px-4 py-2 text-left">NCS명</th>
                <th
                  className="px-4 py-2 text-right cursor-pointer"
                  onClick={() => handleNcsSort('avgRate')}
                >
                  평균 취업률 {ncsSortKey === 'avgRate' ? (ncsSortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th
                  className="px-4 py-2 text-right cursor-pointer"
                  onClick={() => handleNcsSort('totalEmployment')}
                >
                  총 취업인원 {ncsSortKey === 'totalEmployment' ? (ncsSortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th
                  className="px-4 py-2 text-right cursor-pointer"
                  onClick={() => handleNcsSort('totalCompletion')}
                >
                  총 취업대상 인원 {ncsSortKey === 'totalCompletion' ? (ncsSortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th
                  className="px-4 py-2 text-right cursor-pointer"
                  onClick={() => handleNcsSort('courseCount')}
                >
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
}
