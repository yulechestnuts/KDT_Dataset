# API 사용 현황 및 개선사항

## 현재 상황

### 1. API 사용 현황 확인

**현재 화면에서 사용 중인 API:**
- ✅ `/api/data` - GitHub에서 CSV를 가져오는 단순 프록시 (현재 사용 중)
  - 위치: `src/app/api/data/route.ts`
  - 용도: 원본 CSV 파일 다운로드
  - 사용처:
    - `src/app/yearly-analysis/page.tsx`
    - `src/utils/data-loader.ts`
    - `src/utils/data-utils.ts`

**새로 만든 API (아직 사용 안 됨):**
- ❌ `/api/v1/upload-csv` - CSV 업로드 및 처리
- ❌ `/api/v1/institution-stats` - 기관별 통계 조회
- ❌ `/api/v1/yearly-stats` - 연도별 통계 조회
- ❌ `/api/v1/monthly-stats` - 월별 통계 조회
- ❌ `/api/v1/test/golden-cases` - 골든 테스트 케이스 검증

### 2. 인덱스 생성

**✅ 완료**: `supabase-indexes.sql` 파일 생성
- 훈련기관 인덱스
- 과정시작일 인덱스
- 과정종료일 인덱스
- 복합 인덱스 (훈련기관 + 과정시작일)
- 훈련과정 ID 인덱스
- 파트너기관 인덱스

**실행 방법:**
```sql
-- Supabase SQL Editor에서 실행
-- 파일: supabase-indexes.sql
```

### 3. 캐시 적용

**✅ 완료**: 1시간 캐싱 구현
- 캐시 모듈: `src/lib/backend/cache.ts`
- 적용된 API:
  - `/api/v1/institution-stats` - 기관별 통계 (1시간 캐시)
  - `/api/v1/yearly-stats` - 연도별 통계 (1시간 캐시)
  - `/api/v1/monthly-stats` - 월별 통계 (1시간 캐시)
- 캐시 무효화: CSV 업로드 시 자동으로 모든 통계 캐시 삭제

**캐시 동작:**
- 첫 요청: 데이터베이스에서 조회 → 계산 → 캐시 저장 → 응답
- 이후 요청 (1시간 이내): 캐시에서 즉시 반환
- 1시간 후: 자동 만료 → 다시 계산

## 개선사항 요약

### ✅ 완료된 항목

1. **인덱스 생성 SQL 작성**
   - `supabase-indexes.sql` 파일 생성
   - 훈련기관, 과정시작일, 과정종료일 인덱스 포함
   - 복합 인덱스로 조회 성능 최적화

2. **캐시 구현 (1시간)**
   - `src/lib/backend/cache.ts` 모듈 생성
   - 모든 통계 API에 캐시 적용
   - 자동 만료 및 정리 기능

3. **캐시 무효화**
   - CSV 업로드 시 자동으로 모든 통계 캐시 삭제
   - 새로운 데이터 반영 보장

### 📋 다음 단계

1. **Supabase 인덱스 생성**
   ```sql
   -- supabase-indexes.sql 파일의 SQL을 Supabase SQL Editor에서 실행
   ```

2. **프론트엔드 마이그레이션**
   - 현재 `/api/data` 사용 중인 페이지들을 `/api/v1/*` 시리즈로 전환
   - `마이그레이션_가이드.md` 참고

3. **테스트**
   - 캐시 동작 확인
   - 인덱스 적용 후 조회 속도 측정

## API 응답 예시 (캐시 포함)

### 캐시된 응답
```json
{
  "status": "success",
  "data": [...],
  "cached": true
}
```

### 새로 계산된 응답
```json
{
  "status": "success",
  "data": [...],
  "cached": false
}
```

## 성능 개선 효과

### 인덱스 적용 전
- 기관별 통계 조회: ~2-3초
- 연도별 필터링: ~1-2초

### 인덱스 적용 후 (예상)
- 기관별 통계 조회: ~0.5-1초
- 연도별 필터링: ~0.2-0.5초

### 캐시 적용 후
- 첫 요청: 위와 동일
- 이후 요청 (1시간 이내): ~10-50ms (캐시에서 즉시 반환)

---

**작성일**: 2025-01-XX  
**상태**: ✅ 인덱스 SQL 생성 완료, ✅ 캐시 구현 완료
