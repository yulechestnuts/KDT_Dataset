import os
import requests
import pandas as pd
import numpy as np
import streamlit as st
import altair as alt
import io
import traceback

def log_debug(message):
    st.sidebar.text(message)

@st.cache_data
def load_data():
    log_debug("Starting data load process...")
    url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/data_paste.xlsx?raw=true"
    log_debug(f"Attempting to fetch data from: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            log_debug("Successfully fetched data from URL")
            
            # 1. Try reading as Excel
            try:
                log_debug("Attempting to read Excel file...")
                df = pd.read_excel(io.BytesIO(response.content), engine="openpyxl")
                log_debug("Excel file successfully loaded")
                return df
            except Exception as excel_error:
                log_debug(f"Error reading Excel file: {excel_error}")
            
            # 2. Try reading as CSV with different encodings
            encodings = ['utf-8', 'euc-kr', 'cp949', 'iso-8859-1']
            for encoding in encodings:
                try:
                    log_debug(f"Attempting to load as CSV with {encoding} encoding...")
                    df = pd.read_csv(io.StringIO(response.content.decode(encoding)))
                    log_debug(f"CSV file successfully loaded with {encoding} encoding")
                    return df
                except Exception as csv_error:
                    log_debug(f"Error reading CSV file with {encoding} encoding: {csv_error}")
            
            # 3. Last resort: Save as binary and try to read
            log_debug("Attempting to save and read as binary...")
            try:
                df = pd.read_excel(io.BytesIO(response.content), engine="openpyxl")
                log_debug("Successfully read from binary data")
                return df
            except Exception as binary_error:
                log_debug(f"Error reading from binary data: {binary_error}")
        
        else:
            log_debug(f"Unable to fetch data. Status code: {response.status_code}")
        
    except Exception as e:
        log_debug(f"Error in load_data function: {str(e)}")
        log_debug("Full traceback:")
        log_debug(traceback.format_exc())
    
    return pd.DataFrame()

def main():
    # 데이터 로드
    df = load_data()

    if df.empty:
        st.error("데이터를 불러올 수 없습니다. 사이드바의 디버그 정보를 확인해주세요.")
        st.stop()

    # 데이터 전처리
    log_debug("Starting data preprocessing...")
    df.columns = df.columns.str.strip()
    df = df[df['기관명'] != '합계']

    # 데이터 타입 확인 및 변환
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    for col in year_columns:
        log_debug(f"Processing column: {col}")
        log_debug(f"Original data type: {df[col].dtype}")
        if df[col].dtype == 'object':
            df[col] = pd.to_numeric(df[col].str.replace(',', ''), errors='coerce')
        log_debug(f"Final data type: {df[col].dtype}")

    log_debug("Data preprocessing completed")

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

if __name__ == "__main__":
    main()
