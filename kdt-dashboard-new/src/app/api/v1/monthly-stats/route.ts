// 월별 통계 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { calculateMonthlyStatistics } from '@/lib/backend/aggregation';
import { getProcessedCourses } from '@/lib/backend/supabase-service';
import { cacheManager, generateCacheKey } from '@/lib/backend/cache';
import { parseDate } from '@/lib/backend/parsers';
import { applyRevenueAdjustmentIfMissing } from '@/lib/backend/revenue-engine';
import { extractYearMonth } from '@/lib/backend/parsers';

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const original = value;
    const cleaned = original
      .replace(/\([^)]*\)/g, '')
      .replace(/[^0-9+\-\.]/g, '')
      .trim();
    if (cleaned === '' || cleaned === '-' || cleaned.toLowerCase() === 'n/a') {
      console.log('[monthly-stats toFiniteNumber] empty/invalid string -> fallback', { original, cleaned });
      return fallback;
    }
    const num = Number(cleaned);
    if (!Number.isFinite(num)) {
      console.log('[monthly-stats toFiniteNumber] non-finite after parse -> fallback', { original, cleaned, num });
      return fallback;
    }
    return num;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    console.log('[monthly-stats toFiniteNumber] non-finite non-string -> fallback', { value, num });
    return fallback;
  }
  return num;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');
    const trainingTypeParam = searchParams.get('training_type');
    const noCacheParam = searchParams.get('no_cache');
    const flushCacheParam = searchParams.get('flush_cache');

    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    const bypassCache = noCacheParam === '1' || noCacheParam === 'true';

    if (flushCacheParam === '1' || flushCacheParam === 'true') {
      cacheManager.deletePattern('^monthly-stats:.*');
    }

    // 캐시 키 생성
    const cacheKey = generateCacheKey('monthly-stats', {
      year: year || 'all',
      training_type: trainingTypeParam || 'all',
    });

    // 캐시에서 조회
    if (!bypassCache) {
      const cachedResult = cacheManager.get<any>(cacheKey);
      if (cachedResult) {
        return NextResponse.json({
          ...cachedResult,
          cached: true,
        });
      }
    }

    // 데이터 조회
    const courses = await getProcessedCourses();

    const meta = (() => {
      let validDateRows = 0;
      let invalidDateRows = 0;
      let yearFilteredRows = 0;

      for (const c of courses) {
        const s = parseDate(c.과정시작일);
        const e = parseDate(c.과정종료일);
        const valid = Number.isFinite(s.getTime()) && Number.isFinite(e.getTime());
        if (valid) {
          validDateRows += 1;
        } else {
          invalidDateRows += 1;
        }

        if (year === undefined) {
          yearFilteredRows += 1;
        } else if (valid) {
          const sy = s.getFullYear();
          const ey = e.getFullYear();
          if (sy === year || (sy < year && ey === year)) {
            yearFilteredRows += 1;
          }
        }
      }

      return {
        total_rows: courses.length,
        valid_date_rows: validDateRows,
        invalid_date_rows: invalidDateRows,
        year_filtered_rows: yearFilteredRows,
      };
    })();

    const adjustedCourses = applyRevenueAdjustmentIfMissing(courses);

    const filteredCourses = adjustedCourses.filter((c: any) => {
      if (!trainingTypeParam || trainingTypeParam === 'all') return true;
      const hasPartner = String(c.파트너기관 ?? '').trim() !== '';
      if (trainingTypeParam === 'leading') return hasPartner;
      if (trainingTypeParam === 'tech') return !hasPartner;
      return true;
    });

    // 월별 통계 계산
    const monthlyStats = calculateMonthlyStatistics(filteredCourses, year) ?? [];

    const filterMeta = (() => {
      const years = new Set<number>();
      const months = new Set<number>();
      let leading = 0;
      let tech = 0;
      for (const c of adjustedCourses) {
        const ym = extractYearMonth((c as any).과정시작일);
        if (ym.year !== null) years.add(ym.year);
        if (ym.month !== null) months.add(ym.month);
        const hasPartner = String((c as any).파트너기관 ?? '').trim() !== '';
        if (hasPartner) leading += 1;
        else tech += 1;
      }
      return {
        available_years: Array.from(years).sort((a, b) => a - b),
        available_months: Array.from(months).sort((a, b) => a - b),
        available_training_types: {
          leading,
          tech,
        },
        applied_filters: {
          year,
          training_type: trainingTypeParam || 'all',
        },
      };
    })();

    // 요약 정보 계산
    const summary = {
      total_revenue: toFiniteNumber(
        monthlyStats.reduce((sum, stat) => sum + toFiniteNumber(stat.revenue, 0), 0),
        0,
      ),
      total_max_revenue: toFiniteNumber(
        monthlyStats.reduce((sum, stat) => sum + toFiniteNumber(stat.max_revenue, 0), 0),
        0,
      ),
      total_adjusted_revenue: toFiniteNumber(
        monthlyStats.reduce((sum, stat) => sum + toFiniteNumber(stat.adjusted_revenue, 0), 0),
        0,
      ),
      total_students: toFiniteNumber(
        monthlyStats.reduce((sum, stat) => sum + toFiniteNumber(stat.total_students, 0), 0),
        0,
      ),
      total_completed: toFiniteNumber(
        monthlyStats.reduce((sum, stat) => sum + toFiniteNumber(stat.completed_students, 0), 0),
        0,
      ),
      avg_completion_rate: toFiniteNumber(
        monthlyStats.length > 0
          ? monthlyStats.reduce((sum, stat) => sum + toFiniteNumber(stat.completion_rate, 0), 0) /
              monthlyStats.length
          : 0,
        0,
      ),
      avg_employment_rate: 0, // TODO: 계산 필요
    };

    const result = {
      status: 'success',
      data: monthlyStats,
      year: year,
      summary: {
        ...summary,
        meta: {
          ...meta,
          ...filterMeta,
        },
      },
    };

    // 캐시에 저장 (1시간)
    if (!bypassCache) {
      cacheManager.set(cacheKey, result);
    }

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
