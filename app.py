import os
import requests
import pandas as pd
import numpy as np
import streamlit as st
import altair as alt
import io
import traceback

def log_debug(message):
    # 사이드바 디버그 메시지 표시 비활성화
    if 'debug' in st.session_state and st.session_state['debug']:
        st.sidebar.text(message)

@st.cache_data
def load_data():
    url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/data_paste.xlsx?raw=true"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            df = pd.read_excel(io.BytesIO(response.content), engine="openpyxl")
            return df
    except Exception as e:
        log_debug(f"Error loading data: {e}")
    return pd.DataFrame()

def main():
    st.session_state['debug'] = False  # 디버그 비활성화

    df = load_data()
    if df.empty:
        st.error("데이터를 불러올 수 없습니다.")
        st.stop()

    df.columns = df.columns.str.strip()
    df = df[df['기관명'] != '합계']
    year_columns = ['2021년', '2022년', '2023년', '2024년']

    for col in year_columns:
        df[col] = pd.to_numeric(df[col].str.replace(',', ''), errors='coerce')

    # 사이드바에서 검색 기능 활성화
    with st.sidebar:
        st.header("기업 선택")
        selected_company = st.selectbox(
            "회사를 선택하세요",
            options=df['기관명'].unique(),
            index=0,
            key="company_select"
        )

    filtered_data = df[df['기관명'] == selected_company]
    if filtered_data.empty:
        st.error(f"{selected_company}에 대한 데이터가 없습니다.")
    else:
        company_data = filtered_data.iloc[0]
        sales = {year: company_data[year] / 1e8 for year in year_columns}

        total_sales = df[year_columns].sum()
        market_share = {
            year: (company_data[year] / total_sales[year]) * 100 if total_sales[year] else 0
            for year in year_columns
        }
        ranks = {year: df[year].rank(ascending=False, method='min') for year in year_columns}
        company_ranks = {year: int(ranks[year][company_data.name]) for year in year_columns}

        # 매출 추이 그래프
        sales_df = pd.DataFrame({'Year': year_columns, 'Sales': list(sales.values())})
        chart = alt.Chart(sales_df).mark_line(point=True).encode(
            x='Year',
            y=alt.Y('Sales', title='매출 (억 원)'),
            tooltip=['Year', 'Sales']
        ).properties(width=600, height=400)

        text = chart.mark_text(align='center', baseline='bottom', dy=-10).encode(
            text=alt.Text('Sales:Q', format='.1f')
        )
        st.altair_chart(chart + text, use_container_width=True)

        # 주요 지표 표시
        st.subheader("연도별 주요 지표")
        cols = st.columns(4)
        for i, year in enumerate(year_columns):
            delta_color = "inverse" if market_share[year] < market_share.get(year_columns[i - 1], 100) else "normal"
            with cols[i]:
                st.metric(
                    label=year,
                    value=f"{sales[year]:.1f}억",
                    delta=f"점유율 {market_share[year]:.1f}%",
                    delta_color=delta_color
                )

        # 순위 변화 그래프
        rank_df = pd.DataFrame({'Year': year_columns, 'Rank': [company_ranks[year] for year in year_columns]})
        rank_chart = alt.Chart(rank_df).mark_line(point=True).encode(
            x='Year',
            y=alt.Y('Rank', scale=alt.Scale(reverse=True), title='순위'),
            tooltip=['Year', 'Rank']
        ).properties(width=600, height=400)

        rank_text = rank_chart.mark_text(align='center', baseline='bottom', dy=-10).encode(
            text=alt.Text('Rank:Q')
        )
        st.altair_chart(rank_chart + rank_text, use_container_width=True)

        # 누적 통계
        total_company_sales = sum(company_data[year_columns])
        total_market_sales = sum(total_sales)
        cumulative_market_share = (total_company_sales / total_market_sales) * 100 if total_market_sales else 0
        cumulative_rank = df['누적매출'].rank(ascending=False, method='min')[company_data.name]

        st.write("---")
        col1, col2 = st.columns(2)
        with col1:
            st.metric(
                label="누적 매출",
                value=f"{total_company_sales / 1e8:.1f}억",
                delta=f"시장 점유율 {cumulative_market_share:.1f}%"
            )
        with col2:
            st.metric(label="누적 순위", value=f"{int(cumulative_rank)}위")

if __name__ == "__main__":
    main()
