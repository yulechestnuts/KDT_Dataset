import os
from sqlalchemy import create_engine, text
import pandas as pd
from urllib.parse import quote_plus
import traceback
import mysql.connector

def get_db_engine():
    """데이터베이스 엔진 생성"""
    try:
        # SQLAlchemy 엔진 생성
        engine = create_engine(
            "mysql+mysqlconnector://root:alcam2024!@127.0.0.1:3306/kdtdata",
            echo=True,  # SQL 쿼리 로깅
            pool_pre_ping=True  # 연결 확인
        )
        
        # 연결 테스트
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            print("SQLAlchemy 엔진 연결 테스트 성공")
        
        return engine
        
    except Exception as e:
        print(f"데이터베이스 엔진 생성 중 오류 발생:\n{str(e)}")
        print("상세 오류 정보:")
        traceback.print_exc()
        return None

def load_data_from_db(engine, table_name):
    """데이터베이스에서 데이터를 로드"""
    if engine is None:
        print("유효한 데이터베이스 엔진이 제공되지 않았습니다.")
        return pd.DataFrame()
        
    try:
        # 테이블 존재 여부 확인
        check_query = text(f"""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'kdtdata'
            AND table_name = :table_name
        """)
        
        with engine.connect() as conn:
            result = conn.execute(check_query, {"table_name": table_name}).scalar()
            if result == 0:
                print(f"테이블 '{table_name}'이 존재하지 않습니다.")
                return pd.DataFrame()
        
            # 데이터 로드
            print(f"테이블 '{table_name}' 데이터 로드 시도 중...")
            query = text(f"SELECT * FROM {table_name}")
            df = pd.read_sql_query(query, conn)
            
            if df.empty:
                print(f"경고: '{table_name}' 테이블에서 데이터를 찾을 수 없습니다.")
            else:
                print(f"성공적으로 {len(df)} 행의 데이터를 로드했습니다.")
                print(f"컬럼 목록: {', '.join(df.columns)}")
            
            return df
        
    except Exception as e:
        print(f"데이터 로드 중 오류 발생:\n{str(e)}")
        print("상세 오류 정보:")
        traceback.print_exc()
        return pd.DataFrame()

# 사용 예시
if __name__ == "__main__":
    # SQLAlchemy 엔진 생성 및 데이터 로드
    engine = get_db_engine()
    if engine:
        table_name = "kdt_dataset_202412"  # 실제 테이블 이름으로 변경
        df = load_data_from_db(engine, table_name)
        if not df.empty:
            print("\n데이터 로드 성공!")
            print(f"데이터 샘플:\n{df.head()}")