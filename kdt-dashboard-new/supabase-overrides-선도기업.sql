-- 선도기업·파트너기관을 kdt_data 에서 떼어내 별도 테이블로 옮긴다.
--
-- 왜 떼어내는가
-- -------------
-- 이 두 컬럼은 **사람이 손으로 채운 값**이다 (2026-09-17 기준 1,995건,
-- 두 컬럼이 채워진 집합이 정확히 일치하고 한쪽만 채워진 행은 0건).
-- 그런데 kdt_data 는 곧 GitHub Actions 가 매일 upsert 하는 기계 테이블이 된다.
-- `supabase-service.ts` 의 upsert 페이로드에 이 두 컬럼이 들어 있으므로,
-- 수집기가 값을 모른 채 올리면 **수작업 1,995건이 한 번에 null 로 덮인다.**
--
-- 그래서 사람 값과 기계 값을 테이블 단위로 가른다. 기계는 kdt_data 만 쓰고,
-- 사람 값은 여기에만 있으며, 읽을 때 백엔드가 고유값으로 조인해 채운다.
--
-- 출처 컬럼을 두는 이유: 나중에 상세페이지 크롤링으로 자동 판별을 붙일 때
-- (과정명 규칙만으로는 정밀도 70%/재현율 71% 라 원천이 필요하다)
-- 사람이 고친 값과 기계가 넣은 값을 구분해야 한다. 사람 값이 항상 이긴다.

create table if not exists kdt_course_overrides (
  "고유값"    text primary key,
  "선도기업"   text,
  "파트너기관" text,
  "출처"      text not null default 'manual',   -- manual | detail-crawl | course-name
  "비고"      text,
  updated_at timestamptz not null default now()
);

comment on table kdt_course_overrides is
  '사람이 유지하는 과정별 보정값. kdt_data 는 수집기가 덮어쓰므로 여기에 격리한다.';

-- 백필: 현재 kdt_data 에 들어 있는 사람 값을 그대로 옮긴다.
-- 고유값 중복이 있어도 한 건만 남도록 distinct on 을 쓴다.
insert into kdt_course_overrides ("고유값", "선도기업", "파트너기관", "출처", "비고")
select distinct on (d."고유값")
       d."고유값",
       nullif(btrim(d."선도기업"), ''),
       nullif(btrim(d."파트너기관"), ''),
       'manual',
       'kdt_data 에서 백필 (2026-09-17)'
from kdt_data d
where nullif(btrim(coalesce(d."선도기업", '')), '') is not null
   or nullif(btrim(coalesce(d."파트너기관", '')), '') is not null
order by d."고유값", d.id desc
on conflict ("고유값") do nothing;

-- 조회는 공개, 쓰기는 서버(service_role)만.
alter table kdt_course_overrides enable row level security;

drop policy if exists "overrides 읽기 공개" on kdt_course_overrides;
create policy "overrides 읽기 공개" on kdt_course_overrides
  for select to anon, authenticated using (true);
-- 쓰기 정책은 만들지 않는다 → anon/authenticated 는 쓰기 불가.
-- service_role 은 RLS 를 우회하므로 서버에서는 그대로 쓸 수 있다.
