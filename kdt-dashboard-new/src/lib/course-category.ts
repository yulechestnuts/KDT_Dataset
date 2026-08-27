// AI캠퍼스 과정 분류 (프론트/백엔드 공용)
//
// 규칙: 훈련과정 ID 가 `AIG` + 4자리 연도로 시작하고 그 연도가 2026 이상이며,
//       동시에 자비부담금이 0원인 과정을 'AI캠퍼스 과정'으로 본다.
//
// 이 축은 기존 '유형 필터'(파트너기관 유무로 선도기업/신기술을 가르는 것)와
// 완전히 독립적이다. 파트너기관 로직은 건드리지 않으며, AI캠퍼스 과정도
// 파트너기관이 있으면 선도기업 과정으로 그대로 집계된다.

export const AI_CAMPUS_MIN_YEAR = 2026;

/** 'all' = 구분 없이 전부, 'only' = AI캠퍼스만, 'exclude' = AI캠퍼스 제외 */
export type AiCampusFilter = 'all' | 'only' | 'exclude';

const COURSE_ID_YEAR = /^AIG(\d{4})/i;

/** 훈련과정 ID 에서 AIG 뒤 4자리 연도를 뽑는다. 형식이 아니면 null. */
export function extractCourseIdYear(courseId: unknown): number | null {
  const m = String(courseId ?? '').trim().match(COURSE_ID_YEAR);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * 자비부담금 0원 여부.
 * 원본 데이터는 무료 과정을 명시적으로 0 으로 적으므로, 빈 값/누락도 0원으로 본다.
 */
export function hasZeroSelfPayment(course: any): boolean {
  const raw = course?.['자비부담금'] ?? course?.자비_부담금;
  if (raw === null || raw === undefined || raw === '') return true;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n === 0 : true;
}

/** AI캠퍼스 과정인지 판정. */
export function isAiCampusCourse(course: any): boolean {
  const year = extractCourseIdYear(course?.['훈련과정 ID'] ?? course?.훈련과정_ID);
  if (year === null || year < AI_CAMPUS_MIN_YEAR) return false;
  return hasZeroSelfPayment(course);
}

/** 쿼리 파라미터 문자열을 안전하게 AiCampusFilter 로 정규화. */
export function parseAiCampusFilter(param: string | null | undefined): AiCampusFilter {
  return param === 'only' || param === 'exclude' ? param : 'all';
}

export function matchesAiCampusFilter(course: any, filter: AiCampusFilter): boolean {
  if (filter === 'all') return true;
  return filter === 'only' ? isAiCampusCourse(course) : !isAiCampusCourse(course);
}

/** 라벨 (UI 공용) */
export const AI_CAMPUS_FILTER_LABELS: Record<AiCampusFilter, string> = {
  all: '전체',
  only: 'AI캠퍼스 과정만',
  exclude: 'AI캠퍼스 제외',
};
