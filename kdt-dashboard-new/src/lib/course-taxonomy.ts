// 과정 기술분야 분류기 (프론트/백엔드 공용)
//
// 왜 필요한가:
//   NCS명은 '응용SW엔지니어링' 하나가 전체 수강신청 인원의 46%를 차지한다.
//   그 안에 프론트엔드·백엔드·게임·풀스택·클라우드가 전부 섞여 있어서
//   NCS 축만으로는 "수요가 어디로 쏠렸는지"가 전혀 보이지 않는다.
//
// 해결 방식 — 4단계 폴백:
//   1) MANUAL_OVERRIDES : 과정명만으로는 분야를 알 수 없는 기업 브랜드 과정
//                         (SSAFY, 크래프톤 정글 등). 부분일치.
//   2) KEYWORD_RULES    : 과정명 키워드. priority 가 높은 규칙이 primary 를 가져간다.
//   3) NCS_CATEGORY_MAP : 과정명이 아무것도 안 걸릴 때 NCS명으로 추정.
//   4) '기타'
//
// primary 는 점유율/추이 계산용(과정 1개 = 카테고리 1개), tags 는 필터용(다중 라벨).
// 분류 근거는 source 로 노출되므로 커버리지 감사(audit)가 가능하다.

export const COURSE_CATEGORIES = [
  'AI/머신러닝',
  '데이터분석',
  '백엔드',
  '프론트엔드',
  '풀스택/웹',
  '모바일',
  '종합SW아카데미',
  '블록체인/핀테크',
  '클라우드/DevOps',
  '정보보안',
  '게임',
  'XR/실감콘텐츠',
  '반도체',
  '임베디드/IoT',
  '로봇/자율주행',
  '스마트제조/디지털트윈',
  '이차전지/에너지',
  '바이오/헬스',
  '환경/탄소중립',
  'UX/UI디자인',
  '서비스기획/PM',
  '마케팅/그로스',
  '기타',
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

/** 대분류 — 카테고리가 22개라 UI에서 접어 보여주기 위한 상위 묶음 */
export const CATEGORY_GROUPS: Record<string, CourseCategory[]> = {
  'AI·데이터': ['AI/머신러닝', '데이터분석'],
  'SW개발': ['백엔드', '프론트엔드', '풀스택/웹', '모바일', '종합SW아카데미', '블록체인/핀테크'],
  '인프라·보안': ['클라우드/DevOps', '정보보안'],
  '콘텐츠·게임': ['게임', 'XR/실감콘텐츠'],
  '하드웨어·제조': ['반도체', '임베디드/IoT', '로봇/자율주행', '스마트제조/디지털트윈', '이차전지/에너지', '바이오/헬스', '환경/탄소중립'],
  '기획·디자인': ['UX/UI디자인', '서비스기획/PM', '마케팅/그로스'],
  '미분류': ['기타'],
};

export const CATEGORY_TO_GROUP: Record<CourseCategory, string> = (() => {
  const m = {} as Record<CourseCategory, string>;
  for (const [g, cats] of Object.entries(CATEGORY_GROUPS)) for (const c of cats) m[c] = g;
  return m;
})();

// ─────────────────────────────────────────────────────────────
// 1) 수동 오버라이드 — 과정명에 분야 단서가 없는 기업 브랜드 과정
//    부분일치(대소문자 무시). 위에서부터 먼저 걸리는 것이 이긴다.
// ─────────────────────────────────────────────────────────────
export const MANUAL_OVERRIDES: Array<[string, CourseCategory]> = [
  // 제너럴리스트 기업연계 아카데미 — 특정 스택으로 못 자름
  ['청년 SW 아카데미', '종합SW아카데미'], // SSAFY
  ['청년 SW·AI 아카데미', '종합SW아카데미'], // SSAFY 개편 명칭
  ["IT's Your Life", '종합SW아카데미'], // KB
  ['BEYOND SW 캠프', '종합SW아카데미'], // 한화시스템
  ['크래프톤] 정글', '종합SW아카데미'],
  ['멋쟁이사자처럼 스타트업 스쿨', '종합SW아카데미'],
  ['금융 SW 아카데미', '종합SW아카데미'], // 신한DS
  ['LG CNS AM Inspire Camp', '종합SW아카데미'],
  ['Why Not SW캠프', '종합SW아카데미'], // LG U+
  ['GSITM] 부트캠프', '종합SW아카데미'],
  ['CODE 아카데미', '종합SW아카데미'], // SAP
  ['Digital hana', '종합SW아카데미'], // 하나은행
  ['삼정 Future Academy', '종합SW아카데미'],
  ['INNER CIRCLE', '종합SW아카데미'],
  // 브랜드명이 스택을 가리는 경우
  ['AIVLE School', 'AI/머신러닝'], // KT
  ['DX School', '데이터분석'], // LG전자
  ['Hy-Po', '반도체'], // SK하이닉스
  ['CRM101', '클라우드/DevOps'], // 세일즈포스
  ["Vision's Edge Device", '임베디드/IoT'],
  ['Space Challenger Academy', '스마트제조/디지털트윈'], // 한화에어로스페이스
  ['정림] 아카데미', '스마트제조/디지털트윈'],
  ['Ocean DX Academy', 'AI/머신러닝'], // 한화오션
  ['현대건설]', '스마트제조/디지털트윈'], // Smart City / Smart Plant / Smart 안전
];

// ─────────────────────────────────────────────────────────────
// 2) 과정명 키워드 규칙
//    priority 가 큰 쪽이 primary. 같으면 배열 순서가 앞선 쪽.
//
//    핵심 함정: 2023년 이후 'AI'는 거의 모든 과정명에 브랜딩으로 붙는다.
//    그래서 AI 를 두 단계로 쪼갠다 —
//      · AI 코어(딥러닝/LLM/모델링/AI 엔지니어) : priority 80, 직군 규칙을 이긴다
//      · AI 브랜딩(단순히 'AI'가 박힌 것)        : priority 15, 아무것도 없을 때만
//    이렇게 안 하면 "AI를 활용한 프론트엔드 과정"이 AI로 잡혀 분류가 무너진다.
// ─────────────────────────────────────────────────────────────
interface KeywordRule {
  category: CourseCategory;
  pattern: RegExp;
  priority: number;
}

export const KEYWORD_RULES: KeywordRule[] = [
  // 90 — 도메인이 명확한 분야 (직군 키워드보다 우선)
  { category: '반도체', pattern: /반도체|semicon|웨이퍼|파운드리|공정설계/i, priority: 90 },
  { category: '이차전지/에너지', pattern: /이차전지|2차전지|배터리|리튬|에너지\s*저장|신재생/i, priority: 90 },
  { category: '바이오/헬스', pattern: /바이오|\bbio\b|bio-|헬스케어|의료기기|제약|유전체|의료\s*AI|디지털\s*헬스/i, priority: 90 },
  { category: '로봇/자율주행', pattern: /로봇|로보틱스|robot|자율주행|모빌리티|드론|무인기|\bvehicle\b|차량\s*(SW|소프트|제어|전장)/i, priority: 90 },
  { category: '환경/탄소중립', pattern: /탄소중립|미세먼지|에코업|eco-?up|녹색융합|대기환경|수질|생태복원|환경\s*(관리|영향|데이터|공학|기술)/i, priority: 90 },
  { category: '스마트제조/디지털트윈', pattern: /스마트\s*팩토리|스마트공장|디지털\s*트윈|카티아|CATIA|스마트\s*제조|스마트팜|\bPLC\b|생산자동화/i, priority: 90 },
  { category: '블록체인/핀테크', pattern: /블록체인|blockchain|핀테크|fintech|웹3|web3|\bNFT\b|가상자산/i, priority: 90 },
  { category: '게임', pattern: /게임|game|unity|유니티|unreal|언리얼/i, priority: 90 },
  { category: 'XR/실감콘텐츠', pattern: /메타버스|가상현실|증강현실|혼합현실|실감형|실감\s*콘텐츠|\bVR\b|\bAR\b|\bXR\b|버추얼|이머시브|리얼타임\s*엔진|3D\s*(콘텐츠|모델링|그래픽)/i, priority: 88 },
  { category: '정보보안', pattern: /보안|정보\s*보호|해킹|모의침투|포렌식|security|화이트해커/i, priority: 90 },
  { category: '임베디드/IoT', pattern: /임베디드|embedded|펌웨어|firmware|\bIoT\b|사물인터넷|\bMCU\b|아두이노|라즈베리|엣지\s*디바이스/i, priority: 90 },

  // 80 — AI 코어
  {
    category: 'AI/머신러닝',
    pattern:
      /머신\s*러닝|machine\s*learning|딥\s*러닝|deep\s*learning|\bLLM\b|생성형\s*AI|생성\s*AI|GenAI|ChatGPT|자연어\s*처리|\bNLP\b|컴퓨터\s*비전|인공지능\s*(모델|서비스|플랫폼|엔지니어|개발자|기술)|AI\s*(엔지니어|개발자|모델|서비스|플랫폼)|MLOps|프롬프트|추천\s*(시스템|알고리즘)|언어지능/i,
    priority: 80,
  },

  // 70 — 데이터
  { category: '데이터분석', pattern: /빅데이터|\bbig ?data\b|데이터\s*(분석|엔지니어|사이언|시각화|처리|플랫폼|베이스)|데이터분석|data\s*(analy|scien|engineer)|\bBI\b|\bSQL\b|통계\s*분석|\bDBA\b|\bCDS\b/i, priority: 70 },

  // 60 — 직군
  { category: '백엔드', pattern: /백엔드|back-?end|서버\s*개발|스프링|spring|장고|django|node\.?js|\bJava\b|자바(?!스크립트)|코틀린|kotlin|API\s*개발|\bMSA\b/i, priority: 60 },
  { category: '프론트엔드', pattern: /프론트\s*엔드|front-?end|리액트|react|\bvue\b|웹\s*퍼블리|자바스크립트|javascript|타입스크립트|typescript/i, priority: 60 },
  { category: '모바일', pattern: /안드로이드|android|\biOS\b|모바일\s*(앱|개발)|플러터|flutter|리액트\s*네이티브|앱\s*개발|앱\s*제작/i, priority: 60 },
  { category: '클라우드/DevOps', pattern: /클라우드|cloud|\bAWS\b|azure|\bGCP\b|데브옵스|devops|쿠버네티스|kubernetes|도커|docker|인프라|infra|\bSRE\b|리눅스|linux|네트워크\s*엔지니어|시스템\s*엔지니어/i, priority: 60 },

  // 50 — 범용 웹/풀스택 (직군 키워드가 하나도 없을 때)
  { category: '풀스택/웹', pattern: /풀[-\s]?스택|full[-\s]?stack|웹\s*(개발|서비스|프로그래|애플리케이션)|웹서비스|웹앱|소프트웨어\s*엔지니어|SW\s*개발자|응용\s*SW|애플리케이션\s*개발/i, priority: 50 },

  // 40 — 기획·디자인·마케팅
  { category: 'UX/UI디자인', pattern: /\bUX\b|\bUI\b|UX\/UI|UI\/UX|사용자\s*경험|디자인|퍼블리셔|프로덕트\s*디자|그래픽/i, priority: 40 },
  { category: '서비스기획/PM', pattern: /서비스\s*기획|제품\s*기획|프로덕트\s*(매니저|오너)|\bPM\b|\bPO\b|비즈니스\s*(기획|개발)|사업\s*개발|전략\s*기획|\bBD\b/i, priority: 40 },
  { category: '마케팅/그로스', pattern: /마케팅|marketing|그로스|growth|퍼포먼스\s*광고|콘텐츠\s*마케팅/i, priority: 40 },

  // 15 — AI 브랜딩 (최후)
  { category: 'AI/머신러닝', pattern: /\bAI\b|인공지능|A\.\s?I\.|에이아이/i, priority: 15 },
];

// ─────────────────────────────────────────────────────────────
// 3) NCS명 → 카테고리 (과정명이 아무것도 못 잡았을 때만)
//    '응용SW엔지니어링'은 범용 웹/SW 개발 덩어리라 '풀스택/웹'으로 떨어뜨린다.
//    (source='ncs' 로 남으므로 나중에 감사 가능)
// ─────────────────────────────────────────────────────────────
export const NCS_CATEGORY_MAP: Record<string, CourseCategory> = {
  응용SW엔지니어링: '풀스택/웹',
  SW아키텍처: '풀스택/웹',
  DB엔지니어링: '데이터분석',
  데이터아키텍처: '데이터분석',
  빅데이터분석: '데이터분석',
  빅데이터플랫폼구축: '데이터분석',
  '빅데이터운영·관리': '데이터분석',
  빅데이터기획: '데이터분석',
  유전체정보분석: '바이오/헬스',
  인공지능플랫폼구축: 'AI/머신러닝',
  인공지능모델링: 'AI/머신러닝',
  인공지능서비스기획: 'AI/머신러닝',
  인공지능서비스구현: 'AI/머신러닝',
  인공지능서비스운영관리: 'AI/머신러닝',
  생성형AI엔지니어링: 'AI/머신러닝',
  'UI/UX엔지니어링': 'UX/UI디자인',
  디지털디자인: 'UX/UI디자인',
  영상그래픽: 'XR/실감콘텐츠',
  만화콘텐츠제작: 'XR/실감콘텐츠',
  가상현실콘텐츠제작: 'XR/실감콘텐츠',
  '증강현실(AR)콘텐츠제작': 'XR/실감콘텐츠',
  VR콘텐츠디자인: 'XR/실감콘텐츠',
  스마트문화앱콘텐츠제작: 'XR/실감콘텐츠',
  게임콘텐츠제작: '게임',
  SW제품기획: '서비스기획/PM',
  정보기술전략: '서비스기획/PM',
  마케팅전략기획: '마케팅/그로스',
  반도체개발: '반도체',
  반도체장비: '반도체',
  반도체제조: '반도체',
  임베디드SW엔지니어링: '임베디드/IoT',
  IoT시스템연동: '임베디드/IoT',
  시스템SW엔지니어링: '클라우드/DevOps',
  IT시스템관리: '클라우드/DevOps',
  인프라스트럭쳐아키텍처구축: '클라우드/DevOps',
  클라우드인프라스트럭쳐엔지니어링: '클라우드/DevOps',
  클라우드솔루션아키텍처: '클라우드/DevOps',
  클라우드플랫폼구축: '클라우드/DevOps',
  NW엔지니어링: '클라우드/DevOps',
  '정보보호관리·운영': '정보보안',
  '정보보호진단·분석': '정보보안',
  보안엔지니어링: '정보보안',
  보안사고분석대응: '정보보안',
  '클라우드 보안 관리·운영': '정보보안',
  로봇소프트웨어개발: '로봇/자율주행',
  로봇지능개발: '로봇/자율주행',
  로봇하드웨어설계: '로봇/자율주행',
  자율주행소프트웨어개발: '로봇/자율주행',
  소형무인기비행체개발: '로봇/자율주행',
  핀테크엔지니어링: '블록체인/핀테크',
  핀테크기술기획: '블록체인/핀테크',
  '블록체인구축·운영': '블록체인/핀테크',
  리튬이온전지셀개발: '이차전지/에너지',
  에너지절약서비스: '이차전지/에너지',
  전기기기설계: '이차전지/에너지',
  바이오의약품개발: '바이오/헬스',
  바이오의약품생산: '바이오/헬스',
  바이오의약품품질관리: '바이오/헬스',
  첨단바이오의약품개발: '바이오/헬스',
  바이오화학제품제조: '바이오/헬스',
  바이오플라스틱제품제조: '바이오/헬스',
  '의료기기인·허가': '바이오/헬스',
  의료기기연구개발: '바이오/헬스',
  스마트설비설계: '스마트제조/디지털트윈',
  디지털트윈기획: '스마트제조/디지털트윈',
  디지털트윈설계: '스마트제조/디지털트윈',
  '스마트공장(smart factory)시스템설치': '스마트제조/디지털트윈',
  '스마트공장(smart factory)시스템관리': '스마트제조/디지털트윈',
  기계요소설계: '스마트제조/디지털트윈',
  기계시스템설계: '스마트제조/디지털트윈',
  기계소프트웨어개발: '스마트제조/디지털트윈',
  자동제어기기제작: '스마트제조/디지털트윈',
  자동제어시스템설계: '스마트제조/디지털트윈',
  자동제어시스템운영: '스마트제조/디지털트윈',
  '3D프린터용 제품제작': '스마트제조/디지털트윈',
  스마트팜기술개발: '스마트제조/디지털트윈',
  플랜트사업관리: '스마트제조/디지털트윈',
  대기환경관리: '환경/탄소중립',
  수질공정관리: '환경/탄소중립',
  환경관리: '환경/탄소중립',
  환경영향평가: '환경/탄소중립',
  생태복원: '환경/탄소중립',
  건설공사환경관리: '환경/탄소중립',
};

export type TaxonomySource = 'override' | 'keyword' | 'ncs' | 'fallback';

export interface CourseTaxonomy {
  /** 점유율·추이 계산용 단일 분류 */
  primary: CourseCategory;
  /** 다중 라벨 (필터용). primary 를 항상 포함 */
  tags: CourseCategory[];
  /** 분류 근거 — 커버리지 감사용 */
  source: TaxonomySource;
  /**
   * primary 를 결정한 키워드 규칙의 priority (source==='keyword' 일 때만).
   * 15 이면 'AI'라는 단어만 보고 붙인 약한 판정이라는 뜻 — 감사할 때 이걸 본다.
   */
  rulePriority?: number;
  /** 과정명에 AI/인공지능이 박혀 있는가 (실제 AI 과정인지와 무관한 '브랜딩' 지표) */
  aiBranded: boolean;
}

const AI_BRANDING = /\bAI\b|인공지능|A\.\s?I\.|머신\s*러닝|딥\s*러닝|생성형/i;

/** 과정명 정규화 — 접두 태그(융합_, 재직자_ 등)와 따옴표·공백 편차 제거 */
function normalizeName(name: unknown): string {
  return String(name ?? '')
    .replace(/^(융합|기타|재직자|심화)_/g, '')
    .replace(/[“”"']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 과정명 + NCS명으로 기술분야를 판정한다.
 * 과정 객체가 아니라 원시 문자열을 받으므로 프론트/백엔드 어디서든 쓸 수 있다.
 */
export function classifyCourseName(courseName: unknown, ncsName?: unknown): CourseTaxonomy {
  const name = normalizeName(courseName);
  const ncs = String(ncsName ?? '').trim();
  const aiBranded = AI_BRANDING.test(name);

  // 1) 수동 오버라이드
  const lower = name.toLowerCase();
  for (const [needle, category] of MANUAL_OVERRIDES) {
    if (lower.includes(normalizeName(needle).toLowerCase())) {
      return { primary: category, tags: [category], source: 'override', aiBranded };
    }
  }

  // 2) 과정명 키워드
  let best: KeywordRule | null = null;
  const tags: CourseCategory[] = [];
  for (const rule of KEYWORD_RULES) {
    if (!rule.pattern.test(name)) continue;
    if (!tags.includes(rule.category)) tags.push(rule.category);
    if (!best || rule.priority > best.priority) best = rule;
  }
  if (best) {
    let winner = best.category;
    // 백엔드·프론트엔드 키워드가 동시에 잡히면 그건 풀스택 과정이다.
    // (예: "채용연계 풀스택 개발자 부트캠프(스프링&리액트)" — 스프링/리액트 둘 다 걸린다)
    // 도메인 규칙(priority 80+)이 이긴 경우에는 건드리지 않는다.
    if (best.priority <= 60 && tags.includes('백엔드') && tags.includes('프론트엔드')) {
      winner = '풀스택/웹';
      if (!tags.includes('풀스택/웹')) tags.push('풀스택/웹');
    }
    return {
      primary: winner,
      tags: [winner, ...tags.filter((t) => t !== winner)],
      source: 'keyword',
      rulePriority: best.priority,
      aiBranded,
    };
  }

  // 3) NCS 폴백
  const byNcs = NCS_CATEGORY_MAP[ncs];
  if (byNcs) return { primary: byNcs, tags: [byNcs], source: 'ncs', aiBranded };

  // 4) 기타
  return { primary: '기타', tags: ['기타'], source: 'fallback', aiBranded };
}

/** 과정 객체(ProcessedCourseData / RawCourseData 양쪽 표기)를 받아 분류 */
export function classifyCourse(course: any): CourseTaxonomy {
  return classifyCourseName(course?.과정명, course?.NCS명 ?? course?.NCS_명);
}

/** primary 카테고리만 필요할 때의 축약 */
export function getCourseCategory(course: any): CourseCategory {
  return classifyCourse(course).primary;
}
