-- kdt_data 고유값 중복 정리 + 재발 방지
--
-- 배경
--   `saveProcessedCourses` 는 upsert(onConflict:'고유값') 로 저장하는데,
--   `고유값` 에 UNIQUE 제약이 없어 update 가 아니라 insert 로 빠질 수 있다.
--   실제로 모든 컬럼이 동일한 행이 두 벌 들어와 있었다 (id 94380/94382, 94381/94383).
--   중복 1건은 수료인원·취업인원·매출을 그대로 두 번 더하므로 모든 지표가 조용히 부풀려진다.
--
--   앱에는 `dedupeByUniqueKey`(src/lib/backend/supabase-service.ts) 로 방어막을 넣어 두었지만
--   그건 증상 억제일 뿐이다. 아래를 적용해야 원인이 사라진다.
--
-- 실행 전
--   1) Supabase Studio → Database → Backups 에서 백업이 있는지 확인할 것. DELETE 는 되돌릴 수 없다.
--   2) STEP 1~2 로 먼저 무엇이 지워질지 눈으로 볼 것.
--   3) STEP 3~5 는 한 트랜잭션으로 묶여 있다. 중간에 실패하면 전부 롤백된다.

-- ── STEP 1. 중복이 몇 건이나 있는지 ──────────────────────────────────────
SELECT
  count(*)                                   AS 전체행,
  count(DISTINCT 고유값)                      AS 고유값종류,
  count(*) - count(DISTINCT 고유값)           AS 중복행,
  count(DISTINCT btrim(고유값))               AS 공백정규화_종류
FROM kdt_data;
-- 기준값: 2026-09 데이터셋 CSV 는 7,230행이고 고유값이 전부 유일하다.
-- 전체행이 7,230 을 넘으면 그만큼이 재업로드로 쌓인 중복이다.

-- ── STEP 2. 어떤 고유값이 중복인지 + 내용까지 같은지 ─────────────────────
--   내용이 다르면(= 일정 변경 등으로 값이 갱신된 경우) 어느 행을 남길지 눈으로 확인해야 한다.
--   아래 STEP 4 는 무조건 id 가 가장 큰(= 가장 나중에 들어온) 행을 남긴다.
--
--   주의: 예전엔 `count(DISTINCT (kdt_data.*)::text)` 로 비교했는데 그 표현식에는
--   `id` 가 들어간다. 중복 행은 정의상 id 가 다르므로 이 값은 절대 1 이 될 수 없고,
--   "완전 중복" 판정이 영영 작동하지 않았다. id 를 빼고 비교해야 한다.
SELECT
  고유값,
  count(*)                                              AS 행수,
  array_agg(id ORDER BY id)                             AS ids,
  count(DISTINCT (to_jsonb(kdt_data.*) - 'id')::text)   AS 서로다른내용수   -- 1 이면 완전 중복
FROM kdt_data
GROUP BY 고유값
HAVING count(*) > 1
ORDER BY count(*) DESC, 고유값;

-- ── STEP 2-b. 내용이 다른 중복은 무엇이 다른지 컬럼 단위로 본다 ──────────
--   STEP 2 에서 `서로다른내용수 > 1` 인 고유값만 걸린다. 여기서 나온 컬럼이
--   수료인원·취업인원·매출 같은 지표라면 max(id) 를 남기는 게 맞는지 다시 생각할 것.
WITH dup AS (
  SELECT 고유값 FROM kdt_data GROUP BY 고유값 HAVING count(*) > 1
), j AS (
  SELECT k.고유값, k.id, to_jsonb(k.*) - 'id' AS body
  FROM kdt_data k JOIN dup USING (고유값)
)
SELECT 고유값, key AS 다른컬럼, count(DISTINCT value) AS 값종류수,
       array_agg(DISTINCT value::text) AS 값들
FROM j, jsonb_each(body)
GROUP BY 고유값, key
HAVING count(DISTINCT value) > 1
ORDER BY 고유값, key;

-- ── STEP 2-c. 공백/대소문자 때문에 '다른 고유값'으로 새는 행이 있는지 ────
--   STEP 5 의 UNIQUE 인덱스는 btrim 을 적용하지 않은 원본 `고유값` 에 걸린다.
--   앞뒤 공백만 다른 두 행은 제약을 통과해 버리므로 먼저 확인해 둔다.
SELECT btrim(고유값) AS 정규화_고유값,
       count(*)                       AS 행수,
       count(DISTINCT 고유값)          AS 표기종류수,
       array_agg(DISTINCT 고유값)      AS 표기들
