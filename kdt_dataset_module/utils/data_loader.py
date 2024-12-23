# utils/data.py
import pandas as pd
import requests
import io

def load_data_from_github(url):
    """
    GitHub URL에서 엑셀 파일을 로드하고, 에러를 처리하며,
    데이터를 정제하는 함수입니다.
    """
    try:
        response = requests.get(url, timeout=20)  # timeout을 넉넉하게 20초로 설정
        response.raise_for_status()  # 상태 코드가 200이 아니면 에러 발생
        df = pd.read_excel(io.BytesIO(response.content), engine="openpyxl")

        # 더미 데이터 제거 (불필요한 행/열 제거)
        df = df.dropna(axis=0, how='all')
        df = df.dropna(axis=1, how='all')

        # '고유값' 열이 없는 경우 빈 데이터프레임 반환 (더미 데이터만 있는 경우)
        if '고유값' not in df.columns:
            print("Error: '고유값' 열이 존재하지 않습니다. 데이터 파일을 확인해주세요.")
            return pd.DataFrame()

        df = df[df['고유값'].notna()]
        
        #결측치 0으로 채우기
        df = df.fillna(0)

        return df

    except requests.exceptions.RequestException as e:
        print(f"Error: 데이터 로딩 실패 - 네트워크 오류가 발생했습니다. \n\n {e}")
        return pd.DataFrame()
    except pd.errors.ParserError as e:
        print(f"Error: 엑셀 파일 파싱 오류 - 유효하지 않은 엑셀 파일입니다. \n\n {e}")
        return pd.DataFrame()
    except Exception as e:
        print(f"Error: 데이터 처리 중 오류 발생: \n\n {e}")
        return pd.DataFrame()

def preprocess_data(df):
    """데이터 전처리 함수"""
    df.columns = [str(col).replace(' ', '').strip() for col in df.columns]
    # Convert numeric columns to numeric type, coercing invalid values to NaN
    for col in df.columns:
        if df[col].dtype == 'object':
            try:
                df[col] = pd.to_numeric(df[col], errors='coerce')
            except:
                continue

    # Ensure date columns are in datetime format
    date_cols = ['과정시작일', '과정종료일']
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
    
    # 결측치를 0으로 채우기
    df = df.fillna(0)
    
    return df