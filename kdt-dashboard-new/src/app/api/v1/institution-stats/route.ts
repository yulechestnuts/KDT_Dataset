// 기관별 통계 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { calculateInstitutionStats } from '@/lib/backend/aggregation';
import { RevenueMode } from '@/lib/backend/types';
import { getProcessedCourses } from '@/lib/backend/supabase-service';
import { cacheManager, generateCacheKey } from '@/lib/backend/cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');
    const revenueModeParam = searchParams.get('revenue_mode') as RevenueMode | null;
    const institutionNameParam = searchParams.get('institution_name');

    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    const revenueMode = revenueModeParam || 'current';

    // 캐시 키 생성
    const cacheKey = generateCacheKey('institution-stats', {
      year: year || 'all',
      revenue_mode: revenueMode,
      institution_name: institutionNameParam || 'all',
    });

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

    // 기관별 통계 계산
    const stats = calculateInstitutionStats(courses, year, revenueMode);

    // 특정 기관 필터링 (선택사항)
    let filteredStats = stats;
    if (institutionNameParam) {
      filteredStats = stats.filter((s) => s.institution_name === institutionNameParam);
    }

    const result = {
      status: 'success',
      data: filteredStats,
      pagination: {
        total: filteredStats.length,
        page: 1,
        page_size: filteredStats.length,
        total_pages: 1,
      },
    };

    // 캐시에 저장 (1시간)
    cacheManager.set(cacheKey, result);

    return NextResponse.json({
      ...result,
      cached: false,
    });
  } catch (error) {
    console.error('기관별 통계 조회 오류:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: '기관별 통계 조회 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
