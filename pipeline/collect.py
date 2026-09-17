"""K-디지털 트레이닝 수집 통합 스크립트 (1번+2번+3번 대체)

기존 방식의 문제
----------------
1번(목록) → 2번(기관상세) → 3번(실적) 을 따로 돌려 CSV 3개를 만들고,
엑셀/시트에서 나란히 붙여 병합해 왔다. 그런데 2번·3번은 API 호출이 실패하면
`continue` 로 **그 행을 건너뛴다**. 즉 출력 행수가 입력 행수보다 적어진다.
행수가 다른 CSV 를 위치로 붙이면 실패 지점 이후 모든 행이 한 칸씩 밀린다.
=> 수료인원은 A과정 것, 취업인원/취업률은 B과정 것이 되는 오염이 생긴다.

이 스크립트의 원칙
------------------
1. 세 단계를 한 번의 실행으로 처리한다. 중간 CSV 를 손으로 붙이지 않는다.
2. 어떤 단계가 실패해도 **행을 삭제하지 않는다.** 값을 비우고 `수집상태`에 기록한다.
3. 모든 병합은 `고유값`(훈련과정ID+회차) 기준이다. 위치 병합은 어디에도 없다.
4. 기존 마스터의 수기 입력 컬럼(선도기업/파트너기관/매출/연도별 배분)은
   고유값으로 join 해서 보존한다.
5. 저장 전에 검증 리포트를 찍는다. `--strict` 면 이상이 있을 때 저장을 막는다.

사용법
------
    python K디지털_수집_통합.py --start 20210101 --end 20271231 \
        --master kdt_master.csv --out kdt_master_new.csv

    # 실적(수료/취업)만 갱신하고 싶을 때 — 목록 조회를 건너뛰고 마스터의 키를 재사용
    python K디지털_수집_통합.py --refresh-only --master kdt_master.csv --out kdt_master_new.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import requests

# 윈도우 콘솔 기본 코드페이지(cp949)에서 한글 로그가 깨지는 것을 막는다.
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

AUTH_KEY = os.environ.get("WORK24_AUTH_KEY", "da3974b2-e74e-42f1-8fc5-fb2ae0d938ea")
BASE = "https://www.work24.go.kr/cm/openApi/call/hr/"
LIST_API = BASE + "callOpenApiSvcInfo310L01.do"   # 1번: 과정 목록
INST_API = BASE + "callOpenApiSvcInfo310L02.do"   # 2번: 기관/과정 상세
PERF_API = BASE + "callOpenApiSvcInfo310L03.do"   # 3번: 실적(수료·취업)

# 마스터 시트 컬럼 순서. API 로 채우는 컬럼과 수기/계산 컬럼을 구분해 둔다.
API_COLUMNS = [
    "고유값", "과정명", "훈련과정 ID", "회차", "훈련기관",
    "총 훈련일수", "총 훈련시간", "과정시작일", "과정종료일",
    "NCS명", "NCS코드", "훈련비", "정원", "수강신청 인원", "수료인원", "수료율",
    "만족도", "취업인원 (3개월)", "취업률 (3개월)", "취업인원 (6개월)", "취업률 (6개월)",
    "지역", "주소", "과정페이지 링크",
]
# 만족도는 API_COLUMNS 자리에 있지만 **API 로 채우지 않는다.**
# 컬럼 순서를 바꾸면 기존 엑셀/시트와 어긋나므로 위치만 그대로 두고,
# 값은 마스터에서 그대로 승계한다. 정본은 크롤링(kdt_satisfaction_collector.py)
# 또는 회차탭(selectOtherTracseTmeTab.do) 이다.

# 마스터에만 있고 API 가 모르는 값. 절대 덮어쓰지 않고 고유값으로 join 해 가져온다.
MANUAL_COLUMNS = [
    "선도기업", "파트너기관", "매출 최소", "실 매출 대비", "매출 최대",
    "2021년", "2022년", "2023년", "2024년", "2025년", "2026년", "2027년",
    "자비부담금",
]
# 수집 품질 추적용. 마스터에 없으면 새로 붙는다.
AUDIT_COLUMNS = ["수집상태", "수집일시"]

OUT_COLUMNS = API_COLUMNS + MANUAL_COLUMNS + AUDIT_COLUMNS


# ──────────────────────────────────────────────────────────────────────
# 공통 유틸
# ──────────────────────────────────────────────────────────────────────

def make_key(trpr_id: str, degr: Any) -> str:
    """기존 마스터와 동일한 고유값 규칙: 훈련과정ID + 회차 (구분자 없음).

    훈련과정ID 가 고정 길이(AIG + 15자리)라 회차가 몇 자리든 충돌하지 않는다.
    규칙을 바꾸면 기존 마스터와 join 이 깨지므로 그대로 유지한다.
    """
    return f"{str(trpr_id).strip()}{int(str(degr).strip())}"


def torg_id_from_link(link: str | None) -> str:
    """과정페이지 링크에서 훈련기관ID(trainstCstmrId)를 뽑는다.

    마스터에 훈련기관ID 컬럼이 따로 없어서, 2단계 API 호출에 필요한 값을
    링크에서 복원한다. 없으면 빈 문자열 — 이 경우 기관상세만 건너뛴다.
    """
    match = re.search(r"trainstCstmrId=(\d+)", link or "")
    return match.group(1) if match else ""


def to_int(value: Any) -> int | None:
    if value is None:
        return None
    s = re.sub(r"[^0-9\-]", "", str(value))
    return int(s) if s not in ("", "-") else None


def to_float(value: Any) -> float | None:
    """'B' 같은 비수치 마커는 None 으로 떨군다.

    work24 는 아직 6개월 취업률 집계 전인 과정에 eiEmplRate6='B' 를 내려주고
    eiEmplCnt6 요소 자체를 생략한다. 즉 'B' 는 오류가 아니라 '집계 전' 신호다.
    """
    if value is None:
        return None
    s = re.sub(r"[^0-9.\-]", "", str(value))
    try:
        return float(s) if s not in ("", "-", ".") else None
    except ValueError:
        return None


def pct(value: float | None) -> str:
    return "" if value is None else f"{value:.2f}%"


def request_with_retry(url: str, params: dict, *, retries: int = 4,
                       timeout: int = 20) -> requests.Response | None:
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=timeout)
            if resp.status_code == 200:
                return resp
        except requests.RequestException:
            pass
        time.sleep(0.8 * (attempt + 1))
    return None


# ──────────────────────────────────────────────────────────────────────
# 1단계: 과정 목록 (310L01)
# ──────────────────────────────────────────────────────────────────────

def fetch_course_list(start_date: str, end_date: str, page_size: int = 100) -> list[dict]:
    """기간 내 K-디지털 트레이닝(C0104) 과정 목록.

    2·3단계 호출에 필요한 (훈련과정ID, 회차, 훈련기관ID) 를 여기서 확보한다.
    한 페이지라도 실패하면 목록이 통째로 어긋나므로 예외를 던져 중단한다.
    """
    courses: list[dict] = []
    page = 1
    while True:
        params = {
            "authKey": AUTH_KEY, "returnType": "JSON", "outType": "2",
            "pageNum": str(page), "pageSize": str(page_size),
            "srchTraStDt": start_date, "srchTraEndDt": end_date,
            "sort": "ASC", "sortCol": "TRNG_BGDE", "crseTracseSe": "C0104",
        }
        resp = request_with_retry(LIST_API, params)
        if resp is None:
            raise RuntimeError(f"목록 API 실패 (page {page}). 부분 결과로 진행하면 "
                               f"이후 병합이 어긋나므로 중단합니다.")
        items = resp.json().get("srchList") or []
        if not items:
            break
        for item in items:
            if item.get("trainTargetCd") != "C0104":
                continue
            courses.append({
                "훈련과정 ID": item.get("trprId", ""),
                "회차": item.get("trprDegr", ""),
                "훈련기관ID": item.get("trainstCstId", ""),
                # 만족도는 여기서 가져오지 않는다. 목록 API 의 stdgScor 는
                #   (1) 100점 척도이고 (DB 는 5점 척도, 최대 정확히 5.0)
                #   (2) 과정 단위 평균이라 한 과정의 모든 회차에 같은 값이 박힌다.
                # 2026-09-17 실측: 이 값으로 채우면 여러 회차 과정 36개가 36개 모두
                # 전 회차 동일값이 된다. 현재 DB 는 1,020개 중 939개가 회차마다 다르다
                # (동일값 1.6%). 덮어쓰면 만족도가 20배가 되고 회차별 실값이 사라진다.
                "지역": item.get("address", ""),
                "과정페이지 링크": item.get("titleLink", ""),
                "훈련비": item.get("realMan", ""),
            })
        print(f"  목록 page {page}: 누적 {len(courses)}건")
        page += 1
    return courses


# ──────────────────────────────────────────────────────────────────────
# 2단계: 기관/과정 상세 (310L02)
# ──────────────────────────────────────────────────────────────────────

def fetch_institution(trpr_id: str, degr: Any, torg_id: str) -> dict | None:
    params = {"authKey": AUTH_KEY, "returnType": "JSON", "outType": "2",
              "srchTrprId": trpr_id, "srchTrprDegr": str(degr), "srchTorgId": torg_id}
    resp = request_with_retry(INST_API, params)
    if resp is None:
        return None
    try:
        payload = resp.json()
    except ValueError:
        return None
    info = payload.get("inst_base_info")
    if not info:
        return None

    out = {
        "훈련기관": info.get("inoNm", ""),
        "주소": info.get("addr1", ""),
        "NCS명": info.get("ncsNm", ""),
        "NCS코드": info.get("ncsCd", ""),
        "총 훈련일수": info.get("trDcnt", ""),
        "총 훈련시간": info.get("trtm", ""),
        "과정명": info.get("trprNm", ""),
    }

    # 자비부담금은 inst_base_info 가 아니라 **inst_detail_info** 에 있다
    # (`tgcrGnrlTrneOwepAllt`). 추가 호출 없이 같은 응답에서 나온다.
    #
    # 왜 중요한가: 사이트의 AI캠퍼스 판정이 "자비부담금 0원"을 쓰는데,
    # 지금 DB 는 7,230행 중 6,480행이 "0" 이고 그건 무료가 아니라 **미수집**이다.
    # 그래서 판정에 `AIG 연도 >= 2026` 이라는 반창고가 붙어 있다.
    # 이 값을 제대로 채우면 그 반창고를 뗄 수 있다.
    #
    # 0 은 "무료"라는 실제 값이므로 반드시 살려 보낸다 — 빈값일 때만 뺀다.
    detail = payload.get("inst_detail_info") or {}
    own = detail.get("tgcrGnrlTrneOwepAllt")
    if own is not None and str(own).strip() != "":
        out["자비부담금"] = own

    return out


# ──────────────────────────────────────────────────────────────────────
# 3단계: 실적 (310L03) — 수료인원과 취업실적이 같은 응답에서 나온다
# ──────────────────────────────────────────────────────────────────────

def fetch_performance(trpr_id: str, degr: Any, torg_id: str = "") -> dict | None:
    params = {"authKey": AUTH_KEY, "returnType": "XML", "outType": "2",
              "srchTrprId": trpr_id, "srchTrprDegr": str(degr)}
    if torg_id:
        params["srchTorgId"] = torg_id
    resp = request_with_retry(PERF_API, params)
    if resp is None:
        return None
    try:
        root = ET.fromstring(resp.content.decode("utf-8"))
    except ET.ParseError:
        return None
    node = root.find("scn_list")
    if node is None or node.findtext("trprId") is None:
        return None

    def txt(tag: str) -> str | None:
        return node.findtext(tag)

    enrolled = to_int(txt("totParMks"))      # 수강인원(개강 인원) — 수료율의 분모
    applied = to_int(txt("totTrpCnt"))       # 수강신청인원(지원자)
    completed = to_int(txt("finiCnt"))
    ei3, ei_rate3 = to_int(txt("eiEmplCnt3")), to_float(txt("eiEmplRate3"))
    ei6, ei_rate6 = to_int(txt("eiEmplCnt6")), to_float(txt("eiEmplRate6"))
    hrd6, hrd_rate6 = to_int(txt("hrdEmplCnt6")), to_float(txt("hrdEmplRate6"))

    # 6개월 실적 = 고용보험 가입 + 미가입. 두 비율은 분모(취업자 모수)가 같아서
    # 그대로 더하면 마스터의 '취업률 (6개월)' 과 일치한다.
    if ei6 is None or ei_rate6 is None:
        total6, rate6 = None, None          # eiEmplRate6='B' → 아직 집계 전
    else:
        total6 = ei6 + (hrd6 or 0)
        rate6 = ei_rate6 + (hrd_rate6 or 0.0)

    return {
        "정원": to_int(txt("totFxnum")),
        "수강신청 인원": enrolled,
        "수강신청인원_원본": applied,
        "수료인원": completed,
        "수료율": f"{round(completed / enrolled * 100)}%" if completed and enrolled else "",
        "취업인원 (3개월)": ei3,
        "취업률 (3개월)": pct(ei_rate3),
        "취업인원 (6개월)": total6,
        "취업률 (6개월)": pct(rate6),
        "과정시작일": txt("trStaDt") or "",
        "과정종료일": txt("trEndDt") or "",
        "훈련비": to_int(txt("totTrco")),
        "_과정명": txt("trprNm") or "",
    }


# ──────────────────────────────────────────────────────────────────────
# 마스터 병합
# ──────────────────────────────────────────────────────────────────────

def load_master(path: str) -> dict[str, dict]:
    if not path or not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    master: dict[str, dict] = {}
    dupes = 0
    for row in rows:
        key = (row.get("고유값") or "").strip()
        if not key:
            trpr, degr = row.get("훈련과정 ID"), row.get("회차")
            key = make_key(trpr, degr) if trpr and degr else ""
        if not key:
            continue
        if key in master:
            dupes += 1
        master[key] = row
    print(f"기존 마스터 {len(rows)}행 로드 (고유값 {len(master)}개, 중복 {dupes}건)")
    return master


def build_rows(courses: list[dict], master: dict[str, dict], workers: int) -> list[dict]:
    """각 과정에 대해 2·3단계를 호출하고 키 기준으로 한 행을 완성한다.

    호출이 실패해도 행은 반드시 만든다. 실패 행을 지우는 순간 이후 행이 밀리기
    때문이다 — 기존 2번/3번의 `continue` 가 정확히 그 문제였다.
    """
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    total = len(courses)
    done = 0

    def work(course: dict) -> dict:
        nonlocal done
        trpr_id = str(course["훈련과정 ID"]).strip()
        degr = str(course["회차"]).strip()
        torg_id = str(course.get("훈련기관ID") or "").strip()
        key = make_key(trpr_id, degr)

        inst = fetch_institution(trpr_id, degr, torg_id) if torg_id else None
        perf = fetch_performance(trpr_id, degr, torg_id)

        prev = master.get(key, {})
        status = []
        if inst is None:
            status.append("기관상세실패")
        if perf is None:
            status.append("실적실패")

        row = {col: "" for col in OUT_COLUMNS}
        # 1) 이전 마스터 값을 바탕으로 깔고
        for col in OUT_COLUMNS:
            if col in prev and prev[col] not in (None, ""):
                row[col] = prev[col]
        # 2) API 로 확인된 값만 덮어쓴다 (실패한 단계는 이전 값을 그대로 둔다)
        row["고유값"] = key
        row["훈련과정 ID"] = trpr_id
        row["회차"] = degr
        # 만족도는 일부러 뺐다 — 위 fetch_course_list 주석 참고.
        # 마스터 값이 1)단계에서 이미 깔려 있으므로 그대로 보존된다.
        for col in ("지역", "과정페이지 링크"):
            if course.get(col):
                row[col] = course[col]
        if inst:
            row.update({k: v for k, v in inst.items() if v not in (None, "")})
        if perf:
            for col in ("정원", "수강신청 인원", "수료인원", "수료율",
                        "취업인원 (3개월)", "취업률 (3개월)",
                        "취업인원 (6개월)", "취업률 (6개월)",
                        "과정시작일", "과정종료일"):
                value = perf.get(col)
                # 6개월 미집계(None)는 빈칸으로 확정한다. 이전 값을 남기면
                # '집계 전'인 과정에 옛 숫자가 붙어 있는 것처럼 보인다.
                row[col] = "" if value is None else value
            if not row.get("과정명"):
                row["과정명"] = perf["_과정명"]
            if perf.get("훈련비") and not row.get("훈련비"):
                row["훈련비"] = perf["훈련비"]

        row["수집상태"] = ",".join(status) if status else "정상"
        row["수집일시"] = stamp
        done += 1
        if done % 200 == 0:
            print(f"  수집 {done}/{total}")
        return row

    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(work, courses))


# ──────────────────────────────────────────────────────────────────────
# 검증
# ──────────────────────────────────────────────────────────────────────

def validate(rows: list[dict]) -> list[str]:
    """저장 전 자동 점검. 사람이 눈으로 못 잡는 종류만 본다."""
    problems: list[str] = []

    seen: dict[str, int] = {}
    for row in rows:
        seen[row["고유값"]] = seen.get(row["고유값"], 0) + 1
    dupes = [k for k, n in seen.items() if n > 1]
    if dupes:
        problems.append(f"고유값 중복 {len(dupes)}건: {dupes[:5]}")

    # '이번회차미조회' 는 실패가 아니다 — 이번 --start/--end 창 밖이라 조회 대상이
    # 아니었던 마스터 행이다. 증분 수집(좁은 창)을 매일 돌리면 이게 대부분이 되므로,
    # 실패로 세면 "매일 7,228건 실패"라는 가짜 경보가 뜨고 진짜 실패가 묻힌다.
    OUT_OF_WINDOW = "이번회차미조회"
    failed = [r for r in rows if r["수집상태"] not in ("정상", OUT_OF_WINDOW)]
    skipped = [r for r in rows if r["수집상태"] == OUT_OF_WINDOW]
    if failed:
        problems.append(f"수집 실패 {len(failed)}건 (행은 유지됨, 수집상태 컬럼 확인)")
    if skipped:
        print(f"  (참고) 조회 범위 밖이라 그대로 둔 행 {len(skipped)}건 — 실패 아님")

    # 취업자 모수(취업인원 ÷ 취업률)가 수료인원을 크게 넘으면 두 값의 출처가 다른 것이다.
    # 손으로 붙여 넣던 시절의 행 밀림이 바로 이 형태로 나타났다.
    #
    # 다만 **+1 은 정상이다.** 2026-09-17 전수 실측(11,033쌍): 모수가 수료인원을
    # 넘는 경우가 전부 정확히 +1 이고 **+2 이상은 0건**이었다. 행 밀림이라면 크고
    # 불규칙한 차이가 나야 한다. +1 은 조기취업자(수료 전 취업해 수료자에는 안 잡히지만
    # 취업대상자에는 포함)로 설명된다. 이걸 경보로 세면 매번 뜨는 가짜 경보가 되고
    # 진짜 행 밀림이 거기 묻힌다.
    shifted = []
    for row in rows:
        completed = to_int(row.get("수료인원"))
        for cnt_col, rate_col in (("취업인원 (6개월)", "취업률 (6개월)"),
                                  ("취업인원 (3개월)", "취업률 (3개월)")):
            employed, rate = to_int(row.get(cnt_col)), to_float(row.get(rate_col))
            if not (employed and rate and completed):
                continue
            denom = round(employed / (rate / 100))
            if denom > completed + 1:
                shifted.append(f"{row['고유값']} {row.get('과정명','')[:20]} "
                               f"수료 {completed} < 모수 {denom}")
            break
    if shifted:
        problems.append(f"수료인원 < 취업자 모수 {len(shifted)}건 "
                        f"(취업 데이터가 다른 과정 것일 수 있음): {shifted[:5]}")

    for row in rows:
        completed, enrolled = to_int(row.get("수료인원")), to_int(row.get("수강신청 인원"))
        if completed and enrolled and completed > enrolled:
            problems.append(f"수료인원 > 수강인원: {row['고유값']} {completed}>{enrolled}")
            break

    return problems


def write_csv(path: str, rows: list[dict]) -> None:
    """임시 파일에 다 쓴 뒤 교체한다. 중간에 죽어도 기존 파일이 깨지지 않는다."""
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=OUT_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    os.replace(tmp, path)


# ──────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="K-디지털 수집 1·2·3단계 통합")
    parser.add_argument("--start", default="20210101", help="훈련시작일 검색 시작 (YYYYMMDD)")
    parser.add_argument("--end", default="20271231", help="훈련시작일 검색 종료 (YYYYMMDD)")
    parser.add_argument("--master", default="", help="기존 마스터 CSV (수기 컬럼 보존용)")
    parser.add_argument("--out", required=True, help="저장할 CSV 경로")
    parser.add_argument("--workers", type=int, default=6, help="동시 요청 수")
    parser.add_argument("--refresh-only", action="store_true",
                        help="목록 API 를 건너뛰고 마스터의 키로 실적만 갱신")
    parser.add_argument("--strict", action="store_true",
                        help="검증에서 이상이 나오면 저장하지 않음")
    args = parser.parse_args()

    master = load_master(args.master)

    if args.refresh_only:
        if not master:
            print("--refresh-only 는 --master 가 필요합니다.", file=sys.stderr)
            return 2
        courses = [{
            "훈련과정 ID": row.get("훈련과정 ID", ""),
            "회차": row.get("회차", ""),
            # 훈련기관ID 는 과정페이지 링크에 trainstCstmrId 로 들어 있다.
            "훈련기관ID": torg_id_from_link(row.get("과정페이지 링크", "")),
        } for row in master.values()]
        print(f"마스터 키 {len(courses)}건으로 실적 갱신")
    else:
        print(f"1단계: 과정 목록 조회 ({args.start} ~ {args.end})")
        courses = fetch_course_list(args.start, args.end)
        print(f"  총 {len(courses)}건")

    print("2·3단계: 기관상세 + 실적 수집")
    rows = build_rows(courses, master, args.workers)

    # 목록에서 사라진 과거 과정도 마스터에 있으면 유지한다. 행이 줄면
    # 대시보드 집계가 조용히 작아진다.
    collected = {row["고유값"] for row in rows}
    carried = [dict({c: "" for c in OUT_COLUMNS}, **{k: v for k, v in prev.items()
                                                     if k in OUT_COLUMNS},
                    수집상태="이번회차미조회")
               for key, prev in master.items() if key not in collected]
    if carried:
        print(f"이번 조회 범위 밖 마스터 행 {len(carried)}건 유지")
    rows.extend(carried)
    rows.sort(key=lambda r: (str(r.get("훈련과정 ID", "")), to_int(r.get("회차")) or 0))

    print("\n== 검증 ==")
    problems = validate(rows)
    if problems:
        for p in problems:
            print("  [!]", p)
    else:
        print("  이상 없음")

    if problems and args.strict:
        print("\n--strict: 이상이 있어 저장하지 않았습니다.", file=sys.stderr)
        return 1

    write_csv(args.out, rows)
    print(f"\n저장 완료: {args.out} ({len(rows)}행)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
