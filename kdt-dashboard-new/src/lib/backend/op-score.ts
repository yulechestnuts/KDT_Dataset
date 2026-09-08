// 분야 유망도 지수 (Op Score) — 22개 기술분야를 하나의 0~100 숫자로 줄 세운다.
//
// ─────────────────────────────────────────────────────────────
// 이 파일의 구조가 왜 '정규화'와 '가중합'으로 쪼개져 있는가
// ─────────────────────────────────────────────────────────────
// 가중치는 근거가 없는 임의값이다. 그리고 이 데이터에서는 가중치를 조금만 바꿔도
// 상위권 순서가 실제로 뒤집힌다. 실측(±40% 흔들기 4,000회, 분야 21개): 개별 순위의
// 평균 변동폭 7.0위. 지표 5개가 서로 거의 무상관(|ρ|<0.5)이라 구조적으로 그렇고,
// 지표를 빼도 줄지 않는다. 그래서 **순위가 아니라 티어가 판단 단위**다(아래 티어 섹션).
//
// 그래서:
//   · computeOpComponentScores()  = 지표를 0~100 으로 정규화 (무거운 계산, 서버에서 1회)
//   · combineOpScore()            = 정규화된 점수 + 가중치 → 최종 점수 (가벼움, 화면에서 매번)
//
// 화면은 가중치 슬라이더를 주고 combineOpScore 만 다시 돌린다. 사용자가 직접
// 가중치를 흔들어 보고 "이 순위가 얼마나 가중치에 의존하는가"를 눈으로 확인할 수 있다.
// 같은 이유로 순위 안정성(가중치를 무작위로 흔들었을 때의 순위 분포)도 화면에서 낸다.
//
// ─────────────────────────────────────────────────────────────
// 원본(모닝브리프 KDT시장리포트)과 무엇이 다른가
// ─────────────────────────────────────────────────────────────
// 원본은 다섯 지표(CAGR·점유이동·취업률·수료율·만족도)를 22개 분야 안에서 **백분위**로
// 바꾸고 임의 가중치(30·20·30·10·10)로 평균한다. 아이디어는 그대로 가져오되,
// 산식은 다음 다섯 군데를 바꿨다. 전부 이 데이터에서 실제로 틀린 답을 만들던 지점이다.
//
//  (1) 백분위 → 로버스트 z.
//      백분위는 '순위'만 남기고 '격차'를 버린다. 수요 모멘텀 실측을 보면
//      +13.97 / +8.58 / +8.45 (반도체·정보보안·스마트제조) 는 사실상 한 덩어리인데
//      백분위로는 100 / 90 / 86 으로 벌어지고, 반대로 −18.73 과 −46.28 의 큰 격차는
//      14 와 5 로 눌린다. 중앙값·MAD 기반 z 를 쓰면 격차가 그대로 남는다.
//      (평균·표준편차가 아니라 중앙값·MAD 인 이유: −46.28 같은 한 점이 스케일을
//       통째로 흔들지 않게 하려고.)
//
//  (2) CAGR(신청인원 증감율) → 수요 모멘텀(시장 대비 지수의 기울기).
//      회차 수가 430(2021) → 2081(2025) 로 늘어난 시장에서는 거의 모든 분야의
//      신청인원이 는다. CAGR 은 '시장이 5배 커진 것'을 분야의 성장으로 오독한다.
//
//  (3) 취업률·수료율을 '절대값' → '같은 코호트 연도의 시장 평균 대비 지수'.
//      시장 평균 취업률이 67.8%(2021) → 52.2%(2025) 로 내려왔다. 성숙 코호트가
//      2021~2022 에 몰린 분야는 절대값만으로 자동으로 이긴다. 이건 분야의 실력이
//      아니라 코호트 구성의 차이다.
//
//  (4) 결측을 0 으로 대체하지 않는다.
//      원본은 `f.get(k) or 0` 이라 '취업률 미집계'가 '취업률 0%'와 같아진다.
//      백분위 계산에서 이건 최하위를 뜻한다 — 신생 분야에 치명적이다.
//      여기서는 결측 지표의 가중치를 나머지 지표에 **재분배**한다.
//
//  (5) 표본이 얇으면 경고만 띄우는 게 아니라 **점수 자체를 중앙(50)으로 끌어당긴다**.
//      회차 3개짜리 분야의 '기울기'는 값이 아니라 노이즈다. 신뢰도(0~1)를 곱해
//      shrink 하면 표본이 얇을수록 극단 점수가 나오지 못한다.
//
//  (6) 수요 축은 '회차당 신청인원'이 아니라 **신청인원 점유율(사람 수)** 이 본체다.
//      이 파일의 초판은 demand-engine 의 relativeDemandSlope(시장 대비 회차당 신청인원
//      지수의 기울기)를 수요의 주지표로 썼다. 그런데 이 데이터로 재 보니:
//
//        시장대비 회차당신청 지수 ↔ 회차당 정원   r = 0.835 (분산의 70%)
//        회차당 신청           ↔ 신청 점유율    r = -0.10
//        회차당 추세           ↔ 점유 이동      r =  0.30   (분야 21개)
//
//      즉 그 지표의 분산 70%는 "회차를 얼마나 크게 열었나"라는 **공급자 결정**이다.
//      실제로 답이 갈린다 — AI/머신러닝은 점유율이 3년간 +7.3%p(전 분야 1위)로 늘었는데
//      회차당 추세는 +0.44(거의 0)로 "수요 정체"라고 말한다. 회차를 잘게 쪼개 열었기
//      때문이다. 반대로 모바일은 회차당 추세 −46.28(꼴찌)인데 점유 이동은 −0.5 에 불과하다.
//
//      그래서 수요 축을 사람 수 기준으로 다시 짰다:
//        · 점유 이동(25) = 최근 3개 완결 코호트의 신청인원 점유율 변화 %p  ← 주지표
//        · 점유 수준(15) = 최근 코호트 신청인원 점유율 %                  ← 지금 몇 명이 듣나
//        · 회차당 추세(10) = 옛 주지표. 오염을 명시하고 보조로만 남겼다.
//      정원(상한)은 어느 항목에도 값으로 들어가지 않는다. 정원은 오직 '표본이 너무 작은
//      연도 셀 제외'(MIN_CAPACITY_FOR_TREND)에만 쓴다.
//
// ─────────────────────────────────────────────────────────────
// 축 구조 — 이 페이지의 2×2 분면과 같은 축을 쓴다
// ─────────────────────────────────────────────────────────────
// 분면(유망/과열주의/저평가/축소)은 '수요 축 × 성과 축'의 부호만 본다.
// Op Score 는 그 두 축을 연속값으로 만들어 합친 것이다. 그래서 분면과 점수가
// 서로 어긋나지 않는다 — 같은 재료를 쓰기 때문이다.
//
// ⚠️ **두 축을 대등하게 놓고 평균내면 안 된다** — 그게 이 파일의 초판이 틀렸던 지점이다.
//    초판은 '수요 축 × 성과 축'을 가중평균했고, 한쪽이 다른 쪽을 메꾸는 걸 막으려고
//    λ·σ 페널티(보완성 다이얼)까지 붙였다. 그런데 λ 자체가 근거 없는 임의값이라,
//    λ 를 바꾸면 순위가 바뀌고 → 답이 셋이면 답이 없는 것과 같아진다.
//
//    근본 원인은 λ 가 아니라 **애초에 대등한 축이 아니었다**는 것이다. 실측:
//        점유 이동 ↔ 취업 지수   r = -0.14
//        점유 수준 ↔ 취업 지수   r = -0.24
//    거의 무관하다. 무관한 둘을 평균내면 신호가 서로를 지운다.
//
//    KDT 의 목적(훈련생을 현업 개발자로 배출)에서 다시 유도하면 둘은 축이 아니라
//    **퍼널의 단계**다:
//
//        배출 인원 = 수강신청 인원 × 수료율 × 취업률
//                   └ 도달(양) ┘   └─── 배출률(질) ───┘
//
//    퍼널은 곱이고, **곱은 원래 비보완적이다** — 어느 단계가 무너지면 λ 없이도 전체가
//    무너진다. 그래서 수료 지수와 취업 지수를 따로 두고 평균내던 것을 하나의
//    **배출률**(신청 100명당 현업 취업자, 시장 전체 38.4%)로 합쳤고, λ 는 삭제했다.
//    축 사이는 단순 가중평균으로 충분하다 — 비보완성은 이미 배출률 안에 들어 있다.
//
//  (7) **규모(배출 점유)를 점수에서 뺐다** (2026-09, 기본 가중치 0).
//      규모를 25% 로 넣었더니 AI/머신러닝이 2위가 됐다. 그런데 그 분야의 배출률은
//      37.6% 로 시장(40.9%) **아래**다. 점수 분해를 보면 배출률 기여 13.3점 ·
//      배출점유 기여 19.8점 — 「1인당 성과」가 중앙값 이하인데 「덩치」가 최상위라
//      점수를 끌어올린 것이다. 사용자 표현으로 '픽률 높고 승률 낮은 함정픽'.
//
//      규모를 뺄 근거는 셋이다:
//        · 규모가 크다고 훈련기관이 가져가는 몫이 늘지 않는다
//          (분야 크기 ↔ 기관당 신청인원 ρ=0.11, 분야 크기 ↔ 기관 수 ρ=0.76 — 경쟁자만 는다)
//        · 규모는 이미 **신뢰도**에 들어가 있다 (신뢰도 ↔ 누적신청 ρ=0.90). 두 번 세는 셈.
//        · 규모를 빼면 순위도 더 안정된다 (±40% 흔들기 평균 변동폭 8.7위 → 7.0위).
//      규모 지표 자체는 표에 그대로 남는다 — 점수에 넣지 않을 뿐이다.

