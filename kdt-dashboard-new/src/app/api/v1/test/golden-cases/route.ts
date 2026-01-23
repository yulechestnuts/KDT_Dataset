// 골든 테스트 케이스 검증 API

import { NextRequest, NextResponse } from 'next/server';
import { calculateInstitutionStats } from '@/lib/backend/aggregation';
import { getProcessedCourses } from '@/lib/backend/supabase-service';
import fs from 'fs';
import path from 'path';

// 임시: 실제로는 Supabase에서 데이터를 가져와야 함
async function getProcessedCourses(): Promise<ProcessedCourseData[]> {
  // TODO: Supabase에서 데이터 조회
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const courses = await getProcessedCourses();
    
    // JSON 파일 읽기
    const filePath = path.join(process.cwd(), 'golden-test-cases.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const goldenTestCases = JSON.parse(fileContents);
    const testCases = goldenTestCases.test_cases;

    const testResults = [];

    for (const testCase of testCases) {
      const { institution_name, year, expected_values } = testCase;

      // 해당 기관의 통계 계산
      const stats = calculateInstitutionStats(courses, year);
      const institutionStat = stats.find((s) => s.institution_name === institution_name);

      if (!institutionStat) {
        testResults.push({
          test_case_id: testCase.test_case_id,
          passed: false,
          expected: expected_values,
          actual: null,
          differences: [
            {
              field: 'institution_not_found',
              expected: institution_name,
              actual: null,
              difference: 0,
            },
          ],
        });
        continue;
      }

      // 실제 값 추출
      const actual = {
        total_revenue: institutionStat.total_revenue,
        total_courses_display: institutionStat.total_courses_display,
        total_students_display: institutionStat.total_students_display,
        completed_students_display: institutionStat.completed_students_display,
        total_employed: institutionStat.total_employed,
        completion_rate: institutionStat.completion_rate,
        employment_rate: institutionStat.employment_rate,
        avg_satisfaction: institutionStat.avg_satisfaction,
      };

      // 차이점 계산
      const differences: Array<{
        field: string;
        expected: any;
        actual: any;
        difference: number;
      }> = [];

      for (const [key, expectedValue] of Object.entries(expected_values)) {
        const actualValue = (actual as any)[key];
        if (typeof expectedValue === 'number' && typeof actualValue === 'number') {
          const diff = actualValue - expectedValue;
          if (Math.abs(diff) > 0.01) {
            // 소수점 오차 허용 (0.01)
            differences.push({
              field: key,
              expected: expectedValue,
              actual: actualValue,
              difference: diff,
            });
          }
        } else if (expectedValue !== actualValue) {
          differences.push({
            field: key,
            expected: expectedValue,
            actual: actualValue,
            difference: 0,
          });
        }
      }

      testResults.push({
        test_case_id: testCase.test_case_id,
        passed: differences.length === 0,
        expected: expected_values,
        actual: actual,
        differences: differences,
      });
    }

    const passed = testResults.filter((r) => r.passed).length;
    const total = testResults.length;

    return NextResponse.json({
      status: 'success',
      test_results: testResults,
      summary: {
        total: total,
        passed: passed,
        failed: total - passed,
        pass_rate: total > 0 ? (passed / total) * 100 : 0,
      },
      recommendation:
        total - passed > 0
          ? `${total - passed}개의 테스트 케이스가 실패했습니다. 로직을 재검토해주세요.`
          : '모든 테스트 케이스가 통과했습니다!',
    });
  } catch (error) {
    console.error('골든 테스트 케이스 검증 오류:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: '골든 테스트 케이스 검증 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
