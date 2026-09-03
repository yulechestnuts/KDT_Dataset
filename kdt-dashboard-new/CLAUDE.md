# KDT Dashboard — 엔지니어링 컨텍스트

이 문서는 향후 Claude Code 세션이 컨텍스트로 즉시 사용할 수 있도록 정리한 운영·아키텍처 노트입니다. 코드를 읽으면 알 수 있는 사항(파일 구조, 함수 시그니처)은 의도적으로 제외하고, **읽어도 알기 어려운 운영 상의 함정·결정·진단 절차**만 담았습니다.

---

## 1. 스택 개요

- **프론트엔드**: Next.js (App Router) + React + Recharts + Tailwind + shadcn/ui
- **백엔드 API**: Next.js Route Handlers (`src/app/api/v1/*`)
- **DB**: Supabase Postgres (`kdt_data` 테이블)
- **배포**: Vercel (auto-deploy on push to `main`)
- **데이터 입력**: `/api/v1/upload-csv` 로 Excel/CSV → 변환 → Supabase upsert

핵심 메트릭 계산 진입점: `/api/v1/institution-stats` → `calculateInstitutionStats` (`src/lib/backend/aggregation.ts`).

---

## 2. ⚠️ 운영 상 중요 함정

### 2.1 in-memory 캐시 × Vercel 다중 인스턴스 = 스테일 데이터

`src/lib/backend/cache.ts`의 `cacheManager`는 단순 `new Map()`(프로세스 메모리). `/api/v1/institution-stats`는 1시간 TTL로 캐싱하고, `/api/v1/upload-csv`에서 `cacheManager.deletePattern('institution-stats:.*')`로 무효화합니다.

**문제**: Vercel은 서버리스 인스턴스가 자동 스케일링됩니다.
- CSV 업로드는 한 인스턴스에만 도달 → 그 인스턴스의 Map만 비워짐
- 다른 인스턴스는 옛 스냅샷을 최대 1시간 동안 그대로 반환
- 로컬은 단일 프로세스라 항상 최신 → "로컬은 정상, 배포는 이상" 패턴 발생

**증상이 가장 두드러지는 곳**: "전체 연도 / 전체 월 / 유형 전체" 조합. 캐시 키 하나에 가장 큰 집계 결과가 묶여 있어 옛 스냅샷이 그대로 노출되면 매출·취업률 양쪽 모두 옛 값으로 보입니다.

**즉시 우회**:
```
GET /api/v1/institution-stats?no_cache=1&flush_cache=1&revenue_mode=current
```
값이 정상화되면 캐시 문제 확정.

**근본 수정 후보**:
- **A. 캐시 제거 또는 TTL 축소(예: 60초)** — 데이터 규모가 page_size 한 번이면 끝나는 수준이라 손실 미미.
- **B. Vercel KV(Redis) 같은 인스턴스 공용 캐시로 교체** — 무효화가 모든 인스턴스에 반영됨.
- **C. 캐시 키에 데이터 버전(예: `kdt_data` max(updated_at) 또는 row count) 포함** — 무효화 신호 없이도 멱등.

> 권장: A 또는 C. 현재 데이터 크기에서는 B의 인프라 비용 정당화가 어려움.

### 2.2 연도 컬럼이 2026년까지 하드코딩

매출 분배·합산이 6개 위치에서 모두 다음 리터럴을 사용:

```ts
['2021년', '2022년', '2023년', '2024년', '2025년', '2026년']
```

위치:
- `src/lib/backend/supabase-service.ts:252-263` (DB select 매핑 — **가장 결정적**)
- `src/lib/backend/data-transformer.ts:173`
- `src/lib/backend/parsers.ts:269` (`calculateCumulativeRevenue`)
- `src/utils/data-loader.ts:43, 101`
- `src/utils/data-utils.ts:50, 222`

`revenue-engine.ts`의 `computeCourseRevenue`는 `getAvailableRevenueYears`로 키에서 동적 추출하지만, supabase-service에서 `2027년`/`조정_2027년`을 명시적으로 매핑하지 않으므로 객체에 그 키가 존재하지 않아 동적 추출이 무력화됨.

**현재 상태(2026-05 기준)**: 아직 2027년에 매출 분배되는 과정 없음 → 즉시 영향 없음. 단, 2025말~2026 시작 과정이 2027로 운영기간이 넘어가는 시점이 오면 **"현재 계산된 매출"이 조용히 누락됨**. 분기마다 한번씩 점검 필요.

**권장 패치 형태**:
```ts
const yearColumns = Array.from(
  { length: new Date().getFullYear() - 2020 + 1 },
  (_, i) => `${2021 + i}년`
);
```
그리고 supabase-service는 `select('*')` 결과의 row 객체에서 `^(?:조정_)?\d{4}년$` 매칭 키를 모두 보존하도록 수정. DB에 `2027년`/`조정_2027년` 컬럼이 실제 추가되는 것이 선결.

### 2.3 Supabase 페이지네이션 조기 종료

`getProcessedCourses` (`src/lib/backend/supabase-service.ts:135-`):
- `pageSize=1000` 기본, `range(from, to)`로 반복
- `data.length < pageSize` 면 break

