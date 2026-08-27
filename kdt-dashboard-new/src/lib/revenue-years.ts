// 매출 연도 컬럼 해석 (프론트/백엔드 공용)
//
// 연도 목록을 리터럴 배열(['2021년', ... , '2026년'])로 박아두면 새해가 올 때마다
// 매출이 조용히 누락된다. 실제로 2027년 매출이 이 방식으로 통째로 빠져 있었다.
//
// 원칙: 데이터 객체의 키에서 연도를 뽑고, 거기에 폴백 범위를 합집합으로 얹는다.
// 합집합인 이유는 두 가지다.
//   - 키에서 뽑기: DB/CSV 에 새 연도 컬럼이 생기면 코드 수정 없이 따라간다.
//   - 폴백 얹기: 특정 row 에 그 연도 키가 없더라도 표준 컬럼 집합은 항상 채워진다
//     (ProcessedCourseData 가 조정_YYYY년 키의 존재를 전제하는 곳이 있다).

export const REVENUE_START_YEAR = 2021;

/**
 * 폴백 상한을 '올해 + 1' 로 두는 이유:
 * 연말에 개강한 과정은 매출이 다음 해로 넘어가 분배된다. 상한을 올해로 잡으면
 * 그 다음 해 매출이 잡히지 않는다 (2026년 시점에 2027년 매출이 누락됐던 사고).
 */
export const REVENUE_YEAR_LOOKAHEAD = 1;

const YEAR_SUFFIXED = /^(?:조정_)?(\d{4})년$/;
const YEAR_BARE = /^(\d{4})$/;

/** 상식적인 연도 범위. 숫자처럼 생긴 엉뚱한 키가 연도로 잡히는 것을 막는다. */
const MIN_PLAUSIBLE_YEAR = 2000;
const MAX_PLAUSIBLE_YEAR = 2100;

/** '2026년' | '조정_2026년' | '2026' 을 모두 인식한다. 아니면 null. */
export function yearFromKey(key: string): number | null {
  const m = key.match(YEAR_SUFFIXED) ?? key.match(YEAR_BARE);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  if (!Number.isFinite(y)) return null;
  if (y < MIN_PLAUSIBLE_YEAR || y > MAX_PLAUSIBLE_YEAR) return null;
  return y;
}

const asc = (a: number, b: number) => a - b;

/** 객체 하나의 키에서 매출 연도를 뽑는다. */
export function extractRevenueYears(source: unknown): number[] {
  if (!source || typeof source !== 'object') return [];
  const years = new Set<number>();
  for (const key of Object.keys(source as Record<string, unknown>)) {
    const y = yearFromKey(key);
    if (y !== null) years.add(y);
  }
  return Array.from(years).sort(asc);
}

/** 여러 객체의 키에서 뽑은 연도의 합집합. */
export function collectRevenueYears(sources: Iterable<unknown>): number[] {
  const years = new Set<number>();
  for (const s of sources) {
    for (const y of extractRevenueYears(s)) years.add(y);
  }
  return Array.from(years).sort(asc);
}

/** REVENUE_START_YEAR ~ (올해 + REVENUE_YEAR_LOOKAHEAD) */
export function getFallbackRevenueYears(): number[] {
  const end = new Date().getFullYear() + REVENUE_YEAR_LOOKAHEAD;
  const years: number[] = [];
  for (let y = REVENUE_START_YEAR; y <= end; y += 1) years.push(y);
  return years;
}

function unionWithFallback(found: number[]): number[] {
  const years = new Set<number>(getFallbackRevenueYears());
  for (const y of found) years.add(y);
  return Array.from(years).sort(asc);
}

/** 객체 하나 기준으로 쓸 매출 연도 목록. */
export function resolveRevenueYears(source?: unknown): number[] {
  return unionWithFallback(extractRevenueYears(source));
}

/** 컬렉션 기준으로 쓸 매출 연도 목록. */
export function resolveRevenueYearsFrom(sources: Iterable<unknown>): number[] {
  return unionWithFallback(collectRevenueYears(sources));
}

/** [2021, 2022] → ['2021년', '2022년'] */
export function toYearColumns(years: number[]): string[] {
  return years.map((y) => `${y}년`);
}

/** [2021, 2022] → ['조정_2021년', '조정_2022년'] */
export function toAdjustedYearColumns(years: number[]): string[] {
  return years.map((y) => `조정_${y}년`);
}

/** 객체 하나 기준 매출 연도 컬럼명 목록. */
export function resolveYearColumns(source?: unknown): string[] {
  return toYearColumns(resolveRevenueYears(source));
}
