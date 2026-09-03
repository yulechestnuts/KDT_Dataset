// 훈련 수요·경쟁력 분석 API
//
// 카테고리(기술분야) × 코호트연도 매트릭스를 돌려준다.
// 산식과 지표 정의는 @/lib/backend/demand-engine 헤더 참고.
//
// 주의: 다른 v1 라우트는 매출 귀속 때문에 '과정종료일' 기준으로 연도를 자르지만
//       이 라우트는 수요 분석이라 '과정시작일'(코호트) 기준이다.

import { NextRequest, NextResponse } from 'next/server';
import { jsonResponse } from '@/lib/backend/json-response';
import { getProcessedCourses } from '@/lib/backend/supabase-service';
import { calculateDemandAnalysis } from '@/lib/backend/demand-engine';
import { matchesAiCampusFilter, parseAiCampusFilter } from '@/lib/course-category';
import { cacheManager, generateCacheKey } from '@/lib/backend/cache';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const trainingTypeParam = searchParams.get('training_type') || 'all';
    const aiCampusFilter = parseAiCampusFilter(searchParams.get('ai_campus'));
    const noCache = ['1', 'true'].includes(searchParams.get('no_cache') ?? '');

    const cacheKey = generateCacheKey('demand-analysis', {
      training_type: trainingTypeParam,
      ai_campus: aiCampusFilter,
    });
    if (!noCache) {
      const cached = cacheManager.get<any>(cacheKey);
      if (cached) return jsonResponse(request, { ...cached, cached: true });
    }

    const courses = await getProcessedCourses();

    const filtered = courses.filter((c: any) => {
      if (!matchesAiCampusFilter(c, aiCampusFilter)) return false;
      if (trainingTypeParam && trainingTypeParam !== 'all') {
        const hasPartner = String(c.파트너기관 ?? '').trim() !== '';
        if (trainingTypeParam === 'leading' && !hasPartner) return false;
        if (trainingTypeParam === 'tech' && hasPartner) return false;
      }
      return true;
    });

    const analysis = calculateDemandAnalysis(filtered, {
      trainingType: trainingTypeParam,
      aiCampus: aiCampusFilter,
    });

    const result = { status: 'success', ...analysis, cached: false };
    cacheManager.set(cacheKey, result);
    return jsonResponse(request, result);
  } catch (error) {
    console.error('수요 분석 조회 오류:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: '수요 분석 데이터 조회 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