Supabase 프로젝트 설정의 `default_row_limit`이 1000보다 작으면 첫 페이지에서 `data.length < pageSize`가 되어 **나머지 데이터를 통째로 누락**. Vercel Hobby의 10초 함수 timeout도 페이지네이션을 중간에 끊을 수 있음.

증상: 모든 메트릭이 동시에 작아짐. 캐시 우회로도 정상화 안 되면 이쪽 의심.

---

## 3. 핵심 메트릭 계산 경로

### 3.1 "현재 계산된 매출" (revenue_mode='current')

```
route.ts: GET /api/v1/institution-stats
  → getProcessedCourses()                   // Supabase에서 페이지네이션 fetch
  → applyRevenueAdjustmentIfMissing()       // 조정_*년 컬럼 누락 시 보정 계수 적용해 채움
  → calculateInstitutionStats(year, 'current', month)
     → calculateInstitutionDetailedRevenue
        → calculateRevenueShare              // 선도기업: 파트너 90% / 훈련기관 10%, 동일기관이면 100%
        → computeCourseRevenueByMode → computeCourseRevenue
           ├─ year 지정: 조정_{year}년 또는 {year}년 * factor
           └─ year 미지정: 모든 조정_{y}년 합산 (없으면 조정_실매출대비 fallback)
```

보정 계수 (`calculateRevenueAdjustmentFactor`, `revenue-engine.ts:250`):
- 수료율 ≥ 100%: 1.25
- 75–100%: 선형 보간 1.0 → 1.25
- 50–75%: 선형 보간 0.75 → 1.0
- < 50%: 0.75

### 3.2 "취업대상자 대비 취업률"

`getSafeEmploymentData` (`src/lib/backend/performance-engine.ts:43`, `src/lib/data-utils.ts:336`):
- 6개월 데이터 우선 → 없으면 3개월 fallback → 둘 다 없으면 `{ employed: null, targetPop: null, ... }`
- `targetPop = round(employed / (rate / 100))` (역산)
- 6개월/3개월 둘 다 미집계인 과정은 분모/분자에서 **자동 제외**

집계 (`aggregation.ts:425-438`):
```ts
totalTargetPop  = Σ targetPop  (null/0 제외)
totalEmployed   = Σ employed
취업률 = totalEmployed / totalTargetPop × 100
```

**"전체 연도" 모드에서의 함의**: 2026년 종료 직후 과정은 6개월 취업률이 아직 산출되지 않아 분모에서 빠짐. 즉 "전체 연도 취업률"은 `평가가 끝난 과정만의 가중평균`임. 이를 다른 정의로 바꾸려면 `aggregation.ts:425-438` + `performance-engine.ts:43-91`을 동시에 수정해야 함.

### 3.3 매출 모드 3종

| 모드 | UI 라벨 | 정의 |
|-----|--------|------|
| `current` | 현재 계산된 매출 | 수료율 보정 + 연도별 분배 합 |
| `max` | 최대 매출 | 수주 계약상 최대치, 연도 분배 |
| `contract` (FE→`max`) | 수주 매출 | 과정시작일이 선택 연·월에 속한 과정의 매출 최대 전액. **분배되지 않음**. |

`revenue_mode=contract`는 프론트 전용 별칭 — 백엔드는 `max`를 받지만 FE 표시는 `total_contract_revenue` 필드 사용.

---

### 3.4 수요·경쟁력 분석 (`/trend-analysis`, `/api/v1/demand-analysis`)

`src/lib/backend/demand-engine.ts` + `src/lib/course-taxonomy.ts`. 다른 페이지와 **전제가 다르므로** 산식을 옮겨 쓰기 전에 아래를 반드시 확인할 것.

**① 연도 축이 과정시작일이다.** 다른 라우트는 매출 귀속 때문에 `과정종료일`로 자르지만, 수요는 신청 시점의 현상이라 여기는 `과정시작일`(개강 코호트). 두 축을 섞으면 같은 과정이 다른 해에 잡혀 추이가 어긋난다.

**② 정원은 목표가 아니라 회차별 최대 수용 인원(행정적 상한)이다.** 그래서 충원율(신청/정원)은 **함정값**이고 수요 지표로 쓰면 안 된다. 실측:

| 연도 | 회차수 | 회차당 정원(상한) | 회차당 실제 신청 | 충원율 |
|---|---|---|---|---|
| 2021 | 430 | 28.9 | 23.9 | 82.5% |
| 2023 | 1340 | 34.0 | 23.8 | 70.2% |
| 2025 | 2081 | 38.9 | 22.9 | 59.0% |
| 2026 | 814 | 38.5 | 23.4 | 60.7% |

충원율 22%p 하락은 수요 감소가 아니라 **상한 인상**의 결과다. 회차당 실제 신청인원은 5년째 23명 안팎으로 고정. 수요 강도는 `enrollmentPerRound`로 본다.

