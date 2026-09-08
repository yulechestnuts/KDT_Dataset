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
  OP_COMPONENTS,
  OP_WEIGHT_PRESETS,
  DEFAULT_OP_WEIGHTS,
  combineOpScore,
  computeRankStability,
  OP_AXIS_DIVERGENCE,
  OP_AXES,
  OP_AXIS_QUESTION,
  OP_TIER_LABEL,
  OP_TIER_DESC,
  OP_TIER_BORDERLINE,
  type OpWeights,
  type OpComponentKey,
  type OpAxis,
  type OpTier,
} from '@/lib/backend/op-score';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
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

/**
 * 분면 이름은 '배출 효율 × 도달 규모' 축에 맞춰 다시 붙였다.
 * 옛 이름(유망/과열주의/저평가/축소)은 '수요 × 성과' 축의 것이라 지금 축에서는 안 맞는다.
 * 지금 이름은 그대로 실행 항목이 된다 — 늘릴 곳 / 고칠 곳 / 줄일 곳.
 */
const QUADRANT_LABEL: Record<Quadrant, string> = {
  유망: '유망 — 취업도 시장 이상이고 규모도 커지는 중',
  과열주의: '성장·개선필요 — 규모는 커지는데 배출률이 아직 시장 이하. 전환을 고치면 가장 크게 남는 곳',
  '저평가/틈새': '안정·틈새 — 취업은 잘 되는데 규모가 안 큼. 늘릴 여지가 있는 곳',
  축소: '축소 검토 — 취업도 시장 이하, 규모도 줄어드는 중',
};

/** 배지에 쓸 짧은 이름 (Quadrant 값 자체는 API 호환을 위해 유지) */
const QUADRANT_SHORT: Record<Quadrant, string> = {
  유망: '유망',
  과열주의: '성장·개선필요',
  '저평가/틈새': '안정·틈새',
  축소: '축소 검토',
};

/**
 * 분면 = 배출률 지수 × 규모 성장.
 *
 * 사용자 정의(2026-09)를 그대로 두 축으로 옮긴 것:
 *   "취업이 잘 될 수 있는 상황에서, 규모의 범위도 얼마나 잘 늘어나는지를 체크하며 유망직종을 본다"
 *     · 가로 = 배출률 지수 100  → 취업이 시장만큼은 되는가 (절대 기준이 존재한다)
 *     · 세로 = 규모 성장 0%p    → 점유율을 지켰는가 / 늘렸는가
 *
 * ⚠️ 가로축에 '배출 축 점수'(배출률+만족도 합성)를 쓰면 안 된다. 합성값이 50 을 넘어
 *    배출률이 시장 이하인 분야에도 '유망' 배지가 붙는다 — 실제로 그렇게 잡힌 적이 있다.
 */
function quadrantOf(yieldIndex: number | null, growth: number | null): Quadrant | null {
  if (yieldIndex === null || growth === null) return null;
  return yieldIndex >= 100
    ? growth > 0
      ? '유망' // 취업도 되고 규모도 크는 중
      : '저평가/틈새' // 취업은 되는데 규모가 안 큼
    : growth > 0
      ? '과열주의' // 규모는 크는데 취업이 시장 이하
      : '축소';
}

const QUADRANT_BADGE: Record<Quadrant, string> = {
  유망: 'bg-blue-50 text-blue-700 border-blue-200',
  과열주의: 'bg-orange-50 text-orange-700 border-orange-200',
  '저평가/틈새': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  축소: 'bg-gray-100 text-gray-600 border-gray-200',
};

/**
 * 티어 배지. 순위(1·2·3위)를 주인공에서 내리고 이걸 앞에 세운다 —
 * 가중치 ±50% 무작위 5,000회에서 개별 순위는 평균 7.3위씩 움직이지만
 * 티어는 77% 유지된다. 근거는 @/lib/backend/op-score 의 티어 섹션.
 */
const TIER_BADGE: Record<OpTier, string> = {
  S: 'bg-blue-600 text-white border-blue-600',
  A: 'bg-blue-100 text-blue-800 border-blue-300',
  B: 'bg-gray-100 text-gray-700 border-gray-300',
  C: 'bg-gray-50 text-gray-500 border-gray-200',
};

/**
 * 표본 배지 — 성숙 코호트 취업대상자 수.
 * 배출률만 크게 띄우면 표본 348명짜리 분야와 14,718명짜리 분야가 같은 무게로 읽힌다.
 */
function sampleBadge(n: number | null | undefined): { label: string; cls: string; title: string } {
  const v = n ?? 0;
  if (v >= 3000)
    return { label: '충분', cls: 'text-blue-700', title: `성숙 코호트 취업대상 ${v.toLocaleString()}명` };
  if (v >= 1000)
    return { label: '보통', cls: 'text-gray-600', title: `성숙 코호트 취업대상 ${v.toLocaleString()}명` };
  return {
    label: '얇음',
    cls: 'text-orange-600',
    title: `성숙 코호트 취업대상 ${v.toLocaleString()}명 — 배출률을 단독으로 믿지 마세요`,
  };
}

/**
 * Op Score 구성 지표 셀의 배경. 50(=분야 중앙값)을 기준으로 양쪽으로 벌린다.
 * 취업률 매트릭스와 같은 발산형 램프를 쓰되, 여기는 0~100 점수라 스케일만 다르다.
 */
function opCell(score: number | null): { bg: string; fg: string } {
  if (score === null || !Number.isFinite(score)) return { bg: '#fff', fg: '#9ca3af' };
  const delta = score - 50;
  const mag = Math.min(Math.abs(delta), 30) / 30;
  if (mag < 0.15) return { bg: DIVERGING_MID, fg: '#374151' };
  const ramp = delta > 0 ? DIVERGING_ABOVE : DIVERGING_BELOW;
  const step = Math.min(ramp.length - 1, Math.floor(mag * ramp.length));
  return { bg: ramp[step], fg: step >= 2 ? '#ffffff' : '#374151' };
}

