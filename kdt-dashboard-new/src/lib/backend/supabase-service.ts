// Supabase 데이터 서비스

import { supabase } from '@/lib/supabaseClient';
import { requireSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fillMissingRevenue, type DeriveStats } from '@/lib/revenue-derive';
import { ProcessedCourseData } from './types';
import { executeWithRetry, SupabaseConnectionError } from '@/lib/supabase-wrapper';
import { resolveRevenueYears, resolveRevenueYearsFrom } from '@/lib/revenue-years';
import { normalizeCourseLink } from '@/lib/course-link';

/** 진단용 __raw_* 필드를 응답에 포함할지. 켜면 페이로드가 커진다. */
const DEBUG_RAW = process.env.DEBUG_SUPABASE === '1';

const TABLE_NAME = process.env.SUPABASE_TABLE_NAME || 'kdt_data';

/**
 * 사람이 손으로 채우는 값만 모아 둔 테이블 (선도기업·파트너기관).
 *
 * kdt_data 는 수집기가 매일 upsert 하는 기계 테이블이 된다. 두 컬럼이 그 upsert
 * 페이로드에 들어 있으므로, 수집기가 값을 모르는 순간 수작업 1,995건이 한 번에
 * null 로 덮인다. 그래서 사람 값은 여기에만 두고 읽을 때 고유값으로 얹는다.
 * (스키마: supabase-overrides-선도기업.sql)
 */
const OVERRIDES_TABLE = process.env.SUPABASE_OVERRIDES_TABLE || 'kdt_course_overrides';

type CourseOverride = { 선도기업: string; 파트너기관: string };

/**
 * 직전 조회에서 매출을 몇 건이나 계산으로 채웠는지. API 응답 meta 로 노출한다.
 *
 * 이게 갑자기 커지면 "수집기가 매출 컬럼을 못 가져오고 있다"는 신호이고,
 * 0 이면 마스터가 전부 채워져 있다는 뜻이다. 자동 수집이 정상인지 보는 창이다.
 */
let lastRevenueDeriveStats: DeriveStats = { total: 0, filled: 0, unresolvable: 0 };

export function getRevenueDeriveStats(): DeriveStats {
  return lastRevenueDeriveStats;
}

/**
 * overrides 를 전량 읽어 고유값 → 값 맵으로 돌려준다.
 *
 * 실패하면 **빈 맵이 아니라 null** 을 돌려준다. 빈 맵으로 퇴화시키면 "오버라이드가
 * 하나도 없다"와 "읽지 못했다"가 구분되지 않아, 조회 장애 한 번이 선도기업 전건
 * 소실로 조용히 둔갑한다. null 이면 호출부가 kdt_data 에 남은 값을 그대로 쓴다.
 */
async function fetchCourseOverrides(): Promise<Map<string, CourseOverride> | null> {
  try {
    const map = new Map<string, CourseOverride>();
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from(OVERRIDES_TABLE)
        .select('고유값, 선도기업, 파트너기관')
        .order('고유값', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const row of data as any[]) {
        const key = String(row.고유값 ?? '').trim();
        if (!key) continue;
        map.set(key, {
          선도기업: String(row.선도기업 ?? '').trim(),
          파트너기관: String(row.파트너기관 ?? '').trim(),
        });
      }
      if (data.length < pageSize) break;
    }
    return map;
  } catch (error) {
    console.error(
      `[overrides] ${OVERRIDES_TABLE} 조회 실패 — kdt_data 에 남은 값을 그대로 씁니다:`,
      error
    );
    return null;
  }
}

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
/**
 * 저장할 연도 컬럼을 course 객체에서 펼친다.
 * 값이 없는 연도는 아예 넣지 않는다 — DB 에 그 컬럼이 없을 때 upsert 전체가
 * 실패하는 것을 피하기 위해서다.
 */
function buildYearFields(
  course: ProcessedCourseData,
  years: number[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const y of years) {
    const plain = `${y}년`;
    const adjusted = `조정_${y}년`;
    if (course[plain] !== undefined) out[plain] = course[plain];
    if (course[adjusted] !== undefined) out[adjusted] = course[adjusted];
  }
  return out;
}

/**
 * `조정_YYYY년` 키를 떨군다.
 *
 * kdt_data 에는 `2021년`~`2027년` 만 있고 `조정_*` 컬럼은 없다. PostgREST 는
 * 없는 컬럼이 하나라도 섞이면 요청 전체를 400(PGRST204)으로 거절하므로,
 * 한 건이라도 남으면 적재가 통째로 실패한다.
 * (조정값은 어차피 읽을 때 applyRevenueAdjustmentIfMissing 이 다시 계산한다)
 */
function stripMissingYearColumns(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k.startsWith('조정_')) continue;
    out[k] = v;
  }
  return out;
}

