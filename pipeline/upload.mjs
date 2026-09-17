// 수집 결과 CSV 를 사이트로 올린다.
//
//   node pipeline/upload.mjs <csv 경로>
//   환경변수: SITE_URL, UPLOAD_TOKEN, (선택) UPLOAD_FORCE=1
//
// 사이트의 업로드 안전장치가 422 로 막으면 **그대로 실패로 끝낸다.** 자동으로
// force 를 붙이지 않는다 — 가드가 잡는 건 "그날 수집을 버리는 게 나은 상황"이고,
// 자동 우회는 가드를 없애는 것과 같다. 사람이 내용을 보고 판단할 때만 UPLOAD_FORCE=1.
import fs from "node:fs";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("사용법: node pipeline/upload.mjs <csv 경로>");
  process.exit(1);
}

const SITE = (process.env.SITE_URL || "https://kdt-dataset-svth.vercel.app").replace(/\/$/, "");
const TOKEN = (process.env.UPLOAD_TOKEN || "").replace(/^﻿/, "").trim();
const FORCE = process.env.UPLOAD_FORCE === "1";

if (!TOKEN) {
  console.error("UPLOAD_TOKEN 이 없습니다. 시크릿을 확인하세요.");
  process.exit(1);
}

const bytes = fs.statSync(csvPath).size;
const lines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean).length - 1;
console.log(`업로드 대상: ${csvPath} (${(bytes / 1024 / 1024).toFixed(2)}MB, ${lines}행)`);

const url = `${SITE}/api/v1/upload-csv${FORCE ? "?force=1" : ""}`;
if (FORCE) console.log("[주의] UPLOAD_FORCE=1 — 안전장치를 우회합니다.");

const form = new FormData();
form.append("csv_file", new File([fs.readFileSync(csvPath)], "upload.csv", { type: "text/csv" }));

const t0 = Date.now();
const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}` },
  body: form,
  // 7,505행이 11초였다. 넉넉히 준다.
  signal: AbortSignal.timeout(300_000),
});
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const body = await res.json().catch(() => null);

console.log(`HTTP ${res.status} (${elapsed}s)`);

if (res.status === 200) {
  const d = body?.data ?? {};
  const h = body?.health_check ?? {};
  console.log(`  저장 ${d.processed_courses ?? "?"}행 · 기관 ${d.institution_count ?? "?"}곳`);
  console.log(`  연도 범위 ${d.year_range?.start ?? "?"}~${d.year_range?.end ?? "?"}`);
  if (h.invalid_rows) console.log(`  [!] 유효하지 않은 행 ${h.invalid_rows}건`);
  process.exit(0);
}

console.error(`  ${body?.message ?? "(메시지 없음)"}`);
for (const v of body?.violations ?? []) {
  console.error(`  [${v.blocking ? "차단" : "경고"}] ${v.code} — ${v.message}`);
}
if (res.status === 422) {
  console.error("");
  console.error("안전장치가 막았습니다. 데이터는 그대로입니다.");
  console.error("내용을 확인하고 의도한 것이 맞으면 UPLOAD_FORCE=1 로 다시 실행하세요.");
}
process.exit(1);
