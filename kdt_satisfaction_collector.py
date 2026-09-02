# -*- coding: utf-8 -*-
"""
회차별 만족도 수집기 (work24 / HRD-Net)

배경
----
work24 에는 만족도가 세 군데 나오는데 앞의 둘은 전부 과정(trprId) 단위 통합값이다.
  1. 오픈 API 310L01 의 stdgScor (100점)  -- 같은 과정의 모든 회차가 동일
  2. 과정 상세 상단의 별점 (5점)          -- 같은 과정의 모든 회차가 동일
  3. selectSatisfactionAjax.do            -- 유일하게 회차별로 값이 다르다

'만족도 및 취업률' 탭(selectSatisfactionTab.do)은 회차 선택 UI가 있지만
핸들러(tracseTmeChange)가 어디에도 정의돼 있지 않고 값도 항상 비어 있다.
실제 데이터는 3300 성과 페이지가 쓰는 아래 JSON 엔드포인트에만 있다.

수집 절차 (과정 1건당)
----------------------
  (1) POST selectTgcrStdg.do  -> <select id="srchTracseTme"> 옵션 = 유효 회차 목록
  (2) GET  selectSatisfactionAjax.do (회차마다) -> 회차별 만족도

반드시 (1) 을 먼저 해야 한다.
유효 목록에 없는 회차를 요청하면 서버가 조용히 '가장 마지막 회차' 값을 돌려주면서
응답의 tracseTme 필드에는 요청한 값을 그대로 에코한다. 응답만 봐서는 폴백인지
구분할 방법이 없다. (실측: AIG20230000412579 의 2/24/100 회차 -> 전부 23회차 값)

출력
----
CSV 한 줄 = 과정ID x 회차. '훈련과정 ID' + '회차' 로 기존 데이터셋에 조인하면 된다.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
from typing import Dict, List, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE = "https://www.work24.go.kr"
ROUND_LIST_URL = BASE + "/hr/a/a/3300/selectTgcrStdg.do"
SATISFACTION_URL = BASE + "/hr/a/a/3100/selectSatisfactionAjax.do"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"
)

# select 옵션 파싱용. value="ALL" 은 전체회차 집계라 개별 회차 목록에서는 빠진다.
_OPTION_RE = re.compile(r'<option\s+value="(\d+)"', re.I)

OVERALL_ITEM = "전반적 만족도"


def make_session() -> requests.Session:
    """재시도를 붙인 세션.

    한 번은 DNS 가 잠깐 끊겨(getaddrinfo failed) 570개 과정이 통째로 실패했다.
    work24 쪽 차단이 아니라 이쪽 네트워크 문제였고, 재시도만 있었으면 넘어갔을
    일이다. 40분 넘게 도는 작업이라 순간적인 끊김에 견디게 만든다.
    """
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "X-Requested-With": "XMLHttpRequest"})
    retry = Retry(
        total=5,
        connect=5,
        read=3,
        backoff_factor=1.5,          # 0 / 1.5 / 3 / 6 / 12초
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "POST"]),
    )
    adapter = HTTPAdapter(max_retries=retry)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s


def fetch_valid_rounds(
    s: requests.Session, tracse_id: str, timeout: int = 30
) -> List[str]:
    """이 과정에 만족도 데이터가 실제로 있는 회차 목록.

    tracseId 하나면 충분하다. tracseTme/trainstCstmrId/crseTracseSe 를 같이 보내도
    결과가 같음을 확인했다 (AIG20230000412579 -> 22개, AIG20240000498073 -> 3개로 동일).
    만족도의 키는 훈련기관이 아니라 훈련과정 x 회차이므로 기관 정보는 쓰지 않는다.
    """
    r = s.post(ROUND_LIST_URL, data={"tracseId": tracse_id}, timeout=timeout)
    r.raise_for_status()
    seen, out = set(), []
    for tme in _OPTION_RE.findall(r.text):
        if tme not in seen:
            seen.add(tme)
            out.append(tme)
    return out


def _num(v):
    """'4.2' / 4.2 / None / '' 을 float 또는 None 으로."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f > 0 else None


