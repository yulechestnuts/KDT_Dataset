import os
import requests
import pandas as pd
import numpy as np
import streamlit as st
import altair as alt

# 기본 streamlit 설정
st.set_page_config(
    page_title='KDT 매출분석',
    layout='centered',
    initial_sidebar_state='expanded'
)

# CSS 스타일링
st.markdown("""
    <style>
        .main > div {
            max-width: 1000px;
            padding: 1rem 2rem;
        }
        .metric-container {
            background-color: #f8f9fa;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 0.5rem 0;
        }
    </style>
""", unsafe_allow_html=True)

st.title('KDT 매출분석')

# 데이터 로드 함수
@st.cache_data
def load_data():
    try:
        url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/DATASET_PASTE.xlsx?raw=true"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            with open("temp.xlsx", "wb") as f:
                f.write(response.content)
            
            df = pd.read_excel("temp.xlsx", engine="openpyxl")
            if os.path.exists("temp.xlsx"):
                os.remove("temp.xlsx")
            return df
            
        else:
            st.error(f"데이터를 가져올 수 없습니다. 상태 코드: {response.status_code}")
            return pd.DataFrame()
            
    except Exception as e:
        st.error(f"데이터 로드 중 오류가 발생했습니다: {str(e)}")
        return pd.DataFrame()

# 데이터 로드
df = load_data()

if df.empty:
    st.error("데이터를 불러올 수 없습니다.")
    st.stop()

# 데이터 전처리
df.columns = df.columns.str.strip()
df = df[df['기관명'] != '합계']

# 사이드바 설정
with st.sidebar:
    st.header("기업 선택")
    selected_company = st.selectbox("회사를 선택하세요", df['기관명'].unique())

# 선택된 회사 데이터 필터링
filtered_data = df[df['기관명'] == selected_company]

if filtered_data.empty:
    st.error(f"{selected_company}에 해당하는 데이터가 없습니다.")
else:
    company_data = filtered_data.iloc[0]
    years = ['2021년', '2022년', '2023년', '2024년']
    sales = {year: company_data[year] // 100000000 for year in years}

    # 시장 점유율 및 순위 계산
    total_sales = df[years].sum()
    market_share = {year: (company_data[year] / total_sales[year]) * 100 if total_sales[year] != 0 else 0 for year in years}
    ranks = {year: df[year].rank(ascending=False, method='min') for year in years}
    company_ranks = {year: int(ranks[year][company_data.name]) for year in years}

    # 매출 추이 그래프 (Altair)
    sales_df = pd.DataFrame({'Year': years, 'Sales': list(sales.values())})
    
    chart = alt.Chart(sales_df).mark_line(point=True).encode(
        x='Year',
        y=alt.Y('Sales', title='매출 (억 원)'),
        tooltip=['Year', 'Sales']
    ).properties(
        width=600,
        height=400,
        title=f"{selected_company} 연도별 매출"
    )
    
    text = chart.mark_text(
        align='center',
        baseline='bottom',
        dy=-10
    ).encode(
        text=alt.Text('Sales:Q', format=',d')
    )
    
    st.altair_chart(chart + text, use_container_width=True)

    # 주요 지표 표시
    st.subheader("연도별 주요 지표")
    cols = st.columns(4)
    for i, year in enumerate(years):
        with cols[i]:
            st.metric(
                label=year,
                value=f"{sales[year]:,}억",
                delta=f"점유율 {market_share[year]:.1f}%"
            )

    # 순위 변화 그래프 (Altair)
    rank_df = pd.DataFrame({'Year': years, 'Rank': [company_ranks[year] for year in years]})
    
    rank_chart = alt.Chart(rank_df).mark_line(point=True).encode(
        x='Year',
        y=alt.Y('Rank', scale=alt.Scale(reverse=True), title='순위'),
        tooltip=['Year', 'Rank']
    ).properties(
        width=600,
        height=400,
        title=f"{selected_company} 연도별 순위 변화"
    )
    
    rank_text = rank_chart.mark_text(
        align='center',
        baseline='bottom',
        dy=-10
    ).encode(
        text=alt.Text('Rank:Q', format='d')
    )
    
    st.altair_chart(rank_chart + rank_text, use_container_width=True)

    # 누적 통계
    total_company_sales = sum(company_data[years])
    total_market_sales = sum(total_sales)
    cumulative_market_share = (total_company_sales / total_market_sales) * 100 if total_market_sales != 0 else 0
    df['누적매출'] = df[years].sum(axis=1)
    cumulative_rank = df['누적매출'].rank(ascending=False, method='min')[company_data.name]

    # 누적 통계 표시
    st.write("---")
    col1, col2 = st.columns(2)
    with col1:
        st.metric(
            label="누적 매출",
            value=f"{total_company_sales // 100000000:,}억",
            delta=f"시장 점유율 {cumulative_market_share:.1f}%"
        )
    with col2:
        st.metric(
            label="누적 순위",
            value=f"{int(cumulative_rank)}위"
        )