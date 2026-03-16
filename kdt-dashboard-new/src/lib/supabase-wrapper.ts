import { supabase } from './supabaseClient';

export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export class SupabaseConnectionError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'SupabaseConnectionError';
  }
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // 휴면 상태 또는 일시적 오류인 경우 재시도
      const isRetryable = 
        error?.code === 'PGRST116' ||
        error?.message?.includes('unavailable') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('connection') ||
        error?.status === 503 ||
        error?.status === 502;

      if (!isRetryable || attempt === maxRetries) {
        break;
      }

      console.warn(`Supabase 연결 재시도 ${attempt}/${maxRetries}:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw new SupabaseConnectionError(
    'Supabase 연결에 실패했습니다. 서버를 재가동 중입니다.',
    lastError
  );
}

export async function checkSupabaseHealth(): Promise<{
  isHealthy: boolean;
  message: string;
  responseTime?: number;
}> {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase
      .from('kdt_data')
      .select('count', { count: 'exact', head: true })
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        isHealthy: false,
        message: error.message,
        responseTime
      };
    }

    return {
      isHealthy: true,
      message: '정상 작동 중',
      responseTime
    };

  } catch (error) {
    return {
      isHealthy: false,
      message: error instanceof Error ? error.message : '알 수 없는 오류',
      responseTime: Date.now() - startTime
    };
  }
}