/**
 * 세 축은 각각 하나의 질문이다. Op Score 는 이 셋을 다 갖고 있어야 한다 —
 * 배출력만으로도, 규모만으로도, 추세만으로도 '유망하다'고 말할 수 없기 때문이다.
 *   · 배출 = 지금 취업이 되는가
 * *   · 상승세 = 해마다 오르고 있는가 ← 취업률 기울기 + 점유율 변화 (수준이 아니라 방향)
 *   · 규모 = 얼마나 많은 사람에게 닿는가
 */
export type OpAxis = '배출' | '상승세' | '규모';

export const OP_AXES: OpAxis[] = ['배출', '상승세', '규모'];

/** 축 헤더 아래 한 줄 — '무엇을 재는 축인지'를 이름만으로 못 알아보게 두면 안 된다 */
export const OP_AXIS_SUBTITLE: Record<OpAxis, string> = {
  배출: '배출률 · 만족도',
  상승세: '취업률 기울기 · 점유율 변화',
  규모: '현업 배출 점유',
};

/** 축 헤더 툴팁 — 그 축이 답하는 질문과, 왜 그 재료인지 */
export const OP_AXIS_QUESTION: Record<OpAxis, string> = {
  배출: `지금 취업이 되는가 — 「수준」을 재는 축입니다.
· 배출률 = 수강신청 100명 중 현업 취업까지 간 사람 수 (시장 대비 지수, 100 = 시장 평균)
· 만족도 = 설문 인원 가중 평균`,
  상승세: `해마다 오르고 있는가 — 「수준」이 아니라 「방향」을 재는 축입니다.
· 취업률 추세 = 시장 대비 취업률 지수의 연도별 기울기 (해가 갈수록 취업이 잘 되는가)
· 점유율 추세 = 최근 3개 코호트의 신청인원 점유율 변화 %p (해가 갈수록 사람이 더 오는가)
둘 다 +면 오르는 중, −면 내려가는 중입니다. '지금 잘한다'와 '좋아지는 중이다'는 다른 질문이라 축을 나눴습니다.`,
  규모: `몇 명에게 닿는가 — 「크기」를 재는 축입니다.
· 배출 점유 = 시장 전체가 배출한 현업 인력 중 이 분야의 몫
  (신청인원이 아니라 「취업까지 간 사람」 기준이라, 사람만 모으고 취업은 안 되는 분야는 규모를 못 가져갑니다)`,
};



