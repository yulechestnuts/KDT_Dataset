'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { kdtAPI } from '@/lib/api-client';
import { groupInstitutionsAdvanced } from '@/lib/backend/institution-grouping';
import { useGlobalFilters } from '@/contexts/FilterContext';
import {
  AggregationStatus,
  EmploymentPeriod,
  EmploymentStandard,
  EmploymentTotals,
  STANDARD_LABELS,
  accumulate,
  benchmarkByGroup,
  emptyTotals,
  exclusionRate,
  finalize,
  formatStandardYear,
  getEmploymentBase,
  getSupportExpiryDate,
  listStandardYears,
  matchesStandardWindow,
} from '@/lib/employment-standards';

interface GroupRow extends EmploymentTotals {
  name: string;
  /** 펼쳐서 과정 단위로 볼 수 있도록 원본 과정을 들고 있는다 */
  courses: any[];
}

type SortKey = 'rate' | 'employed' | 'denominator' | 'remainingSupport' | 'courseCount';

const STATUS_LABELS: Record<AggregationStatus, string> = {
  confirmed: '확정',
  in_progress: '집계 중',
  not_started: '집계 전',
};

function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${rate.toFixed(1)}%`;
}

function sortValue(row: GroupRow, key: SortKey): number {
  if (key === 'rate') return row.rate ?? -1;
  return row[key];
}

function formatPoints(value: number | null): string {
  if (value === null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}p`;
}

function formatDate(raw: unknown): string {
  const s = String(raw ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s || '—';
}

/**
 * 취업률은 훈련기관에 귀속시킨다.
 *
 * 매출(institution-analysis / aggregation.ts)은 선도기업 과정을 파트너기관 쪽으로 90% 배분하지만,
 * 취업률에 같은 규칙을 쓰면 곤란하다. 수료생을 모집하고 취업까지 책임지는 주체는 훈련기관이라
 * 파트너기관 앞으로 취업률이 붙으면 성과의 임자가 뒤바뀐다.
 * 대신 선도기업 과정은 courseType 필터로 따로 떼어 볼 수 있게 한다.
 */
function resolveInstitution(course: any): string {
  return groupInstitutionsAdvanced(String(course?.훈련기관 ?? ''));
}

/** 선도기업 과정 여부 (파트너기관이 붙어 있으면 선도기업형) */
function isLeadingCourse(course: any): boolean {
  const partnerRaw = String(course?.leadingCompanyPartnerInstitution ?? course?.파트너기관 ?? '').trim();
  return Boolean(course?.isLeadingCompanyCourse) || (partnerRaw !== '' && partnerRaw !== '0');
}

type CourseType = 'all' | 'tech' | 'leading';

const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  all: '전체',
  tech: '일반 과정만',
  leading: '선도기업 과정만',
};

/** 집계된 과정만으로 합산 (격차 분해·추이용) */
function aggregateOf(courses: any[], period: EmploymentPeriod): EmploymentTotals {
  const totals = emptyTotals();
  for (const course of courses) {
    accumulate(totals, getEmploymentBase(course, period), false);
  }
  return finalize(totals);
}

function buildGroups(
  courses: any[],
  keyOf: (course: any) => string,
  period: EmploymentPeriod,
  includeUnaggregated: boolean
): GroupRow[] {
  const map = new Map<string, { totals: EmploymentTotals; courses: any[] }>();

  for (const course of courses) {
    const key = keyOf(course);
    if (!key) continue;
    if (!map.has(key)) map.set(key, { totals: emptyTotals(), courses: [] });
    const entry = map.get(key)!;
    entry.courses.push(course);
    accumulate(entry.totals, getEmploymentBase(course, period), includeUnaggregated);
  }

  return Array.from(map.entries()).map(([name, entry]) => ({
    name,
    courses: entry.courses,
    ...finalize(entry.totals),
  }));
}

