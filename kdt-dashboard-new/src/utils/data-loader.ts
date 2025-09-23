// Use internal API route to avoid external fetch failures and ensure fast, reliable data access
const GITHUB_URL = '/api/data';

// 문자열/숫자 값을 안전하게 숫자로 변환 (콤마 제거·공백 트림)
export function safeParseNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  const num = Number(String(value).replace(/,/g, '').trim());
  return isNaN(num) ? 0 : num;
}

export async function loadDataFromGithub() {
  try {
    const response = await fetch(
      GITHUB_URL,
      {
        headers: {
          'Accept': 'text/csv',
        },
        next: { 
          revalidate: 3600 // 1시간 캐시
        }
      }
    );

    if (!response.ok) {
      throw new Error(`데이터를 불러오는데 실패했습니다. (상태 코드: ${response.status})`);
    }

    const data = await response.text();
    if (!data || data.trim().length === 0) {
      throw new Error('데이터가 비어있습니다.');
    }

    return data;
  } catch (error) {
    console.error('GitHub 데이터 로드 중 오류 발생:', error);
    throw error;
  }
}

// 금액 계산 유틸리티 함수들
export const calculateTotalRevenue = (course: any): number => {
  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'];
  return yearColumns.reduce((total, year) => {
    const value = course[year];
    return total + (Number(value) || 0);
  }, 0);
};

export const calculateMonthlyRevenue = (course: any, year: number, month: number): number => {
  const yearColumn = `${year}년`;
  const monthlyValue = course[yearColumn];
  if (!monthlyValue) return 0;
  
  // 연간 매출을 월별로 균등 분배
  return Math.round(Number(monthlyValue) / 12);
};

export function calculateYearlyRevenue(course: any, year: number): number {
  const yearKey = `${year}년` as keyof any;
  const revenue = course[yearKey];
  return safeParseNumber(revenue) || 0;
}

export function calculateInstitutionYearlyRevenue(courses: any[], year: number): number {
  return courses.reduce((total, course) => {
    return total + calculateYearlyRevenue(course, year);
  }, 0);
}

export function getInstitutionYearlyRevenues(courses: any[]): { year: number; revenue: number }[] {
  const years = [2021, 2022, 2023, 2024, 2025, 2026];
  return years.map(year => ({
    year,
    revenue: calculateInstitutionYearlyRevenue(courses, year)
  }));
}

// 데이터 전처리 함수
export const preprocessData = (data: any[]): any[] => {
  return data.map(raw => {
    // 깊은 복사 방지, 새 객체 생성
    const course: any = { ...raw };

    // 원본 CSV는 연도 컬럼이 '2021' 형태일 수 있으므로, 'YYYY'와 'YYYY년' 모두 인식하여 정규화한다.
    const yearPairs: Array<{ unified: string; variants: string[] }> = [
      { unified: '2021년', variants: ['2021년', '2021'] },
      { unified: '2022년', variants: ['2022년', '2022'] },
      { unified: '2023년', variants: ['2023년', '2023'] },
      { unified: '2024년', variants: ['2024년', '2024'] },
      { unified: '2025년', variants: ['2025년', '2025'] },
      { unified: '2026년', variants: ['2026년', '2026'] },
    ];

    // 정규화된 연도 키에 숫자 값 채우기
    yearPairs.forEach(({ unified, variants }) => {
      const rawVal = variants.map(k => course[k]).find(v => v !== undefined && v !== null && String(v).trim() !== '');
      course[unified] = safeParseNumber(rawVal);
    });

    const yearColumns = yearPairs.map(p => p.unified);

    // 주요 숫자 필드 정리 (공백/콤마 제거 포함)
    course['수강신청 인원'] = safeParseNumber(course['수강신청 인원']);
    course['수료인원'] = safeParseNumber(course['수료인원']);
    course['정원'] = safeParseNumber(course['정원']);
    course['훈련비'] = safeParseNumber(course['훈련비']);

    // 실 매출 대비 컬럼은 CSV에서 '실 매출 대비' 또는 공백이 포함된 '실 매출 대비 ' 로 올 수 있음
    const actualRevenueRaw = course['실 매출 대비'] ?? course['실 매출 대비 '] ?? course['실매출대비'];
    course['실 매출 대비'] = safeParseNumber(actualRevenueRaw);

    // 최소/최대/누적 매출 계산 (연도별 합산 기준)
    const revenues = yearColumns.map(year => safeParseNumber(course[year]));
    const total = revenues.reduce((a, b) => a + b, 0);
    course.누적매출 = total;

    const currentYear = new Date().getFullYear();
    course.실제매출 = calculateYearlyRevenue(course, currentYear);

    // 모든 값이 0인 경우를 대비하여 NaN 방지
    course.최소매출 = revenues.length ? Math.min(...revenues) : 0;
    course.최대매출 = revenues.length ? Math.max(...revenues) : 0;

    return course;
  });
};