export type OpComponentKey =
  | 'yieldIndex'
  | 'employmentTrend'
  | 'satisfaction'
  | 'reachLevel'
  | 'reachShift';

export interface OpComponentSpec {
  key: OpComponentKey;
  /** 화면 라벨 (짧게) */
  label: string;
  /** 라벨 아래 보조 설명 */
  unit: string;
  axis: OpAxis;
  /** 기본 가중치. 화면에서 바꿀 수 있다 — 정답이 아니라 출발점이다. */
  weight: number;
  /** 툴팁에 쓰는 한 줄 정의 */
  hint: string;
  /**
   * **의미 있는 최소 차이** (원값 단위). 정규화 스케일의 하한이다.
   *
   * 왜 필요한가 — z 는 '중앙값에서 몇 스케일 떨어졌나'이고 스케일은 그 지표의 산포다.
   * 그런데 산포 자체가 측정 노이즈만큼 작아지면, 노이즈가 통째로 증폭된다.
   * 실측(2026-09): 만족도 22개 분야의 MAD 가 0.1 점이라 스케일이 0.148 이 되고,
   * **4.2 와 4.3 (사실상 같은 값)이 36 점과 50 점으로 갈렸다.** 수료 지수도 같은 문제로
   * MAD 1.2(수료율 1%p 남짓)가 14점 차이를 만들었다.
   *
   * 그래서 지표마다 "이만큼은 벌어져야 진짜 차이"라는 하한을 두고
   * scale = max(로버스트 산포, minScale) 로 쓴다. 산포가 넉넉한 지표에는 아무 영향이 없다
   * (실측상 회차당 추세·점유 이동·취업 지수 등은 하한에 걸리지 않는다).
   */
  minScale: number;
  /**
   * 정규화 전에 원값에 걸 변환. 표시용 value 는 원값 그대로 두고 z 만 변환값으로 잰다.
   * 점유율처럼 자릿수가 다른 값(29.1% ~ 0.2%)에 쓴다 — 원값 그대로면 상위 한둘이
   * 스케일을 먹어 나머지가 전부 한 덩어리로 눌린다.
   */
  transform?: (v: number) => number;
}

/**
 * 기본 가중치 합 100 — 배출 60(배출률 55 + 만족도 5) · 상승세 40 · 규모 0.
 * 규모가 0 인 이유는 파일 머리 (7) 참고. 화면에서 올려 볼 수는 있다.
 * ⚠️ 나머지 숫자에 이론적 근거는 없다. 흔들어 보라고 만든 출발점이고,
 *    그래서 순위가 아니라 티어로 읽게 되어 있다.
 */
export const OP_COMPONENTS: OpComponentSpec[] = [
  {
    key: 'yieldIndex',
    label: '배출률',
    unit: '지수',
    axis: '배출',
    weight: 55,
    hint: '수강신청 100명 중 현업 취업까지 간 사람 수 ÷ 같은 코호트 연도의 시장 배출률 × 100. 수료율과 취업률을 퍼널로 곱한 값이라 어느 단계가 무너지면 같이 무너진다.',
    /** 지수p. 실측 산포 12.7 — 하한에 안 걸린다 */
    minScale: 5,
  },
  {
    key: 'satisfaction',
    label: '만족도',
    unit: '점',
    axis: '배출',
    weight: 5,
    hint: '설문 인원 가중 평균 만족도. 훈련이 실제로 현업 준비를 시켰는지에 대한 유일한 대리지표라 낮은 가중치로만 넣는다.',
    /** 점. 실측 산포 0.15 → 하한이 문다. 4.2 와 4.3 은 같은 값으로 본다 */
    minScale: 0.3,
  },
  {
    key: 'employmentTrend',
    label: '취업률 추세',
    unit: '지수p/년',
    axis: '상승세',
    weight: 20,
    hint: '시장 대비 취업률 지수의 연도별 기울기 (지수p/년). 「해가 갈수록 취업이 잘 되고 있는가」 — 수준이 아니라 방향이다. 시장 전체 취업률이 67.8%(2021) → 52.2%(2025) 로 내려가는 중이라, 절대 기울기를 재면 거의 모든 분야가 음수다. 그래서 시장 대비 지수의 기울기로 잰다. +면 시장보다 빠르게 좋아지는 중.',
    /** 지수p/년. 실측 산포 3.6 — 안 걸린다 */
    minScale: 2,
  },
  {
    key: 'reachShift',
    label: '점유율 추세',
    unit: '%p',
    axis: '상승세',
    weight: 20,
    hint: '최근 3개 완결 코호트에서 이 분야의 신청인원 점유율이 몇 %p 움직였는가. 「해가 갈수록 사람이 더 오는가」 — 수준이 아니라 방향이다. 분모·분자가 모두 실제 사람 수라 정원·회차 같은 공급자 재량이 끼지 않는다. +면 시장에서 차지하는 몫이 커지는 중.',
    /** %p. 실측 산포 2.4 — 안 걸린다 */
    minScale: 1,
  },
  {
    key: 'reachLevel',
    label: '배출 점유',
    unit: '%',
    axis: '규모',
    weight: 0,
    hint: '시장 전체가 배출한 현업 인력 중 이 분야의 몫(%). 신청인원 점유가 아니라 「취업까지 간 사람」 기준이라, 사람만 많이 모으고 취업은 안 되는 분야는 규모 점수를 가져가지 못한다.',
    /** log10 자리 단위. 0.13 ≈ 1.35배 차이 */
    minScale: 0.13,
    transform: (v) => Math.log10(Math.max(v, 0.05)),
  },
];

