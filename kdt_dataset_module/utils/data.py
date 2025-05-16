import re
import altair as alt
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

def adjust_yearly_revenue(row, year_col, current_date, overall_completion_rate):
    """
    연도별 매출액 조정
    
    Args:
        row: 데이터프레임의 행
        year_col: 연도 컬럼명 (예: '2023년')
        current_date: 현재 날짜
        overall_completion_rate: 전체 수료율
    
    Returns:
        조정된 연도별 매출액
    """
    # 해당 연도 매출이 없으면 0 반환
    if pd.isna(row[year_col]) or row[year_col] == 0:
        return 0
    
    # 과정이 아직 시작되지 않았으면 원래 매출액 유지
    if row['과정시작일'] > current_date:
        return row[year_col]
    
    # 수강신청 인원이 없으면 원래 매출액 유지
    if pd.isna(row['수강신청 인원']) or row['수강신청 인원'] == 0:
        return row[year_col]
    
    # 실제 완료율 계산 (과정이 완료된 경우)
    if row['과정종료일'] <= current_date:
        actual_completion_rate = row['수료인원'] / row['수강신청 인원'] if row['수강신청 인원'] > 0 else 0
    else:
        # 과정이 진행 중인 경우 - 경과 비율에 따라 계산
        total_duration = (row['과정종료일'] - row['과정시작일']).days
        elapsed_duration = (current_date - row['과정시작일']).days
        progress_ratio = min(max(elapsed_duration / total_duration if total_duration > 0 else 0, 0), 1)
        
        # 진행 비율에 따른 예상 수료율 계산
        if pd.notna(row['수료인원']) and row['수료인원'] > 0:
            # 이미 수료자가 있는 경우 해당 수료율 사용
            actual_completion_rate = row['수료인원'] / row['수강신청 인원']
        else:
            # 수료자가 없는 경우 통합 수료율 기준으로 예상
            actual_completion_rate = overall_completion_rate * progress_ratio
    
    # 예상 수료율 기준으로 매출 조정
    # 기본 전제: 원래 매출은 수강신청인원의 80%를 기준으로 계산됨
    base_completion_rate = 0.8
    
    # 수료율 기반 조정 계수 계산
    adjustment_factor = actual_completion_rate / base_completion_rate
    
    # 수료율이 전체 평균보다 높은 경우 가중치 부여
    if actual_completion_rate > overall_completion_rate:
        # 초과 비율에 대한 추가 가중치 (최대 20% 추가)
        bonus_factor = 1 + min((actual_completion_rate - overall_completion_rate) / overall_completion_rate, 0.2)
        adjustment_factor *= bonus_factor
    
    # 조정 계수 범위 제한 (기존 매출의 90%~120%)
    adjustment_factor = min(max(adjustment_factor, 0.9), 1.2)
    
    # 조정된 매출액 계산
    adjusted_revenue = row[year_col] * adjustment_factor
    
    return adjusted_revenue

def apply_adjusted_revenue(df, override_date=None):
    """
    수료율을 기반으로 매출액을 조정하는 함수
    최신 데이터에 대응하도록 현재 날짜를 명시적으로 설정
    
    Args:
        df: 원본 데이터프레임
        override_date: 현재 날짜를 덮어쓰는 값 (None이면 시스템 현재 날짜 사용)
    
    Returns:
        수료율 조정된 매출액이 추가된 데이터프레임
    """
    import pandas as pd
    
    # 데이터 복사
    df_adjusted = df.copy()
    
    # 현재 날짜 설정 - 명시적으로 설정하거나 시스템 현재 날짜 사용
    if override_date is not None:
        current_date = pd.Timestamp(override_date)
    else:
        current_date = pd.Timestamp.now()
        
    # 로깅을 통해 사용된 날짜 확인
    print(f"수료율 조정에 사용된 현재 날짜: {current_date}")
    
    # 과정 시작일/종료일을 datetime으로 변환
    df_adjusted['과정시작일'] = pd.to_datetime(df_adjusted['과정시작일'])
    df_adjusted['과정종료일'] = pd.to_datetime(df_adjusted['과정종료일'])
    
    # 통합 수료율 계산 (전체 수료인원 / 전체 수강신청 인원)
    total_enrollment = df_adjusted['수강신청 인원'].sum()
    total_completion = df_adjusted['수료인원'].sum()
    overall_completion_rate = total_completion / total_enrollment if total_enrollment > 0 else 0
    
    # 조정된 매출액 계산
    df_adjusted['조정_누적매출'] = df_adjusted.apply(
        lambda row: calculate_adjusted_revenue(row, current_date, overall_completion_rate),
        axis=1
    )
    
    # 연도별 매출액도 조정
    year_columns = [col for col in df_adjusted.columns if isinstance(col, str) and col.endswith('년')]
    for year_col in year_columns:
        df_adjusted[f'조정_{year_col}'] = df_adjusted.apply(
            lambda row: adjust_yearly_revenue(row, year_col, current_date, overall_completion_rate),
            axis=1
        )
    
    return df_adjusted

