from collections import defaultdict
import pandas as pd
import re

def group_institutions_advanced(df):
    """훈련기관명을 분석하여 유사한 기관들을 그룹화 (키워드 포함 방식으로 개선)"""
    print("group_institutions_advanced 함수 시작")
    try:
        if '훈련기관' not in df.columns:
            print("'훈련기관' 컬럼이 DataFrame에 존재하지 않습니다.")
            return df

        # 1. 훈련기관명 전처리 (특수문자 제거, 공백 정리, 대문자 변환)
        df['훈련기관'] = df['훈련기관'].fillna("").astype(str)
        df['clean_name'] = df['훈련기관'].str.replace(r'[^가-힣A-Za-z0-9\s()]', '', regex=True).fillna("")
        df['clean_name'] = df['clean_name'].str.replace(r'\s+', ' ', regex=True).fillna("")
        df['clean_name'] = df['clean_name'].str.strip().str.upper().fillna("")

        # 2. 핵심 키워드 기반 그룹핑 (포함 방식 적용)
        institution_groups = {
            '이젠아카데미': ['이젠'],
            '그린컴퓨터아카데미': ['그린'],
            '더조은아카데미': ['더조은'],
            '코리아IT아카데미': ['코리아IT', 'KIT'],
            '비트교육센터': ['비트'],
            '하이미디어': ['하이미디어'],
            '아이티윌': ['아이티윌', 'IT WILL'],
            '메가스터디': ['메가스터디'],
            '에이콘아카데미': ['에이콘'],
            '한국ICT인재개발원': ['ICT'],
            'MBC아카데미 컴퓨터 교육센터': ['MBC아카데미'],
            '쌍용아카데미': ['쌍용']
        }
        grouped_names = {}  # 기관명 - 그룹명 매핑 정보 저장

        for idx, row in df.iterrows():
            name = row['clean_name']
            if not name:
                continue

            assigned_group = False
            for group_name, keywords in institution_groups.items():
                for keyword in keywords:
                    if keyword.upper() in name:  # 포함 여부만 체크 (정확한 단어 경계 X)
                        grouped_names[name] = group_name
                        assigned_group = True
                        break
                if assigned_group:
                    break
            if not assigned_group:
                grouped_names[name] = name  # 기존 코드처럼 그룹에 속하지 않으면 원래 기관명 유지

        # 3. 최종 그룹 대표 이름 설정 및 '훈련기관' 컬럼 업데이트
        df['훈련기관'] = df['clean_name'].map(grouped_names)

        df.drop(columns=['clean_name'], inplace=True, errors='ignore')  # 임시 컬럼 제거

        print("group_institutions_advanced 함수 종료")
        return df

    except Exception as error:
        print(f"Error in group_institutions_advanced: {error}")
        return df