export default function EmploymentAnalysisClient() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    filters: { periodOption },
    setPeriodOption,
  } = useGlobalFilters();

  // 고용노동부 평가 창은 회계연도(7월~익년 6월)라 역년 두 개에 걸친다.
  // 서버 year 필터는 역년 단위라 쓸 수 없어, 전체를 한 번 받아 클라이언트에서 자른다.
  const [standard, setStandard] = useState<EmploymentStandard>('course_review');
  const [standardYear, setStandardYear] = useState<number | null>(null);
  const [includeUnaggregated, setIncludeUnaggregated] = useState(false);
  const [courseType, setCourseType] = useState<CourseType>('all');

  /** 과정 목록을 펼쳐 놓은 기관명 */
  const [expanded, setExpanded] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('employed');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [ncsSortKey, setNcsSortKey] = useState<SortKey>('employed');
  const [ncsSortOrder, setNcsSortOrder] = useState<'asc' | 'desc'>('desc');

  /** 격차 분해 대상 기관. null 이면 패널을 접어 둔다. */
  const [benchmarkTarget, setBenchmarkTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await kdtAPI.getCourseAnalysis({});
        if (cancelled) return;
        setCourses(res.data ?? []);
        setError(null);
      } catch (err) {
        console.error('API 호출 실패:', err);
        if (cancelled) return;
        setCourses([]);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const yearOptions = useMemo(() => listStandardYears(courses, standard), [courses, standard]);

  // 기준을 바꾸면 회계연도/역년 번호 체계가 달라지므로 선택 연도를 되돌린다.
  useEffect(() => {
    setStandardYear(null);
  }, [standard]);

  const matchesCourseType = useMemo(
    () => (course: any) => {
      if (courseType === 'all') return true;
      return courseType === 'leading' ? isLeadingCourse(course) : !isLeadingCourse(course);
    },
    [courseType]
  );

  const scopedCourses = useMemo(
    () =>
      courses.filter(
        (course) => matchesStandardWindow(course, standard, standardYear) && matchesCourseType(course)
      ),
    [courses, standard, standardYear, matchesCourseType]
  );

  const totals = useMemo(() => {
    const acc = emptyTotals();
    for (const course of scopedCourses) {
      accumulate(acc, getEmploymentBase(course, periodOption), includeUnaggregated);
    }
    return finalize(acc);
  }, [scopedCourses, periodOption, includeUnaggregated]);

  const institutionRows = useMemo(
    () => buildGroups(scopedCourses, resolveInstitution, periodOption, includeUnaggregated).filter((r) => r.denominator > 0),
    [scopedCourses, periodOption, includeUnaggregated]
  );

  const ncsRows = useMemo(
    () =>
      buildGroups(scopedCourses, (c) => c.NCS명 || '미분류', periodOption, includeUnaggregated).filter(
        (r) => r.denominator > 0
      ),
    [scopedCourses, periodOption, includeUnaggregated]
  );

  // ── 격차 분해 ───────────────────────────────────────────────
  // 미집계 과정을 섞으면 "아직 안 나온 것"과 "못한 것"이 구분되지 않으므로
  // 이 패널만은 includeUnaggregated 와 무관하게 집계된 과정만 본다.
  const benchmarkCourses = useMemo(
    () => (benchmarkTarget ? scopedCourses.filter((c) => resolveInstitution(c) === benchmarkTarget) : []),
    [scopedCourses, benchmarkTarget]
  );

  const ncsBenchmark = useMemo(
    () =>
      benchmarkTarget
        ? benchmarkByGroup(benchmarkCourses, scopedCourses, (c) => c.NCS명 || '미분류', periodOption)
        : null,
    [benchmarkCourses, scopedCourses, benchmarkTarget, periodOption]
  );

  const benchmarkExclusion = useMemo(
    () => (benchmarkTarget ? exclusionRate(benchmarkCourses, periodOption) : null),
    [benchmarkCourses, benchmarkTarget, periodOption]
  );

  const overallExclusion = useMemo(
    () => (benchmarkTarget ? exclusionRate(scopedCourses, periodOption) : null),
    [scopedCourses, benchmarkTarget, periodOption]
  );

  /** 선택 기관의 연도별 추이 — 격차가 벌어지는 중인지 좁혀지는 중인지 */
  const benchmarkTrend = useMemo(() => {
    if (!benchmarkTarget) return [];
    return listStandardYears(courses, standard)
      .slice(0, 5)
      .sort((a, b) => a - b)
      .map((year) => {
        const yearCourses = courses.filter(
          (c) => matchesStandardWindow(c, standard, year) && matchesCourseType(c)
        );
        const target = yearCourses.filter((c) => resolveInstitution(c) === benchmarkTarget);
        const mine = aggregateOf(target, periodOption);
        const all = aggregateOf(yearCourses, periodOption);
        return {
          year,
          mineRate: mine.rate,
          allRate: all.rate,
          denominator: mine.denominator,
          courseCount: mine.courseCount,
        };
      });
  }, [courses, standard, benchmarkTarget, periodOption, matchesCourseType]);

  const sortedInstitutions = useMemo(() => {
    const dir = sortOrder === 'desc' ? -1 : 1;
    return [...institutionRows].sort((a, b) => (sortValue(a, sortKey) - sortValue(b, sortKey)) * dir);
  }, [institutionRows, sortKey, sortOrder]);

  const sortedNcs = useMemo(() => {
    const dir = ncsSortOrder === 'desc' ? -1 : 1;
    return [...ncsRows].sort((a, b) => (sortValue(a, ncsSortKey) - sortValue(b, ncsSortKey)) * dir);
  }, [ncsRows, ncsSortKey, ncsSortOrder]);

  const makeSortHandler =
    (key: SortKey, currentKey: SortKey, order: 'asc' | 'desc', setKey: (k: SortKey) => void, setOrder: (o: 'asc' | 'desc') => void) =>
    () => {
      if (currentKey === key) setOrder(order === 'desc' ? 'asc' : 'desc');
      else {
        setKey(key);
        setOrder('desc');
      }
    };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) return <div className="text-red-500 text-center">{error}</div>;

  const isMolabStandard = standard !== 'calendar';
  const yearLabel = standardYear === null ? '전체 기간' : formatStandardYear(standard, standardYear);

  const arrow = (active: boolean, order: 'asc' | 'desc') => (active ? (order === 'desc' ? ' ▼' : ' ▲') : '');

  const sortableHeader = (
    label: string,
    key: SortKey,
    currentKey: SortKey,
    order: 'asc' | 'desc',
    setKey: (k: SortKey) => void,
    setOrder: (o: 'asc' | 'desc') => void
  ) => (
    <th
      className="px-3 py-2 text-right cursor-pointer whitespace-nowrap select-none"
      onClick={makeSortHandler(key, currentKey, order, setKey, setOrder)}
    >
      {label}
      {arrow(currentKey === key, order)}
    </th>
  );

  /** 펼쳤을 때 나오는 과정 단위 내역 */
  const renderCourseDetail = (row: GroupRow) => {
    const detail = row.courses
      .map((course) => ({ course, base: getEmploymentBase(course, periodOption) }))
      .sort((a, b) => String(b.course.과정종료일).localeCompare(String(a.course.과정종료일)));

    return (
      <tr key={`${row.name}__detail`} className="bg-gray-50">
        <td colSpan={8} className="px-3 py-3">
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-xs">
              <thead>
                <tr className="text-gray-600">
                  <th className="px-2 py-1 text-left">과정명</th>
                  <th className="px-2 py-1 text-left">NCS</th>
                  <th className="px-2 py-1 text-right">수료일</th>
                  <th className="px-2 py-1 text-right">지원 만료</th>
                  <th className="px-2 py-1 text-right">수료</th>
                  <th className="px-2 py-1 text-right">모수</th>
                  <th className="px-2 py-1 text-right">취업자</th>
                  <th className="px-2 py-1 text-right">취업률</th>
                  <th className="px-2 py-1 text-right">집계</th>
                </tr>
              </thead>
              <tbody>
                {detail.map(({ course, base }, i) => {
                  const expiry = getSupportExpiryDate(course);
                  return (
                    <tr key={`${course.고유값}-${i}`} className="border-t border-gray-200">
                      <td className="px-2 py-1">
                        {String(course.과정명 ?? '')}
                        {course.회차 ? <span className="text-gray-400"> ({course.회차}회차)</span> : null}
                        {isLeadingCourse(course) && (
                          <span className="ml-1 px-1 rounded bg-cyan-100 text-cyan-700">선도</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-gray-600">{course.NCS명 || '—'}</td>
                      <td className="px-2 py-1 text-right">{formatDate(course.과정종료일)}</td>
                      <td className="px-2 py-1 text-right text-gray-500">
                        {expiry ? expiry.toISOString().slice(0, 10) : '—'}
                      </td>
                      <td className="px-2 py-1 text-right">{base.completedStudents.toLocaleString()}</td>
                      <td className="px-2 py-1 text-right">
                        {base.status === 'not_started' ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          base.denominator.toLocaleString()
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {base.status === 'not_started' ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          base.employed.toLocaleString()
                        )}
                      </td>
                      <td className="px-2 py-1 text-right font-medium">{formatRate(base.rate)}</td>
                      <td className="px-2 py-1 text-right whitespace-nowrap">
                        <span
                          className={
                            base.status === 'confirmed'
                              ? 'text-green-700'
                              : base.status === 'in_progress'
                                ? 'text-amber-600'
                                : 'text-gray-400'
                          }
                        >
                          {STATUS_LABELS[base.status]}
                          {base.source && base.source !== periodOption ? ` (${base.source})` : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    );
  };

  const renderRows = (rows: GroupRow[], rateColor: string, expandable: boolean) =>
    rows.flatMap((row, index) => {
      const isOpen = expandable && expanded === row.name;
      const main = (
        <tr key={row.name} className="border-b hover:bg-gray-50">
          <td className="px-3 py-2">{index + 1}</td>
          <td className="px-3 py-2 font-medium">
            {expandable ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-gray-500 w-4 shrink-0"
                  onClick={() => setExpanded(isOpen ? null : row.name)}
                  title={isOpen ? '과정 접기' : '과정 펼치기'}
                  aria-expanded={isOpen}
                >
                  {isOpen ? '▾' : '▸'}
                </button>
                <button
                  type="button"
                  className="text-left hover:underline text-blue-700"
                  onClick={() => setBenchmarkTarget(row.name)}
                  title="이 기관의 격차 분해 보기"
                >
                  {row.name}
                </button>
              </div>
            ) : (
              row.name
            )}
          </td>
          <td className={`px-3 py-2 text-right font-bold ${rateColor}`}>{formatRate(row.rate)}</td>
          <td className="px-3 py-2 text-right">{row.employed.toLocaleString()}명</td>
          <td className="px-3 py-2 text-right">{row.denominator.toLocaleString()}명</td>
          <td className="px-3 py-2 text-right">{row.remainingSupport.toLocaleString()}명</td>
          <td className="px-3 py-2 text-right">{row.courseCount}개</td>
          <td className="px-3 py-2 text-right text-xs text-gray-500 whitespace-nowrap">
            {row.statusCounts.confirmed}/{row.statusCounts.in_progress}/{row.statusCounts.not_started}
          </td>
        </tr>
      );
      return isOpen ? [main, renderCourseDetail(row)] : [main];
    });

  const tableHead = (
    currentKey: SortKey,
    order: 'asc' | 'desc',
    setKey: (k: SortKey) => void,
    setOrder: (o: 'asc' | 'desc') => void,
    firstCol: string
  ) => (
    <thead>
      <tr className="bg-gray-50">
        <th className="px-3 py-2 text-left">순위</th>
        <th className="px-3 py-2 text-left">{firstCol}</th>
        {sortableHeader('취업률', 'rate', currentKey, order, setKey, setOrder)}
        {sortableHeader('취업자', 'employed', currentKey, order, setKey, setOrder)}
        {sortableHeader('취업자 모수', 'denominator', currentKey, order, setKey, setOrder)}
        {sortableHeader('지원대상(잔여)', 'remainingSupport', currentKey, order, setKey, setOrder)}
        {sortableHeader('과정수', 'courseCount', currentKey, order, setKey, setOrder)}
        <th className="px-3 py-2 text-right text-xs whitespace-nowrap">확정/중/전</th>
      </tr>
    </thead>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">취업률 분석</h1>
      <p className="text-sm text-gray-600 mb-6">
        고용노동부 취업률 산정 기준(취업자 모수 = 수료인원 − 근로자 − 제외자)에 따른 집계입니다.
      </p>

      {/* 필터 */}
      <div className="flex flex-wrap gap-6 items-start mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">집계 기준</label>
          <select
            value={standard}
            onChange={(e) => setStandard(e.target.value as EmploymentStandard)}
            className="px-2 py-1 border rounded"
          >
            {(Object.keys(STANDARD_LABELS) as EmploymentStandard[]).map((key) => (
              <option key={key} value={key}>
                {STANDARD_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {standard === 'course_review' ? '평가 회계연도' : '평가 연도'}
          </label>
          <select
            value={standardYear ?? ''}
            onChange={(e) => setStandardYear(e.target.value ? Number(e.target.value) : null)}
            className="px-2 py-1 border rounded"
          >
            <option value="">전체 기간</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {formatStandardYear(standard, year)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">과정 유형</label>
          <select
            value={courseType}
            onChange={(e) => setCourseType(e.target.value as CourseType)}
            className="px-2 py-1 border rounded"
          >
            {(Object.keys(COURSE_TYPE_LABELS) as CourseType[]).map((key) => (
              <option key={key} value={key}>
                {COURSE_TYPE_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">집계 시점</label>
          <div className="flex gap-4 pt-1">
            {(['6개월', '3개월'] as EmploymentPeriod[]).map((option) => (
              <label key={option} className="flex items-center">
                <input
                  type="radio"
                  value={option}
                  checked={periodOption === option}
                  onChange={(e) => setPeriodOption(e.target.value as EmploymentPeriod)}
                  className="mr-2"
                />
                {option}
                {option === '6개월' && <span className="ml-1 text-xs text-gray-500">(기준)</span>}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">미집계 과정</label>
          <label className="flex items-center pt-1">
            <input
              type="checkbox"
              checked={includeUnaggregated}
              onChange={(e) => setIncludeUnaggregated(e.target.checked)}
              className="mr-2"
            />
            분모에 포함
          </label>
        </div>
      </div>

      {/* 집계 상태 */}
      <div className="mb-4 text-sm bg-muted border border-border rounded px-4 py-3 space-y-1">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span className="font-medium">{yearLabel}</span>
          <span>
            대상 과정 <strong>{totals.courseCount.toLocaleString()}</strong>개 —{' '}
            {STATUS_LABELS.confirmed} {totals.statusCounts.confirmed.toLocaleString()} / {STATUS_LABELS.in_progress}{' '}
            {totals.statusCounts.in_progress.toLocaleString()} / {STATUS_LABELS.not_started}{' '}
            {totals.statusCounts.not_started.toLocaleString()}
          </span>
        </div>
        <p className="text-gray-600">
          {includeUnaggregated ? (
            <>
              고용노동부 과정심사 방식입니다. 아직 취업률이 나오지 않은 과정도 분모에 포함하므로 최근 과정이 많은 기관은
              취업률이 낮게 보입니다.
              {totals.estimatedCourses > 0 && (
                <>
                  {' '}
                  이 중 <strong>{totals.estimatedCourses.toLocaleString()}개</strong> 과정은 근로자·제외자 정보가 없어
                  수료인원을 모수로 대체했습니다(취업률이 실제보다 낮게 산출됨).
                </>
              )}
            </>
          ) : (
            <>
              집계가 끝난 과정만 계산합니다. {STATUS_LABELS.not_started}{' '}
              <strong>{totals.statusCounts.not_started.toLocaleString()}개</strong> 과정은 분모·분자 모두에서 빠져 있어,
              이 취업률은 “평가가 끝난 과정만의 가중평균”입니다.
            </>
          )}
        </p>
        <p className="text-gray-500 text-xs">
          취업자 모수는 취업인원 ÷ 취업률로 역산합니다. 지원 만료일은 수료일 + 6개월이며, 제외 사유(창업·해외이민·3주
          이상 질병/부상·재학·휴학)는 증빙 후 HRD-Net에 반영된 시점부터 모수에서 빠집니다.
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">총 수료생</h3>
          <p className="text-3xl font-bold text-blue-600">{totals.completedStudents.toLocaleString()}명</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">취업자 모수</h3>
          <p className="text-3xl font-bold text-green-600">{totals.denominator.toLocaleString()}명</p>
          <p className="text-xs text-gray-500 mt-1">수료인원 − 근로자 − 제외자</p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">취업자</h3>
          <p className="text-3xl font-bold text-purple-600">{totals.employed.toLocaleString()}명</p>
          <p className="text-xs text-gray-500 mt-1">
            지원대상(잔여) {totals.remainingSupport.toLocaleString()}명
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">취업률</h3>
          <p className="text-3xl font-bold text-orange-600">{formatRate(totals.rate)}</p>
          <p className="text-xs text-gray-500 mt-1">
            {periodOption} 기준 · {STATUS_LABELS.confirmed} {totals.statusCounts.confirmed.toLocaleString()}개 과정
          </p>
        </div>
      </div>

      {/* 격차 분해 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold">기관 격차 분해</h2>
          <select
            value={benchmarkTarget ?? ''}
            onChange={(e) => setBenchmarkTarget(e.target.value || null)}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value="">기관 선택…</option>
            {[...institutionRows]
              .sort((a, b) => b.denominator - a.denominator)
              .map((row) => (
                <option key={row.name} value={row.name}>
                  {row.name}
                </option>
              ))}
          </select>
          <span className="text-xs text-gray-500">표에서 기관명을 눌러도 됩니다</span>
        </div>

        {!ncsBenchmark || ncsBenchmark.actualRate === null ? (
          <p className="text-sm text-gray-500">
            기관을 선택하면 취업률 격차를 <strong>분야 구성 효과</strong>와 <strong>실행 격차</strong>로 나눠 보여줍니다.
          </p>
        ) : (
          <div className="space-y-5">
            {/* 분해 요약 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded p-4">
                <div className="text-xs text-gray-500 mb-1">{benchmarkTarget} 취업률</div>
                <div className="text-2xl font-bold text-gray-900">{formatRate(ncsBenchmark.actualRate)}</div>
                <div className="text-xs text-gray-500 mt-1">
                  전체 평균 {formatRate(ncsBenchmark.referenceRate)} 대비{' '}
                  <strong
                    className={
                      (ncsBenchmark.actualRate ?? 0) >= (ncsBenchmark.referenceRate ?? 0)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }
                  >
                    {formatPoints((ncsBenchmark.actualRate ?? 0) - (ncsBenchmark.referenceRate ?? 0))}
                  </strong>
                </div>
              </div>

              <div className="border rounded p-4">
                <div className="text-xs text-gray-500 mb-1">① 분야 구성 효과</div>
                <div
                  className={`text-2xl font-bold ${(ncsBenchmark.mixEffect ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {formatPoints(ncsBenchmark.mixEffect)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  어떤 NCS 분야에 얼마나 걸었는지로 설명되는 몫
                </div>
              </div>

              <div className="border rounded p-4">
                <div className="text-xs text-gray-500 mb-1">② 실행 격차</div>
                <div
                  className={`text-2xl font-bold ${(ncsBenchmark.executionGap ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {formatPoints(ncsBenchmark.executionGap)}
                </div>
                <div className="text-xs text-gray-500 mt-1">같은 분야 안에서 벌어진 몫</div>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              같은 분야 구성으로 전체 평균만큼 했다면 <strong>{formatRate(ncsBenchmark.expectedRate)}</strong>가 기대치입니다.
              제외율(수료인원 대비 근로자·제외자 비중)은 {benchmarkTarget}{' '}
              <strong>{benchmarkExclusion === null ? '—' : `${benchmarkExclusion.toFixed(1)}%`}</strong> / 전체{' '}
              <strong>{overallExclusion === null ? '—' : `${overallExclusion.toFixed(1)}%`}</strong>
              입니다. 이 값이 전체보다 낮으면 제외자 등록이 덜 돼 모수가 부풀려진 것이므로 취업률이 실제보다 낮게 나옵니다.
            </p>

            {/* NCS별 격차 */}
            <div>
              <h3 className="text-sm font-semibold mb-2">NCS 분야별 격차 (모수 큰 순)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left">NCS명</th>
                      <th className="px-3 py-2 text-right">모수</th>
                      <th className="px-3 py-2 text-right">{benchmarkTarget}</th>
                      <th className="px-3 py-2 text-right">전체 평균</th>
                      <th className="px-3 py-2 text-right">격차</th>
                      <th className="px-3 py-2 text-right">기대 대비 부족</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ncsBenchmark.rows.slice(0, 12).map((row) => (
                      <tr key={row.key} className="border-b">
                        <td className="px-3 py-2">{row.key}</td>
                        <td className="px-3 py-2 text-right">{row.denominator.toLocaleString()}명</td>
                        <td className="px-3 py-2 text-right font-medium">{row.rate.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right text-gray-600">{row.referenceRate.toFixed(1)}%</td>
                        <td
                          className={`px-3 py-2 text-right font-bold ${row.gapPoints >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {formatPoints(row.gapPoints)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.shortfall > 0 ? (
                            <span className="text-red-600">{row.shortfall.toLocaleString()}명</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 연도별 추이 */}
            {benchmarkTrend.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">연도별 격차 추이</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left">{standard === 'course_review' ? '회계연도' : '연도'}</th>
                        <th className="px-3 py-2 text-right">{benchmarkTarget}</th>
                        <th className="px-3 py-2 text-right">전체 평균</th>
                        <th className="px-3 py-2 text-right">격차</th>
                        <th className="px-3 py-2 text-right">모수</th>
                        <th className="px-3 py-2 text-right">과정수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarkTrend.map((t) => {
                        const gap = t.mineRate !== null && t.allRate !== null ? t.mineRate - t.allRate : null;
                        return (
                          <tr key={t.year} className="border-b">
                            <td className="px-3 py-2">{formatStandardYear(standard, t.year)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatRate(t.mineRate)}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{formatRate(t.allRate)}</td>
                            <td
                              className={`px-3 py-2 text-right font-bold ${(gap ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
                            >
                              {formatPoints(gap)}
                            </td>
                            <td className="px-3 py-2 text-right">{t.denominator.toLocaleString()}명</td>
                            <td className="px-3 py-2 text-right">{t.courseCount}개</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  집계가 끝난 과정만 비교합니다. 최근 연도는 확정 과정이 적어 표본이 작고 흔들립니다.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 기관별 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-1">훈련기관별 취업률</h2>
        <p className="text-xs text-gray-500 mb-4">
          ▸ 를 눌러 과정별 내역을 펼칩니다. 기관명을 누르면 격차 분해로 이동합니다. 선도기업 과정도 훈련기관 앞으로
          집계합니다(매출과 달리 파트너기관으로 넘기지 않음) — 분리해서 보려면 위의 ‘과정 유형’을 쓰세요.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-sm">
            {tableHead(sortKey, sortOrder, setSortKey, setSortOrder, '훈련기관')}
            <tbody>{renderRows(sortedInstitutions, 'text-green-600', true)}</tbody>
          </table>
        </div>
      </div>

      {/* NCS별 */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">NCS별 취업률</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-sm">
            {tableHead(ncsSortKey, ncsSortOrder, setNcsSortKey, setNcsSortOrder, 'NCS명')}
            <tbody>{renderRows(sortedNcs, 'text-blue-600', false)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
