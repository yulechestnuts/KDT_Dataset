// 기관 그룹화 로직

// 기관 그룹화 마스터 데이터 (JSON 파일에서 로드)
const institutionGroupingMasterData = {
  institution_grouping_master: {
    이젠아카데미: {
      keywords: ['이젠', '이젠컴퓨터학원', '이젠아이티아카데미', '이젠컴퓨터아카데미', '이젠아카데미'],
      examples: ['이젠컴퓨터학원 강남', '이젠아이티아카데미 부산', '이젠컴퓨터아카데미 서울'],
    },
    그린컴퓨터아카데미: {
      keywords: ['그린', '그린컴퓨터아카데미', '그린아카데미컴퓨터학원', '그린컴퓨터학원'],
      examples: ['그린컴퓨터아카데미 강남', '그린아카데미컴퓨터학원', '그린컴퓨터학원'],
    },
    더조은아카데미: {
      keywords: ['더조은', '더조은컴퓨터아카데미', '더조은아이티아카데미', '더조은컴퓨터학원'],
      examples: ['더조은컴퓨터아카데미', '더조은아이티아카데미', '더조은컴퓨터학원'],
    },
    코리아IT아카데미: {
      keywords: ['코리아IT', '코리아아이티', 'KIT', '코리아IT아카데미', '코리아IT학원'],
      examples: ['코리아IT아카데미', '코리아아이티아카데미', 'KIT아카데미'],
    },
    비트교육센터: {
      keywords: ['비트', '비트캠프', '비트교육센터', '비트컴퓨터학원'],
      examples: ['비트교육센터', '비트캠프', '비트컴퓨터학원'],
    },
    하이미디어: {
      keywords: ['하이미디어', '하이미디어아카데미', '하이미디어컴퓨터학원'],
      examples: ['하이미디어아카데미', '하이미디어컴퓨터학원'],
    },
    아이티윌: {
      keywords: ['아이티윌', 'IT WILL', '아이티윌부산교육센터', '아이티윌아카데미'],
      examples: ['아이티윌', 'IT WILL', '아이티윌부산교육센터'],
    },
    메가스터디: {
      keywords: ['메가스터디'],
      examples: ['메가스터디', '메가스터디아카데미'],
    },
    에이콘아카데미: {
      keywords: ['에이콘', '에이콘아카데미', '에이콘아카데미(강남)'],
      examples: ['에이콘아카데미', '에이콘아카데미(강남)', '에이콘'],
    },
    한국ICT인재개발원: {
      keywords: ['ICT', '한국ICT인재개발원'],
      examples: ['한국ICT인재개발원', 'ICT인재개발원'],
    },
    'MBC아카데미 컴퓨터 교육센터': {
      keywords: ['MBC아카데미', '(MBC)', 'MBC아카데미 컴퓨터 교육센터'],
      examples: ['MBC아카데미 컴퓨터 교육센터', '(MBC)아카데미'],
    },
    쌍용아카데미: {
      keywords: ['쌍용', '쌍용아카데미'],
      examples: ['쌍용아카데미', '쌍용컴퓨터학원'],
    },
    이스트소프트: {
      keywords: ['이스트소프트', '(주)이스트소프트'],
      examples: ['이스트소프트', '(주)이스트소프트'],
    },
    KH정보교육원: {
      keywords: ['KH', 'KH정보교육원'],
      examples: ['KH정보교육원', 'KH아카데미'],
    },
    '(주)솔데스크': {
      keywords: ['솔데스크강남학원', '(주)솔데스크', '솔데스크'],
      examples: ['(주)솔데스크', '솔데스크강남학원', '솔데스크'],
    },
  },
  grouping_rules: {
    matching_method: 'keyword_inclusion',
    case_sensitive: false,
    special_characters_removed: true,
    whitespace_normalized: true,
    fallback: 'original_name',
  },
};

const masterData = institutionGroupingMasterData;

/**
 * 기관 그룹화 함수
 */
export function groupInstitutionsAdvanced(institutionName: string): string {
  if (!institutionName) {
    return '알 수 없는 기관';
  }

  // 특수문자 제거, 공백 정리, 대문자 변환
  let cleanName = institutionName.replace(/[^가-힣A-Za-z0-9\s()]/g, '');
  cleanName = cleanName.replace(/\s+/g, ' ').trim().toUpperCase();

  // 매핑 테이블에서 키워드 매칭
  const groups = masterData.institution_grouping_master;
  for (const [groupName, groupData] of Object.entries(groups)) {
    for (const keyword of groupData.keywords) {
      if (cleanName.includes(keyword.toUpperCase())) {
        return groupName;
      }
    }
  }

  // 매칭되지 않으면 원본 반환
  return institutionName;
}

/**
 * 선도기업 과정 판단
 */
export function isLeadingCompanyCourse(partnerInstitution: string | undefined): boolean {
  if (!partnerInstitution) {
    return false;
  }
  const partner = String(partnerInstitution).trim();
  return partner !== '' && partner !== '0';
}

/**
 * 훈련 유형 분류
 */
export function classifyTrainingType(
  courseName: string,
  institutionName: string,
  partnerInstitution?: string
): string {
  const types: string[] = [];

  // 파트너기관 존재 여부
  if (isLeadingCompanyCourse(partnerInstitution)) {
    types.push('선도기업형 훈련');
  }

  // 과정명 검사
  if (courseName.includes('재직자_')) {
    types.push('재직자 훈련');
  }
  if (courseName.includes('심화_')) {
    types.push('심화 훈련');
  }
  if (courseName.includes('융합')) {
    types.push('융합 훈련');
  }

  // 훈련기관 검사
  if (institutionName.includes('학교')) {
    types.push('대학주도형 훈련');
  }

  if (types.length > 0) {
    return types.join('&');
  }

  return '신기술 훈련';
}
