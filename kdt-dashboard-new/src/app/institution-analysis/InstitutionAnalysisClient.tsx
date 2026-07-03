'use client';

import { useEffect, useMemo, useState } from 'react';
import { kdtAPI, InstitutionStat } from '@/lib/api-client';
import { getSafeEmploymentData } from '@/lib/data-utils';
import type { RevenueMode } from '@/lib/backend/types';
import { formatNumber, formatRevenue } from '@/utils/formatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, CartesianGrid } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { groupInstitutionsAdvanced } from '@/lib/backend/institution-grouping';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ViewRevenueMode = RevenueMode | 'contract';

function renderRateWithCount(numer: number | null, denom: number | null, digits: number = 1): string {
  // null 체크: 데이터 없음 vs 계산 실패
  if (numer === null || denom === null) {
    return '- / -'; // 계산 실패
  }
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) {
    return '-';
  }
  const rate = (numer / denom) * 100;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  return `${safeRate.toFixed(digits)}% (${formatNumber(numer)}/${formatNumber(denom)})`;
}

// ★ 의존성 없는 hover 툴팁. 헤더 옆 ⓘ 아이콘에 사용.
function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group align-middle ml-1">
      <span
        role="img"
        aria-label="설명"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-muted-foreground/50 text-muted-foreground text-[10px] leading-none cursor-help select-none"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-2 text-xs font-normal normal-case tracking-normal text-popover-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

// ★ a(b/c) 표기 공통 설명 (훈련과정 수 / 훈련생 수 / 수료인원 공통)
const AB_NOTATION_TOOLTIP =
  'a(b/c) 표기 원칙 — a: 당해 검토 연도에 진행된 총 인원, b: 다른(이전) 연도에 개강한 인원, c: 당해 연도에 개강한 인원 (b+c=a)';

// ─────────────────────────────────────────────────────────────
// 과정 그룹핑 / 연도별 추이 헬퍼
// ─────────────────────────────────────────────────────────────

