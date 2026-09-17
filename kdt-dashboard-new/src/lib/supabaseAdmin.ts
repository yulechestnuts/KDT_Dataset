import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * 서버 전용 Supabase 클라이언트 (service_role).
 *
 * 왜 필요한가
 * -----------
 * 기존에는 쓰기까지 전부 `supabaseClient.ts` 의 **anon 키**로 했다. 그런데 anon 키는
 * `NEXT_PUBLIC_` 이라 프론트 번들에 그대로 실려 누구나 꺼낼 수 있다. 실제로 확인해 보니
 * (2026-09-17) 그 키로 `kdt_data` 에 SELECT 200 / UPDATE 200 / DELETE 204 가 전부 통했다.
 * 즉 사이트를 연 사람이 키를 꺼내 DELETE 한 번 보내면 7,230행이 사라지는 상태였다.
 *
 * 그래서 쓰기는 이 클라이언트로 옮기고, `kdt_data` 에는 RLS 로 anon 읽기만 남긴다.
 * service_role 은 RLS 를 우회하므로 서버 경로는 그대로 동작한다.
 *
 * 주의
 * ----
 * - 이 모듈은 **절대 클라이언트 컴포넌트에서 import 하지 말 것.** 키가 번들에 실린다.
 *   (`SUPABASE_SERVICE_ROLE_KEY` 는 `NEXT_PUBLIC_` 접두어가 없어 Next 가 클라이언트
 *   번들에 넣지 않지만, import 자체를 하지 않는 것이 유일하게 확실한 방어다.)
 * - 키가 없는 환경에서는 null 이다. 호출부가 그 경우를 명시적으로 다뤄야 한다 —
 *   조용히 anon 으로 되돌아가면 RLS 를 켠 뒤 "쓰기가 안 되는데 에러도 없는" 상태가 된다.
 */
function createAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabaseAdmin: SupabaseClient | null = createAdminClient();

/** 쓰기 경로에서 쓴다. 키가 없으면 조용히 anon 으로 떨어지지 않고 던진다. */
export function requireSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다. ' +
        '쓰기 경로는 service_role 로만 동작합니다 (Vercel 환경변수에 추가할 것).'
    );
  }
  return supabaseAdmin;
}