def _parse_legacy(tracse_id: str, tme: str, m: Dict) -> Optional[Dict]:
    """2023년 이전 시작 과정의 응답 형태 (setisfactionMap).

    work24 는 만족도 응답을 두 스키마로 나눠 보낸다. 페이지 JS 주석 기준으로
        satisfactiontlcTrneList / satisfactiontlcTrneInfo  -> 내배카훈련생(O)
        setisfactionMap / epilogueList                     -> 내배카훈련생(X)
    실측상 경계는 '과정 시작연도 2023년'이다. 2021~2022 시작 과정은 앞의 두 키가
    아예 없고 setisfactionMap 으로만 온다. 이걸 안 읽으면 그 시기 과정이 통째로
    '데이터 없음'이 되는데, 실제로는 값이 멀쩡히 있다.

    구조는 다르지만 필요한 값(5점 대표 만족도, 평가인원, 참여율)은 다 들어 있다.
    추천 인원은 이 스키마에 없어 비운다.
    """
    score = (
        _num(m.get("stsfdgAvrgScore"))
        or _num(m.get("totalAvrgScore"))
        or _num(m.get("avgEvlScore"))
    )
    if score is None:
        return None
    return {
        "훈련과정 ID": tracse_id,
        "회차": tme,
        "만족도(5점)": round(score, 2),
        "대표값출처": "setisfactionMap(2023년 이전 스키마)",
        "수강인원": m.get("totTrneeCo"),
        "평가인원": m.get("evalCnt"),
        "평가참여율": m.get("evalRate"),
        "추천인원": None,      # 이 스키마에는 추천 항목이 없다
        "추천응답인원": None,
    }


def fetch_round_satisfaction(
    s: requests.Session, tracse_id: str, tme: str, timeout: int = 30
) -> Optional[Dict]:
    """회차 하나의 만족도. 유효 회차인지는 호출 쪽에서 이미 걸렀다고 가정한다."""
    params = {
        "tracseId": tracse_id,
        "srchTracseTme": json.dumps([tme]),
        "srchTracseTmeSel": tme,
    }
    r = s.get(SATISFACTION_URL, params=params, timeout=timeout)
    r.raise_for_status()
    data = r.json()

    info = data.get("satisfactiontlcTrneInfo") or {}
    items = data.get("satisfactiontlcTrneList") or []
    if not items:
        # 신 스키마가 비면 구 스키마를 본다. 순서를 바꾸면 안 된다 —
        # 2023년 이후 과정은 두 키가 함께 오는 경우가 있고, 그때는 신 스키마가 정확하다.
        legacy = data.get("setisfactionMap")
        if isinstance(legacy, dict) and legacy:
            return _parse_legacy(tracse_id, tme, legacy)
        return None

    row = {
        "훈련과정 ID": tracse_id,
        "회차": tme,
        "수강인원": info.get("totTrneeCo"),
        "평가인원": info.get("evalCnt"),
        "평가참여율": info.get("evalRate"),
        "추천인원": info.get("rcmnCt"),
        "추천응답인원": info.get("rcmnCtJoin"),
    }

    # 항목별 5점 점수. 같은 이름이 여러 번 나오면(예: '개인성과' 3개) 평균낸다.
    buckets: Dict[str, List[float]] = {}
    for it in items:
        name = it.get("copsFcorIemCdNm") or it.get("inqRelmIemCdNm")
        score = it.get("stsfdgAvrgScore")
        if name is None or score is None:
            continue
        buckets.setdefault(str(name), []).append(float(score))

    for name, vals in buckets.items():
        row[name] = round(sum(vals) / len(vals), 2)

    # 대표값: '전반적 만족도' 5점. 없으면 전체 항목 평균으로 대체하고 출처를 남긴다.
    if OVERALL_ITEM in row:
        row["만족도(5점)"] = row[OVERALL_ITEM]
        row["대표값출처"] = OVERALL_ITEM
    else:
        flat = [v for vals in buckets.values() for v in vals]
        row["만족도(5점)"] = round(sum(flat) / len(flat), 2) if flat else None
        row["대표값출처"] = "항목평균(전반적 만족도 없음)"

    return row


def load_done_courses(progress_path: str) -> set:
    """이미 끝낸 과정 ID. 전체 수집이 40분 넘게 걸려서 중단/재개가 필요하다."""
    done = set()
    if os.path.exists(progress_path):
        with open(progress_path, encoding="utf-8") as f:
            for line in f:
                cid = line.strip()
                if cid:
                    done.add(cid)
    return done


