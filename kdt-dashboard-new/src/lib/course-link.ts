// 훈련과정 페이지 링크 정규화
//
// 원본 데이터에 두 형식이 섞여 있다 (실측: 구 1,320건 / 신 5,912건).
//   구: https://hrd.work24.go.kr/hrdp/co/pcoco/PCOCO0100P.do?tracseId=...
//   신: https://www.work24.go.kr/hr/a/a/3200/selectTrainInstitution.do?tracseId=...
//
// 구 도메인은 폐지되어 "존재하지 않는 페이지입니다" 만 뜬다.
// 쿼리 파라미터 집합은 두 형식이 완전히 같으므로
// (tracseId / tracseTme / trainstCstmrId / crseTracseSe)
// 호스트와 경로만 바꾸면 그대로 열린다 — 실제 요청으로 확인했다.
//
// 주의: tracseTme(회차)는 work24 쪽에서 재부여되기도 하지만, 값이 달라도
// 훈련기관상세 페이지는 정상적으로 열린다. 따라서 회차는 건드리지 않는다.

const LEGACY_PATH = 'hrd.work24.go.kr/hrdp/co/pcoco/PCOCO0100P.do';
const CURRENT_URL = 'https://www.work24.go.kr/hr/a/a/3200/selectTrainInstitution.do';

/** 폐지된 구 형식 링크를 현행 형식으로 바꾼다. 그 외 값은 그대로 돌려준다. */
export function normalizeCourseLink(raw: unknown): string {
  const url = String(raw ?? '').trim();
  if (!url) return '';

  const idx = url.indexOf(LEGACY_PATH);
  if (idx === -1) return url;

  // LEGACY_PATH 뒤에 붙은 '?...' 쿼리를 그대로 옮겨 붙인다.
  return CURRENT_URL + url.slice(idx + LEGACY_PATH.length);
}
