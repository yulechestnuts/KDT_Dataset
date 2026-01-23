// 데이터 정합성 리포트 (Health Check)

import { ProcessedCourseData, HealthCheckReport } from './types';
import { parseDate } from './parsers';
import { isCourseOldEnoughForCompletionRate } from './performance-engine';

/**
 * 데이터 정합성 리포트 생성
 */
export function generateHealthCheckReport(
  processedData: ProcessedCourseData[]
): HealthCheckReport {
  const report: HealthCheckReport = {
    row_count: processedData.length,
    valid_rows: 0,
    invalid_rows: 0,
    revenue_zero_count: 0,
    date_format_errors: 0,
    missing_required_fields: 0,
    institution_grouping_applied: 0,
    leading_company_courses: 0,
    revenue_adjustment_applied: 0,
    three_week_rule_excluded: 0,
    year_range: {
      start: 9999,
      end: 0,
    },
    institution_count: 0,
    course_count: 0,
    total_revenue: 0,
    warnings: [],
    errors: [],
  };

  const institutions = new Set<string>();
  const courses = new Set<string>();
  const warnings: Record<string, number> = {};
  const errors: Array<{
    row: number;
    field: string;
    issue: string;
    value: any;
  }> = [];

  processedData.forEach((course, index) => {
    let isValid = true;

    // 필수 필드 검증
    if (!course.과정명 || !course.훈련기관 || !course.과정시작일 || !course.과정종료일) {
      report.missing_required_fields++;
      errors.push({
        row: index + 1,
        field: !course.과정명
          ? '과정명'
          : !course.훈련기관
            ? '훈련기관'
            : !course.과정시작일
              ? '과정시작일'
              : '과정종료일',
        issue: '필수 필드가 누락되었습니다.',
        value: null,
      });
      isValid = false;
    }

    // 날짜 형식 검증
    try {
      const startDate = parseDate(course.과정시작일);
      const endDate = parseDate(course.과정종료일);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        report.date_format_errors++;
        errors.push({
          row: index + 1,
          field: isNaN(startDate.getTime()) ? '과정시작일' : '과정종료일',
          issue: '날짜 형식이 잘못되었습니다.',
          value: isNaN(startDate.getTime()) ? course.과정시작일 : course.과정종료일,
        });
        isValid = false;
      } else {
        // 종료일이 시작일보다 빠른지 확인
        if (endDate < startDate) {
          errors.push({
            row: index + 1,
            field: '과정종료일',
            issue: '과정 종료일이 시작일보다 빠릅니다.',
            value: course.과정종료일,
          });
        }

        // 연도 범위 업데이트
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();
        if (startYear < report.year_range.start) {
          report.year_range.start = startYear;
        }
        if (endYear > report.year_range.end) {
          report.year_range.end = endYear;
        }
      }
    } catch (error) {
      report.date_format_errors++;
      isValid = false;
    }

    // 매출이 0인 경우
    if (course.누적매출 === 0) {
      report.revenue_zero_count++;
      warnings['revenue_zero'] = (warnings['revenue_zero'] || 0) + 1;
    }

    // 기관 그룹화 적용 여부
    if (course.훈련기관 !== course.원본훈련기관) {
      report.institution_grouping_applied++;
    }

    // 선도기업 과정
    if (course.isLeadingCompanyCourse) {
      report.leading_company_courses++;
    }

    // 매출 보정 적용
    if (course.조정_실매출대비 > 0 || Object.keys(course).some((k) => k.startsWith('조정_'))) {
      report.revenue_adjustment_applied++;
    }

    // 3주 규칙 제외
    if (!isCourseOldEnoughForCompletionRate(course)) {
      report.three_week_rule_excluded++;
    }

    // 통계 집계
    if (isValid) {
      report.valid_rows++;
      institutions.add(course.훈련기관);
      if (course['훈련과정 ID']) {
        courses.add(course['훈련과정 ID']);
      }
      report.total_revenue += course.누적매출;
    } else {
      report.invalid_rows++;
    }
  });

  report.institution_count = institutions.size;
  report.course_count = courses.size;

  // 경고 메시지 생성
  if (warnings['revenue_zero']) {
    report.warnings.push({
      type: 'revenue_zero',
      count: warnings['revenue_zero'],
      description: `매출이 0인 과정이 ${warnings['revenue_zero']}개 있습니다.`,
    });
  }

  if (report.date_format_errors > 0) {
    report.warnings.push({
      type: 'date_format_error',
      count: report.date_format_errors,
      description: `날짜 형식이 잘못된 행이 ${report.date_format_errors}개 있습니다.`,
    });
  }

  if (report.missing_required_fields > 0) {
    report.warnings.push({
      type: 'missing_required_field',
      count: report.missing_required_fields,
      description: `필수 필드가 누락된 행이 ${report.missing_required_fields}개 있습니다.`,
    });
  }

  report.errors = errors;

  return report;
}
