// Supabase 데이터 서비스

import { supabase } from '@/lib/supabaseClient';
import { ProcessedCourseData } from './types';

const TABLE_NAME = process.env.SUPABASE_TABLE_NAME || 'kdt_data';

function parseNumeric(value: unknown, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (cleaned === '') return fallback;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pickRowValue(row: any, keys: string[]): any {
  for (const k of keys) {
    if (row && Object.prototype.hasOwnProperty.call(row, k)) return row[k];
  }
  return undefined;
}

/**
 * 처리된 과정 데이터를 Supabase에 저장
 */
export async function saveProcessedCourses(
  courses: ProcessedCourseData[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 기존 데이터 삭제 (선택사항)
    // await supabase.from(TABLE_NAME).delete().neq('id', 0);

    // 데이터 삽입
    const { error } = await supabase.from(TABLE_NAME).upsert(
      courses.map((course) => ({
        고유값: course.고유값,
        과정명: course.과정명,
        훈련과정_ID: course['훈련과정 ID'],
        회차: course.회차,
        훈련기관: course.훈련기관,
        원본훈련기관: course.원본훈련기관,
        과정시작일: course.과정시작일,
        과정종료일: course.과정종료일,
        수강신청_인원: course['수강신청 인원'],
        수료인원: course.수료인원,
        취업인원: course.취업인원,
        취업인원_3개월: course['취업인원 (3개월)'],
        취업인원_6개월: course['취업인원 (6개월)'],
        수료율: course.수료율,
        취업률: course.취업률,
        만족도: course.만족도,
        훈련비: course.훈련비,
        정원: course.정원,
        총훈련일수: course.총훈련일수,
        총훈련시간: course.총훈련시간,
        누적매출: course.누적매출,
        실_매출_대비: course['실 매출 대비'],
        매출_최대: course['매출 최대'],
        매출_최소: course['매출 최소'],
        '2021년': course['2021년'],
        '2022년': course['2022년'],
        '2023년': course['2023년'],
        '2024년': course['2024년'],
        '2025년': course['2025년'],
        '2026년': course['2026년'],
        조정_2021년: course['조정_2021년'],
        조정_2022년: course['조정_2022년'],
        조정_2023년: course['조정_2023년'],
        조정_2024년: course['조정_2024년'],
        조정_2025년: course['조정_2025년'],
        조정_2026년: course['조정_2026년'],
        조정_실매출대비: course.조정_실매출대비,
        훈련유형: course.훈련유형,
        NCS명: course.NCS명,
        NCS코드: course.NCS코드,
        선도기업: course.선도기업,
        파트너기관: course.파트너기관,
        is_leading_company_course: course.isLeadingCompanyCourse,
        leading_company_partner_institution: course.leadingCompanyPartnerInstitution,
      })),
      {
        onConflict: '고유값',
      }
    );

    if (error) {
      console.error('Supabase 저장 오류:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('데이터 저장 중 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Supabase에서 처리된 과정 데이터 조회
 */
export async function getProcessedCourses(): Promise<ProcessedCourseData[]> {
  try {
    const pageSize = parseInt(process.env.SUPABASE_PAGE_SIZE || '1000', 10);
    const hardLimit = (() => {
      const raw = process.env.SUPABASE_FETCH_LIMIT;
      if (!raw) return undefined;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })();

    const allRows: any[] = [];
    let offset = 0;
    let exactCount: number | null = null;

    while (true) {
      const from = offset;
      const to = offset + pageSize - 1;

      const { data, error, count } = await supabase
        .from(TABLE_NAME)
        .select('*', { count: 'exact' })
        .range(from, to);

      if (process.env.DEBUG_SUPABASE === '1') {
        console.log('[getProcessedCourses] table:', TABLE_NAME);
        console.log('[getProcessedCourses] page range:', from, '-', to);
        console.log('[getProcessedCourses] page rows:', data?.length ?? 0);
        console.log('[getProcessedCourses] count (exact):', count);
        console.log('[getProcessedCourses] page error:', error);
      }

      if (error) {
        console.error('Supabase 조회 오류:', error);
        return [];
      }

      if (exactCount === null && typeof count === 'number') {
        exactCount = count;
      }

      if (!data || data.length === 0) {
        break;
      }

      allRows.push(...data);
      offset += data.length;

      if (hardLimit !== undefined && allRows.length >= hardLimit) {
        allRows.length = hardLimit;
        break;
      }

      if (data.length < pageSize) {
        break;
      }
    }

    if (process.env.DEBUG_SUPABASE === '1') {
      console.log('[getProcessedCourses] fetched total rows:', allRows.length);
      console.log('[getProcessedCourses] fetched exact count:', exactCount);
      const sample = allRows[0];
      if (sample) {
        console.log('[getProcessedCourses] sample row keys (first 60):', Object.keys(sample).slice(0, 60));
        console.log('[getProcessedCourses] sample raw values:', {
          '매출_최대': (sample as any).매출_최대,
          '매출 최대': (sample as any)['매출 최대'],
          '조정_실매출대비': (sample as any).조정_실매출대비,
          '조정 실매출대비': (sample as any)['조정 실매출대비'],
          '2026년': (sample as any)['2026년'],
          '조정_2026년': (sample as any).조정_2026년,
          '수료인원': (sample as any).수료인원,
          '수료 인원': (sample as any)['수료 인원'],
          '수료_인원': (sample as any).수료_인원,
          '파트너기관': (sample as any).파트너기관,
          'leading_company_partner_institution': (sample as any).leading_company_partner_institution,
          'is_leading_company_course': (sample as any).is_leading_company_course,
        });
      }
    }

    // Supabase 데이터를 ProcessedCourseData 형식으로 변환
    return allRows.map((row: any) => {
      const rawPartnerInstitution = String(row.leading_company_partner_institution ?? row.파트너기관 ?? '').trim();
      const derivedIsLeading = rawPartnerInstitution !== '' && rawPartnerInstitution !== '0';

      return ({
      고유값: row.고유값 || '',
      과정명: row.과정명 || '',
      '훈련과정 ID': row.훈련과정_ID || '',
      회차: row.회차 || '',
      훈련기관: row.훈련기관 || '',
      원본훈련기관: row.원본훈련기관 || '',
      과정시작일: row.과정시작일 || '',
      과정종료일: row.과정종료일 || '',
      '수강신청 인원': parseNumeric(pickRowValue(row, ['수강신청_인원', '수강신청 인원', '수강신청인원']), 0),
      수료인원: parseNumeric(
        pickRowValue(row, ['수료인원', '수료 인원', '수료_인원', '수료인원(명)', '수료 인원(명)']),
        0
      ),
      취업인원: parseNumeric(pickRowValue(row, ['취업인원', '취업 인원']), 0),
      '취업인원 (3개월)': parseNumeric(pickRowValue(row, ['취업인원_3개월', '취업인원 (3개월)']), 0),
      '취업인원 (6개월)': parseNumeric(pickRowValue(row, ['취업인원_6개월', '취업인원 (6개월)']), 0),
      수료율: parseNumeric(pickRowValue(row, ['수료율']), 0),
      취업률: parseNumeric(pickRowValue(row, ['취업률']), 0),
      만족도: parseNumeric(pickRowValue(row, ['만족도']), 0),
      훈련비: parseNumeric(pickRowValue(row, ['훈련비']), 0),
      정원: parseNumeric(pickRowValue(row, ['정원']), 0),
      총훈련일수: parseNumeric(pickRowValue(row, ['총훈련일수', '총 훈련일수']), 0),
      총훈련시간: parseNumeric(pickRowValue(row, ['총훈련시간', '총 훈련시간']), 0),
      누적매출: parseNumeric(pickRowValue(row, ['누적매출', '누적 매출']), 0),
      '실 매출 대비': parseNumeric(pickRowValue(row, ['실_매출_대비', '실 매출 대비', '실매출대비']), 0),
      '매출 최대': parseNumeric(pickRowValue(row, ['매출_최대', '매출 최대', '매출최대']), 0),
      '매출 최소': parseNumeric(pickRowValue(row, ['매출_최소', '매출 최소', '매출최소']), 0),
      '2021년': parseNumeric(pickRowValue(row, ['2021년']), 0),
      '2022년': parseNumeric(pickRowValue(row, ['2022년']), 0),
      '2023년': parseNumeric(pickRowValue(row, ['2023년']), 0),
      '2024년': parseNumeric(pickRowValue(row, ['2024년']), 0),
      '2025년': parseNumeric(pickRowValue(row, ['2025년']), 0),
      '2026년': parseNumeric(pickRowValue(row, ['2026년']), 0),
      '조정_2021년': parseNumeric(pickRowValue(row, ['조정_2021년', '조정 2021년']), 0),
      '조정_2022년': parseNumeric(pickRowValue(row, ['조정_2022년', '조정 2022년']), 0),
      '조정_2023년': parseNumeric(pickRowValue(row, ['조정_2023년', '조정 2023년']), 0),
      '조정_2024년': parseNumeric(pickRowValue(row, ['조정_2024년', '조정 2024년']), 0),
      '조정_2025년': parseNumeric(pickRowValue(row, ['조정_2025년', '조정 2025년']), 0),
      '조정_2026년': parseNumeric(pickRowValue(row, ['조정_2026년', '조정 2026년']), 0),
      조정_실매출대비: parseNumeric(pickRowValue(row, ['조정_실매출대비', '조정 실매출대비', '조정_실_매출_대비']), 0),
      훈련유형: row.훈련유형 || '',
      NCS명: row.NCS명 || '',
      NCS코드: row.NCS코드 || '',
      선도기업: row.선도기업 || '',
      파트너기관: row.파트너기관 || '',
      isLeadingCompanyCourse: Boolean(row.is_leading_company_course) || derivedIsLeading,
      leadingCompanyPartnerInstitution: rawPartnerInstitution !== '' && rawPartnerInstitution !== '0'
        ? rawPartnerInstitution
        : undefined,
      __raw_매출_최대: pickRowValue(row, ['매출_최대', '매출 최대', '매출최대']),
      __raw_조정_실매출대비: pickRowValue(row, ['조정_실매출대비', '조정 실매출대비', '조정_실_매출_대비']),
      __raw_2026년: pickRowValue(row, ['2026년']),
      __raw_조정_2026년: pickRowValue(row, ['조정_2026년', '조정 2026년']),
      __raw_수료인원: pickRowValue(row, ['수료인원', '수료 인원', '수료_인원', '수료인원(명)', '수료 인원(명)']),
      __raw_파트너기관: pickRowValue(row, ['파트너기관', '파트너 기관']),
      __raw_leading_company_partner_institution: pickRowValue(row, [
        'leading_company_partner_institution',
        'leading company partner institution',
      ]),
      __raw_is_leading_company_course: pickRowValue(row, ['is_leading_company_course']),
    });
    });
  } catch (error) {
    console.error('데이터 조회 중 오류:', error);
    return [];
  }
}

/**
 * 특정 연도의 과정 데이터 조회
 */
export async function getProcessedCoursesByYear(year: number): Promise<ProcessedCourseData[]> {
  const allCourses = await getProcessedCourses();
  return allCourses.filter((course) => {
    const startDate = new Date(course.과정시작일);
    return startDate.getFullYear() === year;
  });
}
