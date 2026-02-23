// 기관별 통계 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { calculateInstitutionStats } from '@/lib/backend/aggregation';
import { RevenueMode } from '@/lib/backend/types';
import { getProcessedCourses } from '@/lib/backend/supabase-service';
import { cacheManager, generateCacheKey } from '@/lib/backend/cache';
import { parseDate } from '@/lib/backend/parsers';
import { applyRevenueAdjustmentIfMissing } from '@/lib/backend/revenue-engine';
import { extractYearMonth } from '@/lib/backend/parsers';
import {
  calculateRevenueShare,
  calculateStudentShare,
} from '@/lib/backend/revenue-engine';
import { groupInstitutionsAdvanced } from '@/lib/backend/institution-grouping';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const trainingTypeParam = searchParams.get('training_type');
    const traceParam = searchParams.get('trace');
    const noCacheParam = searchParams.get('no_cache');
    const flushCacheParam = searchParams.get('flush_cache');
    const revenueModeParam = searchParams.get('revenue_mode') as RevenueMode | null;
    const institutionNameParam = searchParams.get('institution_name');

    const year = yearParam ? parseInt(yearParam, 10) : undefined;
    const month = monthParam ? parseInt(monthParam, 10) : undefined;
    const revenueMode = revenueModeParam || 'current';
    const bypassCache = noCacheParam === '1' || noCacheParam === 'true';
    const trace = traceParam === '1' || traceParam === 'true';

    if (flushCacheParam === '1' || flushCacheParam === 'true') {
      cacheManager.deletePattern('^institution-stats:.*');
    }

    // 캐시 키 생성
    const cacheKey = generateCacheKey('institution-stats', {
      year: year || 'all',
      month: month || 'all',
      training_type: trainingTypeParam || 'all',
      revenue_mode: revenueMode,
      institution_name: institutionNameParam || 'all',
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

    const matchesTrainingType = (c: any): boolean => {
      if (!trainingTypeParam || trainingTypeParam === 'all') return true;
      const hasPartner = String(c.파트너기관 ?? '').trim() !== '';
      if (trainingTypeParam === 'leading') return hasPartner;
      if (trainingTypeParam === 'tech') return !hasPartner;
      return true;
    };

    const matchesYearMonth = (c: any): boolean => {
      if (year === undefined && month === undefined) return true;

      if (month !== undefined) {
        // 월 선택 시: 수주(개강/시작일) 기준으로만 필터링
        const start = parseDate(c.과정시작일);
        if (!Number.isFinite(start.getTime())) {
          const ym = extractYearMonth(c.과정시작일);
          if (ym.year === null || ym.month === null) return false;
          if (year !== undefined && ym.year !== year) return false;
          return ym.month === month;
        }

        if (year !== undefined && start.getFullYear() !== year) return false;
        return start.getMonth() + 1 === month;
      }

      const ym = extractYearMonth(c.과정시작일);
      const y = ym.year;
      if (year === undefined) return true;

      const start = parseDate(c.과정시작일);
      const end = parseDate(c.과정종료일);
      if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        return start <= yearEnd && end >= yearStart;
      }

      // 날짜 파싱 불가 시, 시작일에서 추출한 연도로 fallback
      return y === year;
    };

    const filteredCourses = adjustedCourses.filter((c) => matchesTrainingType(c) && matchesYearMonth(c));

    const filterMeta = (() => {
      const years = new Set<number>();
      const months = new Set<number>();
      let leading = 0;
      let tech = 0;
      for (const c of adjustedCourses) {
        const ym = extractYearMonth(c.과정시작일);
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
      };
    })();

    // 기관별 통계 계산
    const stats = calculateInstitutionStats(filteredCourses, year, revenueMode, month);

    // 특정 기관 필터링 (선택사항)
    let filteredStats = stats;
    if (institutionNameParam) {
      filteredStats = stats.filter((s) => s.institution_name === institutionNameParam);
    }

    const traceReport = (() => {
      if (!trace) return undefined;
      if (!institutionNameParam) return undefined;

      const name = institutionNameParam;
      const relevant = filteredCourses.filter((c: any) => {
        const isLeadingWithPartner = c.isLeadingCompanyCourse && c.leadingCompanyPartnerInstitution;
        if (
          isLeadingWithPartner &&
          c.훈련기관 === name &&
          c.훈련기관 !== c.leadingCompanyPartnerInstitution
        ) {
          return false;
        }
        return c.훈련기관 === name || c.파트너기관 === name;
      });

      const sample = relevant[0];
      const ym = sample ? extractYearMonth(sample.과정시작일) : { year: null, month: null };
      const stat = filteredStats.find((s) => s.institution_name === name);

      const shareProof = (() => {
        if (!sample) return null;
        const trainingGroup = groupInstitutionsAdvanced(sample.훈련기관);
        const partnerRaw = String(
          (sample as any).leadingCompanyPartnerInstitution ?? (sample as any).파트너기관 ?? ''
        ).trim();
        const partnerGroup = partnerRaw ? groupInstitutionsAdvanced(partnerRaw) : null;

        const trainingRevenueShare = calculateRevenueShare(sample as any, trainingGroup, groupInstitutionsAdvanced);
        const trainingStudentShare = calculateStudentShare(sample as any, trainingGroup, groupInstitutionsAdvanced);

        const partnerRevenueShare = partnerGroup
          ? calculateRevenueShare(sample as any, partnerGroup, groupInstitutionsAdvanced)
          : null;
        const partnerStudentShare = partnerGroup
          ? calculateStudentShare(sample as any, partnerGroup, groupInstitutionsAdvanced)
          : null;

        return {
          training_group: trainingGroup,
          partner_group: partnerGroup,
          training: {
            revenue_share: trainingRevenueShare,
            student_share: trainingStudentShare,
          },
          partner: partnerGroup
            ? {
                revenue_share: partnerRevenueShare,
                student_share: partnerStudentShare,
              }
            : null,
        };
      })();

      return {
        institution_name: name,
        sample_course: sample
          ? {
              고유값: sample.고유값,
              과정명: sample.과정명,
              과정시작일: sample.과정시작일,
              과정종료일: sample.과정종료일,
              extracted_start_year: ym.year,
              extracted_start_month: ym.month,
              raw: {
                매출_최대: (sample as any).__raw_매출_최대,
                조정_실매출대비: (sample as any).__raw_조정_실매출대비,
                '2026년': (sample as any).__raw_2026년,
                조정_2026년: (sample as any).__raw_조정_2026년,
              },
              mapped: {
                매출_최대: (sample as any)['매출 최대'],
                조정_실매출대비: (sample as any).조정_실매출대비,
                '2026년': (sample as any)['2026년'],
                조정_2026년: (sample as any)['조정_2026년'],
                수료인원: (sample as any).수료인원,
              },
              share_proof: shareProof,
            }
          : null,
        api_total_max_revenue: stat ? stat.total_max_revenue : null,
        api_total_adjusted_revenue: stat ? stat.total_adjusted_revenue : null,
        api_total_revenue: stat ? stat.total_revenue : null,
        applied_filters: {
          year,
          month,
          training_type: trainingTypeParam || 'all',
          revenue_mode: revenueMode,
        },
        relevant_course_count: relevant.length,
      };
    })();

    const result = {
      status: 'success',
      data: filteredStats,
      year: year,
      revenue_mode: revenueMode,
      cached: false,
      meta: {
        ...meta,
        ...filterMeta,
        applied_filters: {
          year,
          month,
          training_type: trainingTypeParam || 'all',
        },
        trace: traceReport,
      },
      pagination: {
        total: filteredStats.length,
        page: 1,
        page_size: filteredStats.length,
        total_pages: 1,
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
