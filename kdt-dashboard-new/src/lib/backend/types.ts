import type { CompletionRateSource } from '@/lib/revenue-factor';
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
  /** 만족도 설문 응답자 수. 만족도 가중평균의 가중치 (@/lib/satisfaction-rule) */
  평가인원?: number;
  취업인원: number;
  취업률: number;
  취업대상인원: number;
  통합취업인원: number;
  '취업인원 (3개월)': number | null;
  '취업인원 (6개월)': number | null;
  수료율: number;
  '취업률 (3개월)': number | null;
  '취업률 (6개월)': number | null;
  총취업대상인원?: number;
  총통합취업인원?: number;
  평균수료율: number;
  평균취업율: number;
  graduatesStr?: string;
  NCS명: string;
  NCS코드?: string;
  선도기업?: string;
  파트너기관?: string;
  isLeadingCompanyCourse: boolean;
  leadingCompanyPartnerInstitution?: string;
  훈련유형: string;
  조정_2021년: number;
  조정_2022년: number;
  조정_2023년: number;
  조정_2024년: number;
  조정_2025년: number;
  조정_2026년: number;
  /** DB에 컬럼이 늦게 추가돼 기존 객체 리터럴에는 없을 수 있다 */
  조정_2027년?: number;
  조정_실매출대비: number;
  /**
   * 매출 보정에 실제로 쓴 수료율(%). 실측이 없으면 추정치가 들어간다.
   * 원본 `수료율` 컬럼과 달리, 미종료 회차에서도 0 이 아니다.
   */
  적용수료율?: number;
  /** 위 값의 출처. '실측' 이 아니면 그 과정의 매출은 추정이다. */
  수료율_출처?: CompletionRateSource;
  /** 자비부담금(원). AI캠퍼스 과정 판정에 사용 — src/lib/course-category.ts */
  자비부담금?: number;
  [key: string]: any;
}

export interface InstitutionStat {
  institution_name: string;
  total_revenue: number;
  total_max_revenue: number;
  total_contract_revenue: number;
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
  total_target_pop?: number;
  total_integrated_employed?: number;
  avg_satisfaction: number;
  /** 수료인원 반영 유예로 수료율 집계에서 빠진 과정 수 (@/lib/completion-rule) */
  completion_pending_courses?: number;
  /** 위 과정들의 수강신청 인원 합 — 수료율 분모가 '훈련생 수'와 다른 이유 */
  completion_pending_students?: number;
  /** 취업 통계 미집계로 취업률 분모에서 빠진 과정 수 */
  employment_pending_courses?: number;
  /** 위 과정들의 수강신청 인원 합 */
  employment_pending_students?: number;
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
  total_max_revenue: number;
  total_adjusted_revenue: number;
  total_students: number;
  completed_students: number;
  total_employed: number;
  overall_completion_rate: number;
  overall_employment_rate: number;
  /** calculateYearlyStats 가 실제로 채우는 값인데 타입에 빠져 있었다 */
  total_target_pop?: number;
  total_integrated_employed?: number;
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
  max_revenue: number;
  contract_revenue: number;
  adjusted_revenue: number;
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
    completionRate: number;
    employmentRate: number;
    총취업대상인원?: number;
    총통합취업인원?: number;
    avgSatisfaction: number;
    leading_company_course_count?: number;
  };
}

export type RevenueMode = 'current' | 'max';
