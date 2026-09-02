# -*- coding: utf-8 -*-
"""
회차별 만족도를 반영한 최종 엑셀을 만든다.

왜 '값만' 쓰는가
----------------
원본 Sheet1 은 전부 수식이다.
    만족도 = INDEX(k_digital_training_1_260805!L:L, MATCH(A2, ...!AB:AB, 0))
그래서 소스 시트의 L열만 고치면 Sheet1 이 따라오는 구조인데, openpyxl 로
셀만 갈아끼우고 저장하면 워크북 전체의 수식 캐시값이 사라진다 (실측: 저장 후
Sheet1 을 pandas 로 읽으면 100% 결측, 크기도 15.6MB -> 56MB). 엑셀에서 한 번
열어 재계산하지 않으면 업로드 파이프라인이 전부 빈 값을 읽는다.

그래서 모든 시트를 '계산된 값'으로 고정해 내보낸다. 수식 구조가 필요하면
원본(Ver.2.0)에 그대로 남아 있으니 거기서 다시 만들면 된다.

무엇을 바꾸는가
---------------
  k_digital_training_1_260805  L열 '만족도 점수'  <- 회차별 5점 실측
  Sheet1                       '만족도'           <- 같은 값
실측이 없는 회차는 값을 비운다. 0 이나 옛 100점 통합값으로 메우지 않는다.
사유 컬럼 등 부가 컬럼은 넣지 않는다 - 실제 있는 값만 남긴다.
"""

import argparse
import csv
import os
import sys

import pandas as pd

MAIN_SHEET = "Sheet1"
SRC_SHEET = "k_digital_training_1_260805"


def load_sat(path):
    """(훈련과정 ID, 회차) -> 5점 만족도"""
    out = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            v = r.get("만족도(5점)")
            if v in (None, ""):
                continue
            out[(str(r["훈련과정 ID"]).strip(), str(int(float(r["회차"]))))] = float(v)
    return out


def key_series(ids, rounds):
    a = ids.astype(str).str.strip()
    b = pd.to_numeric(rounds, errors="coerce")
    return [
        (x, str(int(y))) if pd.notna(y) else None
        for x, y in zip(a, b)
    ]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--xlsx", required=True, help="원본 (수정하지 않음)")
    p.add_argument("--csv", required=True)
    p.add_argument("--output", required=True)
    a = p.parse_args()

    if os.path.abspath(a.output) == os.path.abspath(a.xlsx):
        print("원본과 출력 경로가 같습니다.", file=sys.stderr)
        sys.exit(1)

    sat = load_sat(a.csv)
    print("회차별 실측: %d건" % len(sat))

    # 캐시된 계산 결과를 읽는다 (수식 문자열이 아니라 값)
    book = pd.read_excel(a.xlsx, sheet_name=None)
    print("시트: %s" % list(book))

    # ── 소스 시트 L열 ──
    src = book[SRC_SHEET]
    keys = key_series(src["훈련과정ID"], src["훈련과정 순차"])
    src["만족도 점수"] = [sat.get(k) if k else None for k in keys]
    hit_src = src["만족도 점수"].notna().sum()
    print("%s L열: %d / %d행" % (SRC_SHEET, hit_src, len(src)))

    # ── Sheet1 ──
    main_df = book[MAIN_SHEET]
    keys2 = key_series(main_df["훈련과정 ID"], main_df["회차"])
    main_df["만족도"] = [sat.get(k) if k else None for k in keys2]
    hit_main = main_df["만족도"].notna().sum()
    print("%s 만족도: %d / %d행" % (MAIN_SHEET, hit_main, len(main_df)))

    if hit_src != hit_main:
        print("경고: 두 시트의 실측 건수가 다릅니다 (%d vs %d)" % (hit_src, hit_main),
              file=sys.stderr)

    # 이전 실행에서 붙었을 수 있는 부가 컬럼 제거 - 실제 값만 남긴다
    drop = ["만족도_미집계사유", "평가인원", "평가참여율", "추천인원",
            "추천응답인원", "설문대상인원", "만족도(회차별100점)", "만족도_출처"]
    for name, df in book.items():
        gone = [c for c in drop if c in df.columns]
        if gone:
            book[name] = df.drop(columns=gone)
            print("  %s 에서 제거: %s" % (name, gone))

    # 완전히 빈 Unnamed 컬럼은 용량만 차지한다
    for name, df in book.items():
        empty = [c for c in df.columns
                 if str(c).startswith("Unnamed") and df[c].isna().all()]
        if empty:
            book[name] = df.drop(columns=empty)
            print("  %s 에서 빈 컬럼 %d개 제거" % (name, len(empty)))

    engine = "xlsxwriter"
    try:
        import xlsxwriter  # noqa: F401
    except ImportError:
        engine = "openpyxl"
        print("xlsxwriter 없음 -> openpyxl 사용 (용량이 커질 수 있음)")

    with pd.ExcelWriter(a.output, engine=engine) as w:
        for name, df in book.items():
            df.to_excel(w, sheet_name=name, index=False)

    print("저장: %s (%.1f MB)" % (a.output, os.path.getsize(a.output) / 1024 / 1024))


if __name__ == "__main__":
    main()