// 과정 시작일에서 연도 추출 (실패 시 null)
function extractCourseYear(course: any): number | null {
  const raw = String(course?.과정시작일 ?? '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isFinite(d.getTime())) return d.getFullYear();
  // 'YYYY' 패턴 fallback
  const m = raw.match(/(20\d{2})/);
  return m ? parseInt(m[1], 10) : null;
}

// 그룹 키: 훈련과정 ID 우선, 없으면 과정명. 같은 ID/과정명이면 한 과목으로 묶음.
function getCourseGroupKey(course: any): string {
  const id = String(course?.['훈련과정 ID'] ?? '').trim();
  if (id) return `ID:${id}`;
  const name = String(course?.과정명 ?? '').trim();
  return name ? `NAME:${name}` : 'UNKNOWN';
}

type CourseGroup = {
  key: string;
  courseName: string;
  courseId: string;
  sessionCount: number;      // 회차 수 (묶인 과정 수)
  enrolledSum: number;       // 훈련생(수강신청) 합
  completedSum: number;      // 수료인원 합
  targetPopSum: number;      // 취업대상 합
  employedSum: number;       // 취업 합
  revenueSum: number;        // 매출 합 (선택 기준)
  years: number[];           // 개강 연도 목록 (오름차순 유니크)
};

// 연도별 추이 한 지점
type TrendPoint = {
  year: number;
  contractRevenue: number;   // 수주매출(=매출 최대 합)
  maxRevenue: number;        // 최대매출(총누적매출 합)
  students: number;          // 훈련생 수 합
};

export default function InstitutionAnalysisClient() {
  const [institutionStats, setInstitutionStats] = useState<InstitutionStat[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [filterType, setFilterType] = useState<'all' | 'leading' | 'tech'>('all');
  const [revenueMode, setRevenueMode] = useState<ViewRevenueMode>('current');
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstitutionName, setSelectedInstitutionName] = useState<string>('');
  const [selectedInstitutionCourses, setSelectedInstitutionCourses] = useState<any[]>([]);

  // ★ 모달: 전체 연도(2021~현재) course — 추이 차트/그룹핑용 (대시보드 필터와 독립)
  const [allYearCourses, setAllYearCourses] = useState<any[]>([]);
  const [isModalDataLoading, setIsModalDataLoading] = useState(false);
  // ★ 그룹핑 토글: false=개별 과정 테이블, true=과정 묶음(그룹) 테이블
  const [isGroupedView, setIsGroupedView] = useState(false);

  const [availableYears] = useState<number[]>(() =>
    Array.from({ length: new Date().getFullYear() - 2020 }, (_, i) => 2021 + i)
  );
  const [availableMonths, setAvailableMonths] = useState<number[]>(() =>
    Array.from({ length: 12 }, (_, i) => i + 1)
  );

  // ★ contract 모드 여부를 한 곳에서 파생 (테이블/차트/상세 보기가 동일 기준을 공유하도록)
  // ★ 매출 기준(current / max / contract)에 따른 표시 파생값을 한 곳에서 결정
  const isContractMode = revenueMode === 'contract';
  const revenueDataKey: keyof InstitutionStat =
    isContractMode ? 'total_contract_revenue' : 'total_revenue';
  const revenueColumnLabel =
    revenueMode === 'contract'
      ? '수주 매출'
      : revenueMode === 'max'
        ? '최대 매출'
        : '매출액';
  // 매출 기준 설명 (모달 안내 배너용)
  const revenueModeDescription =
    revenueMode === 'contract'
      ? '해당 연도에 실제 수주받은 물량의 총액 (수주 시점 전액 귀속)'
      : revenueMode === 'max'
        ? '연도별 매출을 구분하여 집계한 최대 매출'
        : '연도별 비율로 분배된 현재 계산 매출';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const yearParam = selectedYear === 'all' ? undefined : selectedYear;
        const monthParam = selectedMonth === 'all' ? undefined : selectedMonth;
        const apiRevenueMode: RevenueMode = revenueMode === 'contract' ? 'max' : revenueMode;
        const res = await kdtAPI.getInstitutionStats(yearParam, apiRevenueMode, {
          month: monthParam,
          trainingType: filterType,
        });
        if (cancelled) return;
        setInstitutionStats(res.data ?? []);
        if (Array.isArray((res as any)?.meta?.available_months) && (res as any).meta.available_months.length > 0) {
          setAvailableMonths((res as any).meta.available_months);
        } else {
          setAvailableMonths(Array.from({ length: 12 }, (_, i) => i + 1));
        }
      } catch (error) {
        console.error('기관별 통계 API 호출 실패:', error);
        if (cancelled) return;
        setInstitutionStats([]);
        setAvailableMonths(Array.from({ length: 12 }, (_, i) => i + 1));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedYear, selectedMonth, filterType, revenueMode]);

  const filteredInstitutionStats = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = !q
      ? institutionStats
      : institutionStats.filter((s) => s.institution_name.toLowerCase().includes(q));

    const sortKey: keyof InstitutionStat =
      revenueMode === 'contract' ? 'total_contract_revenue' : 'total_revenue';
    return [...base].sort(
      (a, b) => ((b[sortKey] as number) ?? 0) - ((a[sortKey] as number) ?? 0)
    );
  }, [searchTerm, institutionStats, revenueMode]);

  const selectedInstitutionKpis = useMemo(() => {
    const institution = selectedInstitutionName;
    const courses = selectedInstitutionCourses;
    const today = new Date();

    let ongoingCourses = 0;
    let totalSessions = 0;
    let capacitySum = 0;
    let enrolledSum = 0;
    let completedSum = 0;
    let employedSum = 0;
    let revenueSum = 0;
    let contractRevenueSum = 0;

    let targetPopSum = 0;
    let integratedEmployedSum = 0;

    let completionDenom = 0;
    let completionNumer = 0;

    let satWeight = 0;
    let satSum = 0;

    for (const c of courses) {
      const trainingGroup = groupInstitutionsAdvanced(String(c?.훈련기관 ?? ''));
      const partnerRaw = String(c?.leadingCompanyPartnerInstitution ?? c?.파트너기관 ?? '').trim();
      const partnerGroup = partnerRaw ? groupInstitutionsAdvanced(partnerRaw) : undefined;
      const isLeadingWithPartner = Boolean(c?.isLeadingCompanyCourse && partnerRaw);

      const belongsForCounts = isLeadingWithPartner
        ? partnerGroup === institution
        : trainingGroup === institution;
      if (!belongsForCounts) continue;

      totalSessions += 1;
      const start = new Date(String(c?.과정시작일 ?? ''));
      const end = new Date(String(c?.과정종료일 ?? ''));
      if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
        if (start <= today && end >= today) {
          ongoingCourses += 1;
        }
      }

      const enrolled = Number(c?.['수강신청 인원'] ?? 0) || 0;
      const capacity = Number(c?.정원 ?? 0) || 0;
      const completed = Number(c?.수료인원 ?? 0) || 0;
      // ★ 반드시 getSafeEmploymentData에서 반환된 값을 사용
      const empData = getSafeEmploymentData(c);
      const { employed: integratedEmployed, targetPop } = empData;
      const satisfaction = Number(c?.만족도 ?? 0) || 0;
      const revenue = Number(c?.총누적매출 ?? c?.누적매출 ?? 0) || 0;
      // ★ 수주 매출: '매출 최대' 필드 사용 (분배 없이 수주 시점 전액). 없으면 매출액으로 대체
      const contractRevenue = Number(c?.['매출 최대'] ?? c?.총누적매출 ?? c?.누적매출 ?? 0) || 0;

      enrolledSum += enrolled;
      capacitySum += capacity;
      completedSum += completed;
      employedSum += integratedEmployed;
      revenueSum += revenue;
      contractRevenueSum += contractRevenue;
      if (typeof targetPop === 'number' && Number.isFinite(targetPop) && targetPop > 0) {
        targetPopSum += targetPop;
        integratedEmployedSum += integratedEmployed;
      }

      if (enrolled > 0 && completed > 0) {
        completionDenom += enrolled;
        completionNumer += completed;
      }

      if (satisfaction > 0 && completed > 0) {
        satSum += satisfaction * completed;
        satWeight += completed;
      }
    }

    const avgSatisfaction = satWeight > 0 ? satSum / satWeight : 0;

    // ★ 명제 1 적용: targetPop이 0이거나 유효하지 않으면 0/0으로 표시 ★
    const displayTargetPop = (typeof targetPopSum === 'number' && targetPopSum > 0) ? targetPopSum : 0;
    const displayEmployed = (typeof integratedEmployedSum === 'number' && integratedEmployedSum > 0) ? integratedEmployedSum : 0;
    const employmentStr = 
      displayTargetPop > 0
        ? renderRateWithCount(displayEmployed, displayTargetPop, 1)
        : `0.0% (${displayEmployed}/${displayTargetPop})`;

    return {
      ongoingCourses,
      totalSessions,
      capacitySum,
      enrolledSum,
      completedSum,
      employedSum,
      revenueSum,
      contractRevenueSum,
      recruitmentStr: renderRateWithCount(enrolledSum, capacitySum, 1),
      completionStr: renderRateWithCount(completionNumer, completionDenom, 1),
      employmentStr,
      avgSatisfaction,
    };
  }, [selectedInstitutionCourses, selectedInstitutionName]);

  // ★ 연도별 추이 (전체 기간): 수주매출 / 최대매출 / 훈련생 수 3선
  const institutionYearlyTrend = useMemo<TrendPoint[]>(() => {
    const byYear = new Map<number, TrendPoint>();
    for (const c of allYearCourses) {
      const y = extractCourseYear(c);
      if (y === null) continue;
      const point = byYear.get(y) ?? { year: y, contractRevenue: 0, maxRevenue: 0, students: 0 };
      // 수주매출 = 매출 최대(수주 시점 전액). 최대매출 = 총누적매출(=백엔드 max 집계값)
      point.contractRevenue += Number(c?.['매출 최대'] ?? 0) || 0;
      point.maxRevenue += Number(c?.총누적매출 ?? c?.누적매출 ?? 0) || 0;
      point.students += Number(c?.['수강신청 인원'] ?? 0) || 0;
      byYear.set(y, point);
    }
    return Array.from(byYear.values()).sort((a, b) => a.year - b.year);
  }, [allYearCourses]);

  // ★ 과정 그룹핑 (전체 기간): 훈련과정 ID 우선, 없으면 과정명으로 묶음. 매출 높은 순.
  const institutionCourseGroups = useMemo<CourseGroup[]>(() => {
    const byKey = new Map<string, CourseGroup>();
    for (const c of allYearCourses) {
      const key = getCourseGroupKey(c);
      const g =
        byKey.get(key) ??
        ({
          key,
          courseName: String(c?.과정명 ?? '-'),
          courseId: String(c?.['훈련과정 ID'] ?? ''),
          sessionCount: 0,
          enrolledSum: 0,
          completedSum: 0,
          targetPopSum: 0,
          employedSum: 0,
          revenueSum: 0,
          years: [],
        } as CourseGroup);

      g.sessionCount += 1;
      g.enrolledSum += Number(c?.['수강신청 인원'] ?? 0) || 0;
      g.completedSum += Number(c?.수료인원 ?? 0) || 0;

      const emp = getSafeEmploymentData(c);
      if (typeof emp.targetPop === 'number' && Number.isFinite(emp.targetPop) && emp.targetPop > 0) {
        g.targetPopSum += emp.targetPop;
        g.employedSum += emp.employed;
      }

      // 매출: 선택 기준(수주=매출 최대 / 그 외=총누적매출)
      const rev = isContractMode
        ? Number(c?.['매출 최대'] ?? c?.총누적매출 ?? c?.누적매출 ?? 0) || 0
        : Number(c?.총누적매출 ?? c?.누적매출 ?? 0) || 0;
      g.revenueSum += rev;

      const y = extractCourseYear(c);
      if (y !== null && !g.years.includes(y)) g.years.push(y);

      byKey.set(key, g);
    }
    const groups = Array.from(byKey.values());
    groups.forEach((g) => g.years.sort((a, b) => a - b));
    // 매출 높은 순 정렬
    return groups.sort((a, b) => b.revenueSum - a.revenueSum);
  }, [allYearCourses, isContractMode]);

  const handleViewDetails = async (institutionName: string) => {
    setSelectedInstitutionName(institutionName);
    setIsGroupedView(false); // 열 때마다 개별 뷰로 초기화

    // 현재 대시보드 필터 기준 course (KPI 카드 계산에 계속 사용)
    const stat = institutionStats.find((s) => s.institution_name === institutionName);
    const courses = stat?.courses ?? [];
    setSelectedInstitutionCourses(courses);
    setIsModalOpen(true);

    // ★ 방법 A: 전체 연도(2021~현재) 데이터를 별도 요청 — 추이 차트/그룹핑용
    //   대시보드 연도 필터와 독립적으로 항상 전체 기간을 확보한다.
    //   getInstitutionStats는 특정 기관 필터 파라미터가 없으므로 전체를 받아 find로 골라낸다.
    setIsModalDataLoading(true);
    setAllYearCourses([]);
    try {
      const apiRevenueMode: RevenueMode = revenueMode === 'contract' ? 'max' : revenueMode;
      const res = await kdtAPI.getInstitutionStats(undefined, apiRevenueMode, {
        month: undefined,
        trainingType: filterType,
      });
      const list = (res?.data ?? []) as InstitutionStat[];
      const matched = list.find((s) => s.institution_name === institutionName);
      setAllYearCourses((matched?.courses ?? []) as any[]);
    } catch (error) {
      console.error('전체 연도 상세 데이터 로드 실패:', error);
      // 실패 시 현재 필터 course로라도 추이/그룹을 구성 (부정확할 수 있으나 빈 화면 방지)
      setAllYearCourses(courses);
    } finally {
      setIsModalDataLoading(false);
    }
  };

  return (
    <div className="p-6 bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-6 text-foreground">훈련기관별 분석</h1>

      <div className="mb-10 relative z-10 flex gap-6 items-end">
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-2">매출 기준</label>
          <Select value={revenueMode} onValueChange={(v) => setRevenueMode(v as ViewRevenueMode)}>
            <SelectTrigger className="w-[200px] bg-background text-foreground border-border">
              <SelectValue placeholder="매출 기준" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground z-20">
              <SelectItem value="current">현재 계산된 매출</SelectItem>
              <SelectItem value="max">최대 매출</SelectItem>
              <SelectItem value="contract">수주 매출</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-2">연도 선택</label>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(value === 'all' ? 'all' : parseInt(value))}
          >
            <SelectTrigger className="w-[180px] bg-background text-foreground border-border">
              <SelectValue placeholder="연도 선택" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground z-20">
              <SelectItem value="all">전체 연도</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-2">월 선택</label>
          <Select
            value={selectedMonth.toString()}
            onValueChange={(value) => setSelectedMonth(value === 'all' ? 'all' : parseInt(value))}
          >
            <SelectTrigger className="w-[180px] bg-background text-foreground border-border">
              <SelectValue placeholder="월 선택" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground z-20">
              <SelectItem value="all">전체 월</SelectItem>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={String(m)}>{m}월</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-2">유형 필터</label>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="w-[200px] bg-background text-foreground border-border">
              <SelectValue placeholder="유형 선택" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground z-20">
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="leading">선도기업 과정만</SelectItem>
              <SelectItem value="tech">신기술 과정만</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="search" className="block text-sm font-medium text-foreground/80 mb-2">훈련기관 검색</label>
          <input
            id="search"
            type="text"
            placeholder="기관명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-[200px] bg-background text-foreground p-2 border border-border rounded-md placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="mb-4 text-sm text-foreground bg-muted border border-border rounded px-4 py-2 space-y-1">
        <div>※ 매출액: 과정이 2개년도에 걸쳐있는 경우, 각 년도에 차지하는 비율에 맞추어 매출이 분배됩니다.</div>
        <div>※ 수주 매출: 과정시작일(=위탁계약 수주 시점)이 선택 연·월에 속한 과정의 매출 최대 합계입니다. 분배되지 않고 수주 연도에 전액 귀속됩니다.</div>
      </div>

      <div className="bg-card text-card-foreground rounded-lg shadow p-6 mt-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          훈련기관별 {revenueColumnLabel} (억원)
        </h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredInstitutionStats.slice(0, 10)}>
              <XAxis
                dataKey="institution_name"
                angle={0}
                textAnchor="middle"
                height={100}
                tick={{ fontSize: 14 }}
                interval={0}
                tickFormatter={(value: string, index: number) => {
                  const rank = index + 1;
                  let displayValue = `${value}`;
                  if (value === '주식회사 코드스테이츠') {
                    displayValue += ' (2023년 감사를 통해 훈련비 전액 반환)';
                  }
                  if (displayValue.length > 15) {
                    displayValue = displayValue.substring(0, 12) + '...';
                  }
                  return `🏅 ${rank}위\n${displayValue}`;
                }}
                dy={20}
              />
              <YAxis tickFormatter={formatRevenue} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => [formatRevenue(value), revenueColumnLabel]}
                labelFormatter={(label) => {
                  let institutionName = label
                    .replace(/\d+\. /, '')
                    .replace(/ \(2023년 감사를 통해 훈련비 전액 반환\)/, '');
                  if (institutionName === '주식회사 코드스테이츠') {
                    return `기관명: ${institutionName} (2023년 감사를 통해 훈련비 전액 반환)`;
                  }
                  return `기관명: ${institutionName}`;
                }}
              />
              <Bar
                dataKey={revenueDataKey}
                fill="#4F46E5"
                name={revenueColumnLabel}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {selectedYear !== 'all' && (
        <div className="mb-4 text-sm text-muted-foreground bg-muted border border-border rounded px-4 py-3">
          <div>* 수료율은 과정 종료일 기준으로 계산하였으며, 분자는 {selectedYear}년 기준 {selectedYear}년의 수료생, 분모는 {selectedYear}년 기준 {selectedYear}년에 끝나는 과정이 있는 모든 과정의 입과생입니다.</div>
          <div>* ()는 전 해년 입과, 당 해년 수료 인원을 표기하였습니다.</div>
        </div>
      )}

      <div className="bg-card text-card-foreground rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">순위 및 훈련기관</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  {revenueColumnLabel} ▼
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">훈련과정 수</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  훈련생 수<InfoTooltip text={AB_NOTATION_TOOLTIP} />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  수료인원<InfoTooltip text={AB_NOTATION_TOOLTIP} />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">수료율</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">취업대상자 대비 취업률</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">평균 만족도</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">상세</th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredInstitutionStats.map((stat, index) => (
                <tr key={stat.institution_name}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="ml-4">
                        <div className="text-sm font-medium text-foreground">
                          {index + 1}. {stat.institution_name}
                          {stat.institution_name === '주식회사 코드스테이츠' && (
                            <span className="ml-2 text-xs text-red-600">(2023년 감사를 통해 훈련비 전액 반환)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-foreground">
                    {isContractMode
                      ? formatRevenue(stat.total_contract_revenue ?? 0)
                      : selectedMonth !== 'all' && Number.isFinite(stat.expected_attribution_percent)
                        ? `${formatRevenue(stat.total_revenue)} (${(stat.expected_attribution_percent ?? 0).toFixed(1)}%)`
                        : formatRevenue(stat.total_revenue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{stat.total_courses_display}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{stat.total_students_display}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{stat.completed_students_display}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{stat.completion_rate_detail}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{stat.employment_rate_detail}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{Number.isFinite(stat.avg_satisfaction) ? stat.avg_satisfaction.toFixed(1) : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewDetails(stat.institution_name)}
                        className="text-indigo-600 hover:text-indigo-900"
                        style={{
                          backgroundColor: '#E0E7FF',
                          color: '#4338CA',
                          fontWeight: '500',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.375rem',
                          border: '1px solid #C7D2FE'
                        }}
                      >
                        상세 보기
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="mx-auto max-w-[90vw] max-h-[90vh] w-full bg-white dark:bg-[#1E1E1E] text-gray-950 dark:text-[#F5F5F5] rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] p-0 overflow-y-auto border-2 border-gray-400 dark:border-gray-600">
          <DialogHeader className="p-6 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-950 dark:text-gray-100">
              {selectedInstitutionName} - 훈련과정 상세
              {selectedYear !== 'all' && ` (${selectedYear}년)`}
            </DialogTitle>
            <DialogDescription className="text-gray-700 dark:text-gray-400">
              {selectedInstitutionName}의 전체 기간 훈련과정과 연도별 추이입니다.
              ({revenueColumnLabel} 기준 내림차순 정렬)
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            {/* ★ 상세 보기 매출 기준 안내: 대시보드에서 선택한 매출 기준을 명시 */}
            <div className="mb-4 text-sm text-muted-foreground bg-muted border border-border rounded px-4 py-2">
              현재 <span className="font-semibold text-foreground">{revenueColumnLabel}</span> 기준으로 표시하고 있습니다. ({revenueModeDescription})
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <div className="bg-muted p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">운영 중인 과정 수</div>
                <div className="text-lg font-semibold text-foreground">{formatNumber(selectedInstitutionKpis.ongoingCourses)}</div>
              </div>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">전체 개강 회차수</div>
                <div className="text-lg font-semibold text-foreground">{formatNumber(selectedInstitutionKpis.totalSessions)}</div>
              </div>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">합계 정원</div>
                <div className="text-lg font-semibold text-foreground">{formatNumber(selectedInstitutionKpis.capacitySum)}</div>
              </div>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">평균 모집률</div>
                <div className="text-lg font-semibold text-foreground">{selectedInstitutionKpis.recruitmentStr}</div>
              </div>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">훈련생 수</div>
                <div className="text-lg font-semibold text-foreground">{formatNumber(selectedInstitutionKpis.enrolledSum)}</div>
              </div>

              <div className="bg-muted p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">수료인원</div>
                <div className="text-lg font-semibold text-foreground">{formatNumber(selectedInstitutionKpis.completedSum)}</div>
              </div>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">평균 수료율</div>
                <div className="text-lg font-semibold text-foreground">{selectedInstitutionKpis.completionStr}</div>
              </div>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">취업대상자 대비 취업률</div>
                <div className="text-lg font-semibold text-foreground">{selectedInstitutionKpis.employmentStr}</div>
              </div>
              {/* ★ 매출 기준(revenueMode)에 따라 합계 매출액 표시 값을 전환 */}
              <div className="bg-muted p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">합계 {revenueColumnLabel}</div>
                <div className="text-lg font-semibold text-foreground">
                  {formatRevenue(isContractMode ? selectedInstitutionKpis.contractRevenueSum : selectedInstitutionKpis.revenueSum)}
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">평균 만족도</div>
                <div className="text-lg font-semibold text-foreground">{Number.isFinite(selectedInstitutionKpis.avgSatisfaction) ? selectedInstitutionKpis.avgSatisfaction.toFixed(1) : '-'}</div>
              </div>
            </div>

            {/* ★ 연도별 추이 차트 (전체 기간 2021~현재): 수주매출 / 최대매출 / 훈련생 수 */}
            <div className="mb-6 bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-foreground">
                  연도별 추이 (전체 기간)
                </h4>
                <span className="text-xs text-muted-foreground">
                  좌축: 매출(억원) · 우축: 훈련생 수(명)
                </span>
              </div>
              {isModalDataLoading ? (
                <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                  전체 연도 데이터를 불러오는 중…
                </div>
              ) : institutionYearlyTrend.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                  추이를 표시할 데이터가 없습니다.
                </div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={institutionYearlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" tick={{ fontSize: 12 }} tickFormatter={(y) => `${y}년`} />
                      <YAxis
                        yAxisId="revenue"
                        tickFormatter={formatRevenue}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        yAxisId="students"
                        orientation="right"
                        tickFormatter={(v: number) => formatNumber(v)}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === '훈련생 수') return [formatNumber(value), name];
                          return [formatRevenue(value), name];
                        }}
                        labelFormatter={(label) => `${label}년`}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line
                        yAxisId="revenue"
                        type="monotone"
                        dataKey="contractRevenue"
                        name="수주매출"
                        stroke="#4F46E5"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        yAxisId="revenue"
                        type="monotone"
                        dataKey="maxRevenue"
                        name="최대매출"
                        stroke="#059669"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        yAxisId="students"
                        type="monotone"
                        dataKey="students"
                        name="훈련생 수"
                        stroke="#D97706"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* ★ 과정 그룹핑 토글: 개별 과정 ↔ 과정 묶음(그룹) */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-foreground">
                {isGroupedView ? '과정별 그룹 요약 (동일 과정 묶음)' : '개별 훈련과정 목록'}
              </h4>
              <div className="inline-flex rounded-md border border-border overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => setIsGroupedView(false)}
                  className={`px-3 py-1.5 ${!isGroupedView ? 'bg-indigo-600 text-white' : 'bg-background text-foreground hover:bg-muted'}`}
                >
                  개별 과정
                </button>
                <button
                  type="button"
                  onClick={() => setIsGroupedView(true)}
                  className={`px-3 py-1.5 border-l border-border ${isGroupedView ? 'bg-indigo-600 text-white' : 'bg-background text-foreground hover:bg-muted'}`}
                >
                  과정 묶음
                </button>
              </div>
            </div>

            {isModalDataLoading && isGroupedView ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                전체 연도 데이터를 불러오는 중…
              </div>
            ) : isGroupedView ? (
              // ─────────── 그룹핑 뷰 ───────────
              <div className="overflow-x-auto max-h-[65vh]">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[30%]">과정명</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">운영 연도</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[8%]">회차 수</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">훈련생 합</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">수료인원 합</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[12%]">수료율</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[12%]">취업대상자 대비 취업률</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">{revenueColumnLabel} 합</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {institutionCourseGroups.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                          묶을 과정 데이터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      institutionCourseGroups.map((g) => {
                        const completionStr = renderRateWithCount(g.completedSum, g.enrolledSum, 1);
                        const employmentStr =
                          g.targetPopSum > 0
                            ? renderRateWithCount(g.employedSum, g.targetPopSum, 1)
                            : '-';
                        const yearsLabel =
                          g.years.length === 0
                            ? '-'
                            : g.years.length === 1
                              ? `${g.years[0]}`
                              : `${g.years[0]}~${g.years[g.years.length - 1]}`;
                        return (
                          <tr key={g.key} className="hover:bg-muted">
                            <td className="px-4 py-2 text-sm text-foreground">
                              {g.courseName}
                              {g.courseId && (
                                <span className="ml-2 text-[10px] text-muted-foreground">ID:{g.courseId}</span>
                              )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{yearsLabel}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{formatNumber(g.sessionCount)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{formatNumber(g.enrolledSum)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{formatNumber(g.completedSum)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{completionStr}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{employmentStr}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{formatRevenue(g.revenueSum)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              // ─────────── 개별 과정 뷰 (기존) ───────────
              <div className="overflow-x-auto max-h-[65vh]">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[26%]">과정명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">훈련유형</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[12%]">모집률</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[8%]">훈련생</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[8%]">수료인원</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[12%]">수료율</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[12%]">취업대상자 대비 취업률</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">{revenueColumnLabel}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[8%]">만족도</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {selectedInstitutionCourses.map((course: any, idx: number) => (
                    <tr key={course?.고유값 ?? `${course?.['훈련과정 ID'] ?? 'course'}-${idx}`} className="hover:bg-muted">
                      {(() => {
                        const enrolled = Number(course?.['수강신청 인원'] ?? 0) || 0;
                        const capacity = Number(course?.정원 ?? 0) || 0;
                        const completed = Number(course?.수료인원 ?? 0) || 0;
                        const satisfaction = Number(course?.만족도 ?? 0) || 0;
                        // ★ 매출 기준에 따라 표시 값 전환 (대시보드와 동일 기준)
                        const revenue = Number(course?.총누적매출 ?? course?.누적매출 ?? 0) || 0;
                        const contractRevenue = Number(course?.['매출 최대'] ?? course?.총누적매출 ?? course?.누적매출 ?? 0) || 0;
                        const displayRevenue = isContractMode ? contractRevenue : revenue;

                        const recruitStr = renderRateWithCount(enrolled, capacity, 1);
                        const completionStr = renderRateWithCount(completed, enrolled, 1);

                        // ★ getSafeEmploymentData 단일 호출 (source 뱃지까지 한 번에 사용)
                        const { employed: safeEmployed, targetPop, source } = getSafeEmploymentData(course);
                        let employmentStr: string;
                        let sourceBadge: string = '';

                        if (targetPop === null) {
                          // 데이터 없음
                          employmentStr = '- / -';
                        } else if (targetPop > 0) {
                          // 정상 역산됨
                          employmentStr = renderRateWithCount(safeEmployed, targetPop, 1);
                          // 3개월 기준이면 뱃지 표시
                          if (source === '3개월') {
                            sourceBadge = ' 🏷️ 3개월';
                          }
                        } else {
                          employmentStr = '-';
                        }

                        employmentStr += sourceBadge;

                        return (
                          <>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-foreground">{course?.과정명 ?? '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{course?.훈련유형 ?? '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{recruitStr}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{formatNumber(enrolled)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{formatNumber(completed)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{completionStr}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{employmentStr}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{formatRevenue(displayRevenue)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{satisfaction > 0 ? satisfaction.toFixed(1) : '-'}</td>
                          </>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}

          </div>

          <div className="bg-muted px-6 py-3 flex justify-end border-t border-border">
            <button
              type="button"
              className="bg-background px-4 py-2 text-sm font-medium text-foreground border border-border rounded-md hover:bg-muted"
              onClick={() => setIsModalOpen(false)}
            >
              닫기
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