/** 분류 근거 배지 — 과정 목록에서 "왜 이 분야로 잡혔나"를 바로 보이게 */
const SOURCE_LABEL: Record<string, { text: string; cls: string }> = {
  override: { text: '수동', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  keyword: { text: '과정명', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  ncs: { text: 'NCS', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  fallback: { text: '미분류', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? '-' : `${v.toFixed(digits)}%`;

const signed = (v: number | null | undefined, suffix = '') =>
  v === null || v === undefined || !Number.isFinite(v) ? '-' : `${v > 0 ? '+' : ''}${v}${suffix}`;

/** 축마다 색을 고정한다 — 필터를 바꿔도 같은 축은 같은 색이어야 읽힌다 */

/**
 * 축 점수 한 칸. 막대 + 숫자.
 * 세 축을 같은 모양으로 나란히 둬야 "이 분야는 어디만 높다"가 눈에 바로 들어온다.
 */

type SortKey =
  | 'opScore'
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

  // Op Score 가중치는 화면 상태다 — 서버는 정규화된 지표 점수까지만 내려준다.
  // 가중치에 근거가 없기 때문에, 하나를 정답으로 박는 대신 사용자가 흔들어 보게 한다.
  const [opWeights, setOpWeights] = useState<OpWeights>(DEFAULT_OP_WEIGHTS);
  const [activePreset, setActivePreset] = useState<string>('기본');
  const [showWeights, setShowWeights] = useState(false);
  /**
   * 두 축을 굳이 합쳐서 볼 필요는 없다. 합치면 '수요는 죽었지만 성과는 좋다'와
   * '수요는 몰리는데 성과가 안 난다'가 같은 점수가 되어 정보가 사라진다.
   * 축 하나만 보고 싶으면 그렇게 볼 수 있어야 한다.
   */
  const [opView, setOpView] = useState<'종합' | OpAxis>('종합');
  /** 과정 목록에서 이름으로 걸러 보기 */
  const [courseQuery, setCourseQuery] = useState('');

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

  // quadrantData 는 아래 opScores 가 필요해서 그쪽에 함께 둔다.

  // ── Op Score ────────────────────────────────────────────────
  // 서버가 준 것은 '가중치 없는 지표 점수(0~100) + 신뢰도'뿐이다.
  // 최종 점수는 여기서 매번 다시 만든다 — 슬라이더를 움직이면 즉시 반영된다.
  // '기타'는 분류가 안 된 잔여 묶음이라 하나의 '분야'가 아니다. 티어 경계와
  // 정규화 기준(중앙값·MAD)을 같이 흔들므로 Op Score 계산에서 아예 뺀다.
  const opProfiles = useMemo(
    () =>
      categories
        .filter((c) => c.opProfile && c.category !== '기타')
        .map((c) => ({ key: c.category, profile: c.opProfile! })),
    [categories]
  );

  const opScores = useMemo(() => {
    const m = new Map<string, ReturnType<typeof combineOpScore>>();
    for (const p of opProfiles) m.set(p.key, combineOpScore(p.profile, opWeights));
    return m;
  }, [opProfiles, opWeights]);

  /**
   * 가중치를 무작위로 흔들었을 때의 순위 분포.
   * "이 순위가 가중치에 얼마나 의존하는가"를 옆에 같이 두지 않으면, 단일 순위가
   * 없는 확신을 만들어 낸다. 지금 화면의 가중치를 중심으로 400회 시행.
   */
  const opStability = useMemo(
    () => computeRankStability(opProfiles, opWeights),
    [opProfiles, opWeights]
  );

  /** 지금 보고 있는 축의 점수를 꺼낸다 (종합 / 수요 / 성과) */
  const viewScoreOf = (r: ReturnType<typeof combineOpScore> | undefined): number | null =>
    !r ? null : opView === '종합' ? r.score : r.axisScores[opView];

  /**
   * Op Score 표 — 지금 보는 축 기준 내림차순. 점수를 못 낸 분야는 맨 뒤로.
   * 티어 경계에서 구분선을 긋기 위해 tierStart 를 같이 계산한다.
   */
  const opRows = useMemo(() => {
    const rows = categories
      .filter((c) => c.opProfile && c.category !== '기타')
      .map((c) => ({
        category: c,
        result: opScores.get(c.category)!,
        stability: opStability.get(c.category) ?? null,
      }))
      .sort((a, b) => (viewScoreOf(b.result) ?? -1) - (viewScoreOf(a.result) ?? -1));
    // 티어 안에서의 순번 + 티어가 바뀌는 첫 행 표시
    let prev: OpTier | null = null;
    let within = 0;
    return rows.map((r) => {
      const tier = r.stability?.tier ?? null;
      const isStart = tier !== null && tier !== prev;
      if (isStart) within = 0;
      within += 1;
      prev = tier;
      return { ...r, tier, tierStart: isStart, rankInTier: within };
    });
  }, [categories, opScores, opStability, opView]);

  /** 티어별 분야 수 — 헤더 요약용 */
  const tierCounts = useMemo(() => {
    const m = new Map<OpTier, number>();
    for (const r of opRows) if (r.tier) m.set(r.tier, (m.get(r.tier) ?? 0) + 1);
    return m;
  }, [opRows]);

  /** 수강률 × 취업률 산점도 (표본 = 버블 크기) */
  const pickWinData = useMemo(
    () =>
      opRows
        .filter((r) => r.category.matureYieldRate !== null && r.category.latestShare !== null)
        .map((r) => ({
          category: r.category.category,
          x: r.category.matureYieldRate as number,
          y: r.category.latestShare as number,
          z: Math.max(r.category.matureTargetPop ?? 0, 1),
          tier: r.tier,
          rounds: r.category.latestEnrollmentPerRound,
        })),
    [opRows]
  );

  /**
   * 2×2 버블 — 축이 곧 배출 점수 × 도달 점수다.
   * 예전엔 x=relativeDemandSlope, y=성숙 취업률(절대값)이라 아래 표의 점수와 재료가 달랐고,
   * 그래서 "분면은 유망인데 점수는 중위권" 같은 어긋남이 생겼다. 이제 같은 값을 쓴다.
   */
  const quadrantData = useMemo(
    () =>
      categories
        .map((c) => ({ c, r: opScores.get(c.category) }))
        .filter(
          (x): x is { c: CategorySummary; r: ReturnType<typeof combineOpScore> } =>
            !!x.r && x.c.matureYieldIndex !== null && x.c.recentShareShift !== null
        )
        .map(({ c, r }) => ({
          category: c.category,
          x: c.matureYieldIndex as number,
          y: c.recentShareShift as number,
          z: Math.max(c.matureEmployed ?? 0, 1),
          share: c.latestShare,
          yieldRate: c.matureYieldRate,
          employed: c.matureEmployed,
          shift: c.recentShareShift,
          empIndex: c.matureEmploymentIndex,
          quadrant: quadrantOf(c.matureYieldIndex, c.recentShareShift),
        })),
    [categories, opScores]
  );

  /** 두 축이 크게 갈린 분야 — 종합 점수 하나로 설명이 안 되는 곳 */
  const divergentRows = useMemo(
    () =>
      opRows
        .filter((r) => r.result.axisGap !== null && Math.abs(r.result.axisGap) >= OP_AXIS_DIVERGENCE)
        .sort((a, b) => Math.abs(b.result.axisGap!) - Math.abs(a.result.axisGap!)),
    [opRows]
  );

  const opRanked = opRows.filter((r) => r.result.score !== null).length;

  /** 프리셋을 고르면 그 가중치로 갈아끼운다. 슬라이더를 만지면 프리셋은 '사용자'로 바뀐다. */
  const applyPreset = (name: string) => {
    const p = OP_WEIGHT_PRESETS.find((x) => x.name === name);
    if (!p) return;
    setActivePreset(name);
    setOpWeights({ ...p.weights });
  };

  const setWeight = (key: OpComponentKey, value: number) => {
    setActivePreset('사용자 지정');
    setOpWeights((w) => ({ ...w, [key]: value }));
  };

  const weightTotal = OP_COMPONENTS.reduce((a, c) => a + (opWeights[c.key] ?? 0), 0);

  const sorted = useMemo(() => {
    const arr = [...categories];
    arr.sort((a, b) => {
      // Op Score 는 CategorySummary 에 없다(가중치가 화면 상태라서). 별도로 꺼낸다.
      const av = sortKey === 'opScore' ? opScores.get(a.category)?.score ?? null : a[sortKey];
      const bv = sortKey === 'opScore' ? opScores.get(b.category)?.score ?? null : b[sortKey];
      const an = av === null || av === undefined ? -Infinity : Number(av);
      const bn = bv === null || bv === undefined ? -Infinity : Number(bv);
      return sortAsc ? an - bn : bn - an;
    });
    return arr;
  }, [categories, sortKey, sortAsc, opScores]);

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

  /** 선택된 분야의 과정 목록 — 이름/기관으로 거른다 */
  const selectedCourses = useMemo(() => {
    const list = selectedCategory?.courses ?? [];
    const q = courseQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.courseName.toLowerCase().includes(q) ||
        c.institutions.some((i) => i.toLowerCase().includes(q))
    );
  }, [selectedCategory, courseQuery]);

  // 분야를 바꾸면 이전 분야에서 치던 검색어가 남아 "과정이 없다"로 보인다.
  useEffect(() => {
    setCourseQuery('');
  }, [selected]);

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

      {/* ── Op Score — 현업 배출력 ──
          두 축을 **따로** 세운다. 합친 종합은 옆에 작게 두는 참고값일 뿐이다 —
          합치는 순간 '수요는 죽었는데 성과는 좋다'와 그 반대가 같은 숫자가 되기 때문.
          가중치 슬라이더와 순위 변동 폭을 점수 옆에 붙여 '이 순위가 얼마나 가중치에
          의존하는가'를 같이 보게 한다. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            분야 티어 — 유망도 계층
            <span className="ml-2 text-xs font-normal text-gray-500">
              배출 · 상승세 · 규모 세 축 · 순위가 아니라 <strong>티어</strong>로 읽으세요
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 경고를 각주로 내리면 아무도 안 읽는다. 점수보다 위에 둔다. */}
          <div className="space-y-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>
              <strong>가중치에 근거는 없습니다.</strong> 무엇을 중요하게 보느냐에 따라 &lsquo;유망 분야&rsquo;의
              답이 실제로 바뀝니다 — 아래 프리셋을 눌러 보면 상위권 순서가 그때그때 뒤집히는 걸 볼 수 있습니다.
              데이터도 계속 쌓이는 중이라 점수는 고정값이 아닙니다.
            </p>
            <p>
              <strong>유망도는 한 가지로 정해지지 않습니다.</strong> 두 가지를 같이 봅니다 —{' '}
              <strong>① 지금 취업이 되는가(배출 60%)</strong>,{' '}
              <strong>② 해마다 오르고 있는가(상승세 40%)</strong>. &lsquo;상승세&rsquo;는 수준이 아니라{' '}
              <em>방향</em>을 재는 축입니다 — 시장 대비 취업률이 해마다 올라가는지(취업률 추세)와,
              신청인원 점유율이 늘고 있는지(점유율 추세) 둘을 봅니다.
            </p>
            <p>
              <strong>규모(배출 점유)는 점수에서 뺐습니다</strong>(가중치 0). 규모를 25%로 넣었더니
              AI/머신러닝이 2위였는데, 그 분야의 배출률은{' '}
              <strong>37.6%로 시장({pct(data?.thresholds?.marketYieldRate, 1)}) 아래</strong>입니다 — 1인당
              성과는 중앙값 이하인데 덩치가 최상위라 점수를 끌어올린,{' '}
              <strong>&lsquo;많이 듣지만 취업은 덜 되는&rsquo; 함정</strong>이었습니다. 게다가 분야가 크다고
              훈련기관이 가져가는 몫이 늘지도 않습니다 (분야 크기 ↔ 기관당 신청인원 상관 0.11, 분야 크기 ↔
              기관 수 상관 0.76 — 경쟁자만 늡니다). 규모는 이미 <strong>신뢰도</strong>에 반영돼 있어 점수에
              또 넣으면 두 번 세는 셈입니다. 지표 자체는 오른쪽 <strong>배출 점유</strong> 칸에 그대로 있습니다.
            </p>
            <p>
              핵심 재료인 <strong>배출률</strong>은 수료율과 취업률을 따로 평균내지 않고 퍼널로 곱한 값입니다
              (수강신청 100명 중 현업 취업까지 간 사람 수, 시장 전체{' '}
              <strong>{pct(data?.thresholds?.marketYieldRate, 1)}</strong>). 곱이라 어느 단계가 무너지면 자동으로
              같이 무너집니다.
            </p>
          </div>

          {/* 보기 — 합칠지 말지를 사용자가 정한다 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">정렬</span>
            {(['종합', ...OP_AXES] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setOpView(v)}
                title={
                  v === '종합'
                    ? '세 축을 가중합한 종합 점수로 정렬합니다.'
                    : `${v} 축 점수로 정렬합니다 — ${OP_AXIS_QUESTION[v]}.`
                }
                className={`rounded border px-2.5 py-1 text-xs transition ${
                  opView === v
                    ? 'border-blue-300 bg-blue-50 font-medium text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v === '종합' ? '종합순' : `${v}순`}
              </button>
            ))}
          </div>

          {/* 프리셋 — 관점 하나 = 클릭 한 번 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">관점</span>
            {OP_WEIGHT_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p.name)}
                title={p.desc}
                className={`rounded border px-2.5 py-1 text-xs transition ${
                  activePreset === p.name
                    ? 'border-blue-300 bg-blue-50 font-medium text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.name}
              </button>
            ))}
            {activePreset === '사용자 지정' && (
              <span className="rounded border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                사용자 지정
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowWeights((v) => !v)}
              className="ml-auto rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              {showWeights ? '가중치 접기' : '가중치 직접 조정'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {OP_WEIGHT_PRESETS.find((p) => p.name === activePreset)?.desc ??
              '슬라이더로 직접 맞춘 가중치입니다.'}
          </p>

          {showWeights && (
            <div className="grid gap-x-6 gap-y-3 rounded border border-gray-200 bg-gray-50 p-3 md:grid-cols-2">
              {OP_COMPONENTS.map((spec) => (
                <div key={spec.key} className="flex items-center gap-3">
                  <span
                    className="w-24 shrink-0 text-xs text-gray-700"
                    title={spec.hint}
                  >
                    {spec.label}
                    <span className="ml-1 text-[10px] text-gray-400">{spec.axis}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={Math.round(opWeights[spec.key] ?? 0)}
                    onChange={(e) => setWeight(spec.key, Number(e.target.value))}
                    className="h-1 flex-1 cursor-pointer accent-blue-600"
                  />
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-gray-600">
                    {Math.round(opWeights[spec.key] ?? 0)}
                    <span className="text-gray-400">
                      {' '}
                      ({weightTotal > 0 ? Math.round(((opWeights[spec.key] ?? 0) / weightTotal) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
              <div className="md:col-span-2 flex items-center justify-between border-t border-gray-200 pt-2 text-xs text-gray-500">
                <span>
                  가중치 합 {Math.round(weightTotal)} — 합이 100이 아니어도 됩니다(비율로 정규화합니다).
                </span>
                <button
                  type="button"
                  onClick={() => applyPreset('기본')}
                  className="rounded border border-gray-300 bg-white px-2 py-0.5 hover:bg-gray-50"
                >
                  기본값으로
                </button>
              </div>
            </div>
          )}

          {/* ── 픽률 × 승률 ──
              가로 = 배출률(취업률, 수강신청 100명 중 현업 취업까지 간 사람 수), 세로 = 점유율
              (수강률, 훈련생이 이 분야를 고른 비율), 버블 = 표본.
              둘을 나란히 놓아야 '많이 듣지만 취업은 안 되는 분야'와 '숨은 강자'가 갈린다.
              종합 점수 하나로는 이 둘이 같은 숫자가 된다. */}
          <div className="mb-4 rounded border border-gray-200 bg-gray-50/50 p-3">
            <div className="mb-1 text-sm font-medium text-gray-700">
              수강률 × 취업률 — 얼마나 고르는가 × 골라서 취업까지 가는가
            </div>
            <div className="mb-2 text-xs text-gray-500">
              세로 = 최근 개강 코호트에서 이 분야를 고른 훈련생 비율 · 가로 = 성숙 코호트 배출률
              (세로 점선 {pct(data?.thresholds?.marketYieldRate, 1)} = 시장 평균) · 버블 = 표본(성숙 코호트 취업대상자)
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <ScatterChart margin={{ top: 16, right: 32, bottom: 32, left: 20 }}>
                <CartesianGrid stroke={GRID} />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="배출률"
                  unit="%"
                  domain={[30, 55]}
                  tick={{ fill: INK_MUTED, fontSize: 11 }}
                  label={{ value: '배출률 (취업률) →', position: 'insideBottom', offset: -18, fill: INK_MUTED, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="점유율"
                  unit="%"
                  tick={{ fill: INK_MUTED, fontSize: 11 }}
                  label={{ value: '점유율 (수강률) →', angle: -90, position: 'insideLeft', fill: INK_MUTED, fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="z" range={[60, 700]} name="표본" />
                {data?.thresholds?.marketYieldRate != null && (
                  <ReferenceLine x={data.thresholds.marketYieldRate} stroke={INK_MUTED} strokeDasharray="4 4" />
                )}
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof pickWinData)[number];
                    return (
                      <div className="rounded border border-gray-200 bg-white p-2 text-xs shadow">
                        <div className="font-semibold text-gray-800">
                          {d.category} {d.tier && <span className="text-gray-400">· {d.tier}티어</span>}
                        </div>
                        <div className="text-gray-600">배출률 {d.x.toFixed(1)}% · 점유율 {d.y.toFixed(1)}%</div>
                        <div className="text-gray-500">
                          표본 {formatNumber(d.z)}명
                          {d.rounds != null && ` · 회차당 ${Math.round(d.rounds)}명`}
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter data={pickWinData} fill={ACCENT} fillOpacity={0.5} stroke="#fff" strokeWidth={2}>
                  <LabelList
                    dataKey="category"
                    position="top"
                    style={{ fontSize: 10, fill: INK_MUTED }}
                  />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <p className="mt-1 text-xs text-gray-500">
              오른쪽 아래(취업률 높고 수강률 낮음)가 <strong>숨은 강자</strong>, 왼쪽 위(수강률 높고
              취업률 낮음)가 <strong>많이 듣지만 취업은 덜 되는</strong> 분야입니다. 다만 KDT의 수강률에는
              정부가 승인한 회차 수가 섞여 있어 순수 선호가 아닙니다 — 툴팁의 회차당 신청인원을 같이 보세요.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-separate border-spacing-[2px] text-sm">
              <thead>
                <tr className="align-bottom">
                  <th className="w-16 px-2 py-1 text-center font-medium text-gray-600">
                    티어
                    <div className="text-[10px] font-normal text-gray-400">유지 77%</div>
                  </th>
                  <th className="w-40 px-2 py-1 text-left font-medium text-gray-600">분야</th>
                  {/* 배출률은 이 페이지 전체가 딛고 선 숫자다. 툴팁에 숨기지 않고 정면에 둔다. */}
                  <th className="w-24 px-2 py-1 text-center font-medium text-gray-600">
                    배출률
                    <div className="text-[10px] font-normal text-gray-400">
                      시장 {pct(data?.thresholds?.marketYieldRate, 1)}
                    </div>
                  </th>
                  {/* 수강률 — 배출률(취업률)과 짝이다. 둘을 나란히 두지 않으면
                      '많이 듣지만 취업은 안 되는 분야'가 안 보인다. */}
                  <th
                    className="w-24 px-2 py-1 text-center font-medium text-gray-600"
                    title="최근 개강 연도에 이 분야를 고른 훈련생 비율. KDT는 정부가 회차를 승인하므로 공급 성분이 섞여 있습니다 — 옆의 회차당 신청인원을 같이 보세요."
                  >
                    <span className="border-b border-dotted border-gray-400">점유율</span>
                    <div className="text-[10px] font-normal text-gray-400">회차당 신청</div>
                  </th>
                  <th
                    className="w-16 px-2 py-1 text-center font-medium text-gray-600"
                    title="배출률을 낸 성숙 코호트의 취업대상자 수"
                  >
                    표본
                  </th>
                  {/* 축(배출·상승세·규모) 점수는 칸으로 내보내지 않는다.
                      축끼리 편차가 커서 세 숫자를 나란히 두면 읽는 사람이 어느 쪽을
                      믿어야 할지 알 수 없다. 축은 '가중치 비율'로만 존재하고(위 슬라이더),
                      결과는 티어 하나로 읽는다. 지표별 원값은 오른쪽 칸에 그대로 있다. */}
                  <th className="w-24 px-2 py-1 text-center font-normal text-gray-500">
                    Op Score
                    <div className="text-[10px] font-normal text-gray-400">티어 산정용</div>
                  </th>
                  <th className="w-24 px-2 py-1 text-center font-medium text-gray-600">판정</th>
                  <th className="w-32 px-2 py-1 text-left font-medium text-gray-600">
                    순위 변동 폭
                    <div className="text-[10px] font-normal text-gray-400">가중치 ±40% · 400회</div>
                  </th>
                  {OP_COMPONENTS.map((spec) => (
                    <th
                      key={spec.key}
                      className="px-1 py-1 text-center text-[11px] font-medium text-gray-600"
                      title={spec.hint}
                    >
                      {spec.label}
                      <div className="text-[10px] font-normal text-gray-400">
                        {Math.round(((opWeights[spec.key] ?? 0) / (weightTotal || 1)) * 100)}%
                      </div>
                    </th>
                  ))}
                  <th className="w-16 px-2 py-1 text-center font-medium text-gray-600">
                    신뢰도
                    <div className="text-[10px] font-normal text-gray-400">0~1</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {opRows.map((row, i) => {
                  const c = row.category;
                  const r = row.result;
                  const st = row.stability;
                  const prof = c.opProfile!;
                  const gap = r.axisGap;
                  const diverged = gap !== null && Math.abs(gap) >= OP_AXIS_DIVERGENCE;
                  const quad = quadrantOf(c.matureYieldIndex, c.recentShareShift);
                  return (
                    <tr
                      key={c.category}
                      onClick={() => setSelected(selected === c.category ? null : c.category)}
                      className={`cursor-pointer ${selected === c.category ? 'bg-blue-50' : ''} ${
                        row.tierStart && i > 0 ? 'border-t-2 border-gray-300' : ''
                      }`}
                    >
                      {/* 티어 — 티어가 바뀌는 첫 행에만 배지를 찍는다. 매 행에 찍으면
                          '개별 등급'처럼 읽혀서 계층으로 보라는 취지가 사라진다. */}
                      <td className="px-2 py-1 text-center align-top">
                        {row.tier && row.tierStart ? (
                          <span
                            className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold ${TIER_BADGE[row.tier]}`}
                            title={`${OP_TIER_LABEL[row.tier]} — ${OP_TIER_DESC[row.tier]}\n이 티어 ${tierCounts.get(row.tier) ?? 0}개 분야`}
                          >
                            {row.tier}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-300">·</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-400">
                            {r.score === null ? '·' : i + 1}
                          </span>
                          <span
                            className={
                              selected === c.category
                                ? 'font-semibold text-blue-700'
                                : 'text-gray-800'
                            }
                          >
                            {c.category}
                          </span>
                          {/* 티어 경계에 걸친 분야는 숨기지 않고 표시한다 */}
                          {st && st.tierRetention < OP_TIER_BORDERLINE && (
                            <span
                              className="rounded bg-orange-50 px-1 text-[10px] text-orange-600"
                              title={`가중치를 흔들면 ${Math.round((1 - st.tierRetention) * 100)}% 확률로 티어가 바뀝니다 (도달 티어 ${st.tierSpan.join('·')})`}
                            >
                              경계
                            </span>
                          )}
                        </span>
                      </td>
                      <td
                        className="px-2 py-1 text-center text-xs tabular-nums"
                        title={`성숙 코호트 기준 수강신청 ${formatNumber(
                          Math.round((c.matureEmployed ?? 0) / ((c.matureYieldRate ?? 1) / 100))
                        )}명 중 ${formatNumber(c.matureEmployed ?? 0)}명이 현업 취업
시장 전체 ${pct(
                          data?.thresholds?.marketYieldRate,
                          1
                        )} 대비 지수 ${c.matureYieldIndex ?? '-'}`}
                      >
                        <span
                          className={
                            (c.matureYieldIndex ?? 100) >= 100
                              ? 'font-semibold text-blue-700'
                              : 'text-gray-600'
                          }
                        >
                          {pct(c.matureYieldRate, 1)}
                        </span>
                        <div className="text-[10px] text-gray-400">
                          {formatNumber(c.matureEmployed ?? 0)}명
                        </div>
                      </td>
                      {/* 점유율(픽률) + 회차당 신청인원. 후자를 같이 두는 이유는
                          점유율에 '정부가 회차를 몇 개 열어줬나'가 섞여 있기 때문이다. */}
                      <td className="px-2 py-1 text-center text-xs tabular-nums">
                        <span className="text-gray-700">{pct(c.latestShare, 1)}</span>
                        <div className="text-[10px] text-gray-400">
                          {c.latestEnrollmentPerRound === null || c.latestEnrollmentPerRound === undefined
                            ? '-'
                            : `${Math.round(c.latestEnrollmentPerRound)}명/회차`}
                        </div>
                      </td>
                      <td className="px-2 py-1 text-center">
                        {(() => {
                          const b = sampleBadge(c.matureTargetPop);
                          return (
                            <span className={`text-[11px] ${b.cls}`} title={b.title}>
                              {b.label}
                            </span>
                          );
                        })()}
                      </td>
                      {/* 축 사이는 단순 가중평균이다 (배출 60 · 상승세 40 · 규모 0, 기본값 기준).
                          비보완성은 이미 배출률(수료율 × 취업률) 안에 들어 있어 별도 페널티가 필요 없다. */}
                      <td className="px-2 py-1 text-center">
                        {r.score === null ? (
                          <span className="text-xs italic text-gray-400">{r.omitReason}</span>
                        ) : (
                          <span
                            className="inline-flex flex-col items-center leading-tight"
                            title={
                              OP_AXES.map((ax) => `${ax} ${r.axisScores[ax] ?? '-'}`).join(' · ') +
                              ` → 가중합 ${r.rawScore}
신뢰도 ×${prof.reliability} → ${r.score}`
                            }
                          >
                            <span className="font-semibold tabular-nums text-gray-800">
                              {r.score.toFixed(0)}
                            </span>
                            {diverged && (
                              <span
                                className="text-[10px] text-gray-400"
                                title="축 사이 점수 차가 커서 종합 하나로는 설명이 안 됩니다"
                              >
                                편차 {gap!.toFixed(0)}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {quad ? (
                          <span className={`rounded border px-1.5 py-0.5 text-[11px] ${QUADRANT_BADGE[quad]}`}>
                            {QUADRANT_SHORT[quad]}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">·</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {st ? (
                          <span
                            className="flex items-center gap-1.5"
                            title={`가중치를 무작위로 흔들면 ${st.bestRank}위 ~ ${st.worstRank}위 (중앙 ${st.medianRank}위) · 상위 5위 진입 ${Math.round(st.top5Rate * 100)}%`}
                          >
                            <span className="relative h-3 flex-1 rounded-sm bg-gray-100">
                              <span
                                className="absolute inset-y-0 rounded-sm bg-gray-300"
                                style={{
                                  left: `${((st.bestRank - 1) / opRanked) * 100}%`,
                                  width: `${((st.worstRank - st.bestRank + 1) / opRanked) * 100}%`,
                                }}
                              />
                              <span
                                className="absolute inset-y-0 w-[2px]"
                                style={{
                                  left: `${((st.medianRank - 0.5) / opRanked) * 100}%`,
                                  background: ACCENT,
                                }}
                              />
                            </span>
                            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-gray-500">
                              {st.bestRank}~{st.worstRank}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">·</span>
                        )}
                      </td>
                      {OP_COMPONENTS.map((spec) => {
                        const comp = prof.components[spec.key];
                        const { bg, fg } = opCell(comp?.score ?? null);
                        return (
                          <td
                            key={spec.key}
                            className="px-1 py-1 text-center text-xs tabular-nums"
                            style={{ background: bg, color: fg }}
                            title={
                              comp?.score === null || comp === undefined
                                ? `${spec.label}: 산출 불가 — 가중치를 나머지 지표로 재분배했습니다`
                                : `${spec.label} ${comp.value}${spec.unit === '점' ? '점' : ''} → 지표점수 ${comp.score} (시장 중앙값 대비 z ${comp.z})`
                            }
                          >
                            {comp?.score === null || comp === undefined ? '·' : comp.score.toFixed(0)}
                          </td>
                        );
                      })}
                      {/* 신뢰도는 숫자만 두면 "왜 낮은데?"에 답을 못 한다. 병목 항목을 같이 적는다. */}
                      <td
                        className={`px-2 py-1 text-center text-xs tabular-nums ${
                          prof.reliability < 0.6 ? 'text-amber-600' : 'text-gray-500'
                        }`}
                        title={`신뢰도 = 세 항목의 기하평균 (가장 낮은 항목이 사실상 결정한다)\n· 추이 연도 ${prof.reliabilityParts.trendYears}\n· 취업 표본 ${prof.reliabilityParts.employment}\n· 규모 ${prof.reliabilityParts.scale}\n\n병목: ${prof.reliabilityDetail}`}
                      >
                        {prof.reliability.toFixed(2)}
                        {prof.reliabilityBottleneck && (
                          <div className="text-[10px] font-normal text-gray-400">
                            {prof.reliabilityBottleneck}↓
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {divergentRows.length > 0 && (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <strong className="text-gray-800">두 축이 크게 갈린 분야</strong> (배출·도달 축이{' '}
              {OP_AXIS_DIVERGENCE}점 이상 갈림):{' '}
              {divergentRows.map((r, i) => (
                <span key={r.category.category}>
                  {i > 0 && ' · '}
                  <button
                    type="button"
                    onClick={() =>
                      setSelected(selected === r.category.category ? null : r.category.category)
                    }
                    className="underline decoration-dotted underline-offset-2 hover:text-blue-700"
                  >
                    {r.category.category}
                  </button>
                  <span className="text-gray-400">
                    {' '}
                    ({r.result.axisGap! > 0 ? '수요↓성과↑' : '수요↑성과↓'} {Math.abs(r.result.axisGap!).toFixed(0)}점)
                  </span>
                </span>
              ))}
            </div>
          )}

          <div className="space-y-1.5 text-xs text-gray-500">
            <p>
              <strong>티어</strong>: 순위가 아니라 <strong>계층</strong>이 판단 단위입니다. 가중치를 ±40%
              무작위로 4,000회 흔들면 개별 순위는 평균 <strong>7.0위</strong>씩 움직이지만(21개 분야 기준),
              티어는 <strong>77%</strong> 그대로입니다. 1위와 4위는 구분할 수 없고, S티어인지 C티어인지는
              구분할 수 있습니다. 경계는 등분이 아니라 점수축에서 실제로 벌어진 곳(자연 절단점)에 둡니다.
              흔들면 티어가 바뀌는 분야에는 <strong>경계</strong> 표시가 붙습니다.
            </p>
            <p>
              <strong>왜 순위가 안 잡히는가</strong>: 지표 5개가 서로 거의 무상관이기 때문입니다(|ρ|&lt;0.5).
              각 축이 일부러 다른 질문을 하도록 만들었으니 당연한 결과이고, 지표를 빼도 좁아지지 않습니다
              (만족도를 빼면 오히려 8.8위로 늘어납니다). 순위를 좁히려면 지표를 하나로 줄여야 하는데, 그건
              답을 좁히는 게 아니라 눈을 감는 것입니다.
            </p>
            <p>
              <strong>축 점수</strong>: 각 막대의 가운데 세로선이 <strong>50 = 분야 중앙값</strong>입니다.
              <strong>Op Score</strong>는 세 축의 가중평균(기본값 <strong>배출 60 · 상승세 40 · 규모 0</strong>)에 신뢰도를
              곱해 50 쪽으로 당긴 값이고, 지금은 <strong>티어를 정하는 내부 값</strong>입니다. 축 사이에 별도
              보완성 페널티는 없습니다 — 비보완성은 이미 배출률(수료율 × 취업률) 안에 들어 있기 때문입니다.
            </p>
            <p>
              <strong>신뢰도</strong>: ① 추이를 잴 만큼 개강연도가 있는가 ② 성숙 코호트 취업대상자가 충분한가
              ③ 분야 규모가 충분한가 — 이 셋의 <strong>기하평균</strong>입니다. 곱으로 묶었기 때문에 하나만 얇아도
              전체가 내려갑니다(규모가 커도 개강연도가 3개면 &lsquo;기울기&rsquo;를 믿을 수 없으니까요). 숫자 아래
              적힌 항목이 <strong>그 분야의 병목</strong>이고, 칸에 마우스를 올리면 실제 관측값이 나옵니다.
            </p>
            <p>
              <strong>순위 변동 폭</strong>: 지금 가중치를 중심으로 각 지표 가중치를 0~2배 사이에서 무작위로 400번
              흔들었을 때 그 분야가 오간 순위 범위입니다(세로선 = 중앙값). 폭이 좁으면 어떤 관점에서 봐도 그
              자리이고, 폭이 넓으면 <strong>순위가 사실상 가중치가 정한 것</strong>이라 단독으로 믿으면 안 됩니다.
            </p>
            <p>
              <strong>구성 지표 5칸</strong>: 0~100 으로 정규화된 지표별 점수입니다. 50 = 22개 분야의 중앙값.
              칸에 마우스를 올리면 원값이 나옵니다. &lsquo;·&rsquo;는 산출 불가로, 그 가중치는 0으로 치지 않고
              남은 지표에 <strong>재분배</strong>합니다(신생 분야가 데이터 공백만으로 지지 않도록). 만족도처럼 분야 간 값이 촘촘한 지표는 <strong>지표별 최소 유효 차이</strong>를 스케일 하한으로 두어,
              만족도 4.2와 4.3처럼 사실상 같은 값이 큰 점수 차로 벌어지지 않게 했습니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Q2. 2×2 — 축이 곧 배출 점수 × 도달 점수. 위 점수표와 같은 값을 쓴다 ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            취업이 되는가 × 규모가 커지는가 — 유망직종 판별
            <span className="ml-2 text-xs font-normal text-gray-500">
              가로 100 = 시장 평균만큼 배출 · 세로 0 = 점유율 유지 · 버블 = 현업 배출 인원
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={440}>
            <ScatterChart margin={{ top: 24, right: 40, bottom: 36, left: 28 }}>
              <CartesianGrid stroke={GRID} />
              <XAxis
                type="number"
                dataKey="x"
                name="배출률 지수"
                // ⚠️ domain 에 'dataMin - N' 같은 문자열을 쓰면 ZAxis(버블 크기) 스케일까지
                // 같이 망가져서 점이 1px 로 찍힌다. 고정 도메인을 쓴다.
                domain={[70, 140]}
                ticks={[70, 85, 100, 115, 130]}
                tickLine={false}
                axisLine={{ stroke: GRID }}
                tick={{ fill: INK_MUTED, fontSize: 12 }}
                label={{
                  value: '배출률 지수 — 100 = 시장 평균만큼 현업으로 내보냄 (오른쪽일수록 잘 배출)',
                  position: 'bottom',
                  offset: 12,
                  style: { fill: INK_MUTED, fontSize: 12 },
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="규모 성장"
                domain={[-9, 9]}
                ticks={[-8, -4, 0, 4, 8]}
                tickLine={false}
                axisLine={false}
                tick={{ fill: INK_MUTED, fontSize: 12 }}
                width={52}
                label={{
                  value: '규모 성장 — 최근 3개 코호트의 신청인원 점유율 변화 (%p)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: -4,
                  style: { fill: INK_MUTED, fontSize: 12, textAnchor: 'middle' },
                }}
              />
              <ZAxis type="number" dataKey="z" range={[80, 900]} name="현업 배출 인원" />
              <ReferenceLine x={100} stroke={INK_MUTED} strokeDasharray="4 4" />
              <ReferenceLine y={0} stroke={INK_MUTED} strokeDasharray="4 4" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof quadrantData)[number];
                  return (
                    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                      <div className="font-semibold text-gray-900">{d.category}</div>
                      <div className="mt-1 text-gray-600">
                        배출률 {pct(d.yieldRate, 1)} (지수 {d.x.toFixed(0)}) · 배출 {formatNumber(d.employed)}명
                      </div>
                      <div className="text-gray-600">도달 점수 {d.y.toFixed(0)}</div>
                      <div className="mt-1 text-gray-500">
                        최근 점유 {pct(d.share)} · 점유 이동 {signed(d.shift, '%p')}
                      </div>
                      <div className="text-gray-500">취업 지수 {d.empIndex ?? '-'} (100 = 시장 평균)</div>
                      <div className="text-gray-500">누적 수강신청 {formatNumber(d.z)}명</div>
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
                <span className={`shrink-0 rounded border px-1.5 py-0.5 ${QUADRANT_BADGE[q]}`}>
                  {QUADRANT_SHORT[q]}
                </span>
                <span>{QUADRANT_LABEL[q].split('— ')[1]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            <strong>&ldquo;취업이 잘 될 수 있는 상황에서, 규모가 얼마나 잘 늘어나는가&rdquo;</strong>를 그대로
            두 축으로 옮긴 평면입니다. 가로 = 배출률 지수(100 = 시장 평균{' '}
            {pct(data?.thresholds?.marketYieldRate, 1)}), 세로 = 최근 3개 코호트의 신청인원 점유율 변화(%p),
            버블 크기 = 실제 현업 배출 인원. <strong>오른쪽 위가 유망</strong>(취업도 되고 규모도 큼),{' '}
            <strong>왼쪽 위가 성장·개선필요</strong>(규모는 커지는데 배출률이 아직 시장 이하 — 전환을 고치면
            가장 크게 남는 곳), 오른쪽 아래가 안정·틈새(취업은 되는데 규모가 안 큼)입니다. 위 표의 판정 배지와 정확히 같은 기준입니다.
          </p>
        </CardContent>
      </Card>

      {/* ── 표 뷰 (색 대비 relief + 정렬/드릴다운 진입점) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            분야별 지표 · 진입 여건 — 행을 클릭하면 과정 목록과 연도별 상세가 열립니다
            <span className="ml-2 text-xs font-normal text-gray-500">
              오른쪽 세 칸은 &lsquo;다른 기관이 들어가기 유리한가&rsquo;를 보는 칸입니다
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>분야</TableHead>
                <SortableHead label="Op Score" k="opScore" {...{ sortKey, sortAsc, toggleSort }} />
                <SortableHead label="누적 신청" k="totalEnrollment" {...{ sortKey, sortAsc, toggleSort }} />
                <SortableHead label="최근 점유율" k="latestShare" {...{ sortKey, sortAsc, toggleSort }} />
                <SortableHead
                  label="회차당 신청"
                  k="latestEnrollmentPerRound"
                  {...{ sortKey, sortAsc, toggleSort }}
                />
                <SortableHead label="회차당 추세" k="relativeDemandSlope" {...{ sortKey, sortAsc, toggleSort }} />
                <SortableHead label="성숙 취업률" k="matureEmploymentRate" {...{ sortKey, sortAsc, toggleSort }} />
                <SortableHead
                  label="취업률 시장대비 추세"
                  k="relativeEmploymentSlope"
                  {...{ sortKey, sortAsc, toggleSort }}
                />
                <SortableHead label="만족도" k="satisfaction" {...{ sortKey, sortAsc, toggleSort }} />
                {/* ── 진입 여건: 다른 기관이 이 분야에 들어갈 만한가 ── */}
                <TableHead className="text-right">
                  기관 수
                  <div className="text-[10px] font-normal text-gray-400">최근 · 증감</div>
                </TableHead>
                <TableHead className="text-right">
                  기관당 신청
                  <div className="text-[10px] font-normal text-gray-400">한 곳이 가져가는 몫</div>
                </TableHead>
                <TableHead className="text-right">
                  상위3 점유
                  <div className="text-[10px] font-normal text-gray-400">낮을수록 비집기 쉬움</div>
                </TableHead>
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
                  <TableCell className="text-right font-semibold tabular-nums">
                    {opScores.get(c.category)?.score?.toFixed(0) ?? (
                      <span className="text-xs font-normal italic text-gray-400">
                        {opScores.get(c.category)?.omitReason ?? '-'}
                      </span>
                    )}
                    {opStability.get(c.category) && (
                      <span className="ml-1 text-[10px] font-normal text-gray-400">
                        ({opStability.get(c.category)!.bestRank}~{opStability.get(c.category)!.worstRank}위)
                      </span>
                    )}
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
                  <TableCell className="text-right tabular-nums">
                    {c.latestInstitutions}
                    {c.institutionChange !== null && c.institutionChange !== 0 && (
                      <span
                        className={`ml-1 text-xs ${
                          c.institutionChange > 0 ? 'text-orange-600' : 'text-gray-400'
                        }`}
                        title="최근 3개 완결 코호트의 기관 수 변화. 늘고 있으면 신규 진입이 몰리는 중"
                      >
                        {signed(c.institutionChange)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.enrollmentPerInstitution ?? '-'}명
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span
                      className={
                        (c.top3InstitutionShare ?? 0) >= 70 ? 'text-orange-600' : 'text-gray-600'
                      }
                      title={
                        (c.top3InstitutionShare ?? 0) >= 70
                          ? '상위 3곳이 70% 이상 — 과점 상태라 신규 진입이 어렵습니다'
                          : '상위 3곳 누적 신청인원 점유율'
                      }
                    >
                      {pct(c.top3InstitutionShare, 0)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {/* 위 점수표·평면과 같은 기준(배출 점수 50 × 도달 점수 50)을 쓴다.
                        서버의 c.quadrant 는 가중치와 무관한 기본 판정이라 여기선 쓰지 않는다. */}
                    {(() => {
                      const rr = opScores.get(c.category);
                      const q = quadrantOf(c.matureYieldIndex, c.recentShareShift);
                      return q ? (
                        <span className={`rounded border px-1.5 py-0.5 text-xs ${QUADRANT_BADGE[q]}`}>
                          {QUADRANT_SHORT[q]}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">표본 부족</span>
                      );
                    })()}
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
            <CardTitle className="text-base">
              {selectedCategory.category} — 이 분야에 있던 과정과 연도별 상세
              <span className="ml-2 text-xs font-normal text-gray-500">
                {selectedCategory.group} · 과정 {formatNumber(selectedCategory.distinctCourses)}개 ·
                회차 {formatNumber(selectedCategory.totalCourses)}개 · 누적 신청{' '}
                {formatNumber(selectedCategory.totalEnrollment)}명
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* ── 과정 목록 — "이 분야가 대체 뭘로 이뤄져 있나"에 먼저 답한다 ──
                집계 단위는 회차가 아니라 훈련과정 ID다. 회차 기준이면 SSAFY 하나가
                화면을 수십 줄 차지해서 분야의 구성이 안 보인다. */}
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-gray-700">
                  과정 목록
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    같은 과정의 반복 회차는 한 줄로 접었습니다 · 신청인원 순
                    {selectedCategory.courseListTruncated &&
                      ` · 상위 ${selectedCategory.courses.length}개만 표시 (전체 ${formatNumber(
                        selectedCategory.distinctCourses
                      )}개)`}
                  </span>
                </div>
                <input
                  type="search"
                  value={courseQuery}
                  onChange={(e) => setCourseQuery(e.target.value)}
                  placeholder="과정명 · 기관명 검색"
                  className="w-56 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="max-h-[26rem] overflow-auto rounded border border-gray-200">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-gray-600">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">과정명</th>
                      <th className="px-2 py-1.5 text-left font-medium">운영 기관</th>
                      <th className="px-2 py-1.5 text-right font-medium">개강</th>
                      <th className="px-2 py-1.5 text-right font-medium">회차</th>
                      <th className="px-2 py-1.5 text-right font-medium">신청</th>
                      <th className="px-2 py-1.5 text-right font-medium">수료율</th>
                      <th className="px-2 py-1.5 text-right font-medium">취업률</th>
                      <th className="px-2 py-1.5 text-right font-medium">만족도</th>
                      <th className="px-2 py-1.5 text-center font-medium" title="이 과정이 이 분야로 분류된 근거">
                        분류
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCourses.map((c) => {
                      const src = SOURCE_LABEL[c.taxonomySource] ?? SOURCE_LABEL.fallback;
                      return (
                        <tr key={c.courseId} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="max-w-[22rem] px-2 py-1.5">
                            <span className="block truncate text-gray-800" title={c.courseName}>
                              {c.courseName}
                            </span>
                            {c.aiBranded && (
                              <span className="text-[10px] text-amber-600" title="과정명에 AI가 붙어 있지만 AI 코어 과정은 아닙니다">
                                AI 브랜딩
                              </span>
                            )}
                          </td>
                          <td className="max-w-[14rem] px-2 py-1.5 text-gray-600">
                            <span className="block truncate" title={c.institutions.join(', ')}>
                              {c.institutions[0] ?? '-'}
                              {c.institutionCount > 1 && (
                                <span className="ml-1 text-xs text-gray-400">
                                  외 {c.institutionCount - 1}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums text-gray-500">
                            {c.firstYear === c.lastYear ? c.firstYear : `${c.firstYear}–${c.lastYear}`}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{c.rounds}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {formatNumber(c.enrollment)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{pct(c.completionRate, 0)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {c.employmentCoverage < MATURE_EMPLOYMENT_COVERAGE ? (
                              <span
                                className="text-gray-400"
                                title={`취업률 집계율 ${Math.round(c.employmentCoverage * 100)}% — 아직 안 나온 회차가 많습니다`}
                              >
                                {pct(c.employmentRate, 0)}*
                              </span>
                            ) : (
                              pct(c.employmentRate, 0)
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">
                            {c.satisfaction ?? '-'}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`rounded border px-1 py-0.5 text-[10px] ${src.cls}`}>
                              {src.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {selectedCourses.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-2 py-6 text-center text-sm text-gray-400">
                          검색 결과가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                &lsquo;분류&rsquo; 칸은 이 과정이 <strong>{selectedCategory.category}</strong>로 잡힌 근거입니다 —
                <span className="mx-1 rounded border border-violet-200 bg-violet-50 px-1 text-violet-700">수동</span>
                은 과정명만으로 분야를 알 수 없는 브랜드 과정(SSAFY 등)의 수동 매핑,
                <span className="mx-1 rounded border border-blue-200 bg-blue-50 px-1 text-blue-700">과정명</span>
                은 키워드 규칙,
                <span className="mx-1 rounded border border-amber-200 bg-amber-50 px-1 text-amber-700">NCS</span>
                는 과정명이 아무 규칙에도 안 걸려 NCS명으로 추정한 경우입니다. NCS 비중이 높으면 그 분야의 분류를
                의심해 볼 만합니다. * 표시는 취업률 집계가 덜 끝난 과정입니다.
              </p>
            </div>

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
            <strong>3. 「수요」를 무엇으로 재는가 — 정원은 값에 들어가지 않습니다.</strong> 이 페이지에는
            수요 지표가 두 종류 있고, 둘은 <strong>같은 말을 하지 않습니다</strong>.
          </p>
          <ol className="ml-4 list-decimal space-y-1 text-sm text-gray-600">
            <li>
              <strong>도달 이동 · 도달 규모</strong> (Op Score 도달 축) — 그 해 전체 신청인원 중 이
              분야가 차지하는 <strong>사람 수의 몫</strong>과 그 변화(%p)입니다. 분자도 분모도 실제 신청 인원이라
              회차 수·정원 같은 공급자 결정이 끼어들지 않습니다.
            </li>
            <li>
              <strong>회차당 추세</strong> — (분야 회차당 신청인원 ÷ 그 해 시장 전체 회차당 신청인원 × 100)의
              연도별 기울기입니다. 여기에도 정원은 값으로 들어가지 않습니다. 정원이 쓰이는 곳은 딱 한 군데,
              <strong>표본이 너무 작은 연도 셀을 빼는 필터</strong>(정원 100명 미만 제외)뿐입니다.
            </li>
          </ol>
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <strong>그런데 「회차당」 지표는 수요보다 공급을 잽니다.</strong> 이 데이터(분야×연도 114개 셀)로 재보면
            시장 대비 회차당 신청인원 지수는 <strong>회차당 정원과 r=0.835 — 분산의 70%</strong>가 &ldquo;회차를
            얼마나 크게 열었나&rdquo;로 설명됩니다. 신청 점유율과는 r=−0.10 으로 사실상 무관합니다. 실제로 답이
            갈립니다: <strong>AI/머신러닝</strong>은 점유율이 3년간 <strong>+7.3%p(전 분야 1위)</strong>로 늘었는데
            회차당 추세는 +0.44(거의 0)라 &ldquo;수요 정체&rdquo;라고 말합니다 — 회차를 잘게 쪼개 열었기 때문입니다.
            반대로 <strong>모바일</strong>은 회차당 추세 −46.28(꼴찌)이지만 점유 이동은 −0.5 에 불과합니다.
            그래서 Op Score 의 도달 축은 <strong>도달 이동 + 도달 규모</strong>(둘 다 사람 수 기준)만 쓰고,
            회차당 추세는 <strong>지표에서 아예 뺐습니다</strong>.
          </p>
          <p className="text-sm text-gray-600">
            <strong>2×2 분면 차트와 &lsquo;판정&rsquo; 배지도 같은 기준으로 통일했습니다.</strong> 가로축 =
            배출 점수, 세로축 = 도달 점수, 기준선 = 각각 50(시장 중앙값)입니다. 예전에는 차트가
            &lsquo;회차당 추세 × 절대 취업률&rsquo;이라 점수표와 재료가 달라서 &ldquo;분면은 유망인데 점수는
            중위권&rdquo; 같은 어긋남이 생겼습니다. API 응답의 <code className="rounded bg-gray-100 px-1">quadrant</code>
            필드도 점유 이동(0%p) × 취업 지수(100) 기준으로 바뀌었습니다.
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
            <strong>6. Op Score 는 &lsquo;정답&rsquo;이 아니라 요약입니다.</strong> 7개 지표를 22개 분야의{' '}
            <strong>중앙값·MAD 기준 z</strong>로 정규화하고(백분위가 아닙니다 — 백분위는 순위만 남기고 격차를
            버려서, 사실상 붙어 있는 세 분야를 크게 벌려 놓습니다), 가중평균한 뒤, 표본이 얇은 분야는 점수를
            50 쪽으로 끌어당깁니다. 취업률·수료율은 절대값이 아니라 <strong>그 분야가 실제로 쓴 코호트 연도의</strong>{' '}
            시장 평균 대비 지수를 씁니다. 산출 불가한 지표는 0으로 채우지 않고 가중치를 재분배합니다.
          </p>
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <strong>7. 가중치를 바꾸면 유망 분야의 답이 실제로 달라집니다.</strong> 이건 산식의 결함이 아니라
            &lsquo;유망하다&rsquo;는 말 자체가 관점에 따라 다르기 때문입니다. 취업성과를 앞세우면 성숙 코호트가
            두꺼운 분야가, 수요 선점을 앞세우면 아직 성과가 안 나온 신생 분야가 올라옵니다. 그래서 위 표는
            프리셋·슬라이더로 관점을 바꿔 볼 수 있게 하고, <strong>순위 변동 폭</strong>을 같이 보여줍니다.
            변동 폭이 넓은 분야는 &ldquo;몇 위&rdquo;라고 말하는 것 자체가 부정확합니다. 게다가 데이터는 계속
            들어오는 중이라 점수는 고정값이 아닙니다 — 최신 코호트의 취업률이 채워질 때마다 순서가 다시 움직입니다.
          </p>
          <p>
            <strong>8. 이 데이터로는 &lsquo;훈련시장 내부 경쟁력&rsquo;까지만 말할 수 있습니다.</strong> 실제
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
