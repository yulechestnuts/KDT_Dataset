// Supabase 데이터 서비스

import { supabase } from '@/lib/supabaseClient';
import { ProcessedCourseData } from './types';
import { executeWithRetry, SupabaseConnectionError } from '@/lib/supabase-wrapper';
import { resolveRevenueYears } from '@/lib/revenue-years';
import { normalizeCourseLink } from '@/lib/course-link';

/** 진단용 __raw_* 필드를 응답에 포함할지. 켜면 페이로드가 커진다. */
const DEBUG_RAW = process.env.DEBUG_SUPABASE === '1';

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

function parseNumericNullable(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/%/g, '').replace(/,/g, '').trim();
    if (cleaned === '') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
    return await executeWithRetry(async () => {
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
          취업률_3개월: course['취업률 (3개월)'],
          취업률_6개월: course['취업률 (6개월)'],
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
        throw error;
      }

      return { success: true };
    });
  } catch (error) {
    console.error('데이터 저장 중 오류:', error);
    
    if (error instanceof SupabaseConnectionError) {
      return {
        success: false,
        error: '서버를 재가동 중입니다. 잠시 후 다시 시도해주세요.'
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 같은 고유값이 여러 행으로 들어온 경우 하나만 남긴다.
 *
 * `kdt_data.고유값` 에 UNIQUE 제약이 없어서 upsert(onConflict:'고유값') 가 update 로
 * 동작한다는 보장이 없다. 실제로 완전히 동일한 행이 두 벌 들어와 있는 과정이 있었다
 * (id 94380/94382, 94381/94383). 제약이 붙기 전까지는 재업로드마다 늘어날 수 있고,
 * 중복 1건은 수료인원·취업인원·매출을 그대로 두 번 더한다.
 *
 * 어느 쪽을 남길지는 id 가 큰 쪽 — 나중에 삽입된 행이다.
 * `updated_at` 같은 시각 컬럼이 없어 "최신"을 판별할 근거가 serial id 뿐이다.
 * (근본 해결은 supabase-dedupe-고유값.sql 참고)
 */
function dedupeByUniqueKey(rows: any[]): any[] {
  const latestByKey = new Map<string, any>();
  const keyless: any[] = [];

  for (const row of rows) {
    const key = String(row?.고유값 ?? '').trim();
    if (key === '') {
      // 고유값이 비면 서로 구분할 수단이 없다. 묶지 말고 그대로 둔다.
      keyless.push(row);
      continue;
    }
    const existing = latestByKey.get(key);
    if (!existing || Number(row?.id ?? 0) > Number(existing?.id ?? 0)) {
      latestByKey.set(key, row);
    }
  }

  const deduped = [...latestByKey.values(), ...keyless];
  const dropped = rows.length - deduped.length;
  if (dropped > 0) {
    console.warn(
      `[getProcessedCourses] 고유값 중복 ${dropped}건 제거 (${rows.length} → ${deduped.length}). ` +
        'kdt_data.고유값 에 UNIQUE 제약이 없어 재업로드 시 누적된다 — supabase-dedupe-고유값.sql 참고.'
    );
  }
  return deduped;
}

/**
 * Supabase에서 처리된 과정 데이터 조회 (실제 fetch 본체)
 *
 * 직접 호출하지 말 것 — 동시 요청 중복 제거를 거치는 `getProcessedCourses` 를 쓴다.
 */
async function fetchProcessedCourses(): Promise<ProcessedCourseData[]> {
  try {
    return await executeWithRetry(async () => {
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

        // count:'exact' 는 매 페이지마다 full COUNT(*) 를 유발한다.
        // exactCount 는 DEBUG 로그에만 쓰이므로 첫 페이지에서만 요청한다.
        //
        // 과정시작일은 유일하지 않아 같은 날짜 행들의 순서가 페이지마다 뒤바뀔 수 있고,
        // 그러면 range() 페이징이 어떤 행은 두 번 담고 어떤 행은 건너뛴다.
        // 고유값을 2차 정렬키로 넣어 전 페이지에 걸쳐 순서를 고정한다.
        const query = supabase
          .from(TABLE_NAME)
          .select('*', offset === 0 ? { count: 'exact' } : undefined)
          .order('과정시작일', { ascending: false })
          .order('고유값', { ascending: true })
          .range(from, to);

        const { data, error, count } = await query;

        if (process.env.DEBUG_SUPABASE === '1') {
          console.log('[getProcessedCourses] table:', TABLE_NAME);
          console.log('[getProcessedCourses] page range:', from, '-', to);
          console.log('[getProcessedCourses] page rows:', data?.length ?? 0);
          console.log('[getProcessedCourses] count (exact):', count);
          console.log('[getProcessedCourses] page error:', error);
        }

        if (error) {
          console.error('Supabase 조회 오류:', error);
          throw error;
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
      return dedupeByUniqueKey(allRows).map((row: any) => {
        const rawPartnerInstitution = String(row.leading_company_partner_institution ?? row.파트너기관 ?? '').trim();
        const derivedIsLeading = rawPartnerInstitution !== '' && rawPartnerInstitution !== '0';

        const yearRevenueFields: Record<string, number> = {};
        for (const year of resolveRevenueYears(row)) {
          yearRevenueFields[`${year}년`] = parseNumeric(pickRowValue(row, [`${year}년`]), 0);
          yearRevenueFields[`조정_${year}년`] = parseNumeric(
            pickRowValue(row, [`조정_${year}년`, `조정 ${year}년`]),
            0
          );
        }

        return ({
        고유값: row.고유값 || '',
        과정명: row.과정명 || '',
        '훈련과정 ID': String(pickRowValue(row, ['훈련과정_ID', '훈련과정 ID', '훈련과정ID']) ?? ''),
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
        취업인원: parseNumericNullable(pickRowValue(row, ['취업인원', '취업 인원'])),
        '취업인원 (3개월)': parseNumericNullable(row['취업인원 (3개월)'] ?? row['취업인원_3개월']),
        '취업인원 (6개월)': parseNumericNullable(row['취업인원 (6개월)'] ?? row['취업인원_6개월']),
        수료율: parseNumeric(pickRowValue(row, ['수료율']), 0),
        취업률: parseNumericNullable(pickRowValue(row, ['취업률'])),
        '취업률 (3개월)': parseNumericNullable(row['취업률 (3개월)'] ?? row['취업률_3개월']),
        '취업률 (6개월)': parseNumericNullable(row['취업률 (6개월)'] ?? row['취업률_6개월']),
        만족도: parseNumeric(pickRowValue(row, ['만족도']), 0),
        훈련비: parseNumeric(pickRowValue(row, ['훈련비']), 0),
        자비부담금: parseNumeric(pickRowValue(row, ['자비부담금', '자비_부담금', '자비 부담금']), 0),
        정원: parseNumeric(pickRowValue(row, ['정원']), 0),
        총훈련일수: parseNumeric(pickRowValue(row, ['총훈련일수', '총 훈련일수']), 0),
        총훈련시간: parseNumeric(pickRowValue(row, ['총훈련시간', '총 훈련시간']), 0),
        누적매출: parseNumeric(pickRowValue(row, ['누적매출', '누적 매출']), 0),
        '실 매출 대비': parseNumeric(pickRowValue(row, ['실_매출_대비', '실 매출 대비', '실매출대비']), 0),
        '매출 최대': parseNumeric(pickRowValue(row, ['매출_최대', '매출 최대', '매출최대']), 0),
        '매출 최소': parseNumeric(pickRowValue(row, ['매출_최소', '매출 최소', '매출최소']), 0),
        // 연도 키는 row 에서 동적으로 뽑아 펼친다 (리터럴 나열 금지 — @/lib/revenue-years)
        ...yearRevenueFields,
        조정_실매출대비: parseNumeric(pickRowValue(row, ['조정_실매출대비', '조정 실매출대비', '조정_실_매출_대비']), 0),
        훈련유형: row.훈련유형 || '',
        NCS명: row.NCS명 || '',
        NCS코드: row.NCS코드 || '',
        // DB 컬럼은 '과정페이지 링크'(공백 포함), 코드 전반은 '과정페이지링크'(공백 없음)를 쓴다.
        // 폐지된 구 도메인 링크가 섞여 있어 정규화한다 (@/lib/course-link)
        과정페이지링크: normalizeCourseLink(
          pickRowValue(row, ['과정페이지_링크', '과정페이지 링크', '과정페이지링크'])
        ),
        선도기업: row.선도기업 || '',
        파트너기관: row.파트너기관 || '',
        isLeadingCompanyCourse: Boolean(row.is_leading_company_course) || derivedIsLeading,
        leadingCompanyPartnerInstitution: rawPartnerInstitution !== '' && rawPartnerInstitution !== '0'
          ? rawPartnerInstitution
          : undefined,
        // 진단용 원본값. 응답 페이로드를 약 1MB 부풀리므로 DEBUG_SUPABASE=1 일 때만 싣는다.
        // (institution-stats 의 ?trace=1 출력이 이 값을 쓴다)
        ...(DEBUG_RAW
          ? {
              __raw_매출_최대: pickRowValue(row, ['매출_최대', '매출 최대', '매출최대']),
              __raw_조정_실매출대비: pickRowValue(row, [
                '조정_실매출대비',
                '조정 실매출대비',
                '조정_실_매출_대비',
              ]),
              __raw_수료인원: pickRowValue(row, [
                '수료인원',
                '수료 인원',
                '수료_인원',
                '수료인원(명)',
                '수료 인원(명)',
              ]),
              __raw_파트너기관: pickRowValue(row, ['파트너기관', '파트너 기관']),
              __raw_leading_company_partner_institution: pickRowValue(row, [
                'leading_company_partner_institution',
                'leading company partner institution',
              ]),
              __raw_is_leading_company_course: pickRowValue(row, ['is_leading_company_course']),
            }
          : {}),
      });
      });
    });
  } catch (error) {
    console.error('데이터 조회 중 오류:', error);
    
    if (error instanceof SupabaseConnectionError) {
      console.warn('Supabase 휴면 상태 감지, 빈 배열 반환');
      return [];
    }
    
    return [];
  }
}

/**
 * 진행 중인 fetch 를 공유하기 위한 핸들.
 *
 * 한 페이지가 revenue_mode 만 다른 요청을 동시에 쏘면(예: 연도별 분석의 current/max)
 * 같은 전체 스캔이 인스턴스 안에서 2번 돌았다. 진행 중인 Promise 를 재사용해 1번으로 줄인다.
 * 완료 즉시 핸들을 비우므로 스테일 데이터를 만들지 않는다(TTL 캐시가 아님).
 */
let inFlightFetch: Promise<ProcessedCourseData[]> | null = null;

/**
 * Supabase에서 처리된 과정 데이터 조회
 */
export function getProcessedCourses(): Promise<ProcessedCourseData[]> {
  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = fetchProcessedCourses().finally(() => {
    inFlightFetch = null;
  });

  return inFlightFetch;
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
