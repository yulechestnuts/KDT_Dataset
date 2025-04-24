import re
import pandas as pd
from datetime import datetime

def calculate_yearly_revenue(df):
    """연도별 매출 계산 함수 - 현재 날짜 기준 매출만 계산"""
    year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'^\d{4}년$', col)]
    
    # 현재 날짜 가져오기
    current_date = datetime.now()
    
    # 데이터 복사 - 계산을 위해 float 타입으로 변환
    df_revenue = df.copy()
    for year in year_columns:
        if df_revenue[year].dtype.name == 'Int64':
            # Int64 타입인 경우 float로 변환
            df_revenue[year] = df_revenue[year].astype(float)
    
    # 각 행별로 과정 시작일부터 현재까지의 기간에 비례하여 매출 조정
    for idx, row in df_revenue.iterrows():
        start_date = pd.to_datetime(row['과정시작일'])
        end_date = pd.to_datetime(row['과정종료일'])
        
        # 아직 시작하지 않은 과정은 매출 0으로 설정
        if start_date > current_date:
            for year in year_columns:
                df_revenue.at[idx, year] = 0
            continue
        
        # 이미 종료된 과정은 그대로 유지
        if end_date <= current_date:
            continue
        
        # 진행 중인 과정은 현재까지의 기간에 비례하여 매출 조정
        total_days = (end_date - start_date).days
        if total_days <= 0:
            continue  # 잘못된 날짜 데이터 무시
        
        elapsed_days = (current_date - start_date).days
        ratio = elapsed_days / total_days
        
        for year in year_columns:
            if pd.notna(row[year]) and row[year] > 0:
                df_revenue.at[idx, year] = row[year] * ratio
    
    yearly_data = df_revenue[year_columns].copy()
    return df_revenue, yearly_data