export async function saveProcessedCourses(
  courses: ProcessedCourseData[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 실제 데이터에 존재하는 연도의 합집합 + 표준 폴백 범위
    const saveYears = resolveRevenueYearsFrom(courses);
    return await executeWithRetry(async () => {
      // 기존 데이터 삭제 (선택사항)
      // await supabase.from(TABLE_NAME).delete().neq('id', 0);

      // 쓰기는 service_role 로만. anon 키는 프론트 번들에 실려 공개되므로
      // kdt_data 에 RLS 를 걸어 anon 은 읽기만 하게 둔다. (supabaseAdmin.ts 참고)
      const db = requireSupabaseAdmin();

      // 데이터 삽입
      //
      // ★ 컬럼명은 **DB 실제 이름(공백 표기)** 이어야 한다.
      //   예전 코드는 `훈련과정_ID`·`수강신청_인원`·`매출_최대` 처럼 언더스코어로 보냈는데
      //   kdt_data 의 실제 컬럼은 `훈련과정 ID`·`수강신청 인원`·`매출 최대` 다.
      //   그래서 저장이 항상 PGRST204 로 실패했다 (2026-09-17 실증:
      //   언더스코어 → 400 "Could not find the '매출_최대' column", 공백 → 201).
      //   읽기 경로는 pickRowValue 가 두 표기를 모두 시도해서 이 불일치가 가려져 있었다.
      //
      //   DB 에 없는 컬럼을 하나라도 넣으면 요청 전체가 400 이 된다. 그래서
      //   `원본훈련기관`·`평가인원`·`누적매출`·`취업인원`·`취업률`·`훈련유형`·
      //   `조정_실매출대비`·`조정_YYYY년`·`is_leading_company_course` 등
      //   **테이블에 존재하지 않는 키는 전부 뺐다.** 새 컬럼을 쓰고 싶으면
      //   테이블에 먼저 추가할 것.
      const { error } = await db.from(TABLE_NAME).upsert(
        courses.map((course) => ({
          고유값: course.고유값,
          과정명: course.과정명,
          '훈련과정 ID': course['훈련과정 ID'],
          회차: course.회차,
          훈련기관: course.훈련기관,
          과정시작일: course.과정시작일,
          과정종료일: course.과정종료일,
          '수강신청 인원': course['수강신청 인원'],
          수료인원: course.수료인원,
          '취업인원 (3개월)': course['취업인원 (3개월)'],
          '취업인원 (6개월)': course['취업인원 (6개월)'],
          수료율: course.수료율,
          '취업률 (3개월)': course['취업률 (3개월)'],
          '취업률 (6개월)': course['취업률 (6개월)'],
          만족도: course.만족도,
          훈련비: course.훈련비,
          정원: course.정원,
          '총 훈련일수': course.총훈련일수,
          '총 훈련시간': course.총훈련시간,
          자비부담금: course.자비부담금,
          '실 매출 대비': course['실 매출 대비'],
          '매출 최대': course['매출 최대'],
          '매출 최소': course['매출 최소'],
          // 연도 키는 리터럴로 나열하지 않는다 (@/lib/revenue-years).
          // 2026년까지만 박혀 있어서 2027년 매출이 저장되지 않았다 — 읽기 경로만
          // 동적화돼 있고 쓰기 경로에 같은 함정이 남아 있었다.
          // 조정_YYYY년 은 DB 에 컬럼이 없으므로 여기서 걸러낸다.
          ...stripMissingYearColumns(buildYearFields(course, saveYears)),
          NCS명: course.NCS명,
          NCS코드: course.NCS코드,
          // 선도기업·파트너기관은 여기서 쓰지 않는다.
          //
          // 이 둘은 사람이 손으로 채운 값이고(2026-09-17 기준 1,995건),
          // kdt_data 는 곧 수집기가 매일 upsert 하는 기계 테이블이 된다.
          // 페이로드에 남겨 두면 값을 모르는 수집이 한 번 돌 때마다 1,995건이
          // 통째로 null 이 된다. 정본은 kdt_course_overrides 이고,
          // 읽기 경로(fetchCourseOverrides)가 고유값으로 얹어 준다.
          //
          // 사람이 고친 값을 저장하는 경로는 overrides 테이블에 직접 써야 한다.
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

      // 매출 기본값이 비어 있는 행을 계산으로 채운다.
      //
      // 지금까지 이 컬럼들은 엑셀 마스터에서 사람이 넣던 값이다. 수집이 자동화되면
      // 마스터에 없는 신규 과정이 매일 들어오는데 수집기는 이 값을 채우지 않아
      // 그대로 두면 새 과정이 전부 매출 0 으로 보인다.
      // 저장값이 있으면 절대 덮어쓰지 않으므로 기존 숫자는 바뀌지 않는다.
      // (산식은 저장값 전수와 대조해 불일치 0 건 확인 — revenue-derive.ts)
      lastRevenueDeriveStats = fillMissingRevenue(allRows);
      if (lastRevenueDeriveStats.filled > 0 || process.env.DEBUG_SUPABASE === '1') {
        console.log(
          `[매출파생] ${lastRevenueDeriveStats.filled}/${lastRevenueDeriveStats.total}행 계산으로 채움` +
            ` (계산불가 ${lastRevenueDeriveStats.unresolvable}행)`
        );
      }

      // 사람 값(선도기업·파트너기관)을 얹는다. 매핑 **전에** 행에 직접 써넣어야
      // 아래 rawPartnerInstitution 파생과 그 뒤 모든 계산이 같은 값을 본다.
      const overrides = await fetchCourseOverrides();
      if (overrides) {
        let applied = 0;
        for (const row of allRows) {
          const ov = overrides.get(String(row?.고유값 ?? '').trim());
          if (!ov) continue;
          // 오버라이드가 사람이 정한 정본이다. 빈 문자열도 "비우기"라는 뜻이므로
          // kdt_data 값으로 되메우지 않는다.
          row.선도기업 = ov.선도기업;
          row.파트너기관 = ov.파트너기관;
          row.leading_company_partner_institution = ov.파트너기관;
          applied += 1;
        }
        if (process.env.DEBUG_SUPABASE === '1') {
          console.log(`[overrides] ${applied}/${allRows.length} 행에 적용`);
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
        // 만족도 가중평균의 가중치. DB 컬럼은 공백 대신 언더스코어라 두 표기를 함께 시도한다.
        평가인원: parseNumeric(pickRowValue(row, ['평가인원', '평가_인원', '평가 인원']), 0),
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
