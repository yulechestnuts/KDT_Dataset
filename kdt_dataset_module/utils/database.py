import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import pandas as pd
from dotenv import load_dotenv

load_dotenv()


def get_db_engine():
    """데이터베이스 엔진 생성"""
    db_type = os.getenv("DB_TYPE")
    db_url = os.getenv("DB_URL")
    try:
        if db_type and db_url:
            # URL에서 driver부분을 명시적으로 지정합니다.
            engine = create_engine(f"{db_url}",  
                                    )
            print(f"Successfully connected to {db_type} database.")
            try:
              with engine.connect() as connection:
                print("데이터베이스 연결 성공 (get_db_engine 내부)")
            except Exception as e:
               print(f"데이터베이스 연결 실패 (get_db_engine 내부): {e}")
               return None
            return engine
        else:
           print("환경 변수 DB_TYPE 또는 DB_URL이 설정되지 않았습니다.")
           return None
           
    except Exception as e:
        print(f"Error connecting to the {db_type} database: {e}")
        return None

def load_data_from_db(engine, table_name):
    """데이터베이스에서 데이터를 로드"""
    try:
        with engine.connect() as connection:
            print("데이터베이스 연결 성공 (load_data_from_db 내부)")
            query = text(f"SELECT * FROM {table_name}")
            df = pd.read_sql_query(query, connection)
            print(f"Successfully loaded data from '{table_name}' table.")
            print("load_data_from_db 컬럼 확인:", df.columns)
            print(f"load_data_from_db 데이터 타입:\n{df.dtypes}")
            print("load_data_from_db 데이터 샘플:")
            print(df.head())
            
            if '훈련기관' in df.columns:
                print("load_data_from_db '훈련기관' 컬럼 샘플:")
                print(df['훈련기관'].head())
                print(f"Type of '훈련기관' column: {df['훈련기관'].dtype}")

            if '실 매출 대비 ' in df.columns:
                print("load_data_from_db '실 매출 대비' 컬럼 샘플:")
                print(df['실 매출 대비 '].head())
                print(f"Type of '실 매출 대비' column: {df['실 매출 대비 '].dtype}")

            year_columns = ['2021년', '2022년', '2023년', '2024년', '2025년']
            for year in year_columns:
              if year in df.columns:
                 print(f"load_data_from_db '{year}' 컬럼 샘플:")
                 print(df[year].head())
                 print(f"Type of '{year}' column: {df[year].dtype}")
            
            if df.empty:
                 print("데이터 로딩 후 빈 데이터프레임이 생성되었습니다.")
                 return pd.DataFrame()
            
            return df
    except Exception as e:
        print(f"Error loading data from the database: {e}")
        return pd.DataFrame()