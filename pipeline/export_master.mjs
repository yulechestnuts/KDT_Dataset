// Supabase → 수집기용 마스터 CSV.
//
// 수집기(K디지털_수집_통합.py)는 `--master` 로 준 CSV 에서 수기 컬럼
// (선도기업·파트너기관·매출·연도배분·자비부담금·만족도)을 고유값으로 join 해 승계한다.
// 지금까지는 그 마스터가 로컬 엑셀이었다. 그걸 DB 로 바꾼다 —
// 그래야 "엑셀이 있는 PC" 없이도 파이프라인이 돈다.
//
// 선도기업·파트너기관은 kdt_data 가 아니라 kdt_course_overrides 가 정본이므로
// 여기서 덮어 써 내보낸다.
import fs from "node:fs";

// 사용법
//   로컬: node pipeline/export_master.mjs .env.local master.csv
//   CI  : node pipeline/export_master.mjs - master.csv   (환경변수에서 읽는다)
const envPath = process.argv[2];
const outPath = process.argv[3];

function loadEnv(path) {
  // CI 에는 .env 파일이 없다. '-' 이거나 파일이 없으면 process.env 를 쓴다.
  if (!path || path === "-" || !fs.existsSync(path)) return process.env;
  const fromFile = Object.fromEntries(
    fs.readFileSync(path, "utf8").split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")])
  );
  return { ...process.env, ...fromFile };
}
const env = loadEnv(envPath);
// 값에 따옴표나 공백이 묻어 오는 경우가 있다 (.env 를 그대로 export 한 경우 등).
// 그대로 쓰면 "Failed to parse URL" 로 죽으니 여기서 한 번 털어낸다.
const clean = (v) => String(v ?? "").trim().replace(/^["']|["']$/g, "").replace(/\/$/, "");
const U = clean(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL);
const K = clean(env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
if (!U || !K) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다. 시크릿을 확인하세요.");
  process.exit(1);
}
const H = { apikey: K, Authorization: `Bearer ${K}` };

async function fetchAll(table, select) {
  let out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${U}/rest/v1/${table}?select=${select}&order=id&limit=1000&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error(`${table} 조회 실패 ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const p = await r.json();
    out = out.concat(p);
    if (p.length < 1000) break;
  }
  return out;
}

const rows = await fetchAll("kdt_data", "*");
console.log(`kdt_data ${rows.length}행`);

// overrides 는 id 컬럼이 없어 order 를 고유값으로 준다.
let ov = [];
for (let off = 0; ; off += 1000) {
  const r = await fetch(`${U}/rest/v1/kdt_course_overrides?select=*&order=${encodeURIComponent("고유값")}&limit=1000&offset=${off}`, { headers: H });
  const p = await r.json();
  ov = ov.concat(p);
  if (p.length < 1000) break;
}
const ovMap = new Map(ov.map((o) => [String(o.고유값).trim(), o]));
console.log(`overrides ${ov.length}건`);

// 수집기 OUT_COLUMNS 와 같은 순서·이름
const COLUMNS = [
  "고유값", "과정명", "훈련과정 ID", "회차", "훈련기관",
  "총 훈련일수", "총 훈련시간", "과정시작일", "과정종료일",
  "NCS명", "NCS코드", "훈련비", "정원", "수강신청 인원", "수료인원", "수료율",
  "만족도", "취업인원 (3개월)", "취업률 (3개월)", "취업인원 (6개월)", "취업률 (6개월)",
  "지역", "주소", "과정페이지 링크",
  "선도기업", "파트너기관", "매출 최소", "실 매출 대비", "매출 최대",
  "2021년", "2022년", "2023년", "2024년", "2025년", "2026년", "2027년",
  "자비부담금",
];

const esc = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const lines = [COLUMNS.join(",")];
let overridden = 0;
for (const r of rows) {
  const o = ovMap.get(String(r.고유값 ?? "").trim());
  if (o) {
    r.선도기업 = o.선도기업 ?? "";
    r.파트너기관 = o.파트너기관 ?? "";
    overridden += 1;
  }
  lines.push(COLUMNS.map((c) => esc(r[c])).join(","));
}
fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`overrides 적용 ${overridden}행 → ${outPath} (${lines.length - 1}행)`);
