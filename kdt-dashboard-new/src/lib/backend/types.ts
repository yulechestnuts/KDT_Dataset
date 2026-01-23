// 백엔드 통계 엔진 타입 정의

export interface RawCourseData {
  고유값: string;
  과정명: string;
  훈련과정ID?: string;
  회차?: string;
  훈련기관: string;
  총훈련일수?: string;
  총훈련시간?: string;
  과정시작일: string;
  과정종료일: string;
  NCS명?: string;
  NCS코드?: string;
  훈련비?: string | number;
  정원?: string | number;
  수강신청인원?: string | number;
  수료인원?: string | number;
  수료율?: string | number;
  만족도?: string | number;
  취업인원?: string | number;
  취업률?: string | number;
  '취업인원 (3개월)'?: string | number;
  '취업률 (3개월)'?: string | number;
  '취업인원 (6개월)'?: string | number;
  '취업률 (6개월)'?: string | number;
  지역?: string;
  주소?: string;
  과정페이지링크?: string;
  선도기업?: string;
  파트너기관?: string;
  매출최대?: string | number;
  매출최소?: string | number;
  실매출대비?: string | number;
  '2021년'?: string | number;
  '2022년'?: string | number;
  '2023년'?: string | number;
  '2024년'?: string | number;
  '2025년'?: string | number;
  '2026년'?: string | number;
  [key: string]: any;
}

export interface ProcessedCourseData {
  고유값: string;
  과정명: string;
  '훈련과정 ID'?: string;
  회차?: string;
  훈련기관: string;
  원본훈련기관: string;
  과정시작일: string;
  과정종료일: string;
  '수강신청 인원': number;
  수료인원: number;
  취업인원: number;
  '취업인원 (3개월)': number;
  '취업인원 (6개월)': number;
  수료율: number;
  취업률: number;
  만족도: number;
  훈련비: number;
  정원: number;
  총훈련일수: number;
  총훈련시간: number;
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
  [key: string]: any;
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
  courses: ProcessedCourseData[];
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
  monthly_breakdown?: MonthlyStat[];
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
  courses?: ProcessedCourseData[];
}

export interface HealthCheckReport {
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

export interface GoldenTestCase {
  test_case_id: string;
  name: string;
  institution_name: string;
  year: number;
  expected_values: {
    total_revenue: number;
    total_courses_display: string;
    total_students_display: string;
    completed_students_display: string;
    total_employed: number;
    completion_rate: number;
    employment_rate: number;
    avg_satisfaction: number;
    leading_company_course_count?: number;
  };
}

export type RevenueMode = 'current' | 'max';
