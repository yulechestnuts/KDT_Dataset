# -*- coding: utf-8 -*-
"""만족도를 새로 긁어올 가치가 있는 과정만 골라낸다.

전량을 긁으면 과정당 최소 2회 요청(회차 목록 + 회차별 조회)이라 오래 걸린다.
그런데 대부분은 이미 값이 있거나, 아직 값이 **존재하지 않는다.**

실측(2026-09-17, 2026년 개강분):
    종료 60일 초과  94.9% 채움
    종료 60일 이내  63.5%
    진행/예정        0.0%   (750건)

즉 빈칸 대부분은 "아직 안 나온 것"이다. 그래서 고르는 조건은:
    ① 만족도가 비어 있고
    ② 이미 종료했고
    ③ 종료한 지 너무 오래되지 않았다 (오래됐는데도 비면 앞으로도 안 나온다)

③ 의 상한을 두는 이유: 2021~2023 의 빈칸을 매일 다시 긁어봐야 계속 빈칸이다.
포기 기준을 두지 않으면 영원히 같은 과정을 재시도한다.

★ 만족도는 종료 후 한 달이면 고정된다 (2026-09-17 실측)
   같은 (과정, 회차)를 다시 받아 DB 와 대조한 결과:
       종료 후 16~20일   25건 중 13건 다름 (52%), 최대 1.30
       종료 후 30~50일    8건 중  0건
       종료 후 60~120일   8건 중  0건
       종료 후 180~400일  8건 중  0건
       종료 후 400일+     8건 중  0건
   즉 값이 움직이는 구간은 **종료 직후 한 달**뿐이고, 그 뒤로는 한 건도 안 바뀐다.
   (사용자 확인: 설문이 3주~한 달 사이에 마감된다)

   그래서 조회 대상이 둘로 갈린다.
     · 갱신 창 (종료 후 <= fresh-days) — 값이 있어도 다시 받는다. 아직 확정 전이다.
     · 보충 창 (값이 비었고 종료 후 <= backfill-days) — 뒤늦게 올라오는 것만 줍는다.
   그 밖은 조회 자체가 낭비다.
"""
import argparse
import csv
import io
import sys
from datetime import date, datetime, timedelta

for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8")


def parse_date(value):
    text = str(value or "").strip()[:10]
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True, help="collect.py 결과 CSV")
    p.add_argument("--out", required=True)
    p.add_argument("--fresh-days", type=int, default=35,
                   help="종료 후 이 일수 이내면 값이 있어도 다시 받는다 (기본 35일)")
    p.add_argument("--backfill-days", type=int, default=120,
                   help="값이 비었을 때 이 일수까지는 계속 시도한다 (기본 120일)")
    a = p.parse_args()

    today = date.today()
    with io.open(a.input, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    targets = []
    reasons = {"미종료": 0, "고정됨(안봄)": 0, "보충기한초과": 0, "종료일없음": 0}
    fresh = backfill = 0
    for r in rows:
        has_value = str(r.get("만족도") or "").strip() not in ("", "0")
        end = parse_date(r.get("과정종료일"))
        if end is None:
            reasons["종료일없음"] += 1
            continue
        days = (today - end).days
        if days < 0:
            reasons["미종료"] += 1
            continue

        if days <= a.fresh_days:
            fresh += 1                      # 갱신 창 — 값이 있어도 다시 받는다
        elif not has_value and days <= a.backfill_days:
            backfill += 1                   # 보충 창 — 뒤늦게 올라오는 것만
        elif has_value:
            reasons["고정됨(안봄)"] += 1
            continue
        else:
            reasons["보충기한초과"] += 1
            continue

        targets.append({
            "훈련과정 ID": str(r.get("훈련과정 ID") or "").strip(),
            "회차": str(r.get("회차") or "").strip(),
            "과정명": str(r.get("과정명") or "").strip(),
            "과정종료일": str(r.get("과정종료일") or "").strip(),
        })

    # 같은 과정의 여러 회차는 수집기가 한 번에 처리하므로 과정 단위로 줄여도 되지만,
    # 회차 정보를 남겨 두면 결과 조인이 쉬워 그대로 둔다.
    with io.open(a.out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["훈련과정 ID", "회차", "과정명", "과정종료일"])
        w.writeheader()
        w.writerows(targets)

    courses = len({t["훈련과정 ID"] for t in targets})
    print(f"전체 {len(rows)}행 → 대상 {len(targets)}행 (과정 {courses}개)")
    print(f"  갱신 창(종료 {a.fresh_days}일 이내) {fresh}행 · 보충 창(빈칸, {a.backfill_days}일 이내) {backfill}행")
    print("  제외: " + " · ".join(f"{k} {v}" for k, v in reasons.items()))


if __name__ == "__main__":
    main()
