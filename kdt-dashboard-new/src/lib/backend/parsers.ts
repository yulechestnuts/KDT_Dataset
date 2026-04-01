// 데이터 파싱 유틸리티 함수들

/**
 * 숫자 정규화 함수
 */
export function parseNumber(value: any): number {
  if (value === null || value === undefined) {
    return 0.0;
  }

  if (typeof value === 'number') {
    if (isNaN(value)) {
      return 0.0;
    }
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (cleaned === '' || cleaned === '-' || cleaned.toUpperCase() === 'N/A') {
      return 0.0;
    }

    // 쉼표, 공백, %, 원 제거
    const normalized = cleaned
      .replace(/,/g, '')
      .replace(/\s+/g, '')
      .replace(/%/g, '')
      .replace(/원/g, '');

    if (normalized === '' || normalized === '-') {
      return 0.0;
    }

    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0.0 : parsed;
  }

  return 0.0;
}

/**
 * 퍼센트 파싱 함수
 */
export function parsePercentage(value: any): number {
  if (value === null || value === undefined) {
    return 0.0;
  }

  if (typeof value === 'number') {
    if (isNaN(value)) {
      return 0.0;
    }
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/%/g, '').replace(/\s+/g, '').trim();
    if (cleaned === '' || cleaned === '-' || cleaned.toUpperCase() === 'N/A') {
      return 0.0;
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0.0 : parsed;
  }

  return 0.0;
}

/**
 * 괄호 포함 숫자 파싱 함수
 */
export function parseNumberWithParen(value: any): {
  value: number;
  display: string;
  paren: number | null;
} {
  if (typeof value === 'number') {
    if (isNaN(value)) {
      return { value: 0, display: '', paren: null };
    }
    return {
      value: Math.floor(value),
      display: String(Math.floor(value)),
      paren: null,
    };
  }

  if (typeof value !== 'string') {
    return { value: 0, display: '', paren: null };
  }

  const cleaned = value.trim();
  if (cleaned === '') {
    return { value: 0, display: '', paren: null };
  }

  // "x(y)" 형식 매칭
  const match = cleaned.match(/^(\d+)(?:\((\d+)\))?$/);
  if (match) {
    const mainValue = parseInt(match[1], 10);
    const parenValue = match[2] ? parseInt(match[2], 10) : null;
    return {
      value: mainValue,
      display: cleaned,
      paren: parenValue,
    };
  }

  // 일반 숫자 문자열 처리
  const parsed = parseNumber(cleaned);
  return {
    value: Math.floor(parsed),
    display: parsed > 0 ? String(Math.floor(parsed)) : '',
    paren: null,
  };
}

/**
 * 날짜 파싱 함수
 */
export function parseDate(value: any): Date {
  if (value instanceof Date) {
    return value;
  }

  if (value === null || value === undefined) {
    return new Date(NaN);
  }

  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (cleaned === '') {
      return new Date(NaN);
    }

    // 강력 전처리: 구분자/공백/후행 문자 혼합을 모두 정규화하여 YYYY-MM-DD로 흡수
    // 예: "2026. 1. 5", "2026-1-5", "2026/01/05", "2026.1.5." 등
    const normalized = cleaned
      .replace(/[年月]/g, '-')
      .replace(/[日]/g, '')
      .replace(/\s+/g, '')
      .replace(/[./]/g, '-')
      .replace(/-+/g, '-')
      .replace(/[^0-9-]/g, '');

    const ymdMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // 최후 수단: 숫자 3개(YYYY, M, D)만 뽑아 Date로 구성
    const loose = cleaned.match(/(\d{4})\D*(\d{1,2})\D*(\d{1,2})/);
    if (loose) {
      const year = parseInt(loose[1], 10);
      const month = parseInt(loose[2], 10) - 1;
      const day = parseInt(loose[3], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // 다양한 날짜 형식 시도
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{4})\/(\d{2})\/(\d{2})$/, // YYYY/MM/DD
      /^(\d{4})\.(\d{2})\.(\d{2})$/, // YYYY.MM.DD
      /^(\d{4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})$/, // YYYY. M. D (spaces, 1-2 digits)
    ];

    for (const format of formats) {
      const match = cleaned.match(format);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // ISO 형식 시도
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    if (process.env.DEBUG_DATE_PARSE === '1') {
      console.warn('[parseDate] failed to parse date:', value);
    }
  }

  if (process.env.DEBUG_DATE_PARSE === '1') {
    console.warn('[parseDate] unsupported date value:', value);
  }

  return new Date(NaN);
}

export type ExtractedYearMonth = {
  year: number | null;
  month: number | null;
};

export function extractYearMonth(value: any): ExtractedYearMonth {
  if (value === null || value === undefined) {
    return { year: null, month: null };
  }

  const str = String(value).trim();
  if (str === '') {
    return { year: null, month: null };
  }

  const d = parseDate(str);
  if (Number.isFinite(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  const ym = str.match(/(\d{4})\D*(\d{1,2})/);
  if (ym) {
    const year = parseInt(ym[1], 10);
    const month = parseInt(ym[2], 10);
    if (Number.isFinite(year) && year > 1900) {
      const safeMonth = month >= 1 && month <= 12 ? month : null;
      return { year, month: safeMonth };
    }
  }

  const y = str.match(/(\d{4})/);
  if (y) {
    const year = parseInt(y[1], 10);
    if (Number.isFinite(year) && year > 1900) {
      return { year, month: null };
    }
  }

  return { year: null, month: null };
}

/**
 * 총 훈련 시간 계산
 */
export function calculateTotalTrainingHours(
  totalDays: number | string | undefined,
  totalHours: number | string | undefined
): number {
  if (totalHours !== undefined && totalHours !== null && String(totalHours).trim() !== '') {
    return parseNumber(totalHours);
  }

  const days = parseNumber(totalDays);
  return days * 8.0;
}

/**
 * 누적 매출 계산
 */
export function calculateCumulativeRevenue(rawData: Record<string, any>): number {
  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'];
  let total = 0.0;

  for (const yearCol of yearColumns) {
    const yearDigits = yearCol.replace('년', '');
    const value = rawData[yearCol] ?? rawData[yearDigits];
    total += parseNumber(value);
  }

  return total;
}

/**
 * null을 유지하는 퍼센트 파싱 함수 (취업률 같은 필수 데이터용)
 * null/undefined는 null로 반환 (0으로 오염되지 않음)
 */
export function parsePercentageNullable(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/%/g, '').replace(/\s+/g, '').trim();
    if (cleaned === '' || cleaned === '-' || cleaned.toUpperCase() === 'N/A') {
      return null;
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}
