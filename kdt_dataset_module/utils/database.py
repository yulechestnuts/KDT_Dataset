import os
from sqlalchemy import create_engine
import pandas as pd
import streamlit as st
from dotenv import load_dotenv
import urllib.parse  # urllib.parse 모듈 import 추가

# .env 파일 로드
load_dotenv()

# 환경변수에서 DB 정보 가져오기
db_url_env = os.getenv("DB_URL")  # DB_URL 환경 변수 원본 값 가져오기
table_name = os.getenv("TABLE_NAME")

# DB_URL 파싱 및 비밀번호 URL 디코딩
parsed_url = urllib.parse.urlparse(db_url_env)
decoded_password = urllib.parse.unquote(parsed_url.password) # 비밀번호 URL 디코딩
db_url = db_url_env.replace(parsed_url.password, decoded_password) # 디코딩된 비밀번호로 DB_URL 재구성

# 디버깅: 환경 변수 확인
if not db_url:
    raise ValueError("DB_URL is not set. Please check your .env file.")
if not table_name:
    raise ValueError("TABLE_NAME is not set. Please check your .env file.")

def get_db_engine():
    """DB 연결 엔진을 생성합니다."""
    try:
        engine = create_engine(db_url, pool_pre_ping=True, pool_recycle=3600) # 수정된 db_url 사용
        with engine.connect() as connection:
            st.success(f"DB 연결 성공: {db_url}") # st.write -> st.success 로 변경 (성공 메시지 강조)
        return engine
    except Exception as e:
        st.error(f"DB 연결 실패: {e}")
        return None

def load_data_from_db(engine, table_name):
    """데이터베이스에서 데이터를 로드"""
    try:
        query = f"SELECT * FROM {table_name} LIMIT 10"  # 예시 쿼리
        df = pd.read_sql(query, engine)
        st.success("데이터 로드 성공") # st.write -> st.success 로 변경 (성공 메시지 강조)
        st.dataframe(df.head())  # st.write -> st.dataframe 으로 변경 (DataFrame 출력)
        return df
    except Exception as e:
        st.error(f"쿼리 실행 중 오류 발생: {e}")
        return pd.DataFrame()

# DB 연결 및 데이터 로드 (streamlit_app_ver.1.03.py 에서는 이 부분은 필요 없음. utils.database.py 는 모듈로 사용됨)
# engine = get_db_engine()
# if engine:
#     df = load_data_from_db(engine, table_name)