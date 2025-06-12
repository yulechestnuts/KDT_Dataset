export const formatNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '-';
  return value.toLocaleString('ko-KR');
};

export const formatPercentage = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '-';
  return `${value.toFixed(1)}%`;
};

export const formatSatisfaction = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '-';
  return value.toFixed(1);
};

export const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '-';
  return `${value.toLocaleString('ko-KR')}원`;
};

export const safeParseNumber = (value: any): number | null => {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
};

export const safeFormatNumber = (value: any): string => {
  const num = safeParseNumber(value);
  return num === null ? '-' : formatNumber(num);
};

export const safeFormatPercentage = (value: any): string => {
  const num = safeParseNumber(value);
  return num === null ? '-' : formatPercentage(num);
};

export const safeFormatSatisfaction = (value: any): string => {
  const num = safeParseNumber(value);
  return num === null ? '-' : formatSatisfaction(num);
};

export const safeFormatCurrency = (value: any): string => {
  const num = safeParseNumber(value);
  return num === null ? '-' : formatCurrency(num);
}; 