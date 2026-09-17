// 매출 기본값 파생 — 엑셀이 하던 계산을 백엔드로 옮긴 것
//
// 왜 필요한가
// -----------
// `매출 최대`·`매출 최소`·`실 매출 대비`·`YYYY년` 은 지금까지 **엑셀 마스터에서
// 사람이 계산해 넣던 값**이다. 수집을 자동화하면 마스터에 없는 **신규 과정**이
// 매일 들어오는데, 수집기(K디지털_수집_통합.py)는 이 컬럼들을 채우지 않는다
// (MANUAL_COLUMNS 라 마스터에서 join 해 올 뿐이다).
// 그대로 두면 새로 개설된 과정이 전부 **매출 0** 으로 표시된다.
//
// 산식의 근거
// -----------
// 저장된 값 전수와 대조해 확인했다 (2026-09-17, kdt_data 7,230행):
//
//   매출 최대   = 훈련비 × 수강신청 인원      7,040/7,040 일치
//   매출 최소   = 훈련비 × 수료인원           6,574/6,574 일치
//   실 매출 대비 = 매출 최대 × 0.8            7,040/7,040 일치
//   YYYY년      = 실 매출 대비 × (그 해 달력일수 / 총 달력일수)
//                                            7,040/7,040 일치 (연도합도 일치)
//
// 불일치 0 건. 즉 이 계산은 엑셀을 **재현**하는 것이지 새 정의가 아니다.
//
// ★ 안전 원칙: 저장된 값이 있으면 절대 덮어쓰지 않는다.
//   비어 있을 때만 채운다. 그래야 "계산을 옮겼더니 기존 숫자가 변했다"가
//   구조적으로 불가능해진다. 과거 데이터는 그대로 두고 신규만 채워진다.

import { BASE_REVENUE_RATIO } from './revenue-factor';
import { REVENUE_START_YEAR, REVENUE_YEAR_LOOKAHEAD } from './revenue-years';

const MS_PER_DAY = 86_400_000;

function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  if (cleaned === '') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d : null;
}

/** 두 날짜를 **양 끝 포함**으로 센 일수. 하루짜리 과정이 1 이 되어야 한다. */
function inclusiveDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
}

export interface DerivedRevenue {
  '매출 최대': number;
  '매출 최소': number;
  '실 매출 대비': number;
  /** `2026년` 형태의 키 → 배분액 */
  years: Record<string, number>;
}

/**
 * 원시 값에서 매출 컬럼 일체를 계산한다. 계산 불가(훈련비/인원 0)면 0 이다.
 */
export function deriveRevenue(input: {
  훈련비?: unknown;
  수강신청인원?: unknown;
  수료인원?: unknown;
  과정시작일?: unknown;
  과정종료일?: unknown;
}): DerivedRevenue {
  const fee = num(input.훈련비);
  const enrolled = num(input.수강신청인원);
  const finished = num(input.수료인원);

  const max = fee * enrolled;
  const min = fee * finished;
  const real = max * BASE_REVENUE_RATIO;

  const years: Record<string, number> = {};
  const start = parseDate(input.과정시작일);
  const end = parseDate(input.과정종료일);

  if (real > 0 && start && end && end.getTime() >= start.getTime()) {
    const totalDays = inclusiveDays(start, end);
    // 상한을 '올해+1' 로 두는 이유는 revenue-years.ts 와 같다 — 연말 개강 과정의
    // 매출이 다음 해로 넘어간다.
    const lastYear = new Date().getFullYear() + REVENUE_YEAR_LOOKAHEAD;
    for (let y = REVENUE_START_YEAR; y <= lastYear; y++) {
      const yearStart = new Date(Date.UTC(y, 0, 1));
      const yearEnd = new Date(Date.UTC(y, 11, 31));
      const from = start.getTime() > yearStart.getTime() ? start : yearStart;
      const to = end.getTime() < yearEnd.getTime() ? end : yearEnd;
      const days = to.getTime() >= from.getTime() ? inclusiveDays(from, to) : 0;
      if (days > 0) years[`${y}년`] = real * (days / totalDays);
    }
  }

  return { '매출 최대': max, '매출 최소': min, '실 매출 대비': real, years };
}

export interface DeriveStats {
  /** 검사한 행 수 */
  total: number;
  /** 저장값이 비어 있어 계산으로 채운 행 수 */
  filled: number;
  /** 계산조차 불가능했던 행 (훈련비 또는 인원이 0) */
  unresolvable: number;
}

/**
 * DB 행(공백 표기 컬럼)에 매출 기본값을 채운다. **있는 값은 건드리지 않는다.**
 *
 * 반환하는 통계는 진단용이다 — "오늘 들어온 신규 과정 중 몇 건이 계산으로
 * 채워졌는가"를 API meta 로 노출해 두면 자동 수집이 정상인지 한눈에 보인다.
 */
export function fillMissingRevenue(rows: any[]): DeriveStats {
  const stats: DeriveStats = { total: rows.length, filled: 0, unresolvable: 0 };

  for (const row of rows) {
    const storedReal = num(row['실 매출 대비'] ?? row['실_매출_대비']);
    const storedMax = num(row['매출 최대'] ?? row['매출_최대']);
    if (storedReal > 0 && storedMax > 0) continue; // 이미 있다 — 손대지 않는다

    const d = deriveRevenue({
      훈련비: row['훈련비'],
      수강신청인원: row['수강신청 인원'] ?? row['수강신청_인원'],
      수료인원: row['수료인원'],
      과정시작일: row['과정시작일'],
      과정종료일: row['과정종료일'],
    });

    if (d['실 매출 대비'] <= 0) {
      stats.unresolvable += 1;
      continue;
    }

    if (storedMax <= 0) row['매출 최대'] = d['매출 최대'];
    if (num(row['매출 최소']) <= 0) row['매출 최소'] = d['매출 최소'];
    if (storedReal <= 0) row['실 매출 대비'] = d['실 매출 대비'];

    // 연도 배분도 비어 있을 때만. 한 해라도 값이 있으면 그 행은 이미 배분된 것으로 본다.
    const hasAnyYear = Object.keys(row).some(
      (k) => /^\d{4}년$/.test(k) && num(row[k]) > 0
    );
    if (!hasAnyYear) {
      for (const [k, v] of Object.entries(d.years)) row[k] = v;
    }

    stats.filled += 1;
  }

  return stats;
}