export const OP_COMPONENT_KEYS = OP_COMPONENTS.map((c) => c.key);

export type OpWeights = Record<OpComponentKey, number>;

export const DEFAULT_OP_WEIGHTS: OpWeights = Object.fromEntries(
  OP_COMPONENTS.map((c) => [c.key, c.weight])
) as OpWeights;

/**
 * 미리 만들어 둔 관점들. "가중치에 따라 답이 달라진다"를 한 번의 클릭으로 보여주는 장치다.
 * 각 프리셋은 실제 의사결정 상황 하나에 대응한다.
 */
export const OP_WEIGHT_PRESETS: Array<{ name: string; desc: string; weights: OpWeights }> = [
  {
    name: '기본',
    desc: '배출 60 · 상승세 40 · 규모 0. 규모는 점수에서 뺐다 — 덩치가 큰 것과 잘하는 것은 다르고, 규모는 이미 신뢰도에 들어가 있다.',
    weights: DEFAULT_OP_WEIGHTS,
  },
  {
    name: '지금 성과',
    desc: '추세를 빼고 현재 수준만 본다. 지금 당장 어디가 잘 배출하고 있는지 — 실적 점검 관점.',
    weights: { yieldIndex: 55, satisfaction: 10, employmentTrend: 5, reachShift: 5, reachLevel: 25 },
  },
  {
    name: '성장성',
    desc: '수준보다 방향을 본다. 취업률이 올라오고 사람이 몰리는 쪽 — 내년에 어디를 늘릴지 볼 때.',
    weights: { yieldIndex: 15, satisfaction: 5, employmentTrend: 35, reachShift: 35, reachLevel: 10 },
  },
  {
    name: '취업 최우선',
    desc: '훈련의 목적을 취업 하나로 본다. 규모가 작아도 잘 배출하면 최상위로 올라온다.',
    weights: { yieldIndex: 55, satisfaction: 5, employmentTrend: 30, reachShift: 5, reachLevel: 5 },
  },
  {
    name: '균등',
    desc: '5개 지표를 똑같이 본다. 가중치를 안 주면 어떻게 되는지의 기준선.',
    weights: Object.fromEntries(OP_COMPONENTS.map((c) => [c.key, 100 / OP_COMPONENTS.length])) as OpWeights,
  },
];

/** 구성 지표가 이 가중치만큼도 안 채워지면 점수를 내지 않는다 (전체 100 기준) */
export const MIN_AVAILABLE_WEIGHT_RATIO = 0.6;
/** 신뢰도가 이보다 낮으면 점수를 내지 않는다 — 50 근처 숫자는 '평균'이 아니라 '모름'이다 */
export const MIN_RELIABILITY = 0.2;

/**
 * 신뢰도 반감점 — 이 값에서 해당 항목 신뢰도가 0.5 가 된다.
 * 사람 수 단위라 데이터가 늘어도 의미가 변하지 않는다(백분위 기준이면 매번 바뀐다).
 */
export const RELIABILITY_HALF_ENROLLMENT = 1500;
export const RELIABILITY_HALF_TARGET_POP = 300;
/** 기울기를 값으로 볼 수 있는 최소 관측 연도 수. 2개는 직선 1개라 정보가 없다. */
export const RELIABILITY_FULL_TREND_YEARS = 4;

/** z 를 0~100 으로 접는 로지스틱의 기울기. z=±1 → 70/30, z=±3 → 93/7 */
const LOGISTIC_K = 0.85;
/** z 클리핑 — 이상치 하나가 점수판을 독식하지 못하게 */
const Z_CLIP = 3;

export interface OpComponentScore {
  key: OpComponentKey;
  /** 원값 (결측이면 null) */
  value: number | null;
  /** 로버스트 z (클리핑 후) */
  z: number | null;
  /** 0~100 로 접은 점수. 가중치와 무관하다 — 여기까지가 서버 몫이다. */
  score: number | null;
}

/** 서버가 내려주는 부분. 가중치가 들어가지 않은 '재료'다. */
export interface OpProfile {
  components: Record<OpComponentKey, OpComponentScore>;
  /** 0~1. 낮을수록 최종 점수를 50 쪽으로 끌어당긴다 */
  reliability: number;
  reliabilityParts: {
    /** 추이를 잴 만큼 연도가 있는가 */
    trendYears: number;
    /** 취업률 성숙 코호트의 사람 수가 충분한가 */
    employment: number;
    /** 분야 자체의 규모가 충분한가 */
    scale: number;
  };
  /**
   * 신뢰도를 가장 많이 깎은 항목. "왜 신뢰도가 낮지?"에 화면이 바로 답할 수 있게
   * 계산 쪽에서 정해 준다 (툴팁에 숨겨 두면 아무도 안 본다).
   */
  reliabilityBottleneck: '추이 연도' | '취업 표본' | '규모' | null;
  /** 병목 항목의 실제 관측값 — "추이 연도 3개", "누적 747명" 처럼 근거를 같이 보여준다 */
  reliabilityDetail: string;
}

