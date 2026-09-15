// CSV 업로드 및 처리 API

import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { RawCourseData } from '@/lib/backend/types';
import { transformRawDataArray } from '@/lib/backend/data-transformer';
import { generateHealthCheckReport } from '@/lib/backend/health-check';
import { saveProcessedCourses } from '@/lib/backend/supabase-service';

export async function POST(request: NextRequest) {
  try {
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
