// 만족도 집계 기준 — 단일 정의
//
// 같은 가중평균 산식이 한때 7곳에 복제돼 있었다 (aggregation.ts 2곳,
// performance-engine.ts, data-utils.ts 3곳, InstitutionAnalysisClient.tsx).
// 척도가 100점에서 5점으로 바뀌면서 전부 어긋날 뻔했다. 규칙을 바꿀 일이
// 생기면 이 파일만 고친다.
//
// ─────────────────────────────────────────────────────────────
// 척도: 5점
// ─────────────────────────────────────────────────────────────
// 예전 만족도는 work24 오픈 API 의 stdgScor(100점)였는데, 그 값은 과정
// (훈련과정 ID) 단위 통합값이라 같은 과정의 모든 회차가 동일했다. 회차별
// 편차(같은 과정에서 3.6 → 4.8 같은 변화)가 통째로 가려졌다.
//
// 지금은 work24 성과화면의 '평균만족도'(= 조사영역 '전반적 만족도', 5점)를
// 회차별로 수집해 쓴다. 실측이 없는 회차는 값을 비워 둔다 — 통합값으로 메우면
// 회차별 실측과 섞여 구분이 불가능해진다.

/** 만족도 척도 최대값. 표시·검증에 쓴다. */
export const SATISFACTION_SCALE_MAX = 5;

/**
 * 만족도 값으로 볼 수 있는 상한.
 *
 * 5점 전환 전 데이터(100점 척도)가 섞여 들어오면 평균이 조용히 망가진다.
 * 척도를 벗어난 값은 집계에서 배제한다.
 */
const MAX_PLAUSIBLE = SATISFACTION_SCALE_MAX;

type SatisfactionInput = {
  만족도?: unknown;
  평가인원?: unknown;
  수료인원?: unknown;
};

export type SatisfactionSample = {
  /** 5점 척도 점수. 실측이 없으면 null */
  score: number | null;
  /** 가중치 = 실제 응답자 수. score 가 null 이면 0 */
  weight: number;
};

/**
 * 과정(회차) 하나의 만족도 표본.
 *
 * 가중치는 평가인원(실제 설문 응답자 수)을 쓴다. 예전에는 수료인원으로
 * 가중했는데, 만족도는 수료생 전원이 아니라 설문에 응답한 사람들의 값이라
 * 응답자 수가 맞는 가중치다. 평가인원이 없는 과거 행은 수료인원으로 물러선다.
 */
export function getSatisfactionSample(
  course: SatisfactionInput | null | undefined
): SatisfactionSample {
  const raw = Number(course?.만족도 ?? 0);
  if (!Number.isFinite(raw) || raw <= 0 || raw > MAX_PLAUSIBLE) {
    return { score: null, weight: 0 };
  }

  const evaluated = Number(course?.평가인원 ?? 0);
  const completed = Number(course?.수료인원 ?? 0);
  const weight =
    Number.isFinite(evaluated) && evaluated > 0
      ? evaluated
      : Number.isFinite(completed) && completed > 0
        ? completed
        : 0;

  if (weight <= 0) return { score: null, weight: 0 };
  return { score: raw, weight };
}

/** 여러 과정의 만족도 가중평균. 표본이 없으면 null (0 이 아니다). */
export function calculateWeightedSatisfaction(
  courses: ReadonlyArray<SatisfactionInput>
): number | null {
  let sum = 0;
  let weight = 0;
  for (const c of courses) {
    const { score, weight: w } = getSatisfactionSample(c);
    if (score === null) continue;
    sum += score * w;
    weight += w;
  }
  if (weight <= 0) return null;
  return Math.round((sum / weight) * 10) / 10;
}

/**
 * 화면 표기. null/0/NaN 을 '-' 로 통일한다.
 * 직접 `${v.toFixed(1)}` 을 쓰면 가드가 빠지기 쉬워 이 함수로 모은다.
 */
export function formatSatisfaction(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '-';
  return n.toFixed(1);
}

export const SATISFACTION_TOOLTIP =
  '만족도는 work24 성과정보의 회차별 평균만족도(전반적 만족도, 5점 척도)입니다. ' +
  '설문이 아직 집계되지 않은 회차는 값이 없어 평균에서 제외됩니다. ' +
  '여러 과정을 묶을 때는 실제 평가인원으로 가중평균합니다.';
