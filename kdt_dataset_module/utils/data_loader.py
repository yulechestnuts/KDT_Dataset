import pandas as pd
import requests
import io
import streamlit as st
from difflib import SequenceMatcher
import re # Added import re

def load_data_from_github(url):
    """
    GitHub URL에서 엑셀 또는 CSV 파일을 로드하고, 에러를 처리하며,
    데이터를 정제하는 함수입니다.
    """
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        if url.lower().endswith('.xlsx'):
            df = pd.read_excel(io.BytesIO(response.content), engine="openpyxl")
        elif url.lower().endswith('.csv'):
            df = pd.read_csv(io.StringIO(response.content.decode('utf-8')))
        else:
            st.error(f"Error: 지원하지 않는 파일 형식입니다: {url}")
            return pd.DataFrame()
        
        df = df.dropna(axis=0, how='all')
        df = df.dropna(axis=1, how='all')
        
        if '고유값' not in df.columns:
           st.error("Error: '고유값' 열이 존재하지 않습니다. 데이터 파일을 확인해주세요.")
           return pd.DataFrame()
        df = df[df['고유값'].notna()]
        
        df = df.fillna(0)
        print("load_data_from_github 컬럼 확인:", df.columns)
        print(f"load_data_from_github 데이터 타입:\n{df.dtypes}")
        print("load_data_from_github 데이터 샘플:")  # Debugging: print some of the df data
        print(df.head()) # Debugging
        
        if '훈련기관' in df.columns:  # Debugging for '훈련기관' column
          print("load_data_from_github '훈련기관' 컬럼 샘플:")
          print(df['훈련기관'].head())
          print(f"Type of '훈련기관' column: {df['훈련기관'].dtype}")
            
        if '실 매출 대비 ' in df.columns:  # Debugging for '실 매출 대비 ' column
            print("load_data_from_github '실 매출 대비' 컬럼 샘플:")
            print(df['실 매출 대비 '].head())
            print(f"Type of '실 매출 대비' column: {df['실 매출 대비 '].dtype}")
        
        year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}년', col)]
        for year in year_columns:
            if year in df.columns:
                print(f"load_data_from_github '{year}' 컬럼 샘플:")
                print(df[year].head())
                print(f"Type of '{year}' column: {df[year].dtype}")
            
        if df.empty:
           st.error("데이터 로딩 후 빈 데이터프레임이 생성되었습니다.")
           return pd.DataFrame()
        
        # '실 매출 대비 ' 및 연도별 매출 컬럼을 숫자형으로 변환
        if '실 매출 대비 ' in df.columns:
            df['실 매출 대비 '] = pd.to_numeric(df['실 매출 대비 '].astype(str).str.replace(',', ''), errors='coerce').fillna(0)

        for year in year_columns:
            if year in df.columns:
                df[year] = pd.to_numeric(df[year].astype(str).str.replace(',', ''), errors='coerce').fillna(0)

        # 누적 매출 계산 (연도별 매출 컬럼이 모두 숫자로 변환된 후에 계산)
        df['누적매출'] = df[year_columns].sum(axis=1)
        
        return df
    
    except requests.exceptions.RequestException as e:
        st.error(f"Error: 데이터 로딩 실패 - 네트워크 오류가 발생했습니다. \n\n {e}")
        return pd.DataFrame()
    except pd.errors.ParserError as e:
        st.error(f"Error: 엑셀 또는 CSV 파일 파싱 오류 - 유효하지 않은 파일입니다. \n\n {e}")
        return pd.DataFrame()
    except Exception as e:
        st.error(f"Error: 데이터 처리 중 오류 발생: \n\n {e}")
        return pd.DataFrame()

def calculate_yearly_revenue(df):
    """연도별 매출 계산 함수"""
    year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}년', col)]
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
    print("group_institutions_advanced 함수 시작")
    try:
        df = df.copy()
        if '훈련기관' not in df.columns:
          print("'훈련기관' 컬럼이 DataFrame에 존재하지 않습니다.")
          return df
        
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

        print("group_institutions_advanced 함수 종료")
        return df
    
    except Exception as error:
        print(f"Error in group_institutions_advanced: {error}")
        return pd.DataFrame()

def classify_training_type(row):
    types = []
    
    # 파트너기관 정보가 있으면 '선도기업형 훈련'으로 분류
    if not pd.isna(row.get('파트너기관')) and str(row.get('파트너기관')).strip() != '':
        return '선도기업형 훈련'
    
    # 파트너기관 정보가 없으면, 과정명, 훈련기관, 선도기업 정보로 분류
    if row['과정명'].startswith('재직자_'):
        types.append('재직자 훈련')
    if pd.notna(row.get('훈련기관')) and '학교' in str(row['훈련기관']):
        types.append('대학주도형 훈련')
    if row['과정명'].startswith('심화_'):
        types.append('심화 훈련')
    if row['과정명'].startswith('융합_'):
        types.append('융합 훈련')
    if not types:
        types.append('신기술 훈련')

    return '&'.join(types)