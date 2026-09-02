// 수료율 집계 기준 — 단일 정의
//
// 이 규칙은 한때 세 곳에 따로 있었고 서로 달랐다:
//   - src/lib/backend/aggregation.ts  (기관 목록 표)      : 유예 없음
//   - src/lib/data-utils.ts           (레거시 클라 경로)  : 3주 유예
//   - InstitutionAnalysisClient.tsx   (상세 모달 KPI)     : 3주 유예
// 같은 화면의 목록 행과 상세 KPI가 다른 수료율을 보여주는 원인이었다.
// 규칙을 바꿀 일이 생기면 반드시 이 파일만 고친다.

import { parseDate } from '@/lib/backend/parsers';

/**
 * 수료인원 반영 유예 기간(주).
 *
 * HRD-Net 은 과정이 끝나도 수료인원을 바로 올리지 않고, 우리 쪽도 월 1회
 * 수동 갱신이라 반영이 더 늦다. 2026-09 기준 종료 후 경과 주수별 실측:
 *   0주차 — 62%가 수료인원 0, 합산 수료율 10.0%
 *   1주차 — 35%가 0, 33.2%
 *   2주차 — 5%가 0, 80.2%   ← 여기서부터 평평
 * 유예를 4주·8주로 늘려도 전체 수료율이 82.6%대에서 더 움직이지 않아 3주로 잡는다.
 */
export const COMPLETION_GRACE_WEEKS = 3;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** isCompletionCountable 이 읽는 필드만 추린 최소 형태. */
type CompletionCountableInput = {
  '수강신청 인원'?: unknown;
  수료인원?: unknown;
  과정종료일?: unknown;
};

/**
 * 이 과정을 수료율 분모·분자에 넣어도 되는지.
 *
 * 수료인원 0만 걸러서는 부족하다. 신청 93명 과정에 수료인원 1명만 먼저 올라온
 * 것처럼 부분 반영된 과정이 통과해 분모 93명을 통째로 끌고 들어오기 때문이다
 * (실측 24건, 전부 종료 후 4주 이내이거나 아직 종료 전이었다).
 * 종료 후 경과 시간을 함께 봐야 그런 과정이 걸러진다.
 *
 * 날짜는 parseDate 로 읽는다. "2026. 1. 5" 같은 표기가 원본에 섞여 있어
 * new Date() 로는 Invalid Date 가 되고, 그러면 해당 과정이 조용히 영구
 * 제외된다.
 */
export function isCompletionCountable(
  course: CompletionCountableInput | null | undefined,
  now: Date = new Date()
): boolean {
  const enrolled = Number(course?.['수강신청 인원'] ?? 0) || 0;
  const completed = Number(course?.수료인원 ?? 0) || 0;
  if (enrolled <= 0 || completed <= 0) return false;

  const end = parseDate(course?.과정종료일);
  if (!Number.isFinite(end.getTime())) return false;

  return (now.getTime() - end.getTime()) / WEEK_MS >= COMPLETION_GRACE_WEEKS;
}

export const COMPLETION_RULE_TOOLTIP =
  `수료율은 종료 후 ${COMPLETION_GRACE_WEEKS}주가 지나고 수료인원이 반영된 과정만으로 계산합니다. ` +
  '수료인원 반영에 시간이 걸려(HRD-Net 반영 지연 + 월 1회 수동 갱신), ' +
  '그 전 과정을 넣으면 아직 올라오지 않은 인원이 미수료로 잡힙니다.';
