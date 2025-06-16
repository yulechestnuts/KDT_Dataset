const GITHUB_URL = 'https://github.com/yulechestnuts/KDT_Dataset/blob/main/result_kdtdata_202505.csv?raw=true';

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
  return data.map(course => {
    // 기본 정보 복사
    const processed = { ...course };

    // 금액 관련 필드 정리
    const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'];
    yearColumns.forEach(year => {
      processed[year] = Number(processed[year]) || 0;
    });

    // 누적 매출 계산
    processed.누적매출 = calculateTotalRevenue(processed);
    
    // 실제 매출 계산 (현재 연도의 매출)
    const currentYear = new Date().getFullYear();
    processed.실제매출 = calculateYearlyRevenue(processed, currentYear);

    // 최소/최대 매출 계산
    const revenues = yearColumns.map(year => Number(processed[year]) || 0);
    processed.최소매출 = Math.min(...revenues);
    processed.최대매출 = Math.max(...revenues);

    return processed;
  });
}; 