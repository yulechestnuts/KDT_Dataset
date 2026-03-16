import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  return await handleHealthCheck();
}

export async function POST(request: NextRequest) {
  return await handleHealthCheck();
}

async function handleHealthCheck() {
  const startTime = Date.now();
  
  try {
    // 가장 가벼운 Supabase 쿼리 실행
    const { data, error, status } = await supabase
      .from('kdt_data')
      .select('count', { count: 'exact', head: true })
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      console.error('Health check failed:', error);
      
      // Supabase가 휴면 상태일 경우의 응답
      if (status === 503 || error.message?.includes('unavailable') || error.message?.includes('paused')) {
        return NextResponse.json({
          status: 'waking_up',
          message: '서버를 재가동 중입니다. 잠시 후 다시 시도해주세요.',
          timestamp: new Date().toISOString(),
          responseTime: `${responseTime}ms`
        }, { status: 503 });
      }

      return NextResponse.json({
        status: 'error',
        message: '데이터베이스 연결에 실패했습니다.',
        error: error.message,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'healthy',
      message: '서비스가 정상 작동 중입니다.',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      database: 'connected',
      count: data?.[0]?.count || 0
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Health check exception:', error);
    
    return NextResponse.json({
      status: 'error',
      message: '서버 상태 확인 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`
    }, { status: 500 });
  }
}
