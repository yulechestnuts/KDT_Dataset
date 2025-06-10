# KDT 대시보드

KDT(한국디지털기술) 훈련기관 분석 대시보드입니다.

## 주요 기능

- 훈련기관별 매출액 분석
- 연도별/월별 통계
- 수료율 기반 매출액 보정
- 선도기업 과정 분석
- 상세 과정 정보 조회

## 기술 스택

- Next.js 14
- TypeScript
- Tailwind CSS
- Recharts
- shadcn/ui

## 로컬 개발 환경 설정

1. 저장소 클론
```bash
git clone https://github.com/your-username/kdt-dashboard-new.git
cd kdt-dashboard-new
```

2. 의존성 설치
```bash
npm install
```

3. 환경 변수 설정
`.env.local` 파일을 생성하고 다음 환경 변수를 설정:
```
GITHUB_TOKEN=your_github_token_here
GITHUB_REPO_OWNER=your_repo_owner
GITHUB_REPO_NAME=your_repo_name
GITHUB_FILE_PATH=path/to/your/data.csv
```

4. 개발 서버 실행
```bash
npm run dev
```

## Vercel 배포

1. Vercel CLI 설치
```bash
npm i -g vercel
```

2. Vercel 로그인
```bash
vercel login
```

3. 프로젝트 배포
```bash
vercel
```

4. 환경 변수 설정
Vercel 대시보드에서 다음 환경 변수를 설정:
- GITHUB_TOKEN
- GITHUB_REPO_OWNER
- GITHUB_REPO_NAME
- GITHUB_FILE_PATH

## 데이터 업데이트

데이터는 GitHub 저장소의 CSV 파일에서 자동으로 로드됩니다. 데이터를 업데이트하려면:

1. CSV 파일 업데이트
2. GitHub 저장소에 푸시
3. 대시보드가 자동으로 새로운 데이터를 로드

## 라이선스

MIT
