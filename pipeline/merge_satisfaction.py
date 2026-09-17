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

★ 언제 덮어야 하는가 — 시간이 정해 준다 (2026-09-17 실측)
   같은 (과정, 회차)를 다시 받아 DB 와 대조한 결과:
       종료 후 16~20일   25건 중 13건 다름 (52%), 최대 1.30
       종료 후 30~50일    8건 중  0건
       종료 후 60~120일   8건 중  0건
       종료 후 180~400일  8건 중  0건
       종료 후 400일+     8건 중  0건
   **값이 움직이는 구간은 종료 직후 한 달뿐이다.** 그 뒤로는 한 건도 안 바뀐다.
   (사용자 확인: 설문이 3주~한 달 사이에 마감된다)

   그래서 "덮을까 말까"는 사람이 고를 문제가 아니다.
     · 종료 후 <= refresh-days  → **덮는다.** 아직 확정 전이라 최신값이 맞다.
     · 그 뒤                     → **빈칸만 채운다.** 어차피 같으므로 덮을 일이 없고,
                                    다르다면 그건 이상 신호이므로 로그로 남긴다.
   `--refresh` 는 기간을 무시하고 전부 덮는 수동 탈출구다. `--dry-run` 으로 먼저 볼 것.
"""
import argparse
import csv
import io
import sys
from datetime import date, datetime

for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8")


def norm(value) -> str:
    return str(value or "").strip()


def days_since_end(value) -> int | None:
    """과정 종료 후 며칠 지났는지. 파싱 불가면 None."""
    text = norm(value)[:10]
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"):
        try:
            return (date.today() - datetime.strptime(text, fmt).date()).days
        except ValueError:
            continue
    return None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--base", required=True, help="collect.py 가 만든 CSV")
    p.add_argument("--satisfaction", required=True, help="만족도 수집 결과 CSV")
    p.add_argument("--out", required=True)
    p.add_argument("--refresh-days", type=int, default=35,
                   help="종료 후 이 일수 이내면 기존 값도 덮는다 (기본 35일)")
    p.add_argument("--refresh", action="store_true",
                   help="기간을 무시하고 전부 덮는다 (수동 탈출구)")
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

        days = days_since_end(row.get("과정종료일"))
        # 갱신 창 안이면 덮는다. 밖이면 빈칸만 채운다.
        in_window = a.refresh or (days is not None and days <= a.refresh_days)

        if has_value and not in_window:
            kept += 1
            # 덮지는 않지만, 값이 움직였는지는 세어 둔다.
            # 창 밖에서 값이 달라졌다면 그건 드리프트가 아니라 **이상 신호**다.
            if value and abs(float(value) - float(current)) >= 0.05:
                changed.append((row.get("고유값"), current, value, days))
            continue

        if not value:
            if has_value:
                kept += 1
            continue

        if has_value:
            if abs(float(value) - float(current)) >= 0.05:
                changed.append((row.get("고유값"), current, value, days))
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
    mode = "전부 덮어쓰기" if a.refresh else f"종료 {a.refresh_days}일 이내 덮어쓰기"
    tail = " (dry-run — 파일 안 씀)" if a.dry_run else f" → {a.out}"
    print(f"[{mode}] 기존 유지 {kept}행 · 반영 {filled}행 · 전체 {len(rows)}행{tail}")
    if changed:
        late = [c for c in changed if c[3] is not None and c[3] > a.refresh_days]
        print(f"  값이 움직인 행 {len(changed)}건")
        for k, before, after, d in changed[:5]:
            print(f"    {k}: {before} → {after} (종료 후 {d}일)")
        if late and not a.refresh:
            # 실측상 한 달 지나면 안 움직인다. 그런데 움직였다면 확인이 필요하다.
            print(f"  [!] 갱신 창({a.refresh_days}일) 밖인데 값이 달라진 행 {len(late)}건 — "
                  "확정 후에는 바뀌지 않아야 한다. 원인 확인 필요.")


if __name__ == "__main__":
    main()
