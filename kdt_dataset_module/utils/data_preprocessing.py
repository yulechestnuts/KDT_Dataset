import pandas as pd
from difflib import SequenceMatcher
import re
from datetime import datetime

def calculate_yearly_revenue(df):
    year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}년', col)]
    df['누적매출'] = df[year_columns].sum(axis=1)
    yearly_data = df[year_columns].copy()
    return df, yearly_data

def group_institutions_advanced(df, similarity_threshold=0.6):
    """
    훈련기관명을 분석하여 유사한 기관들을 그룹화합니다.

    Args:
        df: 훈련기관명이 포함된 DataFrame
        similarity_threshold: 유사도를 판단하는 기준값 (0~1, 기본값 0.6)

    Returns:
        DataFrame: '훈련기관' 열의 훈련기관명이 그룹화된 DataFrame
    """

    df = df.copy()
    df['훈련기관'] = df['훈련기관'].astype(str)  # '훈련기관' 열을 문자열로 변환
    
    # 전처리: 특수문자, 공백, "(주)" 등 제거 (수정됨)
    df['clean_name'] = df['훈련기관'].str.replace(r'[^가-힣A-Za-z0-9()]', '', regex=True)  # 괄호는 남겨둡니다.
    df['clean_name'] = df['clean_name'].str.replace(r'\s+', '', regex=True)
    df['clean_name'] = df['clean_name'].str.replace(r'주식회사', '', regex=True) # 주식회사만 제거.
    df['clean_name'] = df['clean_name'].str.upper()  # 대문자로 통일

    # 그룹 정보를 담을 딕셔너리
    groups = {}
    group_id = 0

    # 기관명을 순회하며 그룹화
    for idx, row in df.iterrows():
        name = row['clean_name']
        
        if not name:  # 빈 문자열인 경우 건너뛰기
            continue

        found_group = False
        for group_name, members in groups.items():
            for member in members:
                if SequenceMatcher(None, name, member).ratio() >= similarity_threshold:
                    groups[group_name].append(name)
                    found_group = True
                    break
            if found_group:
                break

        if not found_group:
            group_id += 1
            groups[f'기관_{group_id}'] = [name]

    # 훈련기관명을 그룹명으로 매핑
    name_to_group = {}
    for group_name, members in groups.items():
        for member in members:
            name_to_group[member] = group_name

    # 원본 데이터프레임에 그룹 정보 추가
    df['group'] = df['clean_name'].map(name_to_group)

    # 'clean_name' 및 'group' 열이 모두 존재하는지 확인 후 처리
    if 'clean_name' in df.columns and 'group' in df.columns:
        # 그룹 대표 이름 설정 (가장 많이 등장하는 이름)
        group_repr = df.groupby('group')['clean_name'].agg(lambda x: x.value_counts().index[0]).to_dict()
        df['group_name'] = df['group'].map(group_repr)
    
        # '훈련기관' 열을 그룹 대표 이름으로 업데이트
        df['훈련기관'] = df['group_name']
    
    # 불필요한 열 제거
    df.drop(columns=['clean_name', 'group'], inplace=True)

    return df

def classify_training_type(row):
    types = []
    if row['과정명'].startswith('재직자_'):
        types.append('재직자 훈련')
    if '학교' in str(row['훈련기관']):
        types.append('대학주도형 훈련')
    if pd.notna(row['선도기업']) or pd.notna(row['파트너기관']):
        types.append('선도기업형 훈련')
    if row['과정명'].startswith('심화_'):
        types.append('심화 훈련')
    if row['과정명'].startswith('융합_'):
        types.append('융합 훈련')
    if not types:
        types.append('신기술 훈련')
    return '&'.join(types)

def preprocess_data(df):
    try:
        # 날짜 열 처리
        date_columns = ['과정시작일', '과정종료일']
        for col in date_columns:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')

        # 회차 처리
        df['회차'] = pd.to_numeric(df['회차'].astype(str).str.extract('(\d+)', expand=False), errors='coerce').fillna(0).astype('Int64')

        # 연도별 매출 열 처리
        year_columns = ['2021년', '2022년', '2023년', '2024년', '2025년']
        for year in year_columns:
            if year in df.columns:
                df[year] = pd.to_numeric(df[year].astype(str).str.replace(',', ''), errors='coerce').fillna(0)

        # 파트너기관 처리 (기존 로직 유지)
        if '파트너기관' in df.columns:
            partner_rows = df[df['파트너기관'].notna()].copy()
            non_partner_rows = df[df['파트너기관'].isna()].copy()
            partner_rows['훈련기관'] = partner_rows['파트너기관']

            for year in year_columns:
                if year in df.columns:
                    df.loc[df['파트너기관'].notna(), year] *= 0.1
                    partner_rows[year] = partner_rows[year] * 0.9

        # 데이터 합치기
        df = pd.concat([non_partner_rows, partner_rows], ignore_index=True)

        # 수치형 열 처리
        numeric_columns = ['총 훈련일수', '총 훈련시간', '훈련비', '정원', '수강신청 인원', '수료인원', '수료율', '만족도']
        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        # 누적매출 계산: NaN 값은 0으로 처리 후 합산
        if all(year in df.columns for year in year_columns):
            df['누적매출'] = df[year_columns].fillna(0).sum(axis=1)

        # 훈련기관 그룹화 적용
        df = group_institutions_advanced(df)

        # 훈련유형 분류
        df['훈련유형'] = df.apply(classify_training_type, axis=1)

        return df

    except Exception as error:
        print(f"Error: 데이터 전처리 중 오류 발생: {str(error)}")
        print(f"Error details: {error}")
        return pd.DataFrame()