def calculate_adjusted_revenue(row, current_date, overall_completion_rate):
    """
    개별 과정의 수료율 기반 매출액 조정 계산
    
    Args:
        row: 데이터프레임의 행
        current_date: 현재 날짜
        overall_completion_rate: 전체 수료율
    
    Returns:
        조정된 매출액
    """
    import numpy as np
    
    # 누적매출이 없으면 0 반환
    if pd.isna(row['누적매출']) or row['누적매출'] == 0:
        return 0
    
    # 과정이 아직 시작되지 않았으면 원래 매출액 유지
    if row['과정시작일'] > current_date:
        return row['누적매출']
    
    # 수강신청 인원이 없으면 원래 매출액 유지
    if pd.isna(row['수강신청 인원']) or row['수강신청 인원'] == 0:
        return row['누적매출']
    
    # 실제 완료율 계산 (과정이 완료된 경우)
    if row['과정종료일'] <= current_date:
        actual_completion_rate = row['수료인원'] / row['수강신청 인원'] if row['수강신청 인원'] > 0 else 0
    else:
        # 과정이 진행 중인 경우 - 경과 비율에 따라 계산
        total_duration = (row['과정종료일'] - row['과정시작일']).days
        elapsed_duration = (current_date - row['과정시작일']).days
        progress_ratio = min(max(elapsed_duration / total_duration if total_duration > 0 else 0, 0), 1)
        
        # 진행 비율에 따른 예상 수료율 계산 (단순 선형 비례)
        if pd.notna(row['수료인원']) and row['수료인원'] > 0:
            # 이미 수료자가 있는 경우 해당 수료율 사용
            actual_completion_rate = row['수료인원'] / row['수강신청 인원']
        else:
            # 수료자가 없는 경우 통합 수료율 기준으로 예상
            actual_completion_rate = overall_completion_rate * progress_ratio
    
    # 예상 수료율 기준으로 매출 조정
    # 기본 전제: 원래 매출은 수강신청인원의 80%를 기준으로 계산됨
    base_completion_rate = 0.8
    
    # 수료율 기반 조정 계수 계산 
    # (실제 수료율 / 기본 수료율 80%)
    adjustment_factor = actual_completion_rate / base_completion_rate
    
    # 수료율이 전체 평균보다 높은 경우 가중치 부여
    if actual_completion_rate > overall_completion_rate:
        # 초과 비율에 대한 추가 가중치 (최대 20% 추가)
        bonus_factor = 1 + min((actual_completion_rate - overall_completion_rate) / overall_completion_rate, 0.2)
        adjustment_factor *= bonus_factor
    
    # 조정 계수 범위 제한 (기존 매출의 90%~120%)
    adjustment_factor = min(max(adjustment_factor, 0.9), 1.2)
    
    # 조정된 매출액 계산
    adjusted_revenue = row['누적매출'] * adjustment_factor
    
    return adjusted_revenue

