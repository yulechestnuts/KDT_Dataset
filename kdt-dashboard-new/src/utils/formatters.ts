// 숫자 포맷팅 함수
export const formatNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0';
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 1
  }).format(value);
};

// 통화 포맷팅 함수 (조·억 단위 한국형 표기)
export const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0원';

  const num = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  const TRILLION = 1_000_000_000_000; // 1조
  const EOK = 100_000_000;            // 1억

  if (num >= TRILLION) {
    const tril = Math.floor(num / TRILLION); // 조 단위 정수
    const remainEok = (num % TRILLION) / EOK; // 억 단위 소수 첫째자리
    const formattedRemain = remainEok >= 0.05 ? `${formatNumber(remainEok)}억` : '';
    return `${sign}${tril}조 ${formattedRemain}`.trim() + '원';
  }

  if (num >= EOK) {
    return `${sign}${formatNumber(num / EOK)}억 원`;
  }

  return `${sign}${new Intl.NumberFormat('ko-KR').format(num)}원`;
};

// 억 단위 숫자 포맷 (차트용)
export const formatEok = (eokValue: number): string => {
  return `${formatNumber(eokValue)}억`;
};