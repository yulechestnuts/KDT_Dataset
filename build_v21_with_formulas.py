# -*- coding: utf-8 -*-
"""
Ver.2.1 을 '원본과 같은 수식 구조'로 다시 만든다.

원본 Sheet1 은 전부 INDEX/MATCH 수식으로 소스 시트를 참조하는 뷰다.
    만족도 = INDEX(k_digital_training_1_260805!L:L, MATCH(A2, ...!AB:AB, 0))
값으로 고정해 버리면 이후 소스 시트를 고쳐도 Sheet1 이 따라오지 않는다.
그래서 Sheet1 은 반드시 수식으로 유지한다.

수식만 쓰면 안 되는 이유
------------------------
수식만 쓰고 저장하면 캐시된 계산 결과가 없어서, 엑셀에서 한 번 열어 재계산하기
전까지 pandas/업로드 파이프라인이 전부 빈 값을 읽는다 (openpyxl 로 저장했을 때
실측: Sheet1 100% 결측). xlsxwriter 의 write_formula 는 수식과 캐시값을 함께
쓸 수 있어서, 수식 구조와 즉시 읽기를 둘 다 만족시킨다.

하는 일
-------
  1) 소스 시트를 값으로 싣고
       k_digital_training_1_260805 L열  <- 회차별 만족도(5점)
       K_Digital_Training_3_260805 C/D/E/F <- 비어 있던 3·6개월 취업 통계
  2) Sheet1 은 원본의 수식을 행별로 이식해 쓰고, 캐시값은 새로 계산한 값을 넣는다
"""

import argparse
import csv
import os
import sys

import pandas as pd
from openpyxl import load_workbook
from openpyxl.formula.translate import Translator

MAIN = "Sheet1"
SRC1 = "k_digital_training_1_260805"
SRC3 = "K_Digital_Training_3_260805"

EMP_COLS = {
    "3개월 취업률": "3개월 고용보험 취업률(%)",
    "3개월 취업인원": "3개월 고용보험 취업인원",
    "6개월 취업률": "6개월 고용보험 취업률(%)",
    "6개월 취업인원": "6개월 고용보험 취업인원",
}


# 소스가 비어 있을 때 0 이 아니라 빈칸이 되도록 가드를 씌운 수식.
#
# 원본은 =INDEX(...) 형태라 참조 셀이 비면 엑셀이 0 을 돌려준다. 만족도가 늘
# 채워져 있던 예전에는 문제가 없었지만, 지금은 미집계 회차를 의도적으로 비워
# 두므로 그대로 두면 '만족도 0점'으로 읽힌다. 취업률도 마찬가지다.
# 참조 대상과 계산식은 원본 그대로이고, 바깥에 IF(...="","",...) 만 덧댔다.
S1 = "k_digital_training_1_260805"
S3 = "K_Digital_Training_3_260805"
_M1 = "MATCH(A{r}, %s!AB:AB, 0)" % S1
_M3 = "MATCH(A{r}, %s!S:S, 0)" % S3

FORMULA_OVERRIDE = {
    "만족도":
        "=IFERROR(IF(INDEX({s1}!L:L, {m1})=\"\",\"\",INDEX({s1}!L:L, {m1})),\"\")",
    "취업인원 (3개월)":
        "=IFERROR(IF(INDEX({s3}!D:D, {m3})=\"\",\"\",INDEX({s3}!D:D, {m3})),\"\")",
    # 취업률/수료율은 0~100(백분율)로 낸다.
    # 대시보드가 targetPop = 취업인원 / (취업률/100) 로 역산하고,
    # 매출 보정계수도 수료율 100/75/50 을 임계값으로 쓴다. 비율(0~1)을 주면
    # 분모가 100배로 튀고(예: 8,031 -> 803,102) 보정계수는 늘 0.75 로 눌린다.
    # 엑셀 화면의 % 표기는 값이 아니라 셀 서식으로 처리한다.
    "취업률 (3개월)":
        "=IFERROR(IF(INDEX({s3}!C:C, {m3})=\"\",\"\",INDEX({s3}!C:C, {m3})),\"\")",
    "취업인원 (6개월)":
        "=IFERROR(IF(INDEX({s3}!F:F, {m3})=\"\",\"\","
        "INDEX({s3}!F:F, {m3})+N(INDEX({s3}!H:H, {m3}))),\"\")",
    "취업률 (6개월)":
        "=IFERROR(IF(INDEX({s3}!E:E, {m3})=\"\",\"\","
        "INDEX({s3}!E:E, {m3}) + N(INDEX({s3}!G:G, {m3}))),\"\")",
    "수료율":
        "=IFERROR(IF(O{r}=0,\"\",P{r}/O{r}*100),\"\")",
}


