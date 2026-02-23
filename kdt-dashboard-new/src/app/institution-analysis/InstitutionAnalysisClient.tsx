'use client';

import { useEffect, useMemo, useState } from 'react';
import { kdtAPI, InstitutionStat } from '@/lib/api-client';
import type { RevenueMode } from '@/lib/backend/types';
import { formatNumber, formatRevenue } from '@/utils/formatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { groupInstitutionsAdvanced } from '@/lib/backend/institution-grouping';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function renderRateWithCount(numer: number, denom: number, digits: number = 1): string {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) {
    return '-';
  }
  const rate = (numer / denom) * 100;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  return `${safeRate.toFixed(digits)}% (${formatNumber(numer)}/${formatNumber(denom)})`;
}

export default function InstitutionAnalysisClient() {
  const [institutionStats, setInstitutionStats] = useState<InstitutionStat[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [filterType, setFilterType] = useState<'all' | 'leading' | 'tech'>('all');
  const [revenueMode, setRevenueMode] = useState<RevenueMode>('current');
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstitutionName, setSelectedInstitutionName] = useState<string>('');
  const [selectedInstitutionCourses, setSelectedInstitutionCourses] = useState<any[]>([]);

  const [availableYears] = useState<number[]>(() =>
    Array.from({ length: new Date().getFullYear() - 2020 }, (_, i) => 2021 + i)
  );
  const [availableMonths, setAvailableMonths] = useState<number[]>(() =>
    Array.from({ length: 12 }, (_, i) => i + 1)
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const yearParam = selectedYear === 'all' ? undefined : selectedYear;
        const monthParam = selectedMonth === 'all' ? undefined : selectedMonth;
        const res = await kdtAPI.getInstitutionStats(yearParam, revenueMode, {
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

    return [...base].sort((a, b) => (b.total_revenue ?? 0) - (a.total_revenue ?? 0));
  }, [searchTerm, institutionStats]);

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

    let completionDenom = 0;
    let completionNumer = 0;
    let employmentDenom = 0;
    let employmentNumer = 0;

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
      const employed =
        Number(c?.['취업인원 (6개월)'] ?? 0) ||
        Number(c?.['취업인원 (3개월)'] ?? 0) ||
        Number(c?.취업인원 ?? 0) ||
        0;
      const satisfaction = Number(c?.만족도 ?? 0) || 0;
      const revenue = Number(c?.총누적매출 ?? c?.누적매출 ?? 0) || 0;

      enrolledSum += enrolled;
      capacitySum += capacity;
      completedSum += completed;
      employedSum += employed;
      revenueSum += revenue;

      if (enrolled > 0 && completed > 0) {
        completionDenom += enrolled;
        completionNumer += completed;
        employmentDenom += completed;
        employmentNumer += employed;
      }

      if (satisfaction > 0 && completed > 0) {
        satSum += satisfaction * completed;
        satWeight += completed;
      }
    }

    const avgSatisfaction = satWeight > 0 ? satSum / satWeight : 0;

    return {
      ongoingCourses,
      totalSessions,
      capacitySum,
      enrolledSum,
      completedSum,
      employedSum,
      revenueSum,
      recruitmentStr: renderRateWithCount(enrolledSum, capacitySum, 1),
      completionStr: renderRateWithCount(completionNumer, completionDenom, 1),
      employmentStr: renderRateWithCount(employmentNumer, employmentDenom, 1),
      avgSatisfaction,
    };
  }, [selectedInstitutionCourses, selectedInstitutionName]);

  const handleViewDetails = (institutionName: string) => {
    setSelectedInstitutionName(institutionName);
    const stat = institutionStats.find((s) => s.institution_name === institutionName);
    setSelectedInstitutionCourses(stat?.courses ?? []);
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-6 text-foreground">훈련기관별 분석</h1>

      <div className="mb-10 relative z-10 flex gap-6 items-end">
        <div>
          <label className="block text-sm font-medium text-foreground/80 mb-2">매출 기준</label>
          <Select value={revenueMode} onValueChange={(v) => setRevenueMode(v as RevenueMode)}>
            <SelectTrigger className="w-[200px] bg-background text-foreground border-border">
              <SelectValue placeholder="매출 기준" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground z-20">
              <SelectItem value="current">현재 계산된 매출</SelectItem>
              <SelectItem value="max">최대 매출</SelectItem>
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

      <div className="mb-4 text-sm text-foreground bg-muted border border-border rounded px-4 py-2">
        ※ 과정이 2개년도에 걸쳐있는 경우, 각 년도에 차지하는 비율에 맞추어 매출이 분배됩니다.
      </div>

      <div className="bg-card text-card-foreground rounded-lg shadow p-6 mt-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">훈련기관별 매출액 (억원)</h3>
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
                formatter={(value: number) => [formatRevenue(value), '매출액']}
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
              <Bar dataKey="total_revenue" fill="#4F46E5" name="매출액" />
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
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">매출액</th>
                {selectedMonth !== 'all' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">수주 금액(매출 최대)</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">훈련과정 수</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">훈련생 수</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">수료인원</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">수료율</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">취업율</th>
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
                  <td className="px-6 py-4 whitespace-nowrap">{formatRevenue(stat.total_revenue)}</td>
                  {selectedMonth !== 'all' && (
                    <td className="px-6 py-4 whitespace-nowrap">{formatRevenue(stat.total_max_revenue ?? 0)}</td>
                  )}
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
              선택된 훈련기관의 {selectedYear === 'all' ? '모든' : `${selectedYear}년`} 훈련과정 목록입니다.
              (매출액 기준 내림차순 정렬)
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
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
                <div className="text-sm text-muted-foreground">평균 취업률</div>
                <div className="text-lg font-semibold text-foreground">{selectedInstitutionKpis.employmentStr}</div>
              </div>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">합계 매출액</div>
                <div className="text-lg font-semibold text-foreground">{formatRevenue(selectedInstitutionKpis.revenueSum)}</div>
              </div>
              <div className="bg-muted p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">평균 만족도</div>
                <div className="text-lg font-semibold text-foreground">{Number.isFinite(selectedInstitutionKpis.avgSatisfaction) ? selectedInstitutionKpis.avgSatisfaction.toFixed(1) : '-'}</div>
              </div>
            </div>

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
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[12%]">취업률</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">매출액</th>
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
                        const employed =
                          Number(course?.['취업인원 (6개월)'] ?? 0) ||
                          Number(course?.['취업인원 (3개월)'] ?? 0) ||
                          Number(course?.취업인원 ?? 0) ||
                          0;
                        const satisfaction = Number(course?.만족도 ?? 0) || 0;
                        const revenue = Number(course?.총누적매출 ?? course?.누적매출 ?? 0) || 0;

                        const recruitStr = renderRateWithCount(enrolled, capacity, 1);
                        const completionStr = renderRateWithCount(completed, enrolled, 1);
                        const employmentStr = renderRateWithCount(employed, completed, 1);

                        return (
                          <>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-foreground">{course?.과정명 ?? '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{course?.훈련유형 ?? '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{recruitStr}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{formatNumber(enrolled)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{formatNumber(completed)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{completionStr}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{employmentStr}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{formatRevenue(revenue)}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{satisfaction > 0 ? satisfaction.toFixed(1) : '-'}</td>
                          </>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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