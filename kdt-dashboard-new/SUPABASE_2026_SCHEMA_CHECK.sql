-- 1) 컬럼 존재 여부 확인 (courses 테이블 기준)
select
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
from information_schema.columns
where table_schema = 'public'
  and table_name = 'courses'
  and column_name in ('2026년', '조정_2026년')
order by column_name;

-- 2) 없으면 생성 (NUMERIC)
-- 주의: 컬럼명이 한글/특수문자를 포함하므로 반드시 큰따옴표 사용
alter table public.courses
  add column if not exists "2026년" numeric;

alter table public.courses
  add column if not exists "조정_2026년" numeric;

-- 3) 타입이 numeric이 아닌 경우(예: text) 변경
-- 데이터가 문자로 들어가 있다면 먼저 정제 필요. 우선 단순 캐스팅 시도.
-- 실패 시, 변환 불가한 row를 먼저 찾아야 합니다.
alter table public.courses
  alter column "2026년" type numeric using nullif(trim("2026년"::text), '')::numeric;

alter table public.courses
  alter column "조정_2026년" type numeric using nullif(trim("조정_2026년"::text), '')::numeric;