def override_formula(name, row):
    tpl = FORMULA_OVERRIDE.get(name)
    if tpl is None:
        return None
    return tpl.format(s1=S1, s3=S3, r=row,
                      m1=_M1.format(r=row), m3=_M3.format(r=row))


def norm_key(ids, rounds):
    a = ids.astype(str).str.strip()
    b = pd.to_numeric(rounds, errors="coerce")
    return [(x, str(int(y))) if pd.notna(y) else None for x, y in zip(a, b)]


def read_csv_map(path, value_cols):
    """(훈련과정ID, 회차) -> {col: float}"""
    out = {}
    if not path or not os.path.exists(path):
        return out
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            cid = str(r.get("훈련과정 ID") or r.get("훈련과정ID")).strip()
            tme = r.get("회차")
            if not cid or tme in (None, ""):
                continue
            vals = {}
            for c in value_cols:
                v = r.get(c)
                if v not in (None, ""):
                    try:
                        vals[c] = float(v)
                    except ValueError:
                        pass
            if vals:
                out[(cid, str(int(float(tme))))] = vals
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--xlsx", required=True, help="원본 Ver.2.0 (수식 원형)")
    p.add_argument("--sat-csv", required=True)
    p.add_argument("--emp-csv", default="")
    p.add_argument("--output", required=True)
    a = p.parse_args()

    if os.path.abspath(a.output) == os.path.abspath(a.xlsx):
        print("원본과 출력 경로가 같습니다.", file=sys.stderr)
        sys.exit(1)

    sat = read_csv_map(a.sat_csv, ["만족도(5점)"])
    emp = read_csv_map(a.emp_csv, list(EMP_COLS))
    print("만족도 %d건 / 취업 %d건" % (len(sat), len(emp)))

    # ── 1) 값 시트 준비 ──
    book = pd.read_excel(a.xlsx, sheet_name=None)

    src1 = book[SRC1]
    k1 = norm_key(src1["훈련과정ID"], src1["훈련과정 순차"])
    src1["만족도 점수"] = [
        (sat.get(k) or {}).get("만족도(5점)") if k else None for k in k1
    ]
    print("%s L열: %d행" % (SRC1, int(src1["만족도 점수"].notna().sum())))

    src3 = book[SRC3]
    k3 = norm_key(src3["훈련과정ID"], src3["훈련과정 회차"])
    filled = {c: 0 for c in EMP_COLS.values()}
    for csv_col, sheet_col in EMP_COLS.items():
        cur = pd.to_numeric(src3[sheet_col], errors="coerce")
        new = []
        for i, k in enumerate(k3):
            v = cur.iat[i]
            # 비어 있거나 0 인 칸만 채운다. 실제로 조사된 0 을 덮지 않도록
            # API 값이 있을 때만 대체한다.
            if k and (pd.isna(v) or v == 0):
                got = (emp.get(k) or {}).get(csv_col)
                if got is not None:
                    filled[sheet_col] += 1
                    new.append(got)
                    continue
            new.append(v)
        src3[sheet_col] = new
    for c, n in filled.items():
        print("  %s: %d칸 신규" % (c, n))

    # 빈 Unnamed 컬럼은 용량만 차지한다
    for name, df in book.items():
        empty = [c for c in df.columns
                 if str(c).startswith("Unnamed") and df[c].isna().all()]
        if empty:
            book[name] = df.drop(columns=empty)

    # ── 2) Sheet1 원본 수식 확보 ──
    wb = load_workbook(a.xlsx)
    ws = wb[MAIN]
    headers = [c.value for c in ws[1]]
    proto = {}      # 컬럼 인덱스 -> (원본셀좌표, 수식문자열)
    for idx, cell in enumerate(ws[2]):
        if isinstance(cell.value, str) and cell.value.startswith("="):
            proto[idx] = (cell.coordinate, cell.value)
    wb.close()
    print("Sheet1 수식 컬럼: %d / %d" % (len(proto), len(headers)))

    main_df = book[MAIN]
    if list(main_df.columns)[: len(headers)] != [h for h in headers][: len(headers)]:
        print("경고: Sheet1 헤더가 원본과 다릅니다", file=sys.stderr)

    # ── 캐시값을 '수식이 읽는 바로 그 소스'에서 전부 다시 계산한다 ──
    #
    # 원본 Ver.2.0 은 소스 시트만 갱신되고 엑셀 재계산 없이 저장돼 있어서,
    # Sheet1 의 캐시값이 소스와 어긋나 있었다 (수료인원 370행, 수강신청 141행).
    # 그 낡은 캐시를 그대로 옮기면 수료율 207%, 1025% 같은 값이 나온다.
    #   AIG20220000409455 12회차 : 소스 수료 26 -> 캐시 58 -> 수료율 207%
    # 그래서 조회 컬럼은 전부 소스에서 다시 뽑는다. 수식과 캐시가 항상 일치한다.
    src2 = book["k_digital_training_2_260805"]

    def lut(df, key_col, val_col):
        k = df[key_col].astype(str).str.strip()
        return dict(zip(k, df[val_col]))

    # (Sheet1 컬럼) -> (소스 df, 키 컬럼, 값 컬럼)
    LOOKUPS = [
        ("과정명",          src1, "고유값", "제목"),
        ("훈련과정 ID",     src1, "고유값", "훈련과정ID"),
        ("회차",            src1, "고유값", "훈련과정 순차"),
        ("훈련기관",        src1, "고유값", "부 제목"),
        ("과정시작일",      src1, "고유값", "훈련시작일자"),
        ("과정종료일",      src1, "고유값", "훈련종료일자"),
        ("정원",            src1, "고유값", "정원"),
        ("지역",            src1, "고유값", "주소"),
        ("과정페이지 링크", src1, "고유값", "부 제목 링크"),
        ("만족도",          src1, "고유값", "만족도 점수"),
        ("총 훈련일수",     src2, "고유값", "훈련일수"),
        ("총 훈련시간",     src2, "고유값", "총 훈련시간"),
        ("NCS명",           src2, "고유값", "NCS 명"),
        ("NCS코드",         src2, "고유값", "NCS 코드"),
        ("훈련비",          src2, "고유값", "실제 훈련비"),
        ("자비부담금",      src2, "고유값", "수강료"),
        ("주소",            src2, "고유값", "주소지"),
        ("수강신청 인원",   src3, "열1",    "수강인원"),
        ("수료인원",        src3, "열1",    "수료인원"),
    ]

    uids = main_df["고유값"].astype(str).str.strip()
    for main_col, df, key_col, val_col in LOOKUPS:
        if main_col not in main_df.columns:
            print("  건너뜀(Sheet1 에 없음): %s" % main_col, file=sys.stderr)
            continue
        if key_col not in df.columns or val_col not in df.columns:
            print("  건너뜀(소스에 없음): %s <- %s" % (main_col, val_col), file=sys.stderr)
            continue
        m = lut(df, key_col, val_col)
        main_df[main_col] = [m.get(u) for u in uids]

    # k3 에 행은 있는데 '수강인원'이 빈칸인 회차가 141건 있다. 전부 수료인원 0 인
    # 미개설 회차이고, k3 의 수강(신청)인원과 k1 의 수강신청 인원도 0 으로 기록돼
    # 있다. 빈칸으로 두면 '수료인원은 있는데 수강신청 인원이 없는 행'으로 잡히므로
    # 확정 인원 0 명으로 채운다. 수료율은 분모 0 이라 그대로 빈칸이 된다.
    in_k3 = set(src3["열1"].astype(str).str.strip())
    main_df["수강신청 인원"] = [
        (0 if (u in in_k3 and pd.isna(v)) else v)
        for u, v in zip(uids, main_df["수강신청 인원"])
    ]

    # 취업 컬럼: 수식과 동일하게 (6개월은 고용보험 + 미가입 합산)
    def col3(name):
        k = src3["열1"].astype(str).str.strip()
        return dict(zip(k, pd.to_numeric(src3[name], errors="coerce")))
    c3 = col3("3개월 고용보험 취업률(%)")
    d3c = col3("3개월 고용보험 취업인원")
    e3 = col3("6개월 고용보험 취업률(%)")
    f3 = col3("6개월 고용보험 취업인원")
    g3 = col3("6개월 고용보험 미가입 취업률(%)")
    h3 = col3("6개월 고용보험 미가입 취업인원")

    def blank(v):
        return None if v is None or pd.isna(v) else float(v)

    def n(v):          # 엑셀 N(): 빈칸은 0
        return 0.0 if v is None or pd.isna(v) else float(v)

    main_df["취업인원 (3개월)"] = [blank(d3c.get(u)) for u in uids]
    main_df["취업률 (3개월)"] = [blank(c3.get(u)) for u in uids]
    main_df["취업인원 (6개월)"] = [
        None if blank(f3.get(u)) is None else blank(f3.get(u)) + n(h3.get(u)) for u in uids
    ]
    main_df["취업률 (6개월)"] = [
        None if blank(e3.get(u)) is None else blank(e3.get(u)) + n(g3.get(u)) for u in uids
    ]

    # 수료율 = 수료인원 / 수강신청 인원 * 100 (0~100 척도)
    enr = pd.to_numeric(main_df["수강신청 인원"], errors="coerce")
    fin = pd.to_numeric(main_df["수료인원"], errors="coerce")
    main_df["수료율"] = [
        None if (pd.isna(o) or o == 0 or pd.isna(f)) else float(f) / float(o) * 100.0
        for o, f in zip(enr, fin)
    ]

    over = int((pd.to_numeric(main_df["수료율"], errors="coerce") > 100).sum())
    print("재계산 후 수료율 > 100%%: %d행" % over)

    # ── 3) 쓰기 ──
    import xlsxwriter  # noqa: F401
    with pd.ExcelWriter(a.output, engine="xlsxwriter",
                        datetime_format="yyyy-mm-dd") as w:
        for name, df in book.items():
            if name == MAIN:
                continue
            df.to_excel(w, sheet_name=name, index=False)

        wsx = w.book.add_worksheet(MAIN)
        w.sheets[MAIN] = wsx
        for c, h in enumerate(main_df.columns):
            wsx.write(0, c, h)

        date_fmt = w.book.add_format({"num_format": "yyyy-mm-dd"})
        # 값은 0~100 이지만 화면에는 %로 보이게 한다.
        # 값 자체를 0~1 로 두면 대시보드 산식이 깨진다.
        pct_fmt = w.book.add_format({"num_format": '0.0"%"'})
        PCT_COLS = {"수료율", "취업률 (3개월)", "취업률 (6개월)"}
        nrows = len(main_df)
        for r in range(nrows):
            for c, col in enumerate(main_df.columns):
                val = main_df.iat[r, c]
                cached = None if pd.isna(val) else val
                if c in proto:
                    ov = override_formula(str(col), r + 2)
                    if ov is not None:
                        formula = ov
                    else:
                        _, f0 = proto[c]
                        formula = Translator(f0, origin="%s2" % _col_letter(c)) \
                            .translate_formula("%s%d" % (_col_letter(c), r + 2))
                    if cached is None:
                        # 빈 값은 0 이 아니라 빈 문자열로 캐시한다.
                        # 0 으로 넣으면 '만족도 0점' / '취업률 0%' 로 오독된다.
                        wsx.write_formula(
                            r + 1, c, formula,
                            pct_fmt if str(col) in PCT_COLS else None, "")
                        continue
                    if isinstance(cached, pd.Timestamp):
                        # 날짜 수식의 캐시값은 엑셀 일련번호(숫자)여야 한다.
                        # Timestamp 를 그대로 넘기면 문자열로 기록돼, 셀 타입은
                        # 숫자인데 내용은 '2021-01-04 00:00:00' 이 되어 읽기가 깨진다.
                        wsx.write_formula(r + 1, c, formula, date_fmt,
                                          _excel_serial(cached))
                    else:
                        wsx.write_formula(
                            r + 1, c, formula,
                            pct_fmt if str(col) in PCT_COLS else None, cached)
                elif cached is None:
                    pass
                elif isinstance(val, pd.Timestamp):
                    wsx.write_datetime(r + 1, c, val.to_pydatetime(), date_fmt)
                else:
                    wsx.write(r + 1, c, cached)

    print("저장: %s (%.1f MB)" % (a.output, os.path.getsize(a.output) / 1024 / 1024))


def _excel_serial(ts):
    """Timestamp -> 엑셀 일련번호. 엑셀의 1900 윤년 버그 때문에 기준일이 1899-12-30."""
    base = pd.Timestamp("1899-12-30")
    delta = ts - base
    return delta.days + delta.seconds / 86400.0


def _col_letter(idx):
    s = ""
    idx += 1
    while idx:
        idx, rem = divmod(idx - 1, 26)
        s = chr(65 + rem) + s
    return s


if __name__ == "__main__":
    main()