/**
 * 축이 갈렸다고 볼 최소 격차(점).
 * 이보다 벌어지면 종합 점수 하나로는 그 분야를 설명할 수 없다 — 같은 55점이
 * '수요는 죽었는데 성과는 좋다'와 '수요는 몰리는데 성과가 안 난다'를 똑같이 만든다.
 */
export const OP_AXIS_DIVERGENCE = 12;

/** 가중치를 적용한 결과. 화면에서 매번 다시 만든다. */
export interface OpScoreResult {
  /** 최종 점수 (신뢰도 shrink 반영). 표본이 부족하면 null */
  score: number | null;
  /** shrink 전 원점수 — 신뢰도의 영향을 눈으로 보라고 같이 낸다 */
  rawScore: number | null;
  /** 축별 소계 (0~100, score 와 같은 신뢰도 shrink 적용) */
  axisScores: Record<OpAxis, number | null>;
  /** 축 소계의 최대−최소 (점). 크면 한쪽만 잘하는 분야다 */
  axisGap: number | null;
  /** 결측 재분배 후 지표별 실제 가중치 (합 100) */
  appliedWeights: Partial<Record<OpComponentKey, number>>;
  /** 점수를 못 낸 이유 (score === null 일 때만) */
  omitReason: '지표부족' | '표본부족' | null;
}

export interface OpScoreInput {
  key: string;
  values: Partial<Record<OpComponentKey, number | null>>;
  /** 추이 계산에 실제로 들어간 연도 수 */
  trendYears: number;
  /** 성숙 코호트 취업대상자 합 (명) */
  matureTargetPop: number;
  /** 누적 수강신청 인원 (명) */
  totalEnrollment: number;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * 중앙값 절대편차 × 1.4826 — 정규분포에서 표준편차와 같은 스케일이 되게 하는 상수.
 * MAD 가 0(값이 대부분 같음)이면 표준편차로, 그것도 0이면 null 로 떨어뜨려
 * 해당 지표를 통째로 제외한다(전부 같은 값이면 순위 정보가 없다).
 */
function robustScale(values: number[], center: number): number | null {
  const mad = median(values.map((v) => Math.abs(v - center)));
  if (mad !== null && mad > 1e-9) return mad * 1.4826;
  if (values.length < 2) return null;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1));
  return sd > 1e-9 ? sd : null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** z → 0~100. 선형 매핑과 달리 양 끝에서 포화하므로 이상치가 스케일을 안 먹는다. */
function foldToScore(z: number): number {
  return 100 / (1 + Math.exp(-LOGISTIC_K * z));
}

/** 반감점 K 를 쓴 포화 곡선. n=K 에서 0.5, n=3K 에서 0.75 */
const saturate = (n: number, half: number) => (n <= 0 ? 0 : n / (n + half));

/**
 * 신뢰도 = 세 항목의 기하평균.
 * 산술평균이 아니라 기하평균인 이유: 하나라도 0 에 가까우면 전체가 0 이어야 한다.
 * (회차 3개짜리 분야는 규모가 커도 '기울기'를 믿을 수 없다)
 */
function reliabilityOf(input: OpScoreInput) {
  const parts = {
    trendYears: clamp((input.trendYears - 2) / (RELIABILITY_FULL_TREND_YEARS - 2), 0, 1),
    employment: saturate(input.matureTargetPop, RELIABILITY_HALF_TARGET_POP),
    scale: saturate(input.totalEnrollment, RELIABILITY_HALF_ENROLLMENT),
  };
  const product = parts.trendYears * parts.employment * parts.scale;
  return { parts, value: product <= 0 ? 0 : Math.cbrt(product) };
}

/**
 * 1단계 — 지표를 0~100 으로 정규화한다. **가중치가 전혀 들어가지 않는다.**
 *
 * 정규화 기준(중앙값·MAD)이 '입력된 분야 집합 안에서' 정해지므로, 필터(선도기업/AI캠퍼스)를
 * 바꾸면 기준선도 같이 움직인다 — 의도된 동작이다. Op Score 는 절대 척도가 아니라
 * '지금 화면에 있는 시장 안에서의 상대 위치'다.
 */
export function computeOpComponentScores(inputs: OpScoreInput[]): Map<string, OpProfile> {
  const norm = new Map<OpComponentKey, { center: number; scale: number } | null>();
  for (const spec of OP_COMPONENTS) {
    const vals = inputs
      .map((i) => i.values[spec.key])
      .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
      .map((v) => (spec.transform ? spec.transform(v) : v));
    const center = median(vals);
    const spread = center === null ? null : robustScale(vals, center);
    // 산포가 그 지표의 '의미 있는 최소 차이'보다 작으면 노이즈를 증폭하게 된다.
    // minScale 로 바닥을 깔아 준다 — 자세한 이유는 OpComponentSpec.minScale 주석 참고.
    const scale = center === null ? null : Math.max(spread ?? 0, spec.minScale);
    norm.set(spec.key, center === null || !scale ? null : { center, scale });
  }

  const out = new Map<string, OpProfile>();

  for (const input of inputs) {
    const components = {} as Record<OpComponentKey, OpComponentScore>;
    for (const spec of OP_COMPONENTS) {
      const raw = input.values[spec.key];
      const n = norm.get(spec.key);
      const usable =
        n !== null && n !== undefined && raw !== null && raw !== undefined && Number.isFinite(raw);
      if (!usable) {
        components[spec.key] = { key: spec.key, value: raw ?? null, z: null, score: null };
        continue;
      }
      // transform 이 있으면 z 는 변환값 기준으로 재고, 화면에 보여줄 value 는 원값 그대로 둔다.
      const z = clamp(((spec.transform ? spec.transform(raw) : raw) - n.center) / n.scale, -Z_CLIP, Z_CLIP);
      components[spec.key] = {
        key: spec.key,
        value: round1(raw),
        z: round2(z),
        score: round1(foldToScore(z)),
      };
    }

    const reliability = reliabilityOf(input);
    // 세 항목의 기하평균이라, 가장 작은 항목이 사실상 신뢰도를 결정한다. 그걸 이름으로 낸다.
    const legs: Array<[NonNullable<OpProfile['reliabilityBottleneck']>, number, string]> = [
      ['추이 연도', reliability.parts.trendYears, `추이에 쓸 수 있는 개강연도 ${input.trendYears}개`],
      ['취업 표본', reliability.parts.employment, `성숙 코호트 취업대상 ${input.matureTargetPop}명`],
      ['규모', reliability.parts.scale, `누적 신청 ${input.totalEnrollment}명`],
    ];
    legs.sort((a, b) => a[1] - b[1]);
    const weakest = legs[0];

    out.set(input.key, {
      components,
      reliability: round2(reliability.value),
      reliabilityParts: {
        trendYears: round2(reliability.parts.trendYears),
        employment: round2(reliability.parts.employment),
        scale: round2(reliability.parts.scale),
      },
      // 셋 다 넉넉하면(0.85 이상) 굳이 병목을 지목하지 않는다 — 없는 문제를 만들지 않는다.
      reliabilityBottleneck: weakest[1] >= 0.85 ? null : weakest[0],
      reliabilityDetail: weakest[2],
    });
  }

  return out;
}

