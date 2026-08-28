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
  count(*) - count(DISTINCT 고유값)           AS 중복행
FROM kdt_data;

-- ── STEP 2. 어떤 고유값이 중복인지 + 내용까지 같은지 ─────────────────────
--   내용이 다르면(= 일정 변경 등으로 값이 갱신된 경우) 어느 행을 남길지 눈으로 확인해야 한다.
--   아래 STEP 4 는 무조건 id 가 가장 큰(= 가장 나중에 들어온) 행을 남긴다.
SELECT
  고유값,
  count(*)                     AS 행수,
  array_agg(id ORDER BY id)    AS ids,
  count(DISTINCT (kdt_data.*)::text) AS 서로다른내용수   -- 1 이면 완전 중복
FROM kdt_data
GROUP BY 고유값
HAVING count(*) > 1
ORDER BY count(*) DESC, 고유값;

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
--         고유값이 비어 있는 행이 여러 건이어도 걸리지 않도록 부분 인덱스로 만든다.
CREATE UNIQUE INDEX IF NOT EXISTS kdt_data_고유값_uniq
  ON kdt_data (고유값)
  WHERE 고유값 IS NOT NULL AND btrim(고유값) <> '';

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
