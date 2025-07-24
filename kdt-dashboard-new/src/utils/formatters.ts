// 숫자 포맷팅 함수
export const formatNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0';
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 0
  }).format(value);
};

// 통화 포맷팅 함수 (조·억·천만원·백만원 단위 한국형 표기)
export const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '0억';

  const num = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const TRILLION = 1_000_000_000_000; // 1조
  const EOK = 100_000_000; // 1억

  // 소수점 1자리(불필요하면 제거)
  const oneDecimal = (v: number) => {
    const str = v.toFixed(1);
    return str.endsWith('.0') ? str.slice(0, -2) : str;
  };

  if (num >= TRILLION) {
    const tril = Math.floor(num / TRILLION);            // 조 단위
    const remainEok = Math.floor((num % TRILLION) / EOK); // 억 단위 정수
    if (remainEok > 0) {
      return `${sign}${tril}조 ${remainEok}억`;
    }
    return `${sign}${tril}조`;
  }

  // 1억 미만도 모두 억 단위로 표기
  const eokVal = num / EOK;
  return `${sign}${oneDecimal(eokVal)}억`;
};

// 억 단위 숫자 포맷 (차트용)
export const formatEok = (eokValue: number): string => {
  return `${formatNumber(eokValue)}억`;
};

// 매출액을 억 단위로 변환하는 함수
export const formatRevenue = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '0억';
  return `${(value / 100000000).toFixed(1)}억`;
};