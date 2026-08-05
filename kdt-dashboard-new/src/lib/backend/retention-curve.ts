// 잔존율 곡선 — 최종 수료율(c)과 과정 duration(N)로부터
// 월차별 잔존율 가중치 배열을 생성한다.
//
// 형태: r(t) = 1 - (1 - c) × (t / (N - 1))^ALPHA   (0 ≤ t ≤ N-1)
//  - t = 0     → 1.0
//  - t = N-1   → c
//  - ALPHA=0.5 (√): 초반 하락 급, 후반 완만 (KDT 실무 관측 편향과 부합)
//  - ALPHA=1.0    : 선형 감쇠
//
// 이 모듈이 반환하는 값은 "가중치"일 뿐, 절대 금액이 아니다.
// 호출자는 range 슬라이싱 시 `연도 매출 × (구간 가중합 / 해당 연도 가중합)`
// 형태로 재정규화하여 사용한다. 즉 연도별 총합은 기존 산식과 보존된다.

const DEFAULT_ALPHA = 0.5;

/**
 * 월차별 잔존율 가중치 배열 반환.
 * @param completionRate01 최종 수료율 (0..1). 결측/음수/1 초과 시 uniform fallback.
 * @param durationMonths   과정 개월 수(1 이상). 0 이하는 [1]로 처리.
 * @param alpha            곡선 형태 파라미터. 기본 0.5(sqrt front-loaded).
 */
export function retentionWeights(
  completionRate01: number,
  durationMonths: number,
  alpha: number = DEFAULT_ALPHA
): number[] {
  const N = Math.max(1, Math.floor(durationMonths));

  // 단일 월 과정: 잔존/이탈 개념 무의미 → 전액 그 달에 귀속
  if (N === 1) {
    return [1];
  }

  const cRaw = Number(completionRate01);
  const cValid = Number.isFinite(cRaw) && cRaw > 0 && cRaw <= 1;

  // 수료율 결측 시 균등 분배 (fallback)
  if (!cValid) {
    return new Array(N).fill(1);
  }

  const c = Math.min(Math.max(cRaw, 0), 1);
  const weights = new Array<number>(N);
  const denom = N - 1;

  for (let t = 0; t < N; t++) {
    const x = t / denom; // 0..1
    weights[t] = 1 - (1 - c) * Math.pow(x, alpha);
  }
  return weights;
}

/**
 * 과정 시작/종료일로부터 duration(개월 수) 계산.
 * 종료 - 시작을 30일 단위로 반올림. 최소 1.
 */
export function getCourseDurationMonths(
  courseStart: Date,
  courseEnd: Date
): number {
  if (!Number.isFinite(courseStart.getTime()) || !Number.isFinite(courseEnd.getTime())) {
    return 1;
  }
  const diffMs = Math.max(0, courseEnd.getTime() - courseStart.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const months = Math.max(1, Math.round(diffDays / 30));
  return months;
}

/**
 * 과정 시작월로부터 (year, month)이 몇 번째 월차(0-indexed)에 해당하는지.
 * 유효하지 않으면 null.
 */
export function getMonthIndexInCourse(
  courseStart: Date,
  year: number,
  month1to12: number
): number | null {
  if (!Number.isFinite(courseStart.getTime())) return null;
  const sy = courseStart.getFullYear();
  const sm = courseStart.getMonth(); // 0-indexed
  const idx = (year - sy) * 12 + ((month1to12 - 1) - sm);
  return idx >= 0 ? idx : null;
}
