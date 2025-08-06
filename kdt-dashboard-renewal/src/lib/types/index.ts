export interface RawCourseData {
  고유값: string;
  과정명: string;
  훈련과정ID: string;
  회차: string;
  훈련기관: string;
  총훈련일수: string;
  총훈련시간: string;
  과정시작일: Date;
  과정종료일: Date;
  NCS명: string;
  NCS코드: string;
  훈련비: number;
  정원: string;
  수강신청인원: number;
  수료인원: number;
  수료율: string;
  만족도: string;
  취업인원: string;
  취업률: string;
  지역: string;
  주소: string;
  과정페이지링크: string;
  선도기업: string;
  파트너기관: string;
  매출최대: number;
  매출최소: number;
  실매출대비: string;
  '2021년': number;
  '2022년': number;
  '2023년': number;
  '2024년': number;
  '2025년': number;
  '2026년': number;
}

export interface CourseData {
  고유값: string;
  훈련기관: string;
  원본훈련기관?: string;
  '훈련과정 ID'?: string;
  과정명: string;
  과정시작일: string;
  과정종료일: string;
  '수강신청 인원': number;
  '수료인원': number;
  누적매출?: number;
  총훈련일수: number;
  총훈련시간: number;
  훈련비: number;
  정원: number;
  '수료율': number;
  만족도: number;
  취업인원: number;
  취업률: number;
  '취업인원 (3개월)': number;
  '취업률 (3개월)': number;
  '취업인원 (6개월)': number;
  '취업률 (6개월)': number;
  훈련연도: number;
  훈련유형: string;
  NCS명: string;
  NCS코드?: string;
  파트너기관?: string;
  선도기업?: string;
  isLeadingCompanyCourse?: boolean;
  leadingCompanyPartnerInstitution?: string;
  '실 매출 대비'?: number;
  '매출 최대'?: number;
  '매출 최소'?: number;
  조정_실매출대비?: number;
  조정_누적매출?: number;
  '2021년'?: number;
  '2022년'?: number;
  '2023년'?: number;
  '2024년'?: number;
  '2025년'?: number;
  '2026년'?: number;
  '조정_2021년'?: number;
  '조정_2022년'?: number;
  '조정_2023년'?: number;
  '조정_2024년'?: number;
  '조정_2025년'?: number;
  '조정_2026년'?: number;
  월별매출?: { [key: string]: number };
  월별수강인원?: { [key: string]: number };
  월별수료인원?: { [key: string]: number };
  과정상세?: string;
  회차?: string;
  과정페이지링크?: string;
  [key: string]: any;
}

export interface AggregatedCourseData {
  과정명: string;
  '훈련과정 ID'?: string;
  총수강신청인원: number;
  총수료인원: number;
  총누적매출: number;
  최소과정시작일: string;
  최대과정종료일: string;
  훈련유형들: string[];
  원천과정수: number;
  총훈련생수: number;
  평균만족도: number;
  평균수료율: number;
  graduatesStr?: string;
  studentsStr?: string;
  openCountStr?: string;
}

export interface YearlyStats {
  year: number;
  revenue: number;
  totalStudents: number;
  completedStudents: number;
  courses: CourseData[];
}

export interface MonthlyStats {
  month: string;
  revenue: number;
  totalStudents: number;
  completedStudents: number;
  courses: CourseData[];
  completionRate: number;
}

export interface InstitutionStat {
  institutionName: string;
  totalRevenue: number;
  totalCourses: number;
  totalStudents: number;
  completedStudents: number;
  completionRate: number;
  avgSatisfaction: number;
  courses: CourseData[];
  prevYearStudents: number;
  prevYearCompletedStudents: number;
}

export interface CompletionRateDetails {
  completionRate: number;
  totalCourses: number;
  validCourses: number;
  excludedByDate: number;
  excludedByZeroCompletion: number;
  totalEnrollment: number;
  totalCompletion: number;
  details: {
    currentDate: string;
    year?: number;
  };
}

export interface NcsStat {
  ncsName: string;
  totalRevenue: number;
  totalCourses: number;
  totalStudents: number;
  completedStudents: number;
  completionRate: number;
  avgSatisfaction: number;
  courses: CourseData[];
  prevYearStudents: number;
  prevYearCompletedStudents: number;
}

export interface LeadingCompanyStat {
  leadingCompany: string;
  totalRevenue: number;
  totalCourses: number;
  totalStudents: number;
  completedStudents: number;
  completionRate: number;
  avgSatisfaction: number;
  courses: CourseData[];
}

export interface InstitutionExtraStats {
  leadingCourseCount: number;
  leadingRevenue: number;
  techCourseCount: number;
  techRevenue: number;
  ncsTop: { ncsName: string; revenue: number; courses: number }[];
  yearly: { year: number; revenue: number; students: number }[];
}