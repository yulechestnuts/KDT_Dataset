# -*- coding: utf-8 -*-
"""
회차별 취업 통계 수집기 (HRD-Net 오픈 API 310L03)

왜 API 인가
-----------
만족도는 오픈 API 에 회차별 값이 없어 웹 화면을 크롤링했지만, 취업 통계는
310L03 이 (훈련과정ID, 회차, 훈련기관ID) 단위로 정확히 돌려준다.
"오픈 API 는 3년치만 있다"는 제약은 목록 조회(310L01)의 날짜 검색에 걸리는
것이고, 310L03 은 과정 단건 조회라 2021년 과정도 정상 응답한다 (실측 확인).

  AIG20200000286626 1회차 -> 수료 19 | 3개월 14명/73.7% | 6개월 15명/78.9%
  (엑셀에는 0/공백으로 비어 있던 행)

출력
----
CSV 한 줄 = 훈련과정ID x 회차.
K_Digital_Training_3_260805 의 C/D/E/F 열에 채워 넣는 데 쓴다.
"""

import argparse
import csv
import json
import os
import sys
import time
import xml.etree.ElementTree as ET
from typing import Dict, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

URL = "https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo310L03.do"
AUTH_KEY = os.environ.get("HRD_AUTH_KEY", "da3974b2-e74e-42f1-8fc5-fb2ae0d938ea")

FIELDS = {
    "eiEmplCnt3": "3개월 취업인원",
    "eiEmplRate3": "3개월 취업률",
    "eiEmplCnt6": "6개월 취업인원",
    "eiEmplRate6": "6개월 취업률",
    "finiCnt": "수료인원",
}


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": "Mozilla/5.0"})
    retry = Retry(total=5, connect=5, read=3, backoff_factor=1.5,
                  status_forcelist=(429, 500, 502, 503, 504),
                  allowed_methods=frozenset(["GET"]))
    s.mount("https://", HTTPAdapter(max_retries=retry))
    return s


def fetch(s: requests.Session, cid: str, tme: str, inst: str,
          timeout: int = 30) -> Optional[Dict]:
    r = s.get(URL, params={
        "authKey": AUTH_KEY, "returnType": "XML", "outType": "2",
        "srchTrprId": cid, "srchTrprDegr": tme, "srchTorgId": inst,
    }, timeout=timeout)
    r.raise_for_status()
    try:
        root = ET.fromstring(r.content)
    except ET.ParseError:
        return None
    scn = root.findall("scn_list")
    if not scn:
        return None
    node = scn[0]

    out = {"훈련과정ID": cid, "회차": tme}
    got = False
    for tag, name in FIELDS.items():
        el = node.find(tag)
        val = el.text if el is not None else None
        if val not in (None, ""):
            got = True
        out[name] = val
    return out if got else None


def main() -> None:
    p = argparse.ArgumentParser(description="회차별 취업 통계 수집")
    p.add_argument("--input", required=True,
                   help="훈련과정ID / 회차 / 훈련기관ID 컬럼을 가진 CSV")
    p.add_argument("--output", default="employment_by_round.csv")
    p.add_argument("--delay", type=float, default=0.3)
    p.add_argument("--timeout", type=int, default=30)
    a = p.parse_args()

    with open(a.input, encoding="utf-8-sig", newline="") as f:
        targets = list(csv.DictReader(f))

    rows_path = a.output + ".rows.jsonl"
    done_path = a.output + ".done.txt"
    done = set()
    rows = []
    if os.path.exists(done_path):
        done = {l.strip() for l in open(done_path, encoding="utf-8") if l.strip()}
        if os.path.exists(rows_path):
            rows = [json.loads(l) for l in open(rows_path, encoding="utf-8") if l.strip()]
        print("이어서 진행: %d건 완료, %d행 복원" % (len(done), len(rows)))

    s = make_session()
    rf = open(rows_path, "a", encoding="utf-8")
    df = open(done_path, "a", encoding="utf-8")
    empty = failed = 0

    for i, t in enumerate(targets, 1):
        cid = str(t["훈련과정ID"]).strip()
        tme = str(int(float(t["회차"])))
        inst = str(t["훈련기관ID"]).strip().split(".")[0]
        key = "%s|%s" % (cid, tme)
        if key in done:
            continue
        try:
            rec = fetch(s, cid, tme, inst, timeout=a.timeout)
        except Exception as e:
            print("  %s %s회차 실패: %s" % (cid, tme, e), file=sys.stderr)
            failed += 1
            time.sleep(a.delay)
            continue
        if rec:
            rows.append(rec)
            rf.write(json.dumps(rec, ensure_ascii=False) + "\n")
        else:
            empty += 1
        rf.flush()
        df.write(key + "\n")
        df.flush()
        if i % 50 == 0:
            print("[%d/%d] 수집 %d행 / 빈응답 %d / 실패 %d"
                  % (i, len(targets), len(rows), empty, failed))
        time.sleep(a.delay)

    rf.close()
    df.close()

    if not rows:
        print("수집된 행이 없습니다.", file=sys.stderr)
        return

    dedup = {(r["훈련과정ID"], r["회차"]): r for r in rows}
    final = list(dedup.values())
    names = ["훈련과정ID", "회차"] + list(FIELDS.values())
    with open(a.output, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=names)
        w.writeheader()
        w.writerows(final)

    print("\n완료: %d행 -> %s" % (len(final), a.output))
    print("  빈 응답 %d / 실패 %d" % (empty, failed))


if __name__ == "__main__":
    main()