def create_monthly_revenue_chart_adjusted(df, institution=None, override_date=None):
    """
    수료율 조정된 월별 매출 흐름 차트 생성 - 기관별 필터링 가능
    
    Args:
        df: 데이터프레임
        institution: 훈련기관명 (None이면 전체)
        override_date: 현재 날짜를 덮어쓰는 값 (None이면 시스템 현재 날짜 사용)
    """
    import pandas as pd
    import altair as alt
    
    # 현재 날짜 설정 - 명시적으로 설정하거나 시스템 현재 날짜 사용
    if override_date is not None:
        current_date = pd.Timestamp(override_date)
    else:
        current_date = pd.Timestamp.now()
        
    # 로깅을 통해 사용된 날짜 확인
    print(f"월별 차트 생성에 사용된 현재 날짜: {current_date}")
    
    # 데이터 복사 및 수료율 기반 매출액 조정 적용
    df_monthly = apply_adjusted_revenue(df, current_date)
    
    # 수치형 컬럼 float 타입으로 변환
    numeric_cols = ['누적매출', '조정_누적매출', '수강신청 인원', '수료인원']
    for col in numeric_cols:
        if col in df_monthly.columns and pd.api.types.is_integer_dtype(df_monthly[col]):
            df_monthly[col] = df_monthly[col].astype(float)
    
    # 기관별 필터링
    if institution:
        df_monthly = df_monthly[df_monthly['훈련기관'] == institution]
    
    # 시작일을 월 단위로 변환
    df_monthly['월'] = pd.to_datetime(df_monthly['과정시작일']).dt.to_period('M').astype(str)
    
    # 월별 매출, 수강생 수 집계
    monthly_data = df_monthly.groupby('월').agg({
        '누적매출': 'sum',
        '조정_누적매출': 'sum',
        '수강신청 인원': 'sum',
        '수료인원': 'sum'
    }).reset_index()
    
    # 실제 금액(10배)으로 변환
    monthly_data['매출(억)'] = monthly_data['누적매출'] * 10 / 100000000
    monthly_data['조정_매출(억)'] = monthly_data['조정_누적매출'] * 10 / 100000000
    
    # 월 정렬을 위해 datetime으로 변환
    monthly_data['날짜'] = pd.to_datetime(monthly_data['월'] + '-01')
    monthly_data = monthly_data.sort_values('날짜')
    
    # 빈 데이터 처리
    if len(monthly_data) == 0:
        # 빈 차트 반환
        return alt.Chart().mark_text(
            text="데이터가 없습니다.",
            fontSize=20
        ).properties(
            width=800,
            height=400,
            title=f"{institution or '전체'} 월별 매출 및 수강생 추이 (수료율 조정)"
        )
    
    # 이중 축 차트 생성 - Y축 레이블 수평으로 변경
    base = alt.Chart(monthly_data).encode(
        x=alt.X('월:N', sort=None, axis=alt.Axis(labelAngle=-45, title='월'))
    )
    
    # 기존 매출 라인 (점선)
    line1 = base.mark_line(
        stroke='#4299e1', 
        point=True,
        strokeDash=[5, 5],
        opacity=0.6
    ).encode(
        y=alt.Y('매출(억):Q', axis=alt.Axis(title='매출액 (억원)', titleColor='#4299e1', labelAngle=0)),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('매출(억):Q', title='기존 매출액 (억원)', format='.2f'),
        ]
    )
    
    # 수료율 조정 매출 라인 (실선)
    line2 = base.mark_line(
        stroke='#48BB78',
        point=True,
        strokeWidth=3
    ).encode(
        y=alt.Y('조정_매출(억):Q', axis=alt.Axis(title='매출액 (억원)', titleColor='#4299e1', labelAngle=0)),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('조정_매출(억):Q', title='수료율 조정 매출액 (억원)', format='.2f'),
        ]
    )
    
    # 수강신청 인원 바 차트
    bar = base.mark_bar(color='#f6ad55', opacity=0.5).encode(
        y=alt.Y('수강신청 인원:Q', axis=alt.Axis(title='수강신청 인원', titleColor='#f6ad55', labelAngle=0)),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('수강신청 인원:Q', title='수강신청 인원', format=',d'),
            alt.Tooltip('수료인원:Q', title='수료인원', format=',d')
        ]
    )
    
    # 레이어 결합
    chart = alt.layer(bar, line1, line2).resolve_scale(
        y='independent'
    ).properties(
        width=800,
        height=400,
        title=f"{institution or '전체'} 월별 매출 및 수강생 추이 (수료율 조정, 현재 날짜: {current_date.strftime('%Y-%m-%d')})"
    )
    
    return chart

