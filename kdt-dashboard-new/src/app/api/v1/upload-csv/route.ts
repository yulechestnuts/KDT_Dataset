// CSV 업로드 및 처리 API

import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { RawCourseData } from '@/lib/backend/types';
import { transformRawDataArray } from '@/lib/backend/data-transformer';
import { generateHealthCheckReport } from '@/lib/backend/health-check';
import { saveProcessedCourses } from '@/lib/backend/supabase-service';
import { timingSafeEqual } from 'node:crypto';

/**
 * 이 엔드포인트는 7,230행짜리 데이터셋을 통째로 덮어쓴다. 그런데 인증이 한 줄도
 * 없어서 URL 만 알면 누구나 POST 할 수 있었다. 수집이 자동화되면 이 경로가 매일
 * 열리므로 토큰을 요구한다.
 *
 * `UPLOAD_TOKEN` 이 설정되지 않은 환경에서는 **열지 않고 막는다.** 미설정을
 * "인증 없음"으로 해석하면 환경변수를 빠뜨린 순간 조용히 무방비로 돌아간다.
 */
function isAuthorized(request: NextRequest): { ok: true } | { ok: false; reason: string } {
  const expected = process.env.UPLOAD_TOKEN;
  if (!expected) {
    return { ok: false, reason: 'UPLOAD_TOKEN 이 서버에 설정되지 않았습니다.' };
  }

  const header = request.headers.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!provided) return { ok: false, reason: '인증 토큰이 없습니다.' };

  // 길이가 다르면 timingSafeEqual 이 던지므로 먼저 거른다.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: '인증 토큰이 일치하지 않습니다.' };
  }
  return { ok: true };
}

export async function POST(request: NextRequest) {
  try {
    const auth = isAuthorized(request);
    if (!auth.ok) {
      return NextResponse.json(
        { status: 'error', message: `업로드 권한이 없습니다. ${auth.reason}` },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('csv_file') as File;

    if (!file) {
      return NextResponse.json(
        { status: 'error', message: 'CSV 파일이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // CSV 파일 읽기
    const text = await file.text();

    // CSV 파싱
    const parseResult = Papa.parse<RawCourseData>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'CSV 파싱 중 오류가 발생했습니다.',
          errors: parseResult.errors,
        },
        { status: 400 }
      );
    }

    // 데이터 변환
    const processedData = transformRawDataArray(parseResult.data);

    // Health Check 리포트 생성
    const healthCheck = generateHealthCheckReport(processedData);

    // Supabase에 저장
    const saveResult = await saveProcessedCourses(processedData);
    if (!saveResult.success) {
      // 예전엔 여기서 console.error 만 찍고 아래 `status: 'success'` /
      // "성공적으로 처리되었습니다" 를 그대로 반환했다. 저장이 통째로 실패해도
      // 올린 사람에게는 성공으로 보였다는 뜻이다. 재적재는 한 달에 한 번뿐이라
      // 조용한 실패를 다음 달까지 모르고 지나갈 수 있다.
      //
      // 실제로 터질 수 있는 시나리오: `kdt_data.고유값` 에 유니크 인덱스가 없거나
      // 부분 인덱스만 있으면 upsert(onConflict:'고유값') 가 42P10
      // (no unique or exclusion constraint matching the ON CONFLICT specification)
      // 으로 전건 실패한다 — supabase-dedupe-고유값.sql 참고.
      console.error('Supabase 저장 실패:', saveResult.error);
      return NextResponse.json(
        {
          status: 'error',
          message:
            'CSV 는 읽었지만 Supabase 저장에 실패했습니다. 데이터는 갱신되지 않았습니다.',
          error: saveResult.error,
          data: { parsed_courses: processedData.length, saved_courses: 0 },
          health_check: healthCheck,
        },
        { status: 500 }
      );
    }

    // CSV 업로드 시 모든 통계 캐시 무효화
    const { cacheManager } = await import('@/lib/backend/cache');
    cacheManager.deletePattern('institution-stats:.*');
    cacheManager.deletePattern('yearly-stats:.*');
    cacheManager.deletePattern('monthly-stats:.*');

    return NextResponse.json({
      status: 'success',
      message: 'CSV 파일이 성공적으로 처리되었습니다.',
      data: {
        processed_courses: processedData.length,
        processing_time_ms: 0, // TODO: 실제 처리 시간 측정
        institution_count: healthCheck.institution_count,
        year_range: healthCheck.year_range,
      },
      health_check: healthCheck,
    });
  } catch (error) {
    console.error('CSV 업로드 오류:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'CSV 파일 처리 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
