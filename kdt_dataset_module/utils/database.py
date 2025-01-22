import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import pandas as pd
from dotenv import load_dotenv
from urllib.parse import quote_plus
import traceback

load_dotenv()

def get_db_engine():
     """데이터베이스 엔진 생성"""
     db_type = os.getenv("DB_TYPE")
     db_url = os.getenv("DB_URL")
     try:
         if db_type and db_url:
            # URL 파싱 및 재구성
             url_parts = db_url.split('://')[1].split('@')
             user_pass, host_port_db = url_parts[0], url_parts[1]
             user, password = user_pass.split(':')
             host_port, db_name = host_port_db.split('/')
             host, port = host_port.split(':')
                
             encoded_password = quote_plus(password)
             # driver 옵션 명시적으로 추가
             formatted_url = f"mysql+mysqlconnector://{user}:{encoded_password}@{host}:{port}/{db_name}"
             engine = create_engine(formatted_url, pool_pre_ping=True, pool_recycle=3600)
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
            print("1. 데이터베이스 연결 성공 (load_data_from_db 내부)")
            try:
                print(f"2. 쿼리 실행 시작: SELECT * FROM {table_name} LIMIT 10")
                query = text(f"SELECT * FROM {table_name} LIMIT 10")
                result = connection.execute(query)
                print(f"3. 쿼리 실행 완료: {table_name}")

                print("3-1. 결과 출력 시작")
                rows = result.fetchall()
                print(f"3-2. 결과 출력 완료 (총 {len(rows)}행)")

                 # DataFrame으로 변환 ( 수정)
                if rows:
                 df = pd.DataFrame(rows, columns=result.keys())
                 if df is not None and not df.empty:
                      print("4. load_data_from_db 컬럼 확인:", df.columns)
                      print(f"5. load_data_from_db 데이터 타입:\n{df.dtypes}")
                      print("6. load_data_from_db 데이터 샘플:")
                      print(df.head())
   
                      if '훈련기관' in df.columns:
                           print("7. load_data_from_db '훈련기관' 컬럼 샘플:")
                           print(df['훈련기관'].head())
                           print(f"8. Type of '훈련기관' column: {df['훈련기관'].dtype}")
   
                      if '실 매출 대비' in df.columns:
                         print("9. load_data_from_db '실 매출 대비' 컬럼 샘플:")
                         print(df['실 매출 대비'].head())
                         print(f"10. Type of '실 매출 대비' column: {df['실 매출 대비 '].dtype}")
   
                      year_columns = ['2021년', '2022년', '2023년', '2024년', '2025년']
                      for year in year_columns:
                           if year in df.columns:
                               print(f"11. load_data_from_db '{year}' 컬럼 샘플:")
                               print(df[year].head())
                               print(f"12. Type of '{year}' column: {df[year].dtype}")
                else:
                    print("13. 데이터 로딩 후 빈 데이터프레임이 생성되었습니다.")
                    return pd.DataFrame()
                print("14. 데이터 로드 성공, 데이터프레임 반환")
                return df

            except Exception as e:
                print(f"15. Error loading data from the database(query 실행 오류): {e}")
                traceback.print_exc()
                return pd.DataFrame()

    except Exception as e:
        print(f"16. Error connecting to the database(with engine.connect 에러): {e}")
        return pd.DataFrame()