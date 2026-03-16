// 과정 분석 데이터 조회 API (DB/Supabase 기반)

import { NextRequest, NextResponse } from 'next/server';
import { getProcessedCourses } from '@/lib/backend/supabase-service';
import { applyRevenueAdjustmentIfMissing, computeCourseRevenueByMode } from '@/lib/backend/revenue-engine';
import { extractYearMonth, parseDate } from '@/lib/backend/parsers';

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/\([^)]*\)/g, '')
      .replace(/[^0-9+\-\.]/g, '')
      .trim();
    if (cleaned === '' || cleaned === '-' || cleaned.toLowerCase() === 'n/a') return fallback;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

type RevenueMode = 'current' | 'max';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');
    const trainingTypeParam = searchParams.get('training_type');
    const revenueModeParam = (searchParams.get('revenue_mode') as RevenueMode | null) ?? 'current';

    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    const revenueMode: RevenueMode = revenueModeParam === 'max' ? 'max' : 'current';

    const courses = await getProcessedCourses();
    const adjustedCourses = applyRevenueAdjustmentIfMissing(courses);

    const filtered = adjustedCourses.filter((c: any) => {
      if (trainingTypeParam && trainingTypeParam !== 'all') {
        const hasPartner = String(c.파트너기관 ?? '').trim() !== '';
        if (trainingTypeParam === 'leading' && !hasPartner) return false;
        if (trainingTypeParam === 'tech' && hasPartner) return false;
      }

      if (year === undefined) return true;

      // 요구사항: 연도 필터는 훈련종료일(TR_END_DT) 기준
      const end = parseDate(c.과정종료일);
      if (Number.isFinite(end.getTime())) {
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        return end >= yearStart && end <= yearEnd;
      }

      const ym = extractYearMonth(c.과정종료일);
      return ym.year === year;
    });

    const enriched = filtered.map((c: any) => {
      const totalRevenue = computeCourseRevenueByMode(c, year, revenueMode);
      return {
        ...c,
        total_revenue: toFiniteNumber(totalRevenue, 0),
      };
    });

    const meta = (() => {
      const years = new Set<number>();
      let minYear = Number.POSITIVE_INFINITY;
      let maxYear = Number.NEGATIVE_INFINITY;

      for (const c of adjustedCourses as any[]) {
        const ym = extractYearMonth(c.과정종료일);
        if (ym.year !== null) {
          years.add(ym.year);
          minYear = Math.min(minYear, ym.year);
          maxYear = Math.max(maxYear, ym.year);
        }
      }

      return {
        total_rows: adjustedCourses.length,
        filtered_rows: enriched.length,
        available_years: Array.from(years).sort((a, b) => a - b),
        year_range:
          minYear !== Number.POSITIVE_INFINITY && maxYear !== Number.NEGATIVE_INFINITY
            ? { start: minYear, end: maxYear }
            : undefined,
        applied_filters: {
          year,
          training_type: trainingTypeParam || 'all',
          revenue_mode: revenueMode,
        },
      };
    })();

    return NextResponse.json({
      status: 'success',
      data: enriched,
      meta,
    });
  } catch (error) {
    console.error('과정 분석 데이터 조회 오류:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: '과정 분석 데이터 조회 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
