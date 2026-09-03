'use client';

// 수요·경쟁력 분석 페이지
//
// 답하려는 질문:
//   Q1. 어떤 분야가 앞으로 경쟁력 있는가? → 취업률 (분야 × 개강연도, 그 해 시장 평균 대비)
//   Q2. 훈련생 수요가 어디로 쏠렸는가?    → 신청인원 점유율 + 회차당 신청인원
//
// 충원율(신청/정원)은 의도적으로 주요 지표에서 뺐다. 정원이 '목표'가 아니라 '회차별
// 최대 수용 인원(행정적 상한)'이라, 상한을 넉넉히 잡은 과정이 수요가 멀쩡해도 낮게
// 나오는 함정값이기 때문이다. [참고] 카드 두 장에만 남겨 그 함정을 설명하는 용도로 쓴다.
//
// 지표 정의와 함정(특히 취업률 집계 지연)은 @/lib/backend/demand-engine 헤더에 있다.
// 이 파일은 표현만 담당한다 — 산식을 여기서 다시 계산하지 말 것.

import React, { useEffect, useMemo, useState } from 'react';
import { kdtAPI, type DemandAnalysisResponse } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { formatNumber } from '@/utils/formatters';
import { AI_CAMPUS_FILTER_LABELS, type AiCampusFilter } from '@/lib/course-category';
import type { CategorySummary, Quadrant } from '@/lib/backend/demand-engine';
import { MATURE_EMPLOYMENT_COVERAGE } from '@/lib/backend/demand-engine';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  LabelList,
} from 'recharts';

// ─────────────────────────────────────────────────────────────
// 색
//
// dataviz 기준 팔레트(검증 통과: 인접쌍 CVD ΔE 9.1 / 정상시야 19.6).
// 대비 WARN 3종(#1baf7a·#eda100·#e87ba4)은 아래 표 뷰가 있어 해소된다.
//
// 시리즈 색은 '순위'가 아니라 '분야'에 고정한다. 필터를 바꿔 시리즈 구성이
// 달라져도 남은 분야의 색이 바뀌면 안 되기 때문이다(recolor-on-filter 금지).
// 그래서 top-N 을 매번 계산하지 않고 전체 데이터 기준 상위 7개를 상수로 박았다.
// ─────────────────────────────────────────────────────────────
const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'];
const OTHER_COLOR = '#9ca3af';
const ACCENT = '#2a78d6';
const INK_MUTED = '#6b7280';
const GRID = '#e5e7eb';

// 발산형(diverging) 램프 — 그 해 시장 평균 취업률과의 차이를 칠한다.
// blue(평균 이상) ↔ 중립 회색 ↔ red(평균 이하). 두 극이 반대로 읽히고
// 중간값은 '차이 없음'으로 읽혀야 하므로 중간에 색조를 두지 않는다.
const DIVERGING_ABOVE = ['#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6'];
const DIVERGING_BELOW = ['#fbdcdc', '#f3b4b4', '#e97f7f', '#d03b3b'];
const DIVERGING_MID = '#f0efec';
/** 이 %p 이상 벌어지면 램프의 맨 끝 색 */
const DIVERGING_MAX = 16;

/** 취업률 차이(%p) → 배경색 + 글자색 */
function divergingCell(delta: number | null): { bg: string; fg: string } {
  if (delta === null || !Number.isFinite(delta)) return { bg: '#fff', fg: '#9ca3af' };
  const mag = Math.min(Math.abs(delta), DIVERGING_MAX) / DIVERGING_MAX;
  if (mag < 0.12) return { bg: DIVERGING_MID, fg: '#374151' };
  const ramp = delta > 0 ? DIVERGING_ABOVE : DIVERGING_BELOW;
  const step = Math.min(ramp.length - 1, Math.floor(mag * ramp.length));
  // 가장 진한 두 단계 위에서는 흰 글자라야 읽힌다.
  return { bg: ramp[step], fg: step >= 2 ? '#ffffff' : '#374151' };
}

/** 점유율 차트에 개별 색을 주는 분야. 나머지는 '기타'로 접는다. */
const SHARE_SERIES = [
  'AI/머신러닝',
  '데이터분석',
  '백엔드',
  '풀스택/웹',
  '클라우드/DevOps',
  '종합SW아카데미',
  '게임',
] as const;

const SHARE_COLOR: Record<string, string> = Object.fromEntries(
  SHARE_SERIES.map((c, i) => [c, SERIES_COLORS[i]])
);

const QUADRANT_LABEL: Record<Quadrant, string> = {
  유망: '유망 — 수요 강해지고 성과도 평균 이상',
  과열주의: '과열주의 — 수요는 몰리는데 성과는 평균 이하',
  '저평가/틈새': '저평가/틈새 — 수요는 식지만 성과는 평균 이상',
  축소: '축소 — 수요도 성과도 평균 이하',
};