def create_monthly_only_revenue_chart(df, institution=None):
    """월별로만 집계한 매출 흐름 차트 생성 (연도 구분 없이)"""
    # 데이터 복사
    df_monthly = df.copy()
    
    # 수치형 컬럼 float 타입으로 변환
    numeric_cols = ['누적매출', '수강신청 인원', '수료인원']
    for col in numeric_cols:
        if col in df_monthly.columns and df_monthly[col].dtype.name == 'Int64':
            df_monthly[col] = df_monthly[col].astype(float)
    
    # 기관별 필터링
    if institution:
        df_monthly = df_monthly[df_monthly['훈련기관'] == institution]
    
    # 시작일을 월 단위로 변환 (날짜에서 월만 추출)
    df_monthly['월'] = pd.to_datetime(df_monthly['과정시작일']).dt.month.astype(str) + '월'
    
    # 월별 매출, 수강생 수 집계
    monthly_data = df_monthly.groupby('월').agg({
        '누적매출': 'sum',
        '수강신청 인원': 'sum',
        '수료인원': 'sum'
    }).reset_index()
    
    # 실제 금액(10배)으로 변환
    monthly_data['매출(억)'] = monthly_data['누적매출'] * 10 / 100000000
    
    # 월 정렬
    month_order = {'1월': 1, '2월': 2, '3월': 3, '4월': 4, '5월': 5, '6월': 6, 
                   '7월': 7, '8월': 8, '9월': 9, '10월': 10, '11월': 11, '12월': 12}
    monthly_data['월_정렬'] = monthly_data['월'].map(month_order)
    monthly_data = monthly_data.sort_values('월_정렬')
    
    # 빈 데이터 처리
    if len(monthly_data) == 0:
        # 빈 차트 반환
        import streamlit as st
        return alt.Chart().mark_text(
            text="데이터가 없습니다.",
            fontSize=20
        ).properties(
            width=800,
            height=400,
            title=f"{institution or '전체'} 월별 매출 및 수강생 추이 (연도 통합)"
        )
    
    # 이중 축 차트 생성 - Y축 레이블 수평으로 변경
    base = alt.Chart(monthly_data).encode(
        x=alt.X('월:N', sort=list(month_order.keys()), axis=alt.Axis(title='월'))
    )
    
    line = base.mark_line(stroke='#4299e1', point=True).encode(
        y=alt.Y('매출(억):Q', axis=alt.Axis(title='매출액 (억원)', titleColor='#4299e1', labelAngle=0)),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('매출(억):Q', title='매출액 (억원)', format='.2f'),
        ]
    )
    
    bar = base.mark_bar(color='#f6ad55', opacity=0.5).encode(
        y=alt.Y('수강신청 인원:Q', axis=alt.Axis(title='수강신청 인원', titleColor='#f6ad55', labelAngle=0)),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('수강신청 인원:Q', title='수강신청 인원', format=',d'),
            alt.Tooltip('수료인원:Q', title='수료인원', format=',d')
        ]
    )
    
    chart = alt.layer(line, bar).resolve_scale(
        y='independent'
    ).properties(
        width=800,
        height=400,
        title=f"{institution or '전체'} 월별 매출 및 수강생 추이 (연도 통합)"
    )
    
    return chart

def create_monthly_revenue_chart(df, institution=None):
    """월별 매출 흐름 차트 생성 - 기관별 필터링 가능"""
    # 데이터 복사
    df_monthly = df.copy()
    
    # 수치형 컬럼 float 타입으로 변환
    numeric_cols = ['누적매출', '수강신청 인원', '수료인원']
    for col in numeric_cols:
        if col in df_monthly.columns and df_monthly[col].dtype.name == 'Int64':
            df_monthly[col] = df_monthly[col].astype(float)
    
    # 기관별 필터링
    if institution:
        df_monthly = df_monthly[df_monthly['훈련기관'] == institution]
    
    # 시작일을 월 단위로 변환
    df_monthly['월'] = pd.to_datetime(df_monthly['과정시작일']).dt.to_period('M').astype(str)
    
    # 월별 매출, 수강생 수 집계
    monthly_data = df_monthly.groupby('월').agg({
        '누적매출': 'sum',
        '수강신청 인원': 'sum',
        '수료인원': 'sum'
    }).reset_index()
    
    # 실제 금액(10배)으로 변환
    monthly_data['매출(억)'] = monthly_data['누적매출'] * 10 / 100000000
    
    # 월 정렬을 위해 datetime으로 변환
    monthly_data['날짜'] = pd.to_datetime(monthly_data['월'] + '-01')
    monthly_data = monthly_data.sort_values('날짜')
    
    # 빈 데이터 처리
    if len(monthly_data) == 0:
        # 빈 차트 반환
        return alt.Chart().mark_text(
            text="데이터가 없습니다.",
            fontSize=20
        ).properties(
            width=800,
            height=400,
            title=f"{institution or '전체'} 월별 매출 및 수강생 추이"
        )
    
    # 이중 축 차트 생성 - Y축 레이블 수평으로 변경
    base = alt.Chart(monthly_data).encode(
        x=alt.X('월:N', sort=None, axis=alt.Axis(labelAngle=-45, title='월'))
    )
    
    line = base.mark_line(stroke='#4299e1', point=True).encode(
        y=alt.Y('매출(억):Q', axis=alt.Axis(title='매출액 (억원)', titleColor='#4299e1', labelAngle=0)),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('매출(억):Q', title='매출액 (억원)', format='.2f'),
        ]
    )
    
    bar = base.mark_bar(color='#f6ad55', opacity=0.5).encode(
        y=alt.Y('수강신청 인원:Q', axis=alt.Axis(title='수강신청 인원', titleColor='#f6ad55', labelAngle=0)),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('수강신청 인원:Q', title='수강신청 인원', format=',d'),
            alt.Tooltip('수료인원:Q', title='수료인원', format=',d')
        ]
    )
    
    chart = alt.layer(line, bar).resolve_scale(
        y='independent'
    ).properties(
        width=800,
        height=400,
        title=f"{institution or '전체'} 월별 매출 및 수강생 추이"
    )
    
    return chart
