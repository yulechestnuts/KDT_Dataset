import pandas as pd
import requests
import io
import streamlit as st

@st.cache_data
def load_data_from_github(url):
    """
    GitHub URL에서 CSV 파일을 로드하는 함수 (최대한 단순화, 디버깅 강화)
    """
    print(f"load_data_from_github called with URL: {url}")  # Debug print: URL 확인

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        print(f"Response status code: {response.status_code}") # Debug print: HTTP 상태 코드
        print(f"Response content type: {response.headers.get('Content-Type')}") # Debug print: Content-Type 헤더

        if '.csv' in url.lower():
            print("Trying to read as CSV file (basic)") # Debug print: CSV 로딩 시도 메시지
            csv_text = response.content.decode('utf-8') # 응답 내용을 UTF-8 텍스트로 디코딩
            print("CSV text sample (first 200 chars):", csv_text[:200]) # Debug print: CSV 텍스트 내용 일부 출력 (앞부분 200자)
            df = pd.read_csv(io.StringIO(csv_text)) # 가장 기본적인 read_csv 호출 (index_col=0, 0값 행/열 제거 X)
        else:
            st.error(f"Error: 지원하지 않는 파일 형식입니다: {url}")
            return pd.DataFrame()

        print("load_data_from_github 컬럼 확인 (로드 직후):") # Debug print: 컬럼 목록 출력
        print(df.columns.tolist()) # 컬럼 목록을 리스트 형태로 출력
        
        if '고유값' not in df.columns: # 오류 체크 (기존 코드 유지)
            st.error("Error: '고유값' 열이 존재하지 않습니다. 데이터 파일을 확인해주세요.")
            return pd.DataFrame()

        print("load_data_from_github - '고유값' 컬럼 확인 완료") # Debug print: '고유값' 컬럼 확인 완료 메시지

        return df

    except requests.exceptions.RequestException as e:
        st.error(f"Error: 데이터 로딩 실패 - 네트워크 오류가 발생했습니다. \n\n {e}")
        return pd.DataFrame()
    except pd.errors.ParserError as e:
        st.error(f"Error: CSV 파일 파싱 오류 - 유효하지 않은 파일입니다. \n\n {e}")
        return pd.DataFrame()
    except Exception as e:
        st.error(f"Error: 데이터 처리 중 오류 발생: \n\n {e}")
        return pd.DataFrame()