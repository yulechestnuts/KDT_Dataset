// 업로드 안전장치 — 자동 수집이 데이터를 조용히 망가뜨리는 것을 막는다
//
// 왜 필요한가
// -----------
// 업로드가 사람 손이었을 때는 이상하면 사람이 알아챘다. 매일 자동으로 돌기
// 시작하면 아무도 안 본다. 그래서 "무엇이 무너지면 멈춰야 하는가"를 코드로 박는다.
// K-뉴딜 파이프라인의 급감 안전장치와 같은 역할이다.
//
// 실제로 잡아야 하는 사고 (2026-09-17 실측으로 확인된 것들)
// ---------------------------------------------------------
// 1) 만족도 척도 오염 — 수집기(K디지털_수집_통합.py)는 목록 API 의 `stdgScor` 를
//    만족도로 쓰는데 그건 **100점 척도**다(84.3, 77.2, 91.5). DB 는 **5점 척도**다
//    (1.0~5.0, 중앙값 4.4). 그대로 들어오면 만족도가 20배가 된다.
// 2) 회차별 만족도 붕괴 — 같은 `stdgScor` 가 **과정 단위 평균**이라 한 과정의 모든
//    회차에 같은 값이 박힌다(실측 36/36 동일). 지금 DB 는 회차마다 다른 실값이다
//    (여러 회차 과정 1,020개 중 939개가 회차마다 다름 = 동일값은 1.6%뿐).
//    이걸 덮으면 크롤링해 모은 회차별 만족도가 통째로 사라진다.
// 3) 수기 컬럼 전멸 — 수집기를 `--master` 없이 돌리면 자비부담금·선도기업·매출이
//    전부 빈칸으로 나온다(실측). 자비부담금이 날아가면 AI캠퍼스 판정이 무너진다.
// 4) 행 급감 — 수집이 중간에 끊겼는데 부분 결과를 올리는 경우.

import { ProcessedCourseData } from './types';

export interface GuardViolation {
  code: string;
  message: string;
  /** true 면 업로드를 막는다. false 면 경고만 남긴다. */
  blocking: boolean;
  detail?: unknown;
}

export interface GuardContext {
  /** 현재 DB 행 수. 급감 판정의 기준. 모르면 undefined. */
  existingRowCount?: number;
  /** 급감 허용 비율. 기본 0.8 (20% 넘게 줄면 차단) */
  shrinkLimit?: number;
}

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return NaN;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
};

/** 만족도 상한. 5점 척도이므로 5 를 넘으면 척도가 다른 값이 섞인 것이다. */
const SATISFACTION_MAX = 5;

/**
 * 여러 회차를 가진 과정 중 "전 회차가 같은 만족도"인 비율.
 *
 * 과정 단위 평균이 복제돼 들어오면 이 값이 1.0 에 가까워진다.
 * 현재 DB 실측은 0.016 이다.
 */
function sameScoreRatioAcrossRounds(courses: ProcessedCourseData[]): {
  ratio: number;
  multiRoundCourses: number;
} {
  const byCourse = new Map<string, Set<string>>();
  const filledByCourse = new Map<string, number>();

  for (const c of courses) {
    const tid = String(c['훈련과정 ID'] ?? '').trim();
    if (!tid) continue;
    const s = num(c.만족도);
    if (!byCourse.has(tid)) byCourse.set(tid, new Set());
    if (Number.isFinite(s) && s > 0) {
      byCourse.get(tid)!.add(String(s));
      filledByCourse.set(tid, (filledByCourse.get(tid) ?? 0) + 1);
    }
  }

  let multi = 0;
  let same = 0;
  for (const [tid, scores] of byCourse) {
    const filled = filledByCourse.get(tid) ?? 0;
    if (filled <= 1) continue; // 회차가 하나뿐이면 비교 불가
    multi += 1;
    if (scores.size === 1) same += 1;
  }
  return { ratio: multi ? same / multi : 0, multiRoundCourses: multi };
}

