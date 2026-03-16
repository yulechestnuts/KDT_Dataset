# Supabase Keep-Alive 자동화 설정

## 개요
Supabase 무료 티어의 자동 휴면(Pausing) 현상을 방지하기 위한 자동화 솔루션입니다.

## 구성 요소

### 1. GitHub Actions 워크플로우
- **경로**: `.github/workflows/keep-alive.yml`
- **실행 주기**: 매 2일 (UTC 09:00, KST 18:00)
- **기능**: Health Check API를 호출하여 Supabase를 활성 상태로 유지

### 2. Vercel Cron Jobs
- **경로**: `vercel.json`
- **실행 주기**: 매 2일 (GitHub Actions와 동일)
- **기능**: 예비 스케줄러로 동작

### 3. Health Check API
- **경로**: `src/app/api/health/route.ts`
- **기능**: 
  - 가벼운 DB 쿼리 실행 (count 조회)
  - 연결 상태 모니터링
  - 휴면 상태 감지 시 적절한 응답

### 4. 에러 핸들링 개선
- **Supabase Wrapper**: `src/lib/supabase-wrapper.ts`
- **재시도 로직**: 최대 3회 재시도, 점진적 지연
- **사용자 친화적 메시지**: "서버를 재가동 중입니다"

### 5. UI 컴포넌트
- **Connection Status**: `src/components/ui/connection-status.tsx`
- **실시간 상태 표시**: 연결, 로딩, 오류, 재가동 중

## 설정 방법

### 1. 환경 변수 설정
```bash
# GitHub Secrets에 추가
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Vercel 배포
1. `vercel.json`의 cron 설정 확인
2. Vercel 프로젝트에 배포
3. Vercel Dashboard에서 Cron Jobs 활성화 확인

### 3. GitHub Actions 활성화
1. Repository Settings > Actions > General
2. Workflow permissions 설정
3. Secrets에 환경 변수 추가

## 모니터링

### Health Check 엔드포인트
```bash
# Health Check
GET /api/health

# Keep-alive 트리거
POST /api/health
```

### 응답 예시
```json
{
  "status": "healthy",
  "message": "서비스 정상 작동 중입니다.",
  "timestamp": "2026-03-09T12:00:00.000Z",
  "responseTime": "45ms",
  "database": "connected",
  "count": 1234
}
```

## 트러블슈팅

### 1. Cron Job이 실행되지 않을 경우
- Vercel Dashboard에서 Cron 설정 확인
- `vercel.json`의 cron 문법 확인

### 2. GitHub Actions 실패 시
- Workflow 로그 확인
- Secrets 설정 확인
- 권한 설정 확인

### 3. Supabase 연결 오류 시
- 환경 변수 확인
- Supabase 프로젝트 상태 확인
- 네트워크 연결 확인

## 주의사항

1. **실행 주기**: 2일마다 실행되도록 설정되어 있으나, 필요에 따라 조정 가능
2. **비용**: 무료 티어 내에서 운영 가능
3. **모니터링**: 정기적으로 로그 확인 권장
4. **백업**: 여러 계층의 keep-alive 메커니즘으로 안정성 확보

## 향후 개선 사항

1. Slack/Email 알림 연동
2. 더 정교한 상태 모니터링
3. 자동 복구 로직 강화
4. 성능 메트릭 수집
