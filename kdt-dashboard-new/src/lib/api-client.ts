// KDT 통계 API 클라이언트

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface InstitutionStatsResponse {
  status: string;
  data: InstitutionStat[];
  meta?: {
    total_rows?: number;
    valid_date_rows?: number;
    invalid_date_rows?: number;
    year_filtered_rows?: number;
    available_years?: number[];
    available_months?: number[];
    available_training_types?: {
      leading: number;
      tech: number;
    };
    applied_filters?: {
      year?: number;
      month?: number;
      training_type?: string;
    };
  };
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
  total_max_revenue: number;
  total_adjusted_revenue: number;
  total_expected_revenue_all_years?: number;
  expected_attribution_percent?: number;
  total_courses_display: string;
  total_students_display: string;
  completed_students_display: string;
  current_year_completed?: number;
  carried_over_completed?: number;
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
  total_max_revenue: number;
  total_adjusted_revenue: number;
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
  max_revenue: number;
  adjusted_revenue: number;
  total_students: number;
  completed_students: number;
  completion_rate: number;
  employment_rate?: number;
  course_count: number;
  courses?: any[];
}

export interface CourseAnalysisRow {
  고유값: string;
  과정명: string;
  '훈련과정 ID'?: string;
  회차?: string;
  훈련기관: string;
  원본훈련기관?: string;
  과정시작일: string;
  과정종료일: string;
  '수강신청 인원': number;
  수료인원: number;
  정원: number;
  총훈련일수: number;
  총훈련시간: number;
  '취업인원 (3개월)': number;
  '취업인원 (6개월)': number;
  누적매출: number;
  '실 매출 대비': number;
  '매출 최대': number;
  '매출 최소': number;
  '2021년': number;
  '2022년': number;
  '2023년': number;
  '2024년': number;
  '2025년': number;
  '2026년': number;
  '조정_2021년': number;
  '조정_2022년': number;
  '조정_2023년': number;
  '조정_2024년': number;
  '조정_2025년': number;
  '조정_2026년': number;
  조정_실매출대비: number;
  훈련유형: string;
  NCS명: string;
  NCS코드?: string;
  선도기업?: string;
  파트너기관?: string;
  isLeadingCompanyCourse: boolean;
  leadingCompanyPartnerInstitution?: string;
  total_revenue?: number;
  과정페이지링크?: string;
  [key: string]: any;
}

export interface CourseAnalysisResponse {
  status: string;
  data: CourseAnalysisRow[];
  meta?: {
    total_rows?: number;
    filtered_rows?: number;
    available_years?: number[];
    year_range?: { start: number; end: number };
    applied_filters?: {
      year?: number;
      training_type?: string;
      revenue_mode?: 'current' | 'max';
    };
  };
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
    revenueMode: 'current' | 'max' = 'current',
    options?: {
      month?: number;
      trainingType?: 'all' | 'leading' | 'tech';
      institutionName?: string;
      noCache?: boolean;
    }
  ): Promise<InstitutionStatsResponse> {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (revenueMode) params.append('revenue_mode', revenueMode);

    if (options?.month !== undefined) params.append('month', String(options.month));
    if (options?.trainingType && options.trainingType !== 'all') {
      params.append('training_type', options.trainingType);
    }
    if (options?.institutionName) params.append('institution_name', options.institutionName);
    if (options?.noCache) params.append('no_cache', '1');

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
   * 과정 분석용 과정 목록 조회 (DB/Supabase 기반)
   */
  async getCourseAnalysis(options?: {
    year?: number;
    trainingType?: 'all' | 'leading' | 'tech';
    revenueMode?: 'current' | 'max';
  }): Promise<CourseAnalysisResponse> {
    const params = new URLSearchParams();
    if (options?.year !== undefined) params.append('year', String(options.year));
    if (options?.trainingType && options.trainingType !== 'all') {
      params.append('training_type', options.trainingType);
    }
    if (options?.revenueMode) params.append('revenue_mode', options.revenueMode);

    const url = `/api/v1/course-analysis${params.toString() ? `?${params.toString()}` : ''}`;
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
