import altair as alt
import pandas as pd
import plotly.express as px
from datetime import datetime

def format_currency(value):
    """금액을 억 원 단위로 포맷팅"""
    return f"{value/100000000:.1f}"

def create_yearly_revenue_chart(yearly_data):
    """연도별 매출 추이 차트를 생성합니다."""
    yearly_revenue = pd.DataFrame()
    for year in yearly_data.columns:
        yearly_sum = yearly_data[year].sum() / 100000000  # 억 단위로 변환
        yearly_revenue = pd.concat([yearly_revenue, pd.DataFrame({
            '연도': [year],
            '매출': [yearly_sum]
        })])

    line_chart = alt.Chart(yearly_revenue).mark_bar().encode(
        x=alt.X('연도:N', axis=alt.Axis(labelAngle=0, labelFontSize=12)),
        y=alt.Y('매출:Q', axis=alt.Axis(labelFontSize=12)),
        tooltip=[
            alt.Tooltip('연도:N', title='연도'),
            alt.Tooltip('매출:Q', title='매출(억원)', format='.1f')
        ]
    ).properties(
        height=300
    )
    return line_chart

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
    
    # 억 단위 변환
    monthly_data['매출(억)'] = monthly_data['누적매출'] / 100000000
    
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
    
    # 이중 축 차트 생성
    base = alt.Chart(monthly_data).encode(
        x=alt.X('월:N', sort=None, axis=alt.Axis(labelAngle=-45, title='월'))
    )
    
    line = base.mark_line(stroke='#4299e1', point=True).encode(
        y=alt.Y('매출(억):Q', axis=alt.Axis(title='매출액 (억원)', titleColor='#4299e1')),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('매출(억):Q', title='매출액 (억원)', format='.2f'),
        ]
    )
    
    bar = base.mark_bar(color='#f6ad55', opacity=0.5).encode(
        y=alt.Y('수강신청 인원:Q', axis=alt.Axis(title='수강신청 인원', titleColor='#f6ad55')),
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

def create_monthly_revenue_summary_chart(df):
    """전체 월별 매출 요약 차트"""
    try:
        # 데이터 복사
        df_monthly = df.copy()
        
        # 수치형 컬럼 float 타입으로 변환
        numeric_cols = ['누적매출', '수강신청 인원', '수료인원']
        for col in numeric_cols:
            if col in df_monthly.columns:
                if df_monthly[col].dtype.name == 'Int64':
                    df_monthly[col] = df_monthly[col].astype(float)
                elif not pd.api.types.is_numeric_dtype(df_monthly[col]):
                    df_monthly[col] = pd.to_numeric(df_monthly[col], errors='coerce').fillna(0)
        
        # '과정시작일' 열이 있는지 확인
        if '과정시작일' not in df_monthly.columns:
            raise ValueError("'과정시작일' 열이 데이터프레임에 없습니다.")
            
        # 시작일을 월 단위로 변환
        df_monthly['월'] = pd.to_datetime(df_monthly['과정시작일'], errors='coerce').dt.to_period('M').astype(str)
        
        # 월별 매출 집계
        monthly_data = df_monthly.groupby('월').agg({
            '누적매출': 'sum',
            '수강신청 인원': 'sum',
            '수료인원': 'sum',
            '과정명': 'count'
        }).reset_index()
        
        # 억 단위 변환
        monthly_data['매출(억)'] = monthly_data['누적매출'] / 100000000
        monthly_data.rename(columns={'과정명': '과정수'}, inplace=True)
        
        # 월 정렬을 위해 datetime으로 변환
        monthly_data['날짜'] = pd.to_datetime(monthly_data['월'] + '-01', errors='coerce')
        monthly_data = monthly_data.sort_values('날짜')
        
        return monthly_data
    except Exception as e:
        import streamlit as st
        st.error(f"월별 매출 요약 차트 생성 중 오류가 발생했습니다: {e}")
        import traceback
        st.error(traceback.format_exc())
        return pd.DataFrame()

def create_ncs_revenue_bar_chart(ncs_stats):
    """NCS별 매출 바 차트를 생성합니다."""
    try:
        # 입력 데이터 검증
        if ncs_stats is None or len(ncs_stats) == 0:
            import streamlit as st
            st.warning("NCS 통계 데이터가 비어 있습니다.")
            return None
            
        # 필수 컬럼 확인
        required_columns = ['ncs', 'revenue']
        missing_columns = [col for col in required_columns if col not in ncs_stats.columns]
        if missing_columns:
            import streamlit as st
            st.warning(f"NCS 통계 데이터에 필요한 컬럼이 없습니다: {', '.join(missing_columns)}")
            return None
        
        # 데이터 타입 검사 및 변환
        if not pd.api.types.is_numeric_dtype(ncs_stats['revenue']):
            ncs_stats['revenue'] = pd.to_numeric(ncs_stats['revenue'], errors='coerce')
            # 변환 후 NaN 값 확인
            nan_count = ncs_stats['revenue'].isna().sum()
            if nan_count > 0:
                import streamlit as st
                st.warning(f"revenue 컬럼에 {nan_count}개의 유효하지 않은 값이 있어 0으로 대체됩니다.")
                ncs_stats['revenue'] = ncs_stats['revenue'].fillna(0)
        
        # 모든 값이 0인지 확인
        if ncs_stats['revenue'].sum() == 0:
            import streamlit as st
            st.warning("모든 NCS의 매출 값이 0입니다.")
            return None
        
        # 상위 10개 NCS 필터링
        top_ncs = ncs_stats.sort_values('revenue', ascending=False).head(10)
        
        # 결과가 비어있는지 확인
        if len(top_ncs) == 0:
            import streamlit as st
            st.warning("필터링 후 표시할 NCS 데이터가 없습니다.")
            return None
        
        # 차트 생성
        fig = px.bar(
            top_ncs, 
            x='ncs', 
            y='revenue',
            text='revenue',
            title='NCS별 매출',
            labels={'ncs': 'NCS 분류명', 'revenue': '매출액(억)'},
            color='revenue',
            color_continuous_scale=px.colors.sequential.Blues
        )
        
        fig.update_traces(texttemplate='%{text:.1f}억', textposition='outside')
        fig.update_layout(uniformtext_minsize=10, uniformtext_mode='hide')
        fig.update_layout(height=500)
        
        return fig
    except Exception as e:
        import streamlit as st
        st.error(f"NCS별 매출 바 차트 생성 중 오류가 발생했습니다: {str(e)}")
        import traceback
        st.error(traceback.format_exc())
        return None

def create_ncs_yearly_revenue_line_chart(yearly_data_long):
    """NCS별 연도별 매출 추이 라인 차트를 생성합니다."""
    line_chart = alt.Chart(yearly_data_long).mark_line(point=True).encode(
        x=alt.X('연도:O', axis=alt.Axis(labelAngle=-45, labelFontSize=10)),
        y=alt.Y('매출:Q', title='매출 (원)'),
        color=alt.Color('NCS명:N', title='NCS명'),
        tooltip=[
            alt.Tooltip('NCS명:N', title='NCS명'),
            alt.Tooltip('연도:O', title='연도'),
            alt.Tooltip('매출:Q', title='매출', format=',.0f')
        ]
    ).properties(
        width=700,
        height=400,
        title='NCS별 연도별 매출 추이'
    )
    return line_chart

def create_course_ranking_bar_chart(course_metrics, selected_year, sort_metric, years):
    """과정 순위 분석"""
    sort_column = {
        "매출액": "매출액_정렬용",
        "수료율": "유효_수료율",
        "만족도": "유효_만족도"
    }[sort_metric]
    
    sorted_courses = course_metrics.sort_values(sort_column, ascending=False)
    top_5 = sorted_courses.head(5)
    
    if sort_metric == "매출액":
        chart_value = top_5['총매출']
        format_str = '.1f'
        value_suffix = '억원'
    else:
        chart_value = top_5[sort_column]
        format_str = '.2f'
        value_suffix = ''

    chart_data = pd.DataFrame({
        '과정명': top_5['과정명'] + ' (' + top_5['훈련기관'] + ')',
        sort_metric: chart_value
    })
    
    bar_chart = alt.Chart(chart_data).mark_bar().encode(
        x=alt.X(f'{sort_metric}:Q',
                title=f'{sort_metric} ({value_suffix})',
                axis=alt.Axis(labelAngle=0, labelFontSize=12)),
        y=alt.Y('과정명:N',
                sort='-x',
                title='과정명',
                axis=alt.Axis(labelFontSize=12)),
        tooltip=[
            alt.Tooltip('과정명:N', title='과정명'),
            alt.Tooltip(f'{sort_metric}:Q',
                       title=sort_metric,
                       format=format_str)
        ]
    ).properties(
        height=300
    )
    return bar_chart

def create_course_revenue_chart(course_yearly_data, selected_course):
    """과정별 연도별 매출 추이 차트 생성 함수"""
    course_chart = alt.Chart(course_yearly_data).mark_bar().encode(
        x=alt.X('연도:N',
                axis=alt.Axis(labelAngle=0, labelFontSize=12)),
        y=alt.Y('매출:Q',
                axis=alt.Axis(labelFontSize=12)),
        tooltip=[
            alt.Tooltip('연도:N', title='연도'),
            alt.Tooltip('매출:Q', title='매출(억원)', format='.1f'),
            alt.Tooltip('개강횟수:Q', title='개강횟수')
        ]
    ).properties(
        height=300,
        title=f"{selected_course} 연도별 매출 추이"
    )
    return course_chart

def create_employment_rate_chart(df):
    """취업률 분포 차트를 생성합니다."""
    try:
        # 취업률 데이터 필터링 (유효한 데이터만)
        employment_data = df[
            (df['취업인원'] > 0) & 
            (df['수료인원'] > 0) & 
            (df['취업률'] > 0)
        ].copy()
        
        if len(employment_data) == 0:
            return None
            
        # 취업률 구간별 분류
        employment_data['취업률_구간'] = pd.cut(
            employment_data['취업률'], 
            bins=[0, 20, 40, 60, 80, 100], 
            labels=['0-20%', '20-40%', '40-60%', '60-80%', '80-100%']
        )
        
        # 구간별 과정 수 집계
        employment_dist = employment_data['취업률_구간'].value_counts().reset_index()
        employment_dist.columns = ['취업률_구간', '과정수']
        
        # 차트 생성
        chart = alt.Chart(employment_dist).mark_bar().encode(
            x=alt.X('취업률_구간:N', title='취업률 구간'),
            y=alt.Y('과정수:Q', title='과정 수'),
            color=alt.Color('취업률_구간:N', legend=None),
            tooltip=[
                alt.Tooltip('취업률_구간:N', title='취업률 구간'),
                alt.Tooltip('과정수:Q', title='과정 수')
            ]
        ).properties(
            title='취업률 분포',
            width=400,
            height=300
        )
        
        return chart
    except Exception as e:
        print(f"취업률 차트 생성 중 오류: {e}")
        return None

def create_employment_comparison_chart(df):
    """수료율 vs 취업률 비교 차트를 생성합니다."""
    try:
        # 유효한 데이터만 필터링
        comparison_data = df[
            (df['수료인원'] > 0) & 
            (df['취업인원'] > 0) & 
            (df['수료율'] > 0) & 
            (df['취업률'] > 0)
        ].copy()
        
        if len(comparison_data) == 0:
            return None
            
        # 샘플링 (데이터가 너무 많으면)
        if len(comparison_data) > 1000:
            comparison_data = comparison_data.sample(n=1000, random_state=42)
        
        # 차트 생성
        chart = alt.Chart(comparison_data).mark_circle(size=60, opacity=0.6).encode(
            x=alt.X('수료율:Q', title='수료율 (%)', scale=alt.Scale(domain=[0, 100])),
            y=alt.Y('취업률:Q', title='취업률 (%)', scale=alt.Scale(domain=[0, 100])),
            color=alt.Color('훈련유형:N', title='훈련유형'),
            tooltip=[
                alt.Tooltip('과정명:N', title='과정명'),
                alt.Tooltip('훈련기관:N', title='훈련기관'),
                alt.Tooltip('수료율:Q', title='수료율', format='.1f'),
                alt.Tooltip('취업률:Q', title='취업률', format='.1f'),
                alt.Tooltip('수료인원:Q', title='수료인원'),
                alt.Tooltip('취업인원:Q', title='취업인원')
            ]
        ).properties(
            title='수료율 vs 취업률 비교',
            width=600,
            height=400
        )
        
        return chart
    except Exception as e:
        print(f"취업률 비교 차트 생성 중 오류: {e}")
        return None

def create_institution_employment_chart(df):
    """기관별 평균 취업률 차트를 생성합니다."""
    try:
        # 유효한 데이터만 필터링
        institution_data = df[
            (df['수료인원'] > 0) & 
            (df['취업인원'] > 0)
        ].copy()
        
        if len(institution_data) == 0:
            return None
            
        # 기관별 평균 취업률 계산
        institution_stats = institution_data.groupby('훈련기관').agg({
            '취업률': 'mean',
            '수료율': 'mean',
            '수료인원': 'sum',
            '취업인원': 'sum',
            '과정명': 'count'
        }).reset_index()
        
        institution_stats.columns = ['훈련기관', '평균취업률', '평균수료율', '총수료인원', '총취업인원', '과정수']
        
        # 최소 과정 수 필터링 (신뢰성을 위해)
        institution_stats = institution_stats[institution_stats['과정수'] >= 3]
        
        if len(institution_stats) == 0:
            return None
            
        # 상위 20개 기관 선택
        top_institutions = institution_stats.nlargest(20, '평균취업률')
        
        # 차트 생성
        chart = alt.Chart(top_institutions).mark_bar().encode(
            x=alt.X('평균취업률:Q', title='평균 취업률 (%)'),
            y=alt.Y('훈련기관:N', title='훈련기관', sort='-x'),
            color=alt.Color('평균수료율:Q', title='평균 수료율 (%)', scale=alt.Scale(scheme='viridis')),
            tooltip=[
                alt.Tooltip('훈련기관:N', title='훈련기관'),
                alt.Tooltip('평균취업률:Q', title='평균 취업률', format='.1f'),
                alt.Tooltip('평균수료율:Q', title='평균 수료율', format='.1f'),
                alt.Tooltip('총수료인원:Q', title='총 수료인원'),
                alt.Tooltip('총취업인원:Q', title='총 취업인원'),
                alt.Tooltip('과정수:Q', title='과정 수')
            ]
        ).properties(
            title='기관별 평균 취업률 (상위 20개)',
            width=600,
            height=500
        )
        
        return chart
    except Exception as e:
        print(f"기관별 취업률 차트 생성 중 오류: {e}")
        return None