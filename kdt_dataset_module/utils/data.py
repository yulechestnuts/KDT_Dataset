import pandas as pd
from difflib import SequenceMatcher

def calculate_yearly_revenue(df):
    """연도별 매출 계산 함수"""
    year_columns = [col for col in df.columns if isinstance(col, str) and col.endswith('년')]
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
    try:
        df = df.copy()
        df['훈련기관'] = df['훈련기관'].fillna("").astype(str)  # NaN 값을 빈 문자열로 채우고 문자열로 변환
        
        # 전처리: 특수문자, 공백, "(주)" 등 제거 (수정됨)
        df['clean_name'] = df['훈련기관'].str.replace(r'[^가-힣A-Za-z0-9()]', '', regex=True).fillna("")  # 괄호는 남겨둡니다.
        df['clean_name'] = df['clean_name'].str.replace(r'\s+', '', regex=True).fillna("")
        df['clean_name'] = df['clean_name'].str.replace(r'주식회사', '', regex=True).fillna("") # 주식회사만 제거.
        df['clean_name'] = df['clean_name'].str.upper().fillna("")  # 대문자로 통일

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
                    if name and member and SequenceMatcher(None, name, member).ratio() >= similarity_threshold:
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
            group_repr = {}
            for group in df['group'].unique():
                if df[df['group'] == group]['clean_name'].size > 0 :
                    try:
                        group_repr[group] = df[df['group'] == group]['clean_name'].value_counts().index[0]
                    except:
                        group_repr[group] = ""
            
            df['group_name'] = df['group'].map(group_repr)
        
            # '훈련기관' 열을 그룹 대표 이름으로 업데이트
            df['훈련기관'] = df['group_name']
        
        # 불필요한 열 제거
        df.drop(columns=['clean_name', 'group'], inplace=True)

        return df
    
    except Exception as error:
        print(f"Error in group_institutions_advanced: {error}")
        return pd.DataFrame()


def classify_training_type(row):
    types = []
    if row['과정명'].startswith('재직자_'):
        types.append('재직자 훈련')
    if pd.notna(row.get('훈련기관')) and '학교' in str(row['훈련기관']):
        types.append('대학주도형 훈련')
    if pd.notna(row.get('선도기업')) or pd.notna(row.get('파트너기관')):
        types.append('선도기업형 훈련')
    if row['과정명'].startswith('심화_'):
        types.append('심화 훈련')
    if row['과정명'].startswith('융합_'):
        types.append('융합 훈련')
    if not types:
        types.append('신기술 훈련')
    return '&'.join(types)