const QUADRANT_BADGE: Record<Quadrant, string> = {
  유망: 'bg-blue-50 text-blue-700 border-blue-200',
  과열주의: 'bg-orange-50 text-orange-700 border-orange-200',
  '저평가/틈새': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  축소: 'bg-gray-100 text-gray-600 border-gray-200',
};

const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? '-' : `${v.toFixed(digits)}%`;

const signed = (v: number | null | undefined, suffix = '') =>
  v === null || v === undefined || !Number.isFinite(v) ? '-' : `${v > 0 ? '+' : ''}${v}${suffix}`;

type SortKey =
  | 'totalEnrollment'
  | 'latestShare'
  | 'latestEnrollmentPerRound'
  | 'relativeDemandSlope'
  | 'matureEmploymentRate'
  | 'relativeEmploymentSlope'
  | 'satisfaction'
  | 'avgRounds';

export default function TrendAnalysisPage() {
  const [data, setData] = useState<DemandAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trainingType, setTrainingType] = useState<'all' | 'leading' | 'tech'>('all');
  const [aiCampus, setAiCampus] = useState<AiCampusFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('totalEnrollment');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await kdtAPI.getDemandAnalysis({ trainingType, aiCampus });
        if (cancelled) return;
        setData(res);
      } catch (e) {
        if (cancelled) return;
        console.error('수요 분석 로드 오류:', e);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trainingType, aiCampus]);

  const categories = data?.categories ?? [];
  const totals = data?.totals ?? [];

  const firstYear = totals[0];
  const lastYear = totals[totals.length - 1];
  // 공급 규모는 '진행 중인 해'로 재면 안 된다 — 아직 개강하지 않은 과정이 빠져 있어
  // 정원이 실제보다 작게 잡히고, 그러면 공급 증가폭이 과소평가된다.
  // (충원율·점유율은 이미 개강한 과정만의 비율이라 진행 중인 해도 그대로 쓴다)
  const lastCompleteYear = [...totals].reverse().find((t) => !t.partial) ?? lastYear;

  /** 100% 누적 영역 차트용 — 고정 7개 분야 + 기타 */
  const shareSeriesData = useMemo(() => {
    return totals.map((t) => {
      const row: Record<string, number | string> = { year: t.year };
      let others = 0;
      for (const c of categories) {
        const cell = c.years.find((y) => y.year === t.year);
        if (!cell) continue;
        if ((SHARE_SERIES as readonly string[]).includes(c.category)) {
          row[c.category] = cell.enrollmentShare;
        } else {
          others += cell.enrollmentShare;
        }
      }
      row['기타'] = Math.round(others * 10) / 10;
      return row;
    });
  }, [categories, totals]);

  /**
   * 취업률 히트맵용 — 분야 × 개강연도.
   * 칠하는 값은 취업률 절대값이 아니라 '그 해 시장 평균과의 차이(%p)'다.
   * 시장 평균 자체가 연도마다 크게 움직여서(67.8% → 52.2%), 절대값으로 칠하면
   * 분야 차이가 아니라 연도 차이만 보인다.
   */
  const employmentMatrix = useMemo(() => {
    const marketByYear = new Map(totals.map((t) => [t.year, t.employmentRate]));
    return categories
      .map((c) => ({
        category: c.category,
        slope: c.relativeEmploymentSlope,
        totalEnrollment: c.totalEnrollment,
        cells: totals.map((t) => {
          const cell = c.years.find((y) => y.year === t.year);
          const market = marketByYear.get(t.year);
          const rate = cell?.employmentRate ?? null;
          return {
            year: t.year,
            rate,
            targetPop: cell?.targetPop ?? 0,
            coverage: cell?.employmentCoverage ?? 0,
            mature: (cell?.employmentCoverage ?? 0) >= MATURE_EMPLOYMENT_COVERAGE,
            delta:
              rate === null || market === null || market === undefined
                ? null
                : Math.round((rate - market) * 10) / 10,
          };
        }),
      }))
      .sort((a, b) => b.totalEnrollment - a.totalEnrollment);
  }, [categories, totals]);

  /** 2×2 버블용 — 두 축이 모두 산출된 분야만 */
  const quadrantData = useMemo(
    () =>
      categories
        .filter((c) => c.relativeDemandSlope !== null && c.matureEmploymentRate !== null)
        .map((c) => ({
          category: c.category,
          x: c.relativeDemandSlope as number,
          y: c.matureEmploymentRate as number,
          z: c.totalEnrollment,
          perRound: c.latestEnrollmentPerRound,
          quadrant: c.quadrant,
        })),
    [categories]
  );

  const sorted = useMemo(() => {
    const arr = [...categories];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = av === null || av === undefined ? -Infinity : Number(av);
      const bn = bv === null || bv === undefined ? -Infinity : Number(bv);
      return sortAsc ? an - bn : bn - an;
    });
    return arr;
  }, [categories, sortKey, sortAsc]);

  const selectedCategory: CategorySummary | undefined = useMemo(
    () => categories.find((c) => c.category === selected),
    [categories, selected]
  );

  /**
   * 드릴다운 취업률 차트용.
   * 집계율이 10% 미만인 해는 과정 한두 건이 전체 값을 결정한다 — 1명 중 1명 취업이
   * 100% 로 찍혀 추이를 왜곡한다. 선에서는 빼고 아래 표에서만 보여준다.
   */
  const selectedYearsForChart = useMemo(
    () =>
      (selectedCategory?.years ?? []).map((y) => ({
        ...y,
        employmentRate: y.employmentCoverage < 0.1 ? null : y.employmentRate,
      })),
    [selectedCategory]
  );

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">수요 분석 데이터를 불러오는 중…</div>
    );
  }
  if (error) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }
  if (!data || totals.length === 0) {
    return <div className="p-8 text-center text-gray-500">표시할 데이터가 없습니다.</div>;
  }

  const demandDelta =
    firstYear?.enrollmentPerRound != null && lastYear?.enrollmentPerRound != null
      ? Math.round((lastYear.enrollmentPerRound - firstYear.enrollmentPerRound) * 10) / 10
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* ── 헤더 & 필터 (필터는 차트 위 한 줄) ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">수요·경쟁력 분석</h1>
          <p className="mt-1 text-sm text-gray-600">
            훈련생 수요가 어디로 쏠렸고, 어떤 분야가 앞으로 경쟁력이 있는지를 봅니다.
            연도 축은 <strong>과정시작일(개강 코호트)</strong> 기준입니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={trainingType} onValueChange={(v) => setTrainingType(v as typeof trainingType)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="훈련유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">유형 전체</SelectItem>
              <SelectItem value="leading">선도기업</SelectItem>
              <SelectItem value="tech">신기술</SelectItem>
            </SelectContent>
          </Select>
          <Select value={aiCampus} onValueChange={(v) => setAiCampus(v as AiCampusFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="AI캠퍼스" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(AI_CAMPUS_FILTER_LABELS) as AiCampusFilter[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {AI_CAMPUS_FILTER_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── 헤드라인 숫자 — 이 페이지 전체의 배경 사실 ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <div className="text-sm text-gray-500">회차당 수강신청 인원</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  {lastYear?.enrollmentPerRound ?? '-'}명
                </span>
                <span className="text-sm text-gray-500">({lastYear?.year}년 개강)</span>
              </div>
              <div className="mt-1 text-sm">
                <span className={demandDelta !== null && demandDelta < 0 ? 'text-gray-600' : 'text-blue-600'}>
                  {signed(demandDelta, '명')}
                </span>
                <span className="text-gray-500">
                  {' '}
                  vs {firstYear?.year}년 {firstYear?.enrollmentPerRound ?? '-'}명 — 5년째 거의 불변
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">회차 수 증가</div>
              <div className="mt-1 text-3xl font-bold text-gray-900">
                {firstYear && lastCompleteYear && firstYear.courses > 0
                  ? `${(lastCompleteYear.courses / firstYear.courses).toFixed(1)}배`
                  : '-'}
              </div>
              <div className="mt-1 text-sm text-gray-500">
                {firstYear?.year}년 {formatNumber(firstYear?.courses ?? 0)} → {lastCompleteYear?.year}년{' '}
                {formatNumber(lastCompleteYear?.courses ?? 0)}회차
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">성과 기준선</div>
              <div className="mt-1 text-3xl font-bold text-gray-900">
                {pct(data.thresholds.employmentMedian)}
              </div>
              <div className="mt-1 text-sm text-gray-500">분야별 성숙코호트 취업률 중앙값</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">분류 커버리지</div>
              <div className="mt-1 text-3xl font-bold text-gray-900">
                {(100 - (data.meta.taxonomySources['fallback'] ?? 0)).toFixed(1)}%
              </div>
              <div className="mt-1 text-sm text-gray-500">
                과정명 {data.meta.taxonomySources['keyword'] ?? 0}% · 수동{' '}
                {data.meta.taxonomySources['override'] ?? 0}% · NCS{' '}
                {data.meta.taxonomySources['ncs'] ?? 0}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 취업률: 이 페이지의 성과 축. 분야 × 개강연도 격차를 정면에 놓는다 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            분야별 취업률 — 개강 연도별, 그 해 시장 평균과의 차이
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-separate border-spacing-[2px] text-sm">
              <thead>
                <tr>
                  <th className="w-52 px-2 py-1 text-left font-medium text-gray-600">분야</th>
                  {totals.map((t) => (
                    <th key={t.year} className="px-2 py-1 text-center font-medium text-gray-600">
                      {t.year}
                      <div className="text-[10px] font-normal text-gray-400">
                        시장 {pct(t.employmentRate, 0)}
                      </div>
                    </th>
                  ))}
                  <th className="w-32 px-2 py-1 text-center font-medium text-gray-600">
                    시장대비 추세
                    <div className="text-[10px] font-normal text-gray-400">지수p/년</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {employmentMatrix.map((row) => (
                  <tr
                    key={row.category}
                    onClick={() => setSelected(selected === row.category ? null : row.category)}
                    className="cursor-pointer"
                  >
                    <td
                      className={`px-2 py-1 ${
                        selected === row.category ? 'font-semibold text-blue-700' : 'text-gray-800'
                      }`}
                    >
                      {row.category}
                    </td>
                    {row.cells.map((c) => {
                      const { bg, fg } = divergingCell(c.mature ? c.delta : null);
                      return (
                        <td
                          key={c.year}
                          className="px-2 py-1 text-center tabular-nums"
                          style={{ background: bg, color: fg }}
                          title={
                            c.rate === null
                              ? '데이터 없음'
                              : `${c.year}년 개강 · 취업률 ${pct(c.rate)} · 시장 대비 ${signed(
                                  c.delta,
                                  '%p'
                                )} · 취업대상 ${formatNumber(c.targetPop)}명 · 집계율 ${Math.round(
                                  c.coverage * 100
                                )}%`
                          }
                        >
                          {c.rate === null ? (
                            <span className="text-gray-300">·</span>
                          ) : c.mature ? (
                            pct(c.rate, 0)
                          ) : (
                            <span className="italic text-gray-400">집계중</span>
                          )}
                        </td>
                      );
                    })}
                    <td
                      className={`px-2 py-1 text-center tabular-nums ${
                        (row.slope ?? 0) > 0 ? 'text-blue-700' : 'text-gray-500'
                      }`}
                    >
                      {signed(row.slope)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              {[...DIVERGING_BELOW].reverse().map((c) => (
                <span key={c} className="inline-block h-3 w-5 rounded-sm" style={{ background: c }} />
              ))}
              <span className="inline-block h-3 w-5 rounded-sm" style={{ background: DIVERGING_MID }} />
              {DIVERGING_ABOVE.map((c) => (
                <span key={c} className="inline-block h-3 w-5 rounded-sm" style={{ background: c }} />
              ))}
            </span>
            <span>
              시장 평균 대비 −{DIVERGING_MAX}%p ← 0 → +{DIVERGING_MAX}%p
            </span>
            <span className="italic text-gray-400">&lsquo;집계중&rsquo; = 6개월 취업률이 아직 안 나온 코호트</span>
          </div>
          <p className="text-xs text-gray-500">
            숫자는 그 해 개강 코호트의 취업률, 색은 <strong>같은 해 시장 평균과의 차이</strong>입니다. 연도별로
            시장 평균 자체가 {pct(totals[0]?.employmentRate, 0)} → {pct(lastCompleteYear?.employmentRate, 0)}로
            움직이기 때문에, 절대값끼리 비교하면 &ldquo;2021년 과정이 다 좋았다&rdquo;는 착시가 생깁니다. 행을
            클릭하면 해당 분야 상세로 갑니다.
          </p>
        </CardContent>
      </Card>

      {/* ── 시장 전체: 공급 vs 수요 / 충원율 (축이 다르므로 차트를 나눈다) ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <span className="text-gray-400">[참고]</span> 공급(정원)과 수요(수강신청) — 개강 연도별
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={totals} margin={{ top: 8, right: 8, bottom: 4, left: 8 }} barGap={2}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: INK_MUTED, fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: INK_MUTED, fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [`${formatNumber(v)}명`, name]}
                  labelFormatter={(l) => `${l}년 개강`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="capacity" name="정원" fill={SERIES_COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="enrollment" name="수강신청" fill={SERIES_COLORS[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-gray-500">
              정원은 회차별 <strong>최대 수용 가능 인원(행정적 상한)</strong>이지 목표치가 아닙니다. 두 막대의
              간격을 &ldquo;미달&rdquo;로 읽으면 안 되고, 오른쪽 차트처럼 회차 단위로 나눠 봐야 합니다.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <span className="text-gray-400">[참고]</span> 왜 충원율을 지표로 쓰지 않는가
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={totals} margin={{ top: 16, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: INK_MUTED, fontSize: 12 }} />
                <YAxis
                  domain={[0, 45]}
                  tickFormatter={(v) => `${v}명`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: INK_MUTED, fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [`${v}명`, name]}
                  labelFormatter={(l) => `${l}년 개강`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="capacityPerRound"
                  name="회차당 정원(상한)"
                  stroke={SERIES_COLORS[0]}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 4, fill: SERIES_COLORS[0] }}
                />
                <Line
                  type="monotone"
                  dataKey="enrollmentPerRound"
                  name="회차당 실제 신청"
                  stroke={SERIES_COLORS[1]}
                  strokeWidth={2}
                  dot={{ r: 4, fill: SERIES_COLORS[1] }}
                  activeDot={{ r: 6 }}
                >
                  <LabelList
                    dataKey="enrollmentPerRound"
                    position="bottom"
                    formatter={(v: number) => `${v}`}
                    style={{ fill: INK_MUTED, fontSize: 11 }}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-gray-500">
              충원율이 {pct(firstYear?.fillRate, 0)} → {pct(lastYear?.fillRate, 0)}로 떨어진 건 수요가 식어서가
              아니라 <strong>상한을 올려서</strong>입니다. 한 회차가 실제로 끌어오는 인원은 5년째 23명 안팎으로
              거의 고정입니다.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Q1. 수요 쏠림 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            수요 쏠림 — 개강 연도별 수강신청 인원 점유율
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={shareSeriesData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: INK_MUTED, fontSize: 12 }} />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
                axisLine={false}
                tick={{ fill: INK_MUTED, fontSize: 12 }}
              />
              <Tooltip formatter={(v: number, name: string) => [pct(v), name]} labelFormatter={(l) => `${l}년 개강`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SHARE_SERIES.map((cat) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  name={cat}
                  stackId="share"
                  stroke="#fff"
                  strokeWidth={2}
                  fill={SHARE_COLOR[cat]}
                  fillOpacity={0.9}
                />
              ))}
              <Area
                type="monotone"
                dataKey="기타"
                name="기타 분야"
                stackId="share"
                stroke="#fff"
                strokeWidth={2}
                fill={OTHER_COLOR}
                fillOpacity={0.8}
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-gray-500">
            점유율은 &ldquo;훈련생이 실제로 어디로 갔는가&rdquo;입니다. 다만 KDT는 정부가 회차 수를 승인해 공급
            물량을 정하므로, 점유율 상승에는 &ldquo;그 분야에 회차를 더 열었다&rdquo;는 성분이 섞여 있습니다. 회차
            수와 무관한 수요 강도는 아래 표의 <strong>회차당 신청인원</strong>을 보세요.
          </p>
        </CardContent>
      </Card>

      {/* ── Q2. 2×2 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            수요 모멘텀 × 성과 — 어떤 분야가 앞으로 경쟁력 있는가
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={420}>
            <ScatterChart margin={{ top: 24, right: 40, bottom: 36, left: 28 }}>
              <CartesianGrid stroke={GRID} />
              <XAxis
                type="number"
                dataKey="x"
                name="수요 모멘텀"
                tickLine={false}
                axisLine={{ stroke: GRID }}
                tick={{ fill: INK_MUTED, fontSize: 12 }}
                label={{
                  value: '수요 모멘텀 — 시장 대비 「회차당 신청인원」 지수의 연간 변화',
                  position: 'bottom',
                  offset: 12,
                  style: { fill: INK_MUTED, fontSize: 12 },
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="취업률"
                // 점이 40~75% 구간에 몰려 있어 0부터 그리면 상단 절반이 빈다.
                domain={['dataMin - 4', 'dataMax + 4']}
                tickFormatter={(v) => `${Math.round(v)}%`}
                tickLine={false}
                axisLine={false}
                tick={{ fill: INK_MUTED, fontSize: 12 }}
                width={52}
                label={{
                  value: '성숙 코호트 취업률',
                  angle: -90,
                  position: 'insideLeft',
                  offset: -4,
                  style: { fill: INK_MUTED, fontSize: 12, textAnchor: 'middle' },
                }}
              />
              <ZAxis type="number" dataKey="z" range={[80, 900]} name="누적 수강신청" />
              <ReferenceLine x={0} stroke={INK_MUTED} strokeDasharray="4 4" />
              <ReferenceLine y={data.thresholds.employmentMedian ?? 0} stroke={INK_MUTED} strokeDasharray="4 4" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof quadrantData)[number];
                  return (
                    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                      <div className="font-semibold text-gray-900">{d.category}</div>
                      <div className="mt-1 text-gray-600">수요 모멘텀 {signed(d.x)}</div>
                      <div className="text-gray-600">최근 회차당 신청 {d.perRound ?? '-'}명</div>
                      <div className="text-gray-600">성숙 코호트 취업률 {pct(d.y)}</div>
                      <div className="text-gray-600">누적 수강신청 {formatNumber(d.z)}명</div>
                      {d.quadrant && <div className="mt-1 text-gray-900">{d.quadrant}</div>}
                    </div>
                  );
                }}
              />
              {/* 분면은 위치와 배경 라벨로 읽는다 — 분면마다 색을 주면 산점도의
                  all-pairs 색 검증(최대 3색)을 넘기지 못한다. 단일 색 + 직접 라벨. */}
              <Scatter data={quadrantData} fill={ACCENT} fillOpacity={0.5} stroke="#fff" strokeWidth={2}>
                <LabelList dataKey="category" content={<BubbleLabel />} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
            {(Object.keys(QUADRANT_LABEL) as Quadrant[]).map((q) => (
              <div key={q} className="flex items-start gap-2">
                <span className={`shrink-0 rounded border px-1.5 py-0.5 ${QUADRANT_BADGE[q]}`}>{q}</span>
                <span>{QUADRANT_LABEL[q].split('— ')[1]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            세로축은 취업률 <em>수준</em>이 아니라 <strong>산출이 충분히 끝난 코호트</strong>(취업률이 집계된 과정{' '}
            {Math.round(MATURE_EMPLOYMENT_COVERAGE * 100)}% 이상인 해)만 모은 값입니다. 최신 분야일수록 취업률이 비어
            있어서, 그냥 줄 세우면 오래된 분야가 자동으로 이깁니다. 버블 크기는 누적 수강신청 인원 — 작은 버블은
            표본이 적으니 세게 해석하지 마세요.
          </p>
        </CardContent>
      </Card>

      {/* ── 표 뷰 (색 대비 relief + 정렬/드릴다운 진입점) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">분야별 지표 — 행을 클릭하면 연도별 상세가 열립니다</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>분야</TableHead>
                <SortableHead label="누적 신청" k="totalEnrollment" {...{ sortKey, sortAsc, toggleSort }} />
                <SortableHead label="최근 점유율" k="latestShare" {...{ sortKey, sortAsc, toggleSort }} />
                <SortableHead
                  label="회차당 신청"
                  k="latestEnrollmentPerRound"
                  {...{ sortKey, sortAsc, toggleSort }}
                />
                <SortableHead label="수요 모멘텀" k="relativeDemandSlope" {...{ sortKey, sortAsc, toggleSort }} />
                <SortableHead label="성숙 취업률" k="matureEmploymentRate" {...{ sortKey, sortAsc, toggleSort }} />
                <SortableHead
                  label="취업률 시장대비 추세"
                  k="relativeEmploymentSlope"
                  {...{ sortKey, sortAsc, toggleSort }}
                />
                <SortableHead label="만족도" k="satisfaction" {...{ sortKey, sortAsc, toggleSort }} />
                <SortableHead label="평균 회차" k="avgRounds" {...{ sortKey, sortAsc, toggleSort }} />
                <TableHead>판정</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => (
                <TableRow
                  key={c.category}
                  onClick={() => setSelected(selected === c.category ? null : c.category)}
                  className={`cursor-pointer ${selected === c.category ? 'bg-blue-50' : ''}`}
                >
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ background: SHARE_COLOR[c.category] ?? OTHER_COLOR }}
                      />
                      {c.category}
                      <span className="text-xs text-gray-400">{c.group}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(c.totalEnrollment)}</TableCell>
                  <TableCell className="text-right">{pct(c.latestShare)}</TableCell>
                  <TableCell className="text-right">
                    {c.latestEnrollmentPerRound ?? '-'}명
                    <span className="ml-1 text-xs text-gray-400">
                      (지수 {c.latestRelativeEnrollmentPerRound ?? '-'})
                    </span>
                  </TableCell>
                  <TableCell
                    className={`text-right ${
                      (c.relativeDemandSlope ?? 0) > 0 ? 'text-blue-700' : 'text-gray-500'
                    }`}
                  >
                    {signed(c.relativeDemandSlope)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {pct(c.matureEmploymentRate)}
                    <span className="ml-1 text-xs text-gray-400">({c.matureEmploymentYears.length}개년)</span>
                  </TableCell>
                  <TableCell
                    className={`text-right ${
                      (c.relativeEmploymentSlope ?? 0) > 0 ? 'text-blue-700' : 'text-gray-500'
                    }`}
                  >
                    {signed(c.relativeEmploymentSlope)}
                  </TableCell>
                  <TableCell className="text-right">{c.satisfaction ?? '-'}</TableCell>
                  <TableCell className="text-right">{c.avgRounds}회</TableCell>
                  <TableCell>
                    {c.quadrant ? (
                      <span className={`rounded border px-1.5 py-0.5 text-xs ${QUADRANT_BADGE[c.quadrant]}`}>
                        {c.quadrant}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">표본 부족</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── 드릴다운 ── */}
      {selectedCategory && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selectedCategory.category} — 개강 연도별 상세</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-medium text-gray-700">
                  시장 대비 회차당 신청인원 지수 (100 = 시장 평균)
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={selectedCategory.years} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: INK_MUTED, fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: INK_MUTED, fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: number, _n, p: any) => [
                        `지수 ${v} (회차당 ${p?.payload?.enrollmentPerRound ?? '-'}명)`,
                        '시장 대비',
                      ]}
                      labelFormatter={(l) => `${l}년 개강`}
                    />
                    <ReferenceLine y={100} stroke={INK_MUTED} strokeDasharray="4 4" />
                    <Line
                      type="monotone"
                      dataKey="relativeEnrollmentPerRound"
                      stroke={ACCENT}
                      strokeWidth={2}
                      dot={{ r: 4, fill: ACCENT }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium text-gray-700">취업률 (6개월 기준, 미성숙 연도 포함)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={selectedCategory.years} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: INK_MUTED, fontSize: 12 }} />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: INK_MUTED, fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(v: number, _n, p: any) => [
                        `${pct(v)} (집계율 ${Math.round((p?.payload?.employmentCoverage ?? 0) * 100)}%)`,
                        '취업률',
                      ]}
                      labelFormatter={(l) => `${l}년 개강`}
                    />
                    <Line
                      type="monotone"
                      dataKey="employmentRate"
                      stroke={SERIES_COLORS[1]}
                      strokeWidth={2}
                      dot={(props: any) => {
                        const mature =
                          (props.payload?.employmentCoverage ?? 0) >= MATURE_EMPLOYMENT_COVERAGE;
                        return (
                          <circle
                            key={props.key ?? `${props.payload?.year}`}
                            cx={props.cx}
                            cy={props.cy}
                            r={4}
                            fill={mature ? SERIES_COLORS[1] : '#fff'}
                            stroke={SERIES_COLORS[1]}
                            strokeWidth={2}
                          />
                        );
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <p className="mt-1 text-xs text-gray-500">
                  속이 빈 점 = 취업률 집계가 아직 {Math.round(MATURE_EMPLOYMENT_COVERAGE * 100)}%에 못 미친 연도.
                  값이 낮은 게 아니라 <em>아직 안 나온</em> 것입니다.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>개강연도</TableHead>
                    <TableHead className="text-right">회차</TableHead>
                    <TableHead className="text-right">과정 수</TableHead>
                    <TableHead className="text-right">기관 수</TableHead>
                    <TableHead className="text-right">수강신청</TableHead>
                    <TableHead className="text-right">회차당 신청</TableHead>
                    <TableHead className="text-right">회차당 상한</TableHead>
                    <TableHead className="text-right">신청 점유</TableHead>
                    <TableHead className="text-right">정원 점유</TableHead>
                    <TableHead className="text-right">수요갭</TableHead>
                    <TableHead className="text-right">수료율</TableHead>
                    <TableHead className="text-right">취업률</TableHead>
                    <TableHead className="text-right">만족도</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedCategory.years.map((y) => (
                    <TableRow key={y.year}>
                      <TableCell className="font-medium">
                        {y.year}
                        {y.partial && <span className="ml-1 text-xs text-amber-600">진행중</span>}
                      </TableCell>
                      <TableCell className="text-right">{y.courses}</TableCell>
                      <TableCell className="text-right">{y.distinctCourses}</TableCell>
                      <TableCell className="text-right">{y.institutions}</TableCell>
                      <TableCell className="text-right">{formatNumber(y.enrollment)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {y.enrollmentPerRound ?? '-'}명
                        <span className="ml-1 text-xs text-gray-400">
                          ({y.relativeEnrollmentPerRound ?? '-'})
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-gray-500">
                        {y.capacityPerRound ?? '-'}명
                      </TableCell>
                      <TableCell className="text-right">{pct(y.enrollmentShare)}</TableCell>
                      <TableCell className="text-right">{pct(y.capacityShare)}</TableCell>
                      <TableCell
                        className={`text-right ${y.demandGap > 0 ? 'text-blue-700' : 'text-gray-500'}`}
                      >
                        {signed(y.demandGap, '%p')}
                      </TableCell>
                      <TableCell className="text-right">
                        {pct(y.completionRate)}
                        {y.completionCoverage < 0.7 && (
                          <span className="ml-1 text-xs text-amber-600">*</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {y.employmentCoverage < MATURE_EMPLOYMENT_COVERAGE ? (
                          <span className="text-gray-400" title="집계 미완">
                            {pct(y.employmentRate)}*
                          </span>
                        ) : (
                          pct(y.employmentRate)
                        )}
                      </TableCell>
                      <TableCell className="text-right">{y.satisfaction ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-gray-500">
                * 표시는 집계가 아직 덜 끝난 값입니다. 수료율은 종료 후 3주 유예를 적용하고, 취업률은 6개월
                기준(없으면 3개월)으로 산출된 과정만 분모에 넣습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 방법론 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">이 페이지를 읽을 때 알아야 할 것</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <p>
            <strong>1. 분야 분류는 NCS가 아니라 과정명 기반입니다.</strong> NCS명은
            &lsquo;응용SW엔지니어링&rsquo; 하나가 전체 신청인원의 46%를 차지해 프론트·백엔드·게임·풀스택이
            한 덩어리로 묶입니다. 그래서 과정명 키워드 + 브랜드 과정 수동 매핑 + NCS 폴백 순으로
            분류했습니다 (규칙은 <code className="rounded bg-gray-100 px-1">src/lib/course-taxonomy.ts</code>).
          </p>
          <p>
            <strong>2. 정원은 목표가 아니라 회차별 최대 수용 인원(행정적 상한)입니다.</strong> 그래서 충원율을
            경쟁률처럼 읽으면 안 됩니다. 상한을 넉넉히 잡은 과정은 수요가 멀쩡해도 충원율이 낮게 나옵니다.
            실제로 시장 전체 충원율 {pct(firstYear?.fillRate, 0)} → {pct(lastYear?.fillRate, 0)} 하락은 회차당
            상한이 {firstYear?.capacityPerRound}명 → {lastYear?.capacityPerRound}명으로 오른 결과이고, 회차당
            실제 신청인원은 {firstYear?.enrollmentPerRound}명 → {lastYear?.enrollmentPerRound}명으로 거의
            그대로입니다.
          </p>
          <p>
            <strong>3. 「수요 모멘텀」의 정확한 정의.</strong> 정원은 한 글자도 들어가지 않습니다.
          </p>
          <ol className="ml-4 list-decimal space-y-1 text-sm text-gray-600">
            <li>
              (분야, 개강연도)마다 <strong>회차당 신청인원 = 수강신청 인원 합 ÷ 회차 수</strong>
            </li>
            <li>
              그 해 <strong>시장 전체 회차당 신청인원</strong>으로 나눠 ×100 → 지수 (100 = 시장 평균)
            </li>
            <li>그 지수를 개강연도에 대해 최소제곱 선형회귀 (정원 100명 미만인 해는 표본이 작아 제외)</li>
            <li>
              그 <strong>기울기(지수p/년)</strong>가 수요 모멘텀. 예: 반도체는 지수가 107→105→127→150→147→159로
              올라 <strong>+13.97</strong>.
            </li>
          </ol>
          <p className="text-sm text-gray-600">
            회차당으로 나누는 이유는 공급 물량(회차 수)과 수요 강도를 분리하기 위해서입니다. 회차를 두 배로
            열면 총 신청인원도 늘지만, 그건 수요가 세진 게 아닙니다.
          </p>
          <p>
            <strong>4. 취업률은 성과 축의 본체이고, 연도 비교는 시장 평균 대비로 합니다.</strong> 시장 평균
            취업률 자체가 {pct(totals[0]?.employmentRate, 0)}({totals[0]?.year}) →{' '}
            {pct(lastCompleteYear?.employmentRate, 0)}({lastCompleteYear?.year})로 내려왔기 때문에, 분야별
            취업률을 절대값으로 줄 세우면 &ldquo;오래된 코호트가 다 좋았다&rdquo;는 착시가 생깁니다. 위
            히트맵은 같은 해 시장 평균과의 차이를 칠합니다.
          </p>
          <p>
            <strong>5. 취업률은 최신 코호트일수록 비어 있습니다.</strong>{' '}
            {totals
              .filter((t) => t.employmentCoverage < MATURE_EMPLOYMENT_COVERAGE)
              .map((t) => `${t.year}년 ${Math.round(t.employmentCoverage * 100)}%`)
              .join(' · ') || '현재는 모든 연도가 성숙 구간입니다'}{' '}
            수준으로 집계가 덜 끝났습니다. 그래서 경쟁력 판정에는 성숙 코호트만 씁니다.
          </p>
          <p>
            <strong>6. 이 데이터로는 &lsquo;훈련시장 내부 경쟁력&rsquo;까지만 말할 수 있습니다.</strong> 실제
            산업 채용 수요(채용공고, 산업별 취업자)는 외부 데이터라 여기 포함돼 있지 않습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 버블 위에 분야명을 직접 얹는다.
 *
 * 기본 LabelList 는 점 중앙에 글자를 놓아 버블에 묻힌다. 반지름만큼 위로
 * 밀어 올리고, 겹칠 때 읽히도록 흰 외곽선을 준다(paint-order 로 글자 위가 아니라
 * 아래에 깔린다).
 */
function BubbleLabel(props: any) {
  const { x, y, value, index } = props;
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  // 점이 20개 넘게 중앙에 몰려서 위아래 2단으로는 라벨이 겹친다. 4단으로 흩는다.
  const dy = [-15, 23, -28, 36][index % 4];
  return (
    <text
      x={x}
      y={y + dy}
      textAnchor="middle"
      fontSize={11}
      fill="#374151"
      stroke="#fff"
      strokeWidth={3}
      paintOrder="stroke"
    >
      {value}
    </text>
  );
}

function SortableHead({
  label,
  k,
  sortKey,
  sortAsc,
  toggleSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortAsc: boolean;
  toggleSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <TableHead
      onClick={() => toggleSort(k)}
      className={`cursor-pointer select-none text-right ${active ? 'text-gray-900' : ''}`}
    >
      {label}
      {active && <span className="ml-1 text-xs">{sortAsc ? '▲' : '▼'}</span>}
    </TableHead>
  );
}
