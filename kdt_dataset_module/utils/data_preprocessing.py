import pandas as pd
from difflib import SequenceMatcher
import re

def calculate_yearly_revenue(df):
    year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}년', col)]
    df['누적매출'] = df[year_columns].sum(axis=1)
    yearly_data = df[year_columns].copy()
    return df, yearly_data

def group_institutions_advanced(df, similarity_threshold=0.6):
    # ... (group_institutions_advanced 함수 코드는 이전 답변과 동일)
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
    """
    데이터프레임을 전처리합니다.

    Args:
        df (pd.DataFrame): 전처리할 데이터프레임

    Returns:
        pd.DataFrame: 전처리된 데이터프레임, 실패 시 빈 데이터프레임 반환
    """
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
            # 파트너기관이 있는 행
            partner_rows = df[df['파트너기관'].notna()].copy()

            # 파트너기관이 없는 행
            non_partner_rows = df[df['파트너기관'].isna()].copy()
        
            # 파트너기관이 있는 행에 대해서만 훈련기관을 파트너기관으로 변경하고 매출 조정
            partner_rows['훈련기관'] = partner_rows['파트너기관']
        
            for year in year_columns:
                if year in df.columns:
                    # 원본 데이터의 매출 조정 (10%)
                    df.loc[df['파트너기관'].notna(), year] *= 0.1
                    # 파트너 기관이 있는 행에 대해서만 매출 90% 조정
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
    except Exception as e:
        print(f"Error: 데이터 전처리 중 오류 발생: {e}") # st.error 대신 print 사용
        print(f"Error details: {e}")
        return pd.DataFrame()