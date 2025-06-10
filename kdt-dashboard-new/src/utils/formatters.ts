// 숫자 포맷팅 함수
export const formatNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0';
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 1
  }).format(value);
};

// 통화 포맷팅 함수
export const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '₩0';
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
}; 