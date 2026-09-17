# -*- coding: utf-8 -*-
"""수집 결과 CSV 에 회차별 만족도를 얹는다.

왜 따로 붙이는가
----------------
수집기(`collect.py`)는 만족도를 **일부러 채우지 않는다.** 목록 API 의 `stdgScor` 는
100점 척도이고 과정 단위 평균이라, 그걸 쓰면 한 과정의 모든 회차에 같은 값이 박히고
DB(5점 척도, 회차별 실값)를 20배로 뻥튀기하며 덮는다.
회차별 실값은 `kdt_satisfaction_collector.py` 가 `selectSatisfactionAjax.do` 에서
따로 긁어온다. 그 결과를 여기서 `(훈련과정 ID, 회차)` 로 조인한다.

원칙
----
- 기본은 **빈칸만 채운다.** 이미 값이 있는 행은 건드리지 않는다.
- 척도를 검사한다. 5 를 넘으면 100점 값이 섞인 것이므로 **그 행은 버린다.**
  (사이트 업로드 안전장치도 같은 것을 보지만, 여기서 먼저 걸러 그날 수집을 살린다)

★ 만족도는 확정 후에도 움직인다 (2026-09-17 실측)
   같은 (과정, 회차)를 크롤러로 다시 받아 DB 와 대조했더니 **25개 중 13개가 달랐다.**
   차이는 -1.3 ~ +0.9, 평균 -0.16 — 계통 오차가 아니라 값 자체가 바뀐 것이다.
   (평가 참여자가 늘면서 갱신되는 것으로 보인다)

   그래서 "빈칸만 채우기"를 계속 쓰면 DB 가 서서히 옛 값으로 굳는다.
   반대로 매번 덮으면 과거 리포트와 숫자가 달라진다.
   **어느 쪽이든 사람이 정할 문제이므로 기본값을 바꾸지 않고 `--refresh` 로 열어 둔다.**
   `--dry-run` 으로 몇 건이 바뀔지 먼저 볼 수 있다.
"""
import argparse
import csv
import io
import sys

for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8")


def norm(value) -> str:
    return str(value or "").strip()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--base", required=True, help="collect.py 가 만든 CSV")
    p.add_argument("--satisfaction", required=True, help="만족도 수집 결과 CSV")
    p.add_argument("--out", required=True)
    p.add_argument("--refresh", action="store_true",
                   help="이미 값이 있는 행도 최신값으로 덮는다 (기본: 빈칸만 채움)")
    p.add_argument("--dry-run", action="store_true",
                   help="파일을 쓰지 않고 몇 건이 바뀔지만 보고한다")
    a = p.parse_args()

    with io.open(a.satisfaction, encoding="utf-8-sig", newline="") as f:
        sat_rows = list(csv.DictReader(f))

    sat: dict[tuple[str, str], str] = {}
    dropped_scale = 0
    for r in sat_rows:
        key = (norm(r.get("훈련과정 ID")), norm(r.get("회차")))
        # 수집기 출력 컬럼은 `만족도(5점)` 이다. `만족도` 로 찾으면 한 건도 못 찾는다.
        raw = norm(r.get("만족도(5점)") or r.get("만족도"))
        if not key[0] or not raw:
            continue
        try:
            value = float(raw)
        except ValueError:
            continue
        # 0 은 '0점'이 아니라 아직 미집계다. 넣으면 가짜 급락이 찍힌다.
        if value <= 0:
            continue
        if value > 5:
            dropped_scale += 1
            continue
        sat[key] = raw

    with io.open(a.base, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        columns = reader.fieldnames or []
        rows = list(reader)

    filled = 0
    kept = 0
    changed = []
    for row in rows:
        value = sat.get((norm(row.get("훈련과정 ID")), norm(row.get("회차"))))
        current = norm(row.get("만족도"))
        has_value = current not in ("", "0")

        if has_value and not a.refresh:
            kept += 1
            # 덮지는 않지만, 값이 움직였는지는 세어 둔다 — 드리프트를 보는 창이다.
            if value and abs(float(value) - float(current)) >= 0.05:
                changed.append((row.get("고유값"), current, value))
            continue

        if not value:
            if has_value:
                kept += 1
            continue

        if has_value:
            if abs(float(value) - float(current)) >= 0.05:
                changed.append((row.get("고유값"), current, value))
            else:
                kept += 1
                continue

        if not a.dry_run:
            row["만족도"] = value
        filled += 1

    if not a.dry_run:
        with io.open(a.out, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)

    print(f"만족도 수집 {len(sat_rows)}행 → 유효 {len(sat)}건")
    if dropped_scale:
        print(f"  [!] 5점 초과라 버린 행 {dropped_scale}건 (100점 척도 혼입)")
    mode = "덮어쓰기" if a.refresh else "빈칸만"
    tail = " (dry-run — 파일 안 씀)" if a.dry_run else f" → {a.out}"
    print(f"[{mode}] 기존 유지 {kept}행 · 반영 {filled}행 · 전체 {len(rows)}행{tail}")
    if changed:
        print(f"  값이 움직인 행 {len(changed)}건" +
              ("" if a.refresh else " (덮지 않음 — --refresh 로 반영 가능)"))
        for k, before, after in changed[:5]:
            print(f"    {k}: {before} → {after}")


if __name__ == "__main__":
    main()
