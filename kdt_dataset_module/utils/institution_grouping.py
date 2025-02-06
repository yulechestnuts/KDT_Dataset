from difflib import SequenceMatcher
import pandas as pd
from collections import defaultdict
import re

def group_institutions_advanced(df, similarity_threshold=0.75):
    """
    훈련기관명을 분석하여 유사한 기관들을 그룹화 (하이브리드 방식, 최종 개선 버전)

    1차 그룹핑: 핵심 키워드 기반 (institution_groups 딕셔너리 활용)
    2차 그룹핑: 1차 그룹 내 유사도 매칭 (SequenceMatcher 활용)
    """
    print("group_institutions_advanced 함수 시작")
    try:
        if '훈련기관' not in df.columns:
            print("Error: '훈련기관' 컬럼이 DataFrame에 존재하지 않습니다.")
            return df

        # 1. 훈련기관명 전처리 (특수문자 제거, 공백 정리, "주식회사" 처리, 대문자 변환)
        df['훈련기관'] = df['훈련기관'].fillna("").astype(str)
        df['clean_name'] = df['훈련기관'].str.replace(r'[^가-힣A-Za-z0-9\s()]', '', regex=True).fillna("")  # 특수문자 제거
        df['clean_name'] = df['clean_name'].str.replace(r'\s+', ' ', regex=True).fillna("")  # 공백 여러 개를 하나로
        df['clean_name'] = df['clean_name'].apply(lambda x: re.sub(r'^주식회사', '(주)', x) if re.match(r'^주식회사', x) else x).fillna("")  # "주식회사" 처리
        df['clean_name'] = df['clean_name'].str.strip().str.upper().fillna("") # 공백 제거 및 대문자 변환

        # 2. 1차 그룹핑: 핵심 키워드 기반
        institution_groups = {  # 핵심 키워드 정의 (사용자 정의!)
            '이젠아카데미': ['이젠', '이젠컴퓨터학원', '이젠아이티아카데미'],
            '그린컴퓨터아카데미': ['그린', '그린컴퓨터아카데미', '그린아카데미컴퓨터학원'],
            '더조은아카데미': ['더조은', '더조은컴퓨터아카데미', '더조은아이티아카데미'],
            '코리아IT아카데미': ['코리아IT', '코리아아이티', 'KIT', '코리아IT아카데미'],
            '비트교육센터': ['비트', '비트캠프', '비트교육센터'],
            '하이미디어': ['하이미디어', '하이미디어아카데미', '하이미디어컴퓨터학원'],
            '아이티윌': ['아이티윌', 'IT Will', '아이티윌부산교육센터'],
            '메가스터디': ['메가스터디'],
            '에이콘아카데미': ['에이콘'],
            '한국ICT인재개발원': ['ICT'],
            '엠비씨(MBC)아카데미 컴퓨터 교육센터': ['(MBC)']
        }
        initial_groups = defaultdict(list)  # 1차 그룹 정보 저장
        grouped_names = {} # 기관명 - 1차 그룹명 매핑 정보 저장

        for idx, row in df.iterrows():
            name = row['clean_name']
            if not name:
                continue

            assigned_group = False
            for group_name, keywords in institution_groups.items():  # 정의된 키워드 그룹 순회
                for keyword in keywords:  # 각 그룹의 키워드 순회
                    if keyword.upper() in name:  # 훈련기관명에 키워드가 포함되어 있다면 (대소문자 무시)
                        initial_groups[group_name].append(name)  # 해당 그룹에 기관명 추가
                        grouped_names[name] = group_name  # 1차 그룹명 저장
                        assigned_group = True
                        break
                if assigned_group:
                    break
            if not assigned_group:
                initial_groups['기타'].append(name)  # 어떤 키워드 그룹에도 속하지 않으면 '기타' 그룹으로 분류
                grouped_names[name] = '기타'  # 1차 그룹명 '기타' 저장

        # 3. 2차 그룹핑: 1차 그룹 내 유사도 매칭 기반 (단, '기타' 그룹 제외)
        final_groups = {}  # 최종 그룹 정보 저장

        for group_name, member_names in initial_groups.items():  # 1차 그룹 순회
            if group_name == '기타':  # '기타' 그룹은 2차 그룹핑 생략
                final_groups[group_name] = member_names
                continue

            sub_groups = defaultdict(list)  # 2차 하위 그룹 정보 저장
            sub_group_id = 0
            sub_grouped_names = {}

            for name in member_names:  # 1차 그룹 멤버 순회
                found_sub_group = False
                for sub_group_name, sub_members in sub_groups.items():  # 2차 하위 그룹 순회
                    for sub_member in sub_members:
                        if name and sub_member and SequenceMatcher(None, name, sub_member).ratio() >= similarity_threshold:  # 유사도 비교
                            sub_groups[sub_group_name].append(name)
                            sub_grouped_names[name] = sub_group_name
                            found_sub_group = True
                            break
                    if found_sub_group:
                        break
                if not found_sub_group:  # 새 하위 그룹 생성
                    sub_group_id += 1
                    sub_groups[f'{group_name}_세부그룹_{sub_group_id}'].append(name)
                    sub_grouped_names[name] = f'{group_name}_세부그룹_{sub_group_id}'

            final_groups.update(sub_groups)  # 2차 하위 그룹 정보를 최종 그룹 정보에 병합
            grouped_names.update(sub_grouped_names)  # 2차 하위 그룹명으로 grouped_names 업데이트

        # 4. 최종 그룹 대표 이름 설정 및 '훈련기관' 컬럼 업데이트
        df['group'] = df['clean_name'].map(grouped_names)

        if 'clean_name' in df.columns and 'group' in df.columns:
            group_repr = {}
            for group in df['group'].unique():
                group_counts = df[df['group'] == group]['clean_name'].value_counts()
                group_repr[group] = group_counts.index[0] if not group_counts.empty else group  # 그룹 대표 이름: 빈도수 1위 or 그룹ID

            df['group_name'] = df['group'].map(group_repr)
            df['훈련기관'] = df['group_name']  # '훈련기관' 컬럼을 그룹 대표 이름으로 업데이트

        df.drop(columns=['clean_name', 'group'], inplace=True, errors='ignore')  # 불필요한 컬럼 제거

        print("group_institutions_advanced 함수 종료")
        return df

    except Exception as error:
        print(f"Error in group_institutions_advanced: {error}")
        return df