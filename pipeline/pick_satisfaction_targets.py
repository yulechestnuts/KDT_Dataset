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
    p.add_argument("--max-days", type=int, default=400,
                   help="종료 후 이 일수를 넘도록 비어 있으면 포기 (기본 400일)")
    p.add_argument("--min-days", type=int, default=0,
                   help="종료 후 최소 이 일수는 지나야 조회 (기본 0)")
    a = p.parse_args()

    today = date.today()
    with io.open(a.input, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    targets = []
    reasons = {"이미있음": 0, "미종료": 0, "너무오래됨": 0, "종료일없음": 0}
    for r in rows:
        if str(r.get("만족도") or "").strip() not in ("", "0"):
            reasons["이미있음"] += 1
            continue
        end = parse_date(r.get("과정종료일"))
        if end is None:
            reasons["종료일없음"] += 1
            continue
        if end > today - timedelta(days=a.min_days):
            reasons["미종료"] += 1
            continue
        if end < today - timedelta(days=a.max_days):
            reasons["너무오래됨"] += 1
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
    print("  제외: " + " · ".join(f"{k} {v}" for k, v in reasons.items()))


if __name__ == "__main__":
    main()