/**
 * 2단계 — 정규화된 지표 점수 + 가중치 → 최종 Op Score.
 * 가볍기 때문에 화면에서 슬라이더를 움직일 때마다 호출해도 된다.
 *
 * 결측 지표의 가중치는 남은 지표로 재분배된다(0 으로 채우지 않는다).
 */
export function combineOpScore(profile: OpProfile, weights: OpWeights): OpScoreResult {
  const totalWeight = OP_COMPONENTS.reduce((a, c) => a + Math.max(0, weights[c.key] ?? 0), 0);
  if (totalWeight <= 0) {
    return {
      score: null,
      rawScore: null,
      axisScores: { 배출: null, 상승세: null, 규모: null },
      axisGap: null,
      appliedWeights: {},
      omitReason: '지표부족',
    };
  }

  let availableWeight = 0;
  let weighted = 0;
  const appliedWeights: Partial<Record<OpComponentKey, number>> = {};

  for (const spec of OP_COMPONENTS) {
    const w = Math.max(0, weights[spec.key] ?? 0);
    const c = profile.components[spec.key];
    if (w <= 0 || !c || c.score === null) continue;
    availableWeight += w;
    weighted += w * c.score;
  }

  /** 축 소계 + 그 축이 실제로 쓴 가중치 합. 불균형 페널티에서 축 비중이 필요하다. */
  const axisScore = (axis: OpAxis): { value: number | null; weight: number } => {
    let w = 0;
    let s = 0;
    for (const spec of OP_COMPONENTS) {
      if (spec.axis !== axis) continue;
      const cw = Math.max(0, weights[spec.key] ?? 0);
      const c = profile.components[spec.key];
      if (cw <= 0 || !c || c.score === null) continue;
      w += cw;
      s += cw * c.score;
    }
    return { value: w > 0 ? round1(s / w) : null, weight: w };
  };

  // 축 소계에도 종합 점수와 같은 shrink 를 건다. 하나만 shrink 하면 축과 종합을
  // 나란히 놓았을 때 서로 안 맞는다.
  const shrink = (v: number | null) => (v === null ? null : round1(50 + (v - 50) * profile.reliability));
  const axisScores = Object.fromEntries(
    OP_AXES.map((a) => [a, shrink(axisScore(a).value)])
  ) as Record<OpAxis, number | null>;

  // 가중치를 재분배해 봐야 남은 지표가 요청한 가중치의 60% 도 안 되면
  // 그건 '평균'이 아니라 '모름'이다.
  if (
    availableWeight < totalWeight * MIN_AVAILABLE_WEIGHT_RATIO ||
    profile.reliability < MIN_RELIABILITY
  ) {
    // 종합을 못 내는 표본이면 축 소계도 못 낸다. 여기서 축만 내주면 '모름'이
    // 숫자 얼굴을 하고 화면에 남는다.
    return {
      score: null,
      rawScore: null,
      axisScores: { 배출: null, 상승세: null, 규모: null },
      axisGap: null,
      appliedWeights,
      omitReason:
        availableWeight < totalWeight * MIN_AVAILABLE_WEIGHT_RATIO ? '지표부족' : '표본부족',
    };
  }

  for (const spec of OP_COMPONENTS) {
    const w = Math.max(0, weights[spec.key] ?? 0);
    const c = profile.components[spec.key];
    if (w <= 0 || !c || c.score === null) continue;
    appliedWeights[spec.key] = round1((w / availableWeight) * 100);
  }

  // m = 축 가중평균. 지표 전체 가중평균과 같은 값이다(축 소계도 같은 가중치를 쓰므로).
  const rawScore = weighted / availableWeight;

  // 축 사이는 단순 가중평균이다. **비보완성은 이미 배출률 안에 들어 있다** —
  // 배출률 = 수료율 × 취업률 이라 어느 단계가 무너지면 곱이 같이 무너진다.
  // 예전처럼 축 평균에 λ·σ 페널티를 걸 필요가 없다(그 λ 는 근거 없는 임의값이었다).
  // 신뢰도 shrink — 표본이 얇을수록 50(중립) 쪽으로
  const score = 50 + (rawScore - 50) * profile.reliability;

  return {
    score: round1(score),
    rawScore: round1(rawScore),
    axisScores,
    axisGap: (() => {
      const vals = OP_AXES.map((a) => axisScores[a]).filter((v): v is number => v !== null);
      return vals.length < 2 ? null : round1(Math.max(...vals) - Math.min(...vals));
    })(),
    appliedWeights,
    omitReason: null,
  };
}

