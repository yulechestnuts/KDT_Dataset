from collections import defaultdict
import pandas as pd
import re

def group_institutions_advanced(df):
    """훈련기관명을 분석하여 유사한 기관들을 그룹화 (개선된 키워드 방식, 최종 버전)""" # 함수 설명 수정
    print("group_institutions_advanced 함수 시작")
    try:
        if '훈련기관' not in df.columns:
            print("'훈련기관' 컬럼이 DataFrame에 존재하지 않습니다.")
            return df

        # 1. 훈련기관명 전처리 (특수문자 제거, 공백 정리, 대문자 변환) (기존 코드 재활용)
        df['훈련기관'] = df['훈련기관'].fillna("").astype(str)
        df['clean_name'] = df['훈련기관'].str.replace(r'[^가-힣A-Za-z0-9\s()]', '', regex=True).fillna("")
        df['clean_name'] = df['clean_name'].str.replace(r'\s+', ' ', regex=True).fillna("")
        df['clean_name'] = df['clean_name'].str.strip().str.upper().fillna("")

        # 2. 핵심 키워드 기반 그룹핑 (개선!)
        institution_groups = {  # 개선된 핵심 키워드 정의 (사용자 정의!)
            '이젠아카데미': ['이젠'], # '이젠' 만 키워드로 사용 (하위 기관 포괄)
            '그린컴퓨터아카데미': ['그린'], # '그린' 만 키워드로 사용 (하위 기관 포괄)
            '더조은아카데미': ['더조은'], # '더조은' 만 키워드로 사용 (하위 기관 포괄)
            '코리아IT아카데미': ['코리아IT', 'KIT'], # '코리아IT', 'KIT' 키워드 사용
            '비트교육센터': ['비트'], # '비트' 만 키워드로 사용 (하위 기관 포괄)
            '하이미디어': ['하이미디어'], # '하이미디어' 키워드 사용
            '아이티윌': ['아이티윌', 'IT WILL'], # '아이티윌', 'IT Will' 키워드 사용 (공백, 대소문자 무시)
            '메가스터디': ['메가스터디'],
            '에이콘아카데미': ['에이콘'],
            '한국ICT인재개발원': ['ICT'],
            'MBC아카데미 컴퓨터 교육센터': ['MBC아카데미'], 
            '쌍용아카데미': ['쌍용']
             # ... (필요한 그룹 및 키워드 계속 추가 - 사용자 정의!) ...
        }
        grouped_names = {} # 기관명 - 그룹명 매핑 정보 저장

        for idx, row in df.iterrows():
            name = row['clean_name']
            if not name:
                continue

            assigned_group = False
            for group_name, keywords in institution_groups.items():  # 정의된 키워드 그룹 순회
                for keyword in keywords:  # 각 그룹의 키워드 순회
                    if re.search(r'\b' + re.escape(keyword.upper()) + r'\b', name): # 단어 단위 매칭 (정규 표현식, 개선!)
                    # if keyword.upper() in name: # 기존 코드 (단순 포함 여부 체크)
                        grouped_names[name] = group_name  # 그룹명 저장
                        assigned_group = True
                        break
                if assigned_group:
                    break
            if not assigned_group:
                grouped_names[name] = name # 어떤 키워드 그룹에도 속하지 않으면, 원래 기관명 그대로 사용 (수정!)

        # 3. 최종 그룹 대표 이름 설정 및 '훈련기관' 컬럼 업데이트 (더욱 단순화!)
        df['훈련기관'] = df['clean_name'].map(grouped_names) # 그룹명 (또는 원래 기관명) 으로 '훈련기관' 컬럼 업데이트

        df.drop(columns=['clean_name'], inplace=True, errors='ignore') # 'clean_name' 컬럼 제거 (group 컬럼 제거 - 더 이상 2차 그룹핑 사용 X)

        print("group_institutions_advanced 함수 종료")
        return df

    except Exception as error:
        print(f"Error in group_institutions_advanced: {error}")
        return df