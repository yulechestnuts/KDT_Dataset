// KDT 통계 API 클라이언트

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface InstitutionStatsResponse {
  status: string;
  data: InstitutionStat[];
  pagination?: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}

export interface YearlyStatsResponse {
  status: string;
  data: YearlyStat;
}

export interface MonthlyStatsResponse {
  status: string;
  data: MonthlyStat[];
  year?: number;
  summary?: {
    total_revenue: number;
    total_students: number;
    total_completed: number;
    avg_completion_rate: number;
    avg_employment_rate: number;
  };
}

export interface HealthCheckResponse {
  row_count: number;
  valid_rows: number;
  invalid_rows: number;
  revenue_zero_count: number;
  date_format_errors: number;
  missing_required_fields: number;
  institution_grouping_applied: number;
  leading_company_courses: number;
  revenue_adjustment_applied: number;
  three_week_rule_excluded: number;
  year_range: {
    start: number;
    end: number;
  };
  institution_count: number;
  course_count: number;
  total_revenue: number;
  warnings: Array<{
    type: string;
    count: number;
    description: string;
  }>;
  errors: Array<{
    row: number;
    field: string;
    issue: string;
    value: any;
  }>;
}

export interface InstitutionStat {
  institution_name: string;
  total_revenue: number;
  total_courses_display: string;
  total_students_display: string;
  completed_students_display: string;
  total_employed: number;
  completion_rate: number;
  employment_rate: number;
  avg_satisfaction: number;
  completion_rate_detail: string;
  employment_rate_detail: string;
  recruitment_rate_detail?: string;
  courses: any[];
  year?: number;
  revenue_mode?: 'current' | 'max';
}

export interface YearlyStat {
  year: number;
  total_revenue: number;
  total_students: number;
  completed_students: number;
  total_employed: number;
  overall_completion_rate: number;
  overall_employment_rate: number;
  avg_satisfaction: number;
  course_count: number;
  institution_count: number;
  monthly_breakdown?: any[];
  top_courses?: any[];
  top_institutions?: any[];
}

export interface MonthlyStat {
  month: string;
  revenue: number;
  total_students: number;
  completed_students: number;
  completion_rate: number;
  employment_rate?: number;
  course_count: number;
  courses?: any[];
}

export class KDTStatsAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl || '';
  }

  /**
   * 기관별 통계 조회
   */
  async getInstitutionStats(
    year?: number,
    revenueMode: 'current' | 'max' = 'current'
  ): Promise<InstitutionStatsResponse> {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (revenueMode) params.append('revenue_mode', revenueMode);

    const url = `/api/v1/institution-stats${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 연도별 통계 조회
   */
  async getYearlyStats(year?: number): Promise<YearlyStatsResponse> {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());

    const url = `/api/v1/yearly-stats${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 월별 통계 조회
   */
  async getMonthlyStats(year?: number): Promise<MonthlyStatsResponse> {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());

    const url = `/api/v1/monthly-stats${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * CSV 파일 업로드
   */
  async uploadCSV(file: File): Promise<{
    status: string;
    message: string;
    data: {
      processed_courses: number;
      processing_time_ms: number;
      institution_count: number;
      year_range: {
        start: number;
        end: number;
      };
    };
    health_check: HealthCheckResponse;
  }> {
    const formData = new FormData();
    formData.append('csv_file', file);

    const response = await fetch('/api/v1/upload-csv', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 골든 테스트 케이스 검증
   */
  async validateGoldenCases(): Promise<{
    status: string;
    test_results: Array<{
      test_case_id: string;
      passed: boolean;
      expected: any;
      actual: any;
      differences: Array<{
        field: string;
        expected: any;
        actual: any;
        difference: number;
      }>;
    }>;
    summary: {
      total: number;
      passed: number;
      failed: number;
      pass_rate: number;
    };
    recommendation: string;
  }> {
    const response = await fetch('/api/v1/test/golden-cases', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }
}

// 싱글톤 인스턴스 export
export const kdtAPI = new KDTStatsAPI();
