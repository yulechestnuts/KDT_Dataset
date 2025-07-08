import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 디버깅: 환경변수 확인
console.log('Supabase URL:', supabaseUrl ? '설정됨' : '설정되지 않음');
console.log('Supabase Anon Key:', supabaseAnonKey ? '설정됨' : '설정되지 않음');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase 환경변수가 설정되지 않았습니다!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 연결 테스트
supabase.from('posts').select('count').limit(1).then(({ data, error }) => {
  if (error) {
    console.error('Supabase 연결 실패:', error);
  } else {
    console.log('Supabase 연결 성공');
  }
}); 