def collect(courses: List[Dict], delay: float, timeout: int, out_path: str) -> None:
    """courses: [{훈련과정 ID, 회차}] 목록. 그 두 컬럼 외에는 보지 않는다."""
    s = make_session()

    # 과정 단위로 묶어 유효 회차 목록을 과정당 한 번만 조회한다.
    by_course: Dict[str, set] = {}
    for c in courses:
        cid = str(c.get("훈련과정 ID", "")).strip()
        tme = str(c.get("회차", "")).strip()
        if not cid or not tme:
            continue
        by_course.setdefault(cid, set()).add(tme)

    # 재개용. 과정 하나가 끝날 때마다 결과(jsonl)와 진행표시(txt)를 함께 남긴다.
    rows_path = out_path + ".rows.jsonl"
    progress_path = out_path + ".done.txt"
    done = load_done_courses(progress_path)

    rows: List[Dict] = []
    if done and os.path.exists(rows_path):
        with open(rows_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
        print("이어서 진행: 과정 %d개 완료, %d행 복원" % (len(done), len(rows)))

    rows_f = open(rows_path, "a", encoding="utf-8")
    prog_f = open(progress_path, "a", encoding="utf-8")

    skipped_invalid = 0
    failed_courses = 0
    total = len(by_course)

    for idx, (cid, wanted_rounds) in enumerate(sorted(by_course.items()), 1):
        if cid in done:
            continue
        try:
            valid = fetch_valid_rounds(s, cid, timeout=timeout)
        except Exception as e:
            print("[%d/%d] %s 회차목록 실패: %s" % (idx, total, cid, e), file=sys.stderr)
            failed_courses += 1
            continue

        valid_set = set(valid)
        want = sorted(wanted_rounds, key=lambda x: int(x) if x.isdigit() else 0)

        for tme in want:
            # 폴백 방지: 유효 목록에 없으면 요청 자체를 하지 않는다.
            if tme not in valid_set:
                skipped_invalid += 1
                continue
            try:
                row = fetch_round_satisfaction(s, cid, tme, timeout=timeout)
            except Exception as e:
                print("    %s %s회차 실패: %s" % (cid, tme, e), file=sys.stderr)
                continue
            if row:
                rows.append(row)
                rows_f.write(json.dumps(row, ensure_ascii=False) + "\n")
            time.sleep(delay)

        # 과정 단위로 flush — 여기까지는 다시 안 받아도 된다.
        rows_f.flush()
        prog_f.write(cid + "\n")
        prog_f.flush()

        print("[%d/%d] %s  유효회차 %d개  누적 %d행" % (idx, total, cid, len(valid_set), len(rows)))
        time.sleep(delay)

    rows_f.close()
    prog_f.close()

    if not rows:
        print("수집된 행이 없습니다.", file=sys.stderr)
        return

    fixed = [
        "훈련과정 ID", "회차", "만족도(5점)", "대표값출처",
        "수강인원", "평가인원", "평가참여율", "추천인원", "추천응답인원",
    ]
    extra: List[str] = []
    for r in rows:
        for k in r:
            if k not in fixed and k not in extra:
                extra.append(k)

    # 재개 시 같은 회차를 다시 받을 수 있어 마지막 값만 남긴다.
    deduped = {}
    for r in rows:
        deduped[(r["훈련과정 ID"], str(r["회차"]))] = r
    final = list(deduped.values())
    if len(final) != len(rows):
        print("중복 %d행 제거" % (len(rows) - len(final)))

    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fixed + extra)
        w.writeheader()
        w.writerows(final)

    print("")
    print("완료: %d행 -> %s" % (len(final), out_path))
    print("  과정 %d개 중 회차목록 실패 %d개" % (total, failed_courses))
    print("  유효 목록에 없어 건너뛴 회차 %d개 (폴백값 방지)" % skipped_invalid)


def main() -> None:
    p = argparse.ArgumentParser(description="work24 회차별 만족도 수집")
    p.add_argument("--input", required=True,
                   help="훈련과정 ID / 회차 컬럼을 가진 CSV 또는 JSON")
    p.add_argument("--output", default="satisfaction_by_round.csv")
    p.add_argument("--delay", type=float, default=0.3, help="요청 간격(초)")
    p.add_argument("--timeout", type=int, default=30)
    p.add_argument("--limit", type=int, default=0, help="과정 수 제한(0=전체)")
    a = p.parse_args()

    if a.input.lower().endswith(".json"):
        with open(a.input, encoding="utf-8") as f:
            courses = json.load(f)
    else:
        with open(a.input, encoding="utf-8-sig", newline="") as f:
            courses = list(csv.DictReader(f))

    if a.limit:
        seen, trimmed = set(), []
        for c in courses:
            cid = str(c.get("훈련과정 ID", "")).strip()
            if cid not in seen and len(seen) >= a.limit:
                continue
            seen.add(cid)
            trimmed.append(c)
        courses = trimmed

    collect(courses, a.delay, a.timeout, a.output)


if __name__ == "__main__":
    main()
