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

// ── 판정 기준 감시 ────────────────────────────────────────────────────
//
// AI캠퍼스 판정의 연도 축을 무엇으로 볼지에 두 안이 있다.
//   A. 훈련과정 ID 의 등록연도 (지금 정본)
//   B. 실제 개강연도 (과정시작일)
//
// 2026-09-17 전수 실측에서는 **두 규칙의 결과가 완전히 같다 (각 86건)**.
//   ID2024/개강2026 717건 → 전부 유료
//   ID2025/개강2025 225건 → 전부 0원 (제도 시행 전이라 진짜 0. AI캠퍼스 아님)
//   ID2025/개강2026 286건 → 전부 유료
//   ID2026/개강2026  86건 → 전부 0원  ← 두 규칙이 공통으로 잡는 집합
//
// 갈리는 건 미래뿐이다 — AIG2026 과정이 2027 에 개강하거나 AIG2027 이 나올 때,
// 혹은 옛 ID 과정이 2026 이후 개강하며 면제받는 사례가 생길 때.
// 그래서 지금 고르지 않고, **차집합이 0 이 아니게 되는 순간**을 잡는다.
// 그때 실제 사례를 보고 정하면 된다.
//
// 자비부담금 제도는 2026 년부터다 — 2021~2025 의 0 원은 미수집이 아니라 진짜 0 이다.
// 그래서 연도 조건 자체는 두 안 모두에 반드시 필요하다.

export const AI_CAMPUS_POLICY_START_YEAR = 2026;

/** 과정시작일에서 개강연도를 뽑는다. 파싱 불가면 null. */
export function extractOpenYear(course: any): number | null {
  const raw = course?.['과정시작일'] ?? course?.과정시작일;
  const m = String(raw ?? '').trim().match(/^(\d{4})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return Number.isFinite(y) ? y : null;
}

/** 대안 규칙 B: 개강연도 기준. 정본이 아니라 비교용이다. */
export function isAiCampusCourseByOpenYear(course: any): boolean {
  const year = extractOpenYear(course);
  if (year === null || year < AI_CAMPUS_POLICY_START_YEAR) return false;
  return hasZeroSelfPayment(course);
}

export interface AiCampusRuleDiff {
  /** 정본(ID연도) 기준으로 잡힌 건수 */
  byIdYear: number;
  /** 대안(개강연도) 기준으로 잡힌 건수 */
  byOpenYear: number;
  /** ID 기준만 잡은 건수 — 0 이 아니면 결정이 필요해진 시점이다 */
  idOnly: number;
  /** 개강 기준만 잡은 건수 — 위와 같다 */
  openOnly: number;
  /** 갈린 과정의 예시 (최대 5건) */
  samples: Array<{ 고유값: string; 훈련과정ID: string; 과정시작일: string; 자비부담금: unknown; 잡은쪽: 'id' | 'open' }>;
}

/**
 * 두 규칙을 같이 돌려 차집합을 센다. 화면 값은 바꾸지 않는다 — 감시 전용.
 */
export function compareAiCampusRules(courses: any[]): AiCampusRuleDiff {
  const out: AiCampusRuleDiff = { byIdYear: 0, byOpenYear: 0, idOnly: 0, openOnly: 0, samples: [] };
  for (const c of courses) {
    const a = isAiCampusCourse(c);
    const b = isAiCampusCourseByOpenYear(c);
    if (a) out.byIdYear += 1;
    if (b) out.byOpenYear += 1;
    if (a === b) continue;
    if (a) out.idOnly += 1;
    else out.openOnly += 1;
    if (out.samples.length < 5) {
      out.samples.push({
        고유값: String(c?.고유값 ?? ''),
        훈련과정ID: String(c?.['훈련과정 ID'] ?? c?.훈련과정_ID ?? ''),
        과정시작일: String(c?.['과정시작일'] ?? ''),
        자비부담금: c?.['자비부담금'],
        잡은쪽: a ? 'id' : 'open',
      });
    }
  }
  return out;
}
