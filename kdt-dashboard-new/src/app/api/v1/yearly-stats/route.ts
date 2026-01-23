// 연도별 통계 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { calculateYearlyStats } from '@/lib/backend/aggregation';
import { getProcessedCourses } from '@/lib/backend/supabase-service';
import { cacheManager, generateCacheKey } from '@/lib/backend/cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');

    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    // 캐시 키 생성
    const cacheKey = generateCacheKey('yearly-stats', { year });

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

    // 연도별 통계 계산
    const stats = calculateYearlyStats(courses, year);

    const result = {
      status: 'success',
      data: stats,
    };

    // 캐시에 저장 (1시간)
    cacheManager.set(cacheKey, result);

    return NextResponse.json({
      ...result,
      cached: false,
    });
  } catch (error) {
    console.error('연도별 통계 조회 오류:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: '연도별 통계 조회 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