**③ 모든 분야 비교는 "그 해 시장 평균 대비 지수"로 한다.** 시장 전체가 크게 움직여서(회차 5배, 상한 인상, 취업률 67.8%→52.2%) 절대값 기울기를 재면 22개 분야가 전부 같은 방향으로 나온다. `relativeEnrollmentPerRound` / `relativeEmploymentRate` (100 = 시장 평균)의 기울기를 쓴다.

**④ NCS명은 분류 축으로 못 쓴다.** `응용SW엔지니어링` 하나가 전체 신청인원의 46%. 그래서 `course-taxonomy.ts`가 **수동 오버라이드 → 과정명 키워드 → NCS 폴백 → 기타** 4단계로 22개 기술분야에 배정한다(현재 커버리지 100%, `기타` 0건). 규칙을 바꿨으면 `classifyCourseName`의 `source`별 비중이 API 응답 `meta.taxonomySources`에 나오니 그걸로 감사할 것. `AI` 키워드는 2023년 이후 브랜딩으로 남발되므로 **AI 코어(priority 80) / AI 브랜딩(priority 15)** 두 단계로 쪼개져 있다 — 합치면 "AI를 활용한 프론트엔드 과정"이 AI로 잡혀 분류가 무너진다.

**⑤ 취업률은 최신 코호트일수록 구조적으로 비어 있다.** 2026년 개강 과정의 6개월 취업률 산출 비율은 3%. 취업률 수준으로 줄 세우면 신생 분야가 자동으로 진다. 그래서 경쟁력 판정은 `employmentCoverage >= 0.7`인 **성숙 코호트**만 쓰고, 화면은 미성숙 셀을 '집계중'으로 표시한다.

---

## 4. 데이터 흐름 / 컬럼 명명 함정

- DB 컬럼은 공백을 언더스코어로 치환해서 저장됨: `수강신청_인원`, `매출_최대`, `취업인원_6개월`, ...
- `ProcessedCourseData`의 키는 다시 공백 포함: `'수강신청 인원'`, `'매출 최대'`, `'취업인원 (6개월)'`, ...
- 매핑은 `supabase-service.ts:218-285`의 `pickRowValue`로 두 표기 모두 시도. **신규 컬럼 추가 시 양쪽 표기를 함께 등록**해야 누락 없음.
- `getSafeEmploymentData`는 키 검색을 `k.includes('취업인원') && k.includes('6개월')`처럼 substring으로 하므로 점 표기법(`course.취업인원`)이 아니라 대괄호 표기(`course['취업인원 (6개월)']`)가 안전.

---

## 5. 진단 체크리스트

배포만 이상하다고 보고될 때:

1. `?no_cache=1&flush_cache=1` 응답이 정상이면 → §2.1 캐시 문제
2. Vercel Deployments에서 production이 최신 커밋인지 (빌드 실패/지연 가능)
3. Vercel Project Settings → Environment Variables에서 `SUPABASE_FETCH_LIMIT` / `SUPABASE_PAGE_SIZE` / `SUPABASE_TABLE_NAME` 가 로컬과 다르게 잡혀있지 않은지 (`.env.local`엔 셋 다 없음 — 비어있어야 정상)
4. Vercel Functions 로그에 timeout/error 가 있는지 (Hobby 10s 컷)
5. `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`과 Vercel의 그것이 동일한 프로젝트인지

데이터값이 의심될 때(개발/스테이징 공통):

- `?trace=1&institution_name=<기관>` 으로 share/매핑 raw 값 확인 (`route.ts:173-265`)
- Supabase Studio에서 해당 기관 row의 `조정_{year}년` 컬럼이 비어있는지 직접 확인
- `DEBUG_SUPABASE=1` 환경변수로 페이지네이션 로그 출력

---

## 6. 일반 작업 가이드

- 메트릭 산식을 바꿀 때는 **`aggregation.ts`만 고치면 안 됨** — 같은 로직을 `src/lib/data-utils.ts`(레거시 클라이언트 경로)와 `src/utils/data-utils.ts`도 별도로 보유. 일치 안 시키면 페이지마다 값이 달라지는 버그가 재발함.
- "수료율"·"취업률" 텍스트 포맷은 항상 `formatRateDetail`(performance-engine) 또는 `renderRateWithCount`(InstitutionAnalysisClient)로 통일. 직접 `${rate}%` 쓰지 말 것 — `null/NaN` 가드가 빠지기 쉬움.
- 캐시를 추가/수정할 때는 §2.1을 먼저 읽고 **무효화 경로가 다중 인스턴스에서도 성립하는지** 검증.
- 새 연도가 시작되면 §2.2 패치를 잊지 말 것. 동적 연도 리스트로 통합되기 전까지는 매년 점검 필요.

---

## 7. 알려진 차후 과제

- [ ] 연도 컬럼 동적화 (§2.2)
- [ ] 캐시를 KV 또는 버전 키 방식으로 교체 (§2.1)
- [ ] `data-utils.ts` 두 사본(`src/lib`, `src/utils`)과 백엔드 `aggregation.ts`의 메트릭 산식 단일화
- [ ] Vercel 함수 timeout 대응(쿼리 최적화 또는 페이지네이션 병렬화)
