-- Supabase 인덱스 생성 SQL
-- 데이터 안 깨지니까 걱정 말고 훈련기관, 과정시작일에 인덱스 걸어주세요. 그래야 조회 속도가 잡힙니다.

-- 훈련기관 인덱스
CREATE INDEX IF NOT EXISTS idx_courses_훈련기관 ON courses(훈련기관);

-- 과정시작일 인덱스
CREATE INDEX IF NOT EXISTS idx_courses_과정시작일 ON courses(과정시작일);

-- 과정종료일 인덱스 (추가로 생성 - 통계 계산에 유용)
CREATE INDEX IF NOT EXISTS idx_courses_과정종료일 ON courses(과정종료일);

-- 복합 인덱스 (기관별 연도별 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_courses_훈련기관_과정시작일 ON courses(훈련기관, 과정시작일);

-- 훈련과정 ID 인덱스 (과정 집계에 유용)
CREATE INDEX IF NOT EXISTS idx_courses_훈련과정_ID ON courses(훈련과정_ID) WHERE 훈련과정_ID IS NOT NULL;

-- 파트너기관 인덱스 (선도기업 과정 조회에 유용)
CREATE INDEX IF NOT EXISTS idx_courses_파트너기관 ON courses(파트너기관) WHERE 파트너기관 IS NOT NULL AND 파트너기관 != '';

-- 인덱스 생성 확인 쿼리
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'courses';
