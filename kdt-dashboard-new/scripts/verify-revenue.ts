/**
 * 매출 보정 산식 검증 — 실제 엔진을 실제 데이터셋 CSV 에 돌린다.
 *
 *   npx tsx scripts/verify-revenue.ts "<CSV 경로>"
 *
 * 하는 일
 *  1. 데이터셋의 매출 4개 컬럼이 문서화된 산식과 맞는지 전수 확인
 *     (매출 최대 = 훈련비 × 수강신청 인원 / 매출 최소 = 훈련비 × 수료인원
 *      / 실 매출 대비 = 매출 최대 × 0.8 / 연도합 = 실 매출 대비)
 *  2. transformRawDataArray → applyRevenueAdjustmentIfMissing 을 태운 뒤
 *     보정 매출이 [매출 최소, 매출 최대] 구간 안에 있는지 확인 (하한/상한 위반)
 *  3. 수료율 출처 분포와 합계를 출력
 */

import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { transformRawDataArray } from '../src/lib/backend/data-transformer';
import { computeCourseRevenue } from '../src/lib/backend/revenue-engine';
import {
  BASE_REVENUE_RATIO,
  DROPOUT_WEIGHT,
  revenueRatioFromCompletionRate,
} from '../src/lib/revenue-factor';
import type { RawCourseData } from '../src/lib/backend/types';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('사용법: npx tsx scripts/verify-revenue.ts "<CSV 경로>"');
  process.exit(1);
}

const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').replace(/[,%\s]/g, '');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const 억 = (n: number) => (n / 1e8).toFixed(1) + '억';

const text = fs.readFileSync(path.resolve(csvPath), 'utf8').replace(/^﻿/, '');
const parsed = Papa.parse<RawCourseData>(text, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => h.trim(),
});
const raw = parsed.data.filter((r) => String((r as any).고유값 || '').trim() !== '');
console.log(`CSV ${raw.length}행 로드\n`);

// ── 1) 원본 산식 전수 검증 ────────────────────────────────────
const col = (r: any, ...names: string[]) => {
  for (const n of names) if (r[n] !== undefined) return r[n];
  return undefined;
};
let okMax = 0, badMax = 0, okMin = 0, badMin = 0, okRatio = 0, badRatio = 0, okYear = 0, badYear = 0;
for (const r of raw as any[]) {
  const fee = num(r.훈련비);
  const app = num(col(r, '수강신청 인원', '수강신청인원'));
  const fin = num(r.수료인원);
  const mx = num(col(r, '매출 최대', '매출최대'));
  const mn = num(col(r, '매출 최소', '매출최소'));
  const ac = num(col(r, '실 매출 대비', '실매출대비'));
  Math.abs(mx - fee * app) < 1 ? okMax++ : badMax++;
  Math.abs(mn - fee * fin) < 1 ? okMin++ : badMin++;
  if (mx > 0) (Math.abs(ac - BASE_REVENUE_RATIO * mx) < 1 ? okRatio++ : badRatio++);
  const ySum = Object.keys(r)
    .filter((k) => /^\d{4}년$/.test(k))
    .reduce((s, k) => s + num(r[k]), 0);
  Math.abs(ySum - ac) < 1 ? okYear++ : badYear++;
}
console.log('[1] 데이터셋 원본 산식');
console.log(`  매출 최대 = 훈련비 × 수강신청 인원 : 일치 ${okMax} / 불일치 ${badMax}`);
console.log(`  매출 최소 = 훈련비 × 수료인원      : 일치 ${okMin} / 불일치 ${badMin}`);
console.log(`  실 매출 대비 = 매출 최대 × ${BASE_REVENUE_RATIO}   : 일치 ${okRatio} / 불일치 ${badRatio}`);
console.log(`  연도합 = 실 매출 대비              : 일치 ${okYear} / 불일치 ${badYear}\n`);

// ── 2) 계수의 단조성·구간 ──────────────────────────────────────
console.log(`[2] 보정 계수 (θ=${DROPOUT_WEIGHT})`);
let prev = -1, monotonic = true;
for (let p = 0; p <= 100; p++) {
  const v = revenueRatioFromCompletionRate(p);
  if (v < prev - 1e-12) monotonic = false;
  prev = v;
}
console.log(`  수료율 0→100%% 구간에서 단조증가: ${monotonic ? 'OK' : '위반'}`);
for (const p of [0, 25, 40, 50, 75, 90, 100]) {
  const ratio = revenueRatioFromCompletionRate(p);
  const theta = p < 100 ? (ratio - p / 100) / (1 - p / 100) : NaN;
  console.log(
    `   수료율 ${String(p).padStart(3)}%  매출최대 대비 ${ratio.toFixed(3)}` +
      `  역산 θ ${Number.isNaN(theta) ? '  -  ' : theta.toFixed(3)}`
  );
}
console.log();

// ── 3) 엔진을 태운 뒤 구간 검증 ────────────────────────────────
const courses = transformRawDataArray(raw);
let below = 0, above = 0, total = 0;
const bySource = new Map<string, { n: number; revenue: number }>();
for (const c of courses) {
  const rev = computeCourseRevenue(c);
  total += rev;
  const mn = num((c as any)['매출 최소']);
  const mx = num((c as any)['매출 최대']);
  if (mx > 0) {
    if (rev < mn - 1) below++;
    if (rev > mx + 1) above++;
  }
  const src = String((c as any).수료율_출처 ?? '미표기');
  const cur = bySource.get(src) ?? { n: 0, revenue: 0 };
  cur.n++; cur.revenue += rev;
  bySource.set(src, cur);
}

console.log('[3] 보정 후 매출이 [매출 최소, 매출 최대] 구간 안에 있는가');
console.log(`  하한(매출 최소) 미만 : ${below}건`);
console.log(`  상한(매출 최대) 초과 : ${above}건\n`);

console.log('[4] 수료율 출처 분포');
const order = ['실측', '부분실측', '동일과정', '기관×NCS', '기관', 'NCS', '전체', '미확정', '미표기'];
for (const src of order) {
  const v = bySource.get(src);
  if (!v) continue;
  console.log(`  ${src.padEnd(9)} ${String(v.n).padStart(5)}건  ${억(v.revenue).padStart(10)}`);
}
const estimated = [...bySource.entries()]
  .filter(([s]) => s !== '실측')
  .reduce((s, [, v]) => s + v.revenue, 0);
console.log(`\n  합계 ${억(total)}  (이 중 추정분 ${억(estimated)}, ${((estimated / total) * 100).toFixed(1)}%)`);

const failed = badMax || badMin || badRatio || badYear || below || above || !monotonic;
process.exit(failed ? 1 : 0);
