import pandas as pd
import requests
import io
import streamlit as st
from difflib import SequenceMatcher
import re

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

        df = df.dropna(axis=0, how='all').dropna(axis=1, how='all')

        if '고유값' not in df.columns:
            st.error("Error: '고유값' 열이 존재하지 않습니다. 데이터 파일을 확인해주세요.")
            return pd.DataFrame()

        df = df[df['고유값'].notna()].fillna(0)

        print("load_data_from_github 컬럼 확인:", df.columns)
        print(f"load_data_from_github 데이터 타입:\n{df.dtypes}")
        print("load_data_from_github 데이터 샘플:")
        print(df.head())

        if '훈련기관' in df.columns:
            print("load_data_from_github '훈련기관' 컬럼 샘플:")
            print(df['훈련기관'].head())
            print(f"Type of '훈련기관' column: {df['훈련기관'].dtype}")

        if '실 매출 대비' in df.columns:
            print("load_data_from_github '실 매출 대비' 컬럼 샘플:")
            print(df['실 매출 대비'].head())
            print(f"Type of '실 매출 대비' column: {df['실 매출 대비'].dtype}")

        year_columns = ['2021년', '2022년', '2023년', '2024년', '2025년']
        for year in year_columns:
            if year in df.columns:
                print(f"load_data_from_github '{year}' 컬럼 샘플:")
                print(df[year].head())
                print(f"Type of '{year}' column: {df[year].dtype}")

        if df.empty:
            st.error("데이터 로딩 후 빈 데이터프레임이 생성되었습니다.")
            return pd.DataFrame()

        # '실 매출 대비' 및 연도별 매출 컬럼을 숫자형으로 변환 (int64)
        if '실 매출 대비' in df.columns:
            df['실 매출 대비'] = pd.to_numeric(df['실 매출 대비'].astype(str).str.replace(',', ''), errors='coerce').fillna(0).astype('Int64')

        for year in year_columns:
            if year in df.columns:
                df[year] = pd.to_numeric(df[year].astype(str).str.replace(',', ''), errors='coerce').fillna(0).astype('Int64')

        # 누적 매출 계산 (연도별 매출 컬럼이 모두 숫자로 변환된 후에 계산)
        df['누적매출'] = df[year_columns].sum(axis=1)
        
        # 데이터 로딩 후 특정 훈련기관 데이터 확인
        smart_data = df[df['훈련기관'].str.contains('스마트인재개발원', na=False)]
        if not smart_data.empty:
            print("\n'스마트인재개발원' 데이터 샘플 (로딩 직후):")
            print(smart_data)
            print(smart_data.to_markdown(index=False)) # 마크다운 표 형태로 출력
            

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