/** 어떤 컬럼이 "실제로 값이 있는" 비율 */
function fillRate(courses: ProcessedCourseData[], pick: (c: ProcessedCourseData) => unknown): number {
  if (!courses.length) return 0;
  let n = 0;
  for (const c of courses) {
    const v = pick(c);
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s === '' || s === '0') continue;
    n += 1;
  }
  return n / courses.length;
}

export function runUploadGuards(
  courses: ProcessedCourseData[],
  ctx: GuardContext = {}
): { ok: boolean; violations: GuardViolation[] } {
  const v: GuardViolation[] = [];

  if (!courses.length) {
    v.push({ code: 'EMPTY', message: '업로드에 행이 하나도 없습니다.', blocking: true });
    return { ok: false, violations: v };
  }

  // ── 1. 만족도 척도 ──────────────────────────────────────────────
  const overScale = courses.filter((c) => {
    const s = num(c.만족도);
    return Number.isFinite(s) && s > SATISFACTION_MAX;
  });
  if (overScale.length) {
    v.push({
      code: 'SATISFACTION_SCALE',
      blocking: true,
      message:
        `만족도가 ${SATISFACTION_MAX}점을 넘는 행이 ${overScale.length}건 있습니다. ` +
        'DB 는 5점 척도인데 100점 척도 값이 섞였습니다 (목록 API 의 stdgScor 를 그대로 쓰면 이렇게 됩니다).',
      detail: overScale.slice(0, 5).map((c) => ({ 고유값: c.고유값, 만족도: c.만족도 })),
    });
  }

  // ── 2. 회차별 만족도 붕괴 ───────────────────────────────────────
  const { ratio, multiRoundCourses } = sameScoreRatioAcrossRounds(courses);
  if (multiRoundCourses >= 20 && ratio > 0.5) {
    v.push({
      code: 'SATISFACTION_NOT_PER_ROUND',
      blocking: true,
      message:
        `여러 회차를 가진 과정 ${multiRoundCourses}개 중 ${(ratio * 100).toFixed(1)}% 가 ` +
        '모든 회차에 같은 만족도를 갖습니다. 회차별 실값이 아니라 과정 단위 평균이 복제된 것으로 보입니다. ' +
        '(현재 DB 실측은 1.6% 입니다)',
      detail: { multiRoundCourses, sameRatio: ratio },
    });
  }

  // ── 3. 수기/파생 컬럼 전멸 ──────────────────────────────────────
  const checks: Array<[string, (c: ProcessedCourseData) => unknown, number]> = [
    ['자비부담금', (c) => (c as any).자비부담금, 0.05],
    ['실 매출 대비', (c) => c['실 매출 대비'], 0.5],
  ];
  for (const [label, pick, minRate] of checks) {
    const rate = fillRate(courses, pick);
    if (rate < minRate) {
      v.push({
        code: 'COLUMN_WIPED',
        blocking: true,
        message:
          `'${label}' 채움률이 ${(rate * 100).toFixed(1)}% 입니다 (최소 ${(minRate * 100).toFixed(0)}%). ` +
          '수집기를 --master 없이 돌리면 이 컬럼들이 전부 빈칸으로 나옵니다.',
        detail: { column: label, fillRate: rate },
      });
    }
  }

  // ── 4. 행 급감 ──────────────────────────────────────────────────
  const limit = ctx.shrinkLimit ?? 0.8;
  if (ctx.existingRowCount && courses.length < ctx.existingRowCount * limit) {
    v.push({
      code: 'ROW_SHRINK',
      blocking: true,
      message:
        `업로드 행수 ${courses.length} 가 현재 ${ctx.existingRowCount} 행의 ` +
        `${((courses.length / ctx.existingRowCount) * 100).toFixed(1)}% 입니다. ` +
        '수집이 중간에 끊겼을 가능성이 큽니다.',
      detail: { incoming: courses.length, existing: ctx.existingRowCount },
    });
  }

  return { ok: !v.some((x) => x.blocking), violations: v };
}