// ─────────────────────────────────────────────────────────────
// 순위 안정성 — "가중치를 바꾸면 답이 얼마나 달라지는가"를 수치로 낸다
// ─────────────────────────────────────────────────────────────

/**
 * 결정론적 난수(LCG). Math.random 을 쓰면 새로고침할 때마다 '순위 변동 폭'이
 * 미세하게 달라져서 사용자가 값을 신뢰할 수 없다. 시드를 고정한다.
 */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────
// 티어 — 순위 대신 '계층'으로 읽게 한다
//
// 왜 순위를 주인공에서 내리는가 (실측, 가중치 ±50% 무작위 5,000회):
//   · 개별 순위의 평균 변동 폭 7.3위 / 21개 분야. 1위와 4위를 구분할 수 없다.
//   · 지표 5개가 서로 거의 무상관(|ρ|<0.5)이라 **구조적으로** 그렇다.
//     각 축이 다른 질문을 하도록 설계했으니 당연한 결과고, 지표를 빼도 안 줄어든다
//     (만족도 제거 시 7.43 으로 오히려 늘어남).
//   · 반면 계층 유지율은 3구간 85.2% / 4구간 77.3%.
//
// 경계는 등분이 아니라 **자연 절단점**(점수축 1D k-means)이다. 등분하면 경계가
// 밀집 구간 한가운데를 지나가서(45.6 과 45.4 사이 같은 곳) 그 두 분야의 티어가
// 동전 던지기가 된다. 자연 절단점은 실제로 벌어진 곳에 경계를 놓는다.
//
// 그래도 4구간 유지율이 77% 라는 건 5개 중 1개는 경계에서 흔들린다는 뜻이다.
// 그래서 tierRetention 을 같이 내고 화면이 '경계'로 표시한다 — 숨기지 않는다.
// ─────────────────────────────────────────────────────────────

export type OpTier = 'S' | 'A' | 'B' | 'C';

export const OP_TIERS: OpTier[] = ['S', 'A', 'B', 'C'];

export const OP_TIER_LABEL: Record<OpTier, string> = {
  S: '최상위',
  A: '상위',
  B: '중위',
  C: '하위',
};

export const OP_TIER_DESC: Record<OpTier, string> = {
  S: '어떤 관점(가중치)으로 봐도 상위권에 남는 분야',
  A: '대체로 상위권이지만 무엇을 중시하느냐에 따라 중위권으로 내려갈 수 있음',
  B: '관점에 따라 위아래로 가장 많이 움직이는 구간',
  C: '어떤 관점으로 봐도 하위권',
};

/** 티어 유지율이 이보다 낮으면 '경계'로 표시한다 — 티어를 확정값처럼 읽지 말라는 뜻 */
export const OP_TIER_BORDERLINE = 0.7;

/**
 * 순위/티어 안정성을 잴 때 가중치를 흔드는 폭 (±비율).
 *
 * 실측(2026-09, 분야 21개, 기본 가중치 55/5/20/20/0):
 *   흔들기 폭   최대 변동폭   평균 변동폭
 *   ±100%          21위        15.7위   ← 예전 모델. 전 구간이라 정보가 없다
 *   ±40%           14위         7.0위   ← 지금
 *   ±25%            9위         5.1위
 * 폭을 좁히면 숫자는 예뻐지지만 '이견의 범위'를 좁게 잡은 것뿐이다.
 * ±40% 는 배출률을 33~77% 로 보는 정도 — 실제로 있을 법한 이견의 크기로 잡았다.
 */
export const WEIGHT_JITTER = 0.4;

/**
 * 점수축 1D k-means(자연 절단점). 내림차순 값에서 T-1 개의 경계 점수를 돌려준다.
 * 등분에서 출발해 수렴시키므로 결과가 결정론적이다(화면이 새로고침마다 바뀌면 안 된다).
 */
export function naturalBreaks(values: number[], tiers: number): number[] {
  const v = [...values].sort((a, b) => b - a);
  if (v.length <= tiers || tiers < 2) return [];
  let cut = Array.from({ length: tiers - 1 }, (_, i) => Math.floor(((i + 1) * v.length) / tiers));
  for (let it = 0; it < 60; it += 1) {
    const bounds = [0, ...cut, v.length];
    const centers: number[] = [];
    for (let t = 0; t < tiers; t += 1) {
      const seg = v.slice(bounds[t], bounds[t + 1]);
      centers.push(seg.length ? seg.reduce((a, b) => a + b, 0) / seg.length : 0);
    }
    const labels = v.map((x) => {
      let bi = 0;
      let bd = Infinity;
      centers.forEach((c, i) => {
        const dd = Math.abs(x - c);
        if (dd < bd) {
          bd = dd;
          bi = i;
        }
      });
      return bi;
    });
    const next: number[] = [];
    for (let t = 1; t < tiers; t += 1) {
      const idx = labels.findIndex((l) => l >= t);
      next.push(idx < 0 ? v.length : idx);
    }
    if (next.join() === cut.join()) break;
    cut = next;
  }
  // 경계 '점수' = 경계 양옆 값의 중간
  return cut
    .filter((i) => i > 0 && i < v.length)
    .map((i) => (v[i - 1] + v[i]) / 2);
}

/** 경계 점수 목록으로 티어를 정한다 (높은 점수가 S) */
export function tierFromBreaks(score: number, breaks: number[]): OpTier {
  let t = 0;
  for (const b of breaks) if (score < b) t += 1;
  return OP_TIERS[Math.min(t, OP_TIERS.length - 1)];
}