FROM kdt_data
WHERE 고유값 IS NOT NULL AND btrim(고유값) <> ''
GROUP BY btrim(고유값)
HAVING count(DISTINCT 고유값) > 1
ORDER BY 1;

-- ── STEP 2-d. 고유값이 비어 있는 행 (부분 인덱스가 덮지 않는 사각지대) ───
SELECT count(*) AS 고유값_빈행 FROM kdt_data
WHERE 고유값 IS NULL OR btrim(고유값) = '';

-- ── STEP 3~5. 정리 및 제약 추가 (한 트랜잭션) ───────────────────────────
BEGIN;

-- STEP 3. 지워질 행을 임시 테이블에 남겨 둔다 (롤백용 근거)
CREATE TEMP TABLE kdt_data_dupes_removed AS
SELECT *
FROM kdt_data
WHERE id NOT IN (
  SELECT max(id) FROM kdt_data WHERE 고유값 IS NOT NULL AND btrim(고유값) <> '' GROUP BY 고유값
)
AND 고유값 IS NOT NULL
AND btrim(고유값) <> '';

SELECT count(*) AS 삭제예정 FROM kdt_data_dupes_removed;

-- STEP 4. 고유값별 최신(max id) 한 건만 남기고 삭제
DELETE FROM kdt_data
WHERE id IN (SELECT id FROM kdt_data_dupes_removed);

-- STEP 5. 재발 방지 — 이 제약이 있어야 upsert(onConflict:'고유값') 가 실제로 update 로 동작한다.
--
--   ★ 부분 인덱스(WHERE 절 있는 인덱스)로 만들면 안 된다.
--     PostgREST 가 만드는 구문은 `ON CONFLICT (고유값) DO UPDATE` 로 index_predicate 가 없다.
--     Postgres 는 술어 없는 conflict_target 으로 **부분 유니크 인덱스를 추론하지 못한다**
--     (index_predicate 를 같이 줘야 추론된다). 그래서 부분 인덱스만 있으면 업로드가
--     `42P10: there is no unique or exclusion constraint matching the ON CONFLICT
--     specification` 로 통째로 실패한다. 중복을 막으려다 적재를 막는 셈이다.
--
--   전체 인덱스로 만들어도 NULL 은 문제되지 않는다 — Postgres 유니크 인덱스에서 NULL 끼리는
--   서로 다른 값으로 취급돼 여러 건이 공존한다. 걸리는 건 **빈 문자열('')이 2건 이상**일 때뿐이다.
--   STEP 2-d 로 먼저 확인하고, 있으면 아래 정리를 먼저 돌린다.
--
--   -- 빈 문자열을 NULL 로 바꿔 유니크 충돌에서 빼기 (STEP 2-d 결과가 2건 이상일 때만)
--   -- UPDATE kdt_data SET 고유값 = NULL WHERE 고유값 IS NOT NULL AND btrim(고유값) = '';

CREATE UNIQUE INDEX IF NOT EXISTS kdt_data_고유값_uniq
  ON kdt_data (고유값);

-- 확인: 여기서 중복행이 0 이어야 한다
SELECT count(*) - count(DISTINCT 고유값) AS 남은중복 FROM kdt_data;

COMMIT;
-- 문제가 보이면 COMMIT 대신 ROLLBACK;

-- ── STEP 6 (선택). "최신"을 id 우연이 아니라 시각으로 판별하기 ───────────
--   지금은 updated_at 이 없어 어느 행이 최신인지 serial id 로 추정할 수밖에 없다.
--   아래를 넣으면 갱신 시각이 데이터에 남아 판단 근거가 명시적이 된다.
--
-- ALTER TABLE kdt_data ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
--
-- CREATE OR REPLACE FUNCTION kdt_data_touch_updated_at() RETURNS trigger AS $$
-- BEGIN
--   NEW.updated_at := now();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- DROP TRIGGER IF EXISTS kdt_data_set_updated_at ON kdt_data;
-- CREATE TRIGGER kdt_data_set_updated_at
--   BEFORE INSERT OR UPDATE ON kdt_data
--   FOR EACH ROW EXECUTE FUNCTION kdt_data_touch_updated_at();
