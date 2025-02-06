from difflib import SequenceMatcher
import pandas as pd
from collections import defaultdict
import re

def group_institutions_advanced(df, similarity_threshold=0.75):
    """훈련기관명을 분석하여 유사한 기관들을 그룹화 (개선된 키워드 방식, 최종 버전)"""
    print("group_institutions_advanced 함수 시작")
    try:
        if '훈련기관' not in df.columns:
            print("'훈련기관' 컬럼이 DataFrame에 존재하지 않습니다.")
            return df

        df['훈련기관'] = df['훈련기관'].fillna("").astype(str)

        # 전처리 로직 (기존과 동일)
        df['clean_name'] = df['훈련기관'].str.replace(r'[^가-힣A-Za-z0-9\s()]', '', regex=True).fillna("")
        df['clean_name'] = df['clean_name'].str.replace(r'\s+', ' ', regex=True).fillna("")
        df['clean_name'] = df['clean_name'].apply(lambda x: re.sub(r'^주식회사', '(주)', x) if re.match(r'^주식회사', x) else x).fillna("")
        df['clean_name'] = df['clean_name'].str.strip().str.upper().fillna("")

        # 1. 핵심 키워드 기반 1차 그룹핑
        keyword_groups = {  # 핵심 키워드 정의 (사용자 정의!)
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
            '직업전문학교 (IT)': ['아이티직업전문학교', 'IT직업전문학교', '직업전문학교', '전문학교']
             # ... (필요한 그룹 및 키워드 계속 추가 - 사용자 정의!) ...
        }
        initial_groups = defaultdict(list)  # 1차 그룹 정보 저장
        grouped_names = {} # 기관명 - 1차 그룹명 매핑 정보 저장

        for idx, row in df.iterrows():
            name = row['clean_name']
            if not name:
                continue

            assigned_group = False
            for group_name, keywords in keyword_groups.items():  # 정의된 키워드 그룹 순회
                for keyword in keywords:  # 각 그룹의 키워드 순회
                    if re.search(r'\b' + re.escape(keyword.upper()) + r'\b', name): # 단어 단위 매칭
                        initial_groups[group_name].append(name)  # 해당 그룹에 기관명 추가
                        grouped_names[name] = group_name  # 1차 그룹명 저장
                        assigned_group = True
                        break  # Inner loop break (keyword)
                if assigned_group:
                    break  # Outer loop break (group_name)
            if not assigned_group:
                initial_groups['기타'].append(name)  # 어떤 키워드 그룹에도 속하지 않으면 '기타' 그룹으로 분류
                grouped_names[name] = '기타'  # 1차 그룹명 '기타' 저장

        # 2. 최종 그룹 대표 이름 설정 및 '훈련기관' 컬럼 업데이트
        df['group'] = df['clean_name'].map(grouped_names) # 기관명에 맞는 그룹 할당

        if 'clean_name' in df.columns and 'group' in df.columns:
            group_repr = {} # 각 group의 대표 이름 저장
            for group in df['group'].unique():
                group_counts = df[df['group'] == group]['clean_name'].value_counts()
                # 그룹 내 가장 흔한 clean_name을 대표로 설정. 없다면 그룹 이름을 사용
                group_repr[group] = group_counts.index[0] if not group_counts.empty else group

            # 'group_name' 컬럼: 각 훈련기관의 그룹 대표 이름을 저장
            df['group_name'] = df['group'].map(group_repr)
            # '훈련기관' 컬럼을 'group_name'으로 업데이트 (그룹 대표 이름으로 변경)
            df['훈련기관'] = df['group_name']

        df.drop(columns=['clean_name', 'group'], inplace=True, errors='ignore')

        print("group_institutions_advanced 함수 종료")
        return df

    except Exception as error:
        print(f"Error in group_institutions_advanced: {error}")
        return df