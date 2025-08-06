
# KDT-Dashboard-New 프로젝트 개선 방안

## 1. 현황 및 문제점

현재 프로젝트는 두 가지 주요 문제점을 안고 있습니다.

1.  **성능 저하**: `훈련기관별 분석` 등 데이터 집약적인 페이지에서 로딩 및 상호작용 속도가 매우 느립니다.
    - **원인**: 모든 데이터 처리(파싱, 그룹화, 통계 계산)가 클라이언트(브라우저)에서 실시간으로 수행되어 사용자 경험을 저해합니다.
2.  **데이터 불일치**: `훈련기관 분석`과 `선도기업형 분석` 등 여러 분석 기능 간에 데이터 해석 방식이 달라 통일된 기준을 적용하기 어렵습니다.
    - **원인**: 중앙화된 데이터 파이프라인 없이, 각 기능이 원본 데이터를 독립적으로 가공하면서 로직의 중복과 비일관성이 발생합니다.

## 2. 핵심 해결 전략: 데이터 처리 백엔드화

**클라이언트에서 수행하던 무거운 데이터 처리를 빌드 시점(Build-time)에 미리 수행하도록 변경합니다.**

이렇게 하면 클라이언트는 복잡한 계산 없이 미리 가공된 정적 JSON 데이터만 가져와 화면에 렌더링하므로, 성능이 획기적으로 개선되고 모든 컴포넌트가 동일한 데이터를 바라보게 되어 일관성을 확보할 수 있습니다.

![개선 아키텍처](https://i.imgur.com/gVjSkfA.png)

## 3. 단계별 실행 계획

### 1단계: 데이터 사전 처리(Pre-processing) 스크립트 작성

1.  **스크립트 생성**: 프로젝트 루트에 `scripts` 폴더를 만들고 `preprocess-data.mjs` 파일을 생성합니다.
2.  **로직 이전**: `data-utils.ts`와 각 페이지 컴포넌트에 흩어져 있던 데이터 처리 로직(기관 그룹화, 매출 조정, 통계 계산 등)을 이 스크립트로 모두 이전합니다.
3.  **데이터 출력**: 스크립트가 최종적으로 각 페이지에 필요한 데이터를 계산하여 `public/processed-data/` 폴더 내에 다음과 같은 JSON 파일로 저장하도록 구현합니다.
    - `institution-stats.json`: 기관별 분석 데이터
    - `yearly-stats.json`: 연도별 분석 데이터
    - `monthly-stats.json`: 월별 분석 데이터

**예시: `scripts/preprocess-data.mjs`**
```javascript
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
// 기존 data-utils.ts의 함수들을 이곳으로 옮겨옵니다.
import { groupInstitutions, applyRevenueAdjustment, calculateInstitutionStats } from '../src/utils/data-utils-node'; // Node.js 환경에 맞게 수정된 유틸리티

const main = async () => {
  // 1. 원본 데이터 로드 (예: 로컬 CSV 파일 또는 API)
  const rawData = await fetch('...').then(res => res.text());
  const parsedData = Papa.parse(rawData, { header: true }).data;

  // 2. 중앙화된 데이터 처리 파이프라인 실행
  const groupedData = groupInstitutions(parsedData);
  const adjustedData = applyRevenueAdjustment(groupedData, ...);
  
  // 3. 각 페이지에 필요한 최종 데이터 생성
  const institutionStats = calculateInstitutionStats(adjustedData);
  // ... 다른 통계 데이터 생성 ...

  // 4. 결과를 JSON 파일로 저장
  const outputDir = path.join(process.cwd(), 'public', 'processed-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outputDir, 'institution-stats.json'), JSON.stringify(institutionStats, null, 2));
  
  console.log('✅ Data preprocessing complete!');
};

main();
```

### 2단계: 빌드 프로세스에 스크립트 통합

`package.json`의 `scripts`를 수정하여 `next build`가 실행되기 전에 항상 데이터 사전 처리 스크립트가 실행되도록 설정합니다.

**`package.json`**
```json
{
  ...
  "scripts": {
    "dev": "next dev --turbopack",
    "preprocess": "node ./scripts/preprocess-data.mjs",
    "build": "npm run preprocess && next build",
    "start": "next start",
    "lint": "next lint"
  },
  ...
}
```

### 3단계: 프론트엔드 코드 리팩토링

1.  **데이터 로딩 방식 변경**: 기존 `useEffect`에서 수행하던 복잡한 데이터 fetch 및 처리 로직을 제거합니다.
2.  **정적 JSON 사용**: 대신, 사전 처리된 `public/processed-data/*.json` 파일을 직접 `fetch`하여 상태(state)에 저장합니다.

**예시: `InstitutionAnalysisPage.tsx`**
```typescript
import { useState, useEffect } from 'react';
import { InstitutionStats } from '@/lib/types'; // 공유 타입

function InstitutionAnalysisPage() {
  const [institutionData, setInstitutionData] = useState<InstitutionStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // 미리 가공된 JSON 데이터를 fetch
      const response = await fetch('/processed-data/institution-stats.json');
      const data = await response.json();
      setInstitutionData(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  // 이제 institutionData를 사용하여 차트와 테이블을 렌더링
  return (
    <Dashboard>
      <InstitutionChart data={institutionData} />
      <InstitutionTable data={institutionData} />
    </Dashboard>
  );
}
```

### 4단계: 코드 정리

- `data-utils.ts`에서 서버(Node.js)로 이전된 함수들을 제거하고, 타입 정의(interfaces/types)나 간단한 클라이언트용 유틸리티 함수만 남깁니다.
- `papaparse` 등 클라이언트에서 더 이상 사용하지 않는 라이브러리를 `dependencies`에서 `devDependencies`로 이동하거나 제거합니다.

## 4. 기대 효과

- **압도적인 성능 향상**: 데이터 로딩 속도가 수초에서 수십 밀리초 단위로 단축되어 사용자 경험이 극대화됩니다.
- **데이터 일관성 확보**: 모든 컴포넌트가 단일 소스(pre-processed JSON)를 바라보게 되어 데이터 불일치 문제가 원천적으로 해결됩니다.
- **유지보수성 향상**: 데이터 관련 로직이 한곳(`scripts/preprocess-data.mjs`)에 모여있어 관리 및 디버깅이 용이해집니다.
- **개발 효율성 증대**: 프론트엔드 개발자는 더 이상 복잡한 데이터 처리를 신경 쓸 필요 없이 UI 개발에만 집중할 수 있습니다.
