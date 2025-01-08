import re
import pandas as pd

def calculate_yearly_revenue(df):
    """연도별 매출 계산 함수"""
    year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'^\d{4}년$', col)]
    yearly_data = df[year_columns].copy()
    return df, yearly_data