-- kdt_data 잠그기 + upsert 가 실제로 동작하게 만들기
--
-- 이 파일은 세 가지를 한 번에 한다. 순서가 중요하다.
--
--  A. 고유값 UNIQUE 인덱스
--     없으면 upsert(onConflict:'고유값') 가 42P10 으로 **전건 실패**한다.
--     2026-09-17 롤백 트랜잭션에서 실제로 확인했다:
--       ON CONFLICT (고유값) → 42P10: there is no unique or exclusion constraint
--     즉 /api/v1/upload-csv 는 지금까지 한 번도 저장에 성공한 적이 없다.
--     (a52ed5d 이전에는 그 실패를 'success' 로 돌려줬다)
--     사전점검 완료: 7,230행 / 고유값 7,230종 / 중복 0 / 빈값 0 / 공백변형 0
--     → supabase-dedupe-고유값.sql 의 STEP 3~4(중복 삭제)는 할 일이 없다.
--
--  B. updated_at + 트리거
--     "최신 행"을 serial id 우연이 아니라 시각으로 판별할 수 있게 한다.
--     캐시 무효화 키(인스턴스별 Map 대신 데이터 버전)와 변경분 이력 적재의 기준.
--
--  C. RLS — anon 은 읽기만
--     쓰기까지 anon 키로 하고 있었는데 그 키는 NEXT_PUBLIC_ 이라 프론트 번들에
--     그대로 실린다. 2026-09-17 실측: anon 으로 SELECT 200 / UPDATE 200 / DELETE 204.
--     사이트를 연 사람이 7,230행을 지울 수 있는 상태였다.
--
--     ★ 선행 조건: 서버 쓰기 경로가 이미 service_role 로 옮겨져 있어야 한다.
--       (commit 0f28596 — supabaseAdmin.ts / requireSupabaseAdmin)
--       안 그러면 이 파일을 적용하는 순간 업로드가 조용히 막힌다.

begin;

-- ── A. UNIQUE ────────────────────────────────────────────────────────────
-- 부분 인덱스(WHERE 절)로 만들면 안 된다. PostgREST 가 만드는 구문은
-- `ON CONFLICT (고유값) DO UPDATE` 로 index_predicate 가 없어서 Postgres 가
-- 부분 유니크 인덱스를 추론하지 못한다 → 42P10 이 그대로 남는다.
create unique index if not exists "kdt_data_고유값_uniq" on kdt_data ("고유값");

-- ── B. updated_at ────────────────────────────────────────────────────────
alter table kdt_data add column if not exists updated_at timestamptz not null default now();

create or replace function kdt_data_touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists kdt_data_set_updated_at on kdt_data;
create trigger kdt_data_set_updated_at
  before insert or update on kdt_data
  for each row execute function kdt_data_touch_updated_at();

-- ── C. RLS ───────────────────────────────────────────────────────────────
alter table kdt_data enable row level security;

drop policy if exists "kdt_data 읽기 공개" on kdt_data;
create policy "kdt_data 읽기 공개" on kdt_data
  for select to anon, authenticated using (true);

-- INSERT/UPDATE/DELETE 정책은 만들지 않는다 → anon/authenticated 는 쓰기 불가.
-- service_role 은 RLS 를 우회하므로 서버 경로는 그대로 동작한다.

commit;

-- ── 적용 후 확인 ─────────────────────────────────────────────────────────
-- 1) 유니크가 붙었는가 (이 구문이 에러 없이 통과해야 한다)
--    begin; insert into kdt_data ("고유값") values ('__t__') on conflict ("고유값") do nothing; rollback;
-- 2) anon 으로 DELETE 가 막히는가 (401/403 이어야 한다)
-- 3) 사이트 institution-stats 총매출이 그대로인가 (읽기는 영향 없어야 한다)
