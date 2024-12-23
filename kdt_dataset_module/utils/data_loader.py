import pandas as pd
import requests
import io
import streamlit as st

@st.cache_data
def load_data_from_github(url):
    """
    GitHub URL에서 엑셀 파일을 로드하고, 에러를 처리하며, 
    데이터를 정제하는 함수입니다.

    Args:
        url (str): 엑셀 파일의 GitHub URL

    Returns:
        pd.DataFrame: 로드 및 정제된 데이터프레임,
                       데이터 로딩 또는 처리 중 오류 발생 시 빈 데이터프레임 반환
    """
    try:
        response = requests.get(url, timeout=20) # timeout을 넉넉하게 20초로 설정
        response.raise_for_status()  # 상태 코드가 200이 아니면 에러 발생
        df = pd.read_excel(io.BytesIO(response.content), engine="openpyxl")

        # 더미 데이터 제거 (불필요한 행/열 제거)
        df = df.dropna(axis=0, how='all')
        df = df.dropna(axis=1, how='all')

        # '고유값' 열이 없는 경우 빈 데이터프레임 반환 (더미 데이터만 있는 경우)
        if '고유값' not in df.columns:
            st.error("Error: '고유값' 열이 존재하지 않습니다. 데이터 파일을 확인해주세요.")
            return pd.DataFrame()
        
        df = df[df['고유값'].notna()]

        #결측치 0으로 채우기
        df = df.fillna(0)

        return df
    except requests.exceptions.RequestException as e:
        st.error(f"Error: 데이터 로딩 실패 - 네트워크 오류가 발생했습니다. \n\n {e}")
        return pd.DataFrame()
    except pd.errors.ParserError as e:
        st.error(f"Error: 엑셀 파일 파싱 오류 - 유효하지 않은 엑셀 파일입니다. \n\n {e}")
        return pd.DataFrame()
    except Exception as e:
        st.error(f"Error: 데이터 처리 중 오류 발생: \n\n {e}")
        return pd.DataFrame()