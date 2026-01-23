// 월별 통계 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { calculateMonthlyStatistics } from '@/lib/backend/aggregation';
import { getProcessedCourses } from '@/lib/backend/supabase-service';
import { cacheManager, generateCacheKey } from '@/lib/backend/cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');

    const year = yearParam ? parseInt(yearParam, 10) : undefined;

    // 캐시 키 생성
    const cacheKey = generateCacheKey('monthly-stats', { year: year || 'all' });

    // 캐시에서 조회
    const cachedResult = cacheManager.get<any>(cacheKey);
    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    // 데이터 조회
    const courses = await getProcessedCourses();

    // 월별 통계 계산
    const monthlyStats = calculateMonthlyStatistics(courses, year);

    // 요약 정보 계산
    const summary = {
      total_revenue: monthlyStats.reduce((sum, stat) => sum + stat.revenue, 0),
      total_students: monthlyStats.reduce((sum, stat) => sum + stat.total_students, 0),
      total_completed: monthlyStats.reduce((sum, stat) => sum + stat.completed_students, 0),
      avg_completion_rate:
        monthlyStats.length > 0
          ? monthlyStats.reduce((sum, stat) => sum + stat.completion_rate, 0) / monthlyStats.length
          : 0,
      avg_employment_rate: 0, // TODO: 계산 필요
    };

    const result = {
      status: 'success',
      data: monthlyStats,
      year: year,
      summary: summary,
    };

    // 캐시에 저장 (1시간)
    cacheManager.set(cacheKey, result);

    return NextResponse.json({
      ...result,
      cached: false,
    });
  } catch (error) {
    console.error('월별 통계 조회 오류:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: '월별 통계 조회 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
