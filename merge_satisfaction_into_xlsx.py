# -*- coding: utf-8 -*-
"""
회차별 만족도를 KDT 고유 데이터 셋 엑셀의 '만족도' 컬럼에 반영한다.

방침
----
'만족도' 는 회차별 실측값 하나만 남긴다.
  - 값: work24 성과화면의 '평균만족도' = 조사영역 '전반적 만족도' (5점 척도)
  - 회차별 설문이 없는 행은 비운다. 과정 통합값으로 메우지 않는다.
    (그런 행은 대개 아직 종강 전이고, 통합값을 채우면 회차별 실측과 섞여
     "이 숫자가 이 회차 것인가"를 나중에 구분할 수 없게 된다.)

기존 '만족도'(100점 척도, 과정 단위 통합값)는 이 스크립트로 덮인다.
원본은 --inplace 를 주지 않는 한 건드리지 않으며, 줄 경우에도 백업을 먼저 뜬다.

세부항목(교강사/훈련환경 등 9종)은 CSV 에는 남지만 엑셀에는 넣지 않는다.
대표 점수 하나로 충분하다는 판단.
"""

import argparse
import os
import shutil
import sys
from datetime import datetime

import pandas as pd

SHEET = "Sheet1"
KEY = ["훈련과정 ID", "회차"]

# 엑셀에 실을 컬럼만 고른다. (CSV 의 9개 세부항목은 제외)
#   CSV 컬럼명 -> 엑셀 컬럼명
CARRY = {
    "만족도(5점)": "만족도",
    "평가인원": "평가인원",
    "평가참여율": "평가참여율",
    "추천인원": "추천인원",
    "추천응답인원": "추천응답인원",
    "수강인원": "설문대상인원",
}


def normalize_key(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["훈련과정 ID"] = df["훈련과정 ID"].astype(str).str.strip()
    # 엑셀은 int, CSV 는 str 이라 숫자로 맞춘다. '04' 같은 표기도 흡수된다.
    df["회차"] = pd.to_numeric(df["회차"], errors="coerce").astype("Int64")
    return df


def main() -> None:
    p = argparse.ArgumentParser(description="회차별 만족도를 엑셀에 반영")
    p.add_argument("--xlsx", required=True)
    p.add_argument("--csv", required=True)
    p.add_argument("--output", default="", help="기본: <원본>_회차별만족도.xlsx")
    p.add_argument("--inplace", action="store_true", help="원본을 덮어쓴다 (백업 후)")
    a = p.parse_args()

    sat = pd.read_csv(a.csv, encoding="utf-8-sig", dtype=str)
    missing = [c for c in CARRY if c not in sat.columns]
    if missing:
        print("CSV 에 없는 컬럼: %s" % missing, file=sys.stderr)
        sys.exit(1)

    sat = normalize_key(sat)[KEY + list(CARRY)]
    for c in CARRY:
        sat[c] = pd.to_numeric(sat[c], errors="coerce")
    sat = sat.rename(columns=CARRY)

    dup = int(sat.duplicated(subset=KEY).sum())
    if dup:
        print("경고: CSV 중복 키 %d건 — 첫 행만 사용" % dup, file=sys.stderr)
        sat = sat.drop_duplicates(subset=KEY, keep="first")

    book = pd.read_excel(a.xlsx, sheet_name=None)
    if SHEET not in book:
        print("'%s' 시트 없음: %s" % (SHEET, list(book)), file=sys.stderr)
        sys.exit(1)

    base = normalize_key(book[SHEET])
    old_sat = pd.to_numeric(base["만족도"], errors="coerce")

    # 기존 만족도(100점 통합값)를 버리고 회차별 실측으로 갈아끼운다.
    merged = base.drop(columns=["만족도"]).merge(sat, on=KEY, how="left")

    # '만족도' 를 원래 자리로 되돌린다 (컬럼 순서 유지)
    order = [c for c in base.columns if c != "만족도"]
    pos = list(base.columns).index("만족도")
    order.insert(pos, "만족도")
    order += [c for c in merged.columns if c not in order]
    merged = merged[order]

    n = len(merged)
    hit = int(merged["만족도"].notna().sum())
    print("행 %d 중 회차별 실측 %d행 (%.1f%%), 빈칸 %d행"
          % (n, hit, hit / n * 100, n - hit))
    print("만족도 척도: %.1f ~ %.1f (5점)"
          % (merged["만족도"].min(), merged["만족도"].max()))
    print("기존 100점 통합값이 있었으나 회차 실측이 없어 비워진 행: %d"
          % int((old_sat.notna() & merged["만족도"].isna()).sum()))

    # 설문의 수강인원과 엑셀의 수강신청 인원이 어긋나는 정도 — 참고용
    both = merged["설문대상인원"].notna() & merged["수강신청 인원"].notna()
    if both.any():
        diff = (merged.loc[both, "설문대상인원"] != merged.loc[both, "수강신청 인원"]).sum()
        print("설문대상인원 != 수강신청 인원: %d / %d행" % (int(diff), int(both.sum())))

    if a.inplace:
        out = a.xlsx
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        root, ext = os.path.splitext(a.xlsx)
        bak = "%s.backup_%s%s" % (root, stamp, ext)
        shutil.copy2(a.xlsx, bak)
        print("백업: %s" % bak)
    else:
        out = a.output or "%s_회차별만족도.xlsx" % os.path.splitext(a.xlsx)[0]

    book[SHEET] = merged
    with pd.ExcelWriter(out, engine="openpyxl") as w:
        for name, df in book.items():
            df.to_excel(w, sheet_name=name, index=False)

    print("저장: %s" % out)


if __name__ == "__main__":
    main()
