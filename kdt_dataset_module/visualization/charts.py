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

def create_ncs_revenue_bar_chart(ncs_stats):
    """NCS별 누적매출 바 차트를 생성합니다."""
    base_chart = alt.Chart(ncs_stats).encode(
        x=alt.X('NCS명:N', sort='-y', axis=alt.Axis(labelAngle=-45, labelFontSize=10))
    )

    bars = base_chart.mark_bar().encode(
        y=alt.Y('누적매출:Q', title='누적매출 (원)'),
        tooltip=[
            alt.Tooltip('NCS명:N', title='NCS명'),
            alt.Tooltip('누적매출:Q', title='누적매출', format=',.0f'),
            alt.Tooltip('과정명:Q', title='과정 수')
        ]
    )

    text = base_chart.mark_text(
        align='center',
        baseline='bottom',
        dy=-5,
        fontSize=10
    ).encode(
        y=alt.Y('누적매출:Q'),
        text=alt.Text('누적매출:Q', format='.1e')
    )

    chart = (bars + text).properties(
        width=700,
        height=400,
        title='NCS별 누적매출'
    )
    return chart

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