export interface OpRankStability {
  /** 가중치를 흔들었을 때 이 분야가 도달한 최고 순위(작을수록 상위) */
  bestRank: number;
  worstRank: number;
  medianRank: number;
  /** 상위 5위 안에 든 시행 비율 (0~1) */
  top5Rate: number;
  /** 지금 가중치로 정해진 티어 */
  tier: OpTier;
  /** 가중치를 흔들어도 같은 티어에 남은 비율 (0~1). 낮으면 경계에 걸쳐 있다 */
  tierRetention: number;
  /** 흔들었을 때 도달한 티어들 (S→C 순) */
  tierSpan: OpTier[];
}

/**
 * 가중치를 무작위로 흔들어(각 지표 0 ~ 기본값의 2배) 순위 분포를 낸다.
 *
 * 이 결과를 화면에 같이 두는 이유: Op Score 는 단일 값처럼 보이지만 실제로는
 * 가중치라는 자유도 위에 놓인 값이다. 변동 폭이 좁은 분야는 어떤 관점에서 봐도
 * 상위/하위이고, 폭이 넓은 분야는 "무엇을 중요하게 보느냐"에 전적으로 달려 있다.
 * 후자를 단일 순위로만 보여주면 없는 확신을 만들어 내는 셈이 된다.
 *
 * @param base 흔들기의 중심이 될 가중치 (보통 지금 화면의 가중치)
 * @param trials 시행 횟수. 22개 분야 × 400 회는 브라우저에서 수 ms 다.
 */
export function computeRankStability(
  profiles: Array<{ key: string; profile: OpProfile }>,
  base: OpWeights,
  trials = 400,
  seed = 20260907
): Map<string, OpRankStability> {
  const rng = makeRng(seed);
  const ranksByKey = new Map<string, number[]>();
  let top5ByKey = new Map<string, number>();
  // 티어 유지율 — 순위 분포와 같은 시행에서 공짜로 나온다
  const tierHitByKey = new Map<string, number>();
  const tierSpanByKey = new Map<string, Set<OpTier>>();

  // 점수를 못 내는 분야는 순위 경쟁에서 빼야 한다. 넣으면 항상 꼴찌로 잡혀
  // '안정적으로 하위'라는 잘못된 인상을 준다.
  const scored = profiles.filter(
    (p) => combineOpScore(p.profile, base).score !== null
  );
  for (const p of scored) {
    ranksByKey.set(p.key, []);
    top5ByKey.set(p.key, 0);
    tierHitByKey.set(p.key, 0);
    tierSpanByKey.set(p.key, new Set());
  }

  // 지금 가중치 기준 티어 — 이게 화면에 나가는 값이고, 흔들기는 이것의 신뢰도를 잰다
  const baseScores = scored.map((p) => ({
    key: p.key,
    score: combineOpScore(p.profile, base).score as number,
  }));
  const baseBreaks = naturalBreaks(baseScores.map((s) => s.score), OP_TIERS.length);
  const baseTier = new Map<string, OpTier>(
    baseScores.map((s) => [s.key, tierFromBreaks(s.score, baseBreaks)])
  );

  for (let t = 0; t < trials; t += 1) {
    const w = {} as OpWeights;
    for (const spec of OP_COMPONENTS) {
      // 각 가중치를 ±WEIGHT_JITTER 만큼 흔든다.
      //
      // 예전에는 0 ~ 2×기본값(=±100%)이었는데, 그건 한 지표의 가중치가 0 까지
      // 떨어질 수 있다는 뜻이라 '가중치를 조금 다르게 본다'가 아니라 '아예 다른
      // 지표로 줄 세운다'가 된다. 그 모델에서는 어떤 가중치를 골라도 최대 변동폭이
      // 21위(=전 구간)까지 나와서 숫자가 정보를 잃었다. ±40% 는 "배출률을 55%로
      // 볼 수도, 33%나 77%로 볼 수도 있다" 정도의 현실적인 이견 범위다.
      w[spec.key] = Math.max(0, (base[spec.key] ?? 0) * (1 + WEIGHT_JITTER * (2 * rng() - 1)));
    }
    const row = scored
      .map((p) => ({ key: p.key, score: combineOpScore(p.profile, w).score }))
      .filter((r): r is { key: string; score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score);
    // 경계도 매 시행마다 다시 잡는다. 고정하면 '점수가 통째로 내려간 시행'에서
    // 전부 강등돼 유지율이 실제보다 나쁘게 나온다 — 재는 건 상대 위치다.
    const breaks = naturalBreaks(row.map((r) => r.score), OP_TIERS.length);
    row.forEach((r, i) => {
      ranksByKey.get(r.key)!.push(i + 1);
      if (i < 5) top5ByKey.set(r.key, (top5ByKey.get(r.key) ?? 0) + 1);
      const t = tierFromBreaks(r.score, breaks);
      tierSpanByKey.get(r.key)!.add(t);
      if (t === baseTier.get(r.key)) tierHitByKey.set(r.key, (tierHitByKey.get(r.key) ?? 0) + 1);
    });
  }

  const out = new Map<string, OpRankStability>();
  for (const [key, ranks] of ranksByKey) {
    if (!ranks.length) continue;
    const sorted = [...ranks].sort((a, b) => a - b);
    const span = tierSpanByKey.get(key) ?? new Set<OpTier>();
    out.set(key, {
      bestRank: sorted[0],
      worstRank: sorted[sorted.length - 1],
      medianRank: sorted[Math.floor(sorted.length / 2)],
      top5Rate: (top5ByKey.get(key) ?? 0) / ranks.length,
      tier: baseTier.get(key) ?? 'C',
      tierRetention: (tierHitByKey.get(key) ?? 0) / ranks.length,
      tierSpan: OP_TIERS.filter((t) => span.has(t)),
    });
  }
  return out;
}
