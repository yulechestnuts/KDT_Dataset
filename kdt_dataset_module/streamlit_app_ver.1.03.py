import streamlit as st
import pandas as pd
import numpy as np
import altair as alt
from datetime import datetime
import requests
import io
from streamlit.components.v1 import html
import json
import re
import plotly.express as px
from difflib import SequenceMatcher

# utils 모듈에서 함수 직접 임포트 (가독성 및 명시성 향상)
from utils.data_loader import load_data_from_github
from utils.data_preprocessing import preprocess_data
from utils.data import calculate_yearly_revenue
from utils.institution_grouping import group_institutions_advanced
from utils.training_type_classification import classify_training_type
from visualization.reports import analyze_training_institution, analyze_course, analyze_ncs, analyze_top5_institutions

@st.cache_data
def create_ranking_component(df, yearly_data):
    """훈련기관별 랭킹 컴포넌트 생성"""
    if '훈련기관' not in df.columns:
       print("Error: '훈련기관' 컬럼이 DataFrame에 없습니다. (create_ranking_component)")
       return None
    institution_revenue = df.groupby('훈련기관').agg({
        '누적매출': 'sum',
        '과정명': 'count',
        '과정시작일': 'min',
        '과정종료일': 'max'
    }).reset_index()

    year_columns = [str(col) for col in df.columns if re.match(r'^\d{4}년$', str(col))]

    yearly_sums = {}
    for year in year_columns:
        yearly_sums[year] = df.groupby('훈련기관')[year].sum()

    ranking_data = []
    for _, row in institution_revenue.iterrows():
        yearly_revenues = {str(year): float(yearly_sums[year].get(row['훈련기관'], 0)) for year in year_columns}

        ranking_data.append({
            "institution": row['훈련기관'],
            "revenue": float(row['누적매출']),
            "courses": int(row['과정명']),
            "yearlyRevenue": yearly_revenues,
            "startDate": row['과정시작일'].strftime('%Y-%m'),
            "endDate": row['과정종료일'].strftime('%Y-%m')
        })

    js_code = """
    <div id="ranking-root"></div>
    <script src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
    <script type="text/babel">
        const rankingData = %s;

        function RankingDisplay() {
            const [selectedYear, setSelectedYear] = React.useState('all');
            const [searchTerm, setSearchTerm] = React.useState('');
            const years = Object.keys(rankingData[0].yearlyRevenue).sort();

             const getRevenueForDisplay = (item) => {
                if (selectedYear === 'all') {
                    return item.revenue;
                }
                return item.yearlyRevenue[selectedYear] || 0;
             };

            const filteredAndSortedData = [...rankingData]
                .filter(item =>
                    item.institution.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .sort((a, b) => getRevenueForDisplay(b) - getRevenueForDisplay(a));

            const maxRevenue = Math.max(...filteredAndSortedData.map(getRevenueForDisplay));

            const formatRevenue = (revenue) => {
                return (revenue / 100000000).toLocaleString('ko-KR', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }) + '억원';
            };

            return (
                <div style={{
                    minHeight: '100vh',
                    background: 'black',
                    color: 'white',
                    padding: '20px'
                }}>
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 0'
                    }}>
                        <h1 style={{
                            fontSize: '48px',
                            fontWeight: 'bold',
                            marginBottom: '16px'
                        }}>KDT 훈련현황</h1>
                        <p style={{
                            fontSize: '20px',
                            color: '#888'
                        }}>첨단산업 디지털 핵심 실무인재 양성 훈련 과정 개괄표</p>

                        <div style={{
                            margin: '20px 0',
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '10px',
                            flexWrap: 'wrap'
                        }}>
                            <input
                                type="text"
                                placeholder="기관명 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    padding: '8px 16px',
                                    background: '#333',
                                    border: '1px solid #666',
                                    borderRadius: '4px',
                                    color: 'white',
                                    marginRight: '10px'
                                }}
                            />
                            <button
                                onClick={() => setSelectedYear('all')}
                                style={{
                                    padding: '8px 16px',
                                    background: selectedYear === 'all' ? '#4299e1' : '#333',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: 'white',
                                    cursor: 'pointer'
                                }}
                            >
                                전체
                            </button>
                            {years.map(year => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    style={{
                                        padding: '8px 16px',
                                        background: selectedYear === year ? '#4299e1' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{
                        maxWidth: '1200px',
                        margin: '0 auto'
                    }}>
                        {filteredAndSortedData.map((item, index) => {
                            const revenue = getRevenueForDisplay(item);
                            const width = (revenue / maxRevenue * 100) + '%%';
                            return (
                                <div key={item.institution}
                                    style={{
                                        background: '#222',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        marginBottom: '8px',
                                        position: 'relative',
                                        animation: `slideIn 0.5s ease-out ${index * 0.1}s both`
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        position: 'relative',
                                        zIndex: 1
                                    }}>
                                        <div>
                                            <span style={{color: '#4299e1', marginRight: '16px'}}>
                                                #{index + 1}
                                            </span>
                                            <span style={{marginRight: '16px'}}>
                                                {item.institution}
                                            </span>
                                            <span style={{color: '#888', fontSize: '14px'}}>
                                                ({item.courses}개 과정)
                                            </span>
                                        </div>
                                        <div>
                                        <span style={{ marginRight: '16px', color: '#4299e1' }}>
                                          {formatRevenue(revenue)}
                                        </span>
                                            <span style={{color: '#888', fontSize: '14px'}}>
                                                {item.startDate} ~ {item.endDate}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        height: '4px',
                                        width: width,
                                        background: '#4299e1',
                                        transition: 'width 1s ease-out',
                                        opacity: 0.5
                                    }}/>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        ReactDOM.render(
            <RankingDisplay />,
            document.getElementById('ranking-root')
        );
    </script>
    <style>
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(-50px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
    </style>
    """ % json.dumps(ranking_data)

    return js_code


@st.cache_data
def calculate_and_visualize_revenue(df):
    """선도기업 비중 및 SSAFY 사업 분류 시각화"""
    year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'^\d{4}년$', col)]

    # 각 유형별 매출액 계산 함수
    def calculate_revenue_by_type(df, year=None):
         if year:
           total_year_revenue = df[year].sum()
           leading_company_year_revenue = df[df['훈련유형'].str.contains('선도기업형 훈련')][year].sum()
           ssafy_year_revenue = df[df['과정명'].str.contains(r'\[삼성\] 청년 SW 아카데미', na=False)][year].sum()
           new_tech_year_revenue = df[~df['훈련유형'].str.contains('선도기업형 훈련')][year].sum()
           non_leading_non_ssafy_year_revenue = max(0, total_year_revenue - leading_company_year_revenue - ssafy_year_revenue - new_tech_year_revenue)
           return {
                '유형': ['신기술 훈련', '선도기업형 훈련', 'SSAFY', '기타'],
                '매출액': [new_tech_year_revenue / 100000000, leading_company_year_revenue / 100000000, ssafy_year_revenue / 100000000, non_leading_non_ssafy_year_revenue / 100000000]
            }

         else:
           total_revenue = df[year_columns].sum().sum()
           leading_company_revenue = df[df['훈련유형'].str.contains('선도기업형 훈련')][year_columns].sum().sum()
           ssafy_revenue = df[df['과정명'].str.contains(r'\[삼성\] 청년 SW 아카데미', na=False)][year_columns].sum().sum()
           new_tech_revenue = df[~df['훈련유형'].str.contains('선도기업형 훈련')][year_columns].sum().sum()
           non_leading_non_ssafy_revenue = max(0, total_revenue - leading_company_revenue - ssafy_revenue - new_tech_revenue)
           return {
                 '유형': ['신기술 훈련', '선도기업형 훈련', 'SSAFY', '기타'],
                '매출액': [new_tech_revenue / 100000000, leading_company_revenue / 100000000, ssafy_revenue / 100000000, non_leading_non_ssafy_revenue / 100000000]
             }
    # 전체 매출 데이터 생성
    total_revenue_data = calculate_revenue_by_type(df)
    total_revenue_df = pd.DataFrame(total_revenue_data)

    # 매출 비중 시각화
    pie_chart = alt.Chart(total_revenue_df).mark_arc().encode(
        theta=alt.Theta(field="매출액", type="quantitative"),
        color=alt.Color(field="유형", type="nominal",
                         scale=alt.Scale(domain=['신기술 훈련', '선도기업형 훈련', 'SSAFY', '기타'],
                                        range=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'])),
        tooltip=['유형', alt.Tooltip('매출액', format=",.2f")]
    ).properties(
        title="전체 사업 유형별 매출 비중 (억 원)"
    )

    st.altair_chart(pie_chart, use_container_width=True)

    # 연도별 매출 비중 계산 및 시각화 (막대 그래프 및 원 그래프)
    for year in year_columns:
      yearly_revenue_data = calculate_revenue_by_type(df, year)
      yearly_revenue_df = pd.DataFrame(yearly_revenue_data)

      # 파이 차트에 표시할 퍼센트 계산을 위한 컬럼 추가
      yearly_revenue_df['매출액_퍼센트'] = yearly_revenue_df['매출액'] / yearly_revenue_df['매출액'].sum() * 100

      pie_chart = alt.Chart(yearly_revenue_df).mark_arc().encode(
            theta=alt.Theta(field="매출액", type="quantitative"),
            color=alt.Color(field="유형", type="nominal",
                            scale=alt.Scale(domain=['신기술 훈련', '선도기업형 훈련', 'SSAFY', '기타'],
                                            range=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'])),
            tooltip=[alt.Tooltip('유형'), alt.Tooltip('매출액', format=",.2f"), alt.Tooltip('매출액_퍼센트', format=".2f", title="비율(%)")]
          ).properties(
              title=f"{year} 사업 유형별 매출 비중 (억 원)"
          )

      # 텍스트 레이블 추가
      text = alt.Chart(yearly_revenue_df).mark_text(
             align='center',
             color='black',
             dy=0
      ).encode(
            text=alt.Text('매출액_퍼센트', format=".1f"),
            theta=alt.Theta(field="매출액", type="quantitative"),
            ).transform_calculate(
                    y_pos = "datum.매출액"
            ).transform_aggregate(
              sum_매출액='sum(매출액)',
              groupby=['유형']
          ).transform_calculate(
             x = "if(datum.sum_매출액 < 0, -25, 0)" ,
              y = "if(datum.sum_매출액 < 0, -25, -2)" ,
          )

      st.altair_chart(pie_chart + text, use_container_width=True)

    yearly_data = {}
    for year in year_columns:
        yearly_revenue_data = calculate_revenue_by_type(df, year)
        yearly_data[year] = {item['유형']: item['매출액'] for item in  [{"유형": yearly_revenue_data['유형'][i] , "매출액": yearly_revenue_data['매출액'][i]} for i in range(len(yearly_revenue_data['유형']))] }


    yearly_revenue_df = pd.DataFrame(yearly_data).T.reset_index()
    yearly_revenue_df.rename(columns={'index': '연도'}, inplace=True)

    yearly_revenue_df_melted = yearly_revenue_df.melt(id_vars=['연도'], var_name='유형', value_name='매출액')

    bar_chart = alt.Chart(yearly_revenue_df_melted).mark_bar().encode(
        x=alt.X('연도', title="연도"),
        y=alt.Y('매출액', title="매출액 (억원)", axis=alt.Axis(format="~s")),
        color=alt.Color(field="유형", type="nominal",
                         scale=alt.Scale(domain=['신기술 훈련', '선도기업형 훈련', 'SSAFY', '기타'],
                                        range=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'])),
         tooltip = ['연도','유형',alt.Tooltip('매출액', format=",.2f")]
    ).properties(
        title="연도별 사업 유형별 매출 비중"
    )

    st.altair_chart(bar_chart, use_container_width=True)

def main():
    st.set_page_config(layout="wide")

    st.markdown("""
        <style>
        .stHtmlFrame-container {
            height: 800px;
            overflow-y: scroll !important;
        }
        iframe {
            height: 100% !important;
            min-height: 800px !important;
        }
        </style>
    """, unsafe_allow_html=True)

    url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/result_kdtdata_202501.csv?raw=true" # Define URL here
    df = load_data_from_github(url) # Use load_data_from_github
    if df.empty:
        return

    # 데이터 전처리
    df = preprocess_data(df)
    if df.empty:  # preprocess_data에서 '훈련기관' 컬럼이 없는 경우
      return

    print("Preprocessed DataFrame Columns:", df.columns)

    # 연도별 매출 계산 (전처리 후 수행)
    year_columns = [str(col) for col in df.columns if re.match(r'^\d{4}년$', str(col))]
    df, yearly_data = calculate_yearly_revenue(df)

    # 랭킹 컴포넌트 생성 및 표시
    js_code = create_ranking_component(df, yearly_data)
    if js_code is None:
      st.error("랭킹 컴포넌트 생성에 실패했습니다. '훈련기관' 컬럼이 없는지 확인해주세요.")
      return
    js_code = f"""
        <div style="height: 800px; overflow-y: auto;">
            {js_code}
        </div>
    """
    html(js_code, height=800)

    # 선도기업 비중 및 SSAFY 사업 분류 시각화
    calculate_and_visualize_revenue(df)

    # 사이드바에서 분석 유형 선택
    analysis_type = st.sidebar.selectbox(
        "분석 유형 선택",
        ["훈련기관 분석", "과정 분석", "NCS 분석"]
    )

    if analysis_type == "훈련기관 분석":
        selected_institution = st.selectbox("훈련기관 선택", df['훈련기관'].unique(), key='selectbox')
        if selected_institution:
            st.subheader("훈련기관별 훈련 유형별 비중")
            total_courses = df.groupby(['훈련기관', '훈련연도']).size().reset_index(name='총 과정 수')
            type_courses = df.groupby(['훈련기관', '훈련연도', '훈련유형']).size().reset_index(name='유형별 과정 수')
            merged_df = pd.merge(total_courses, type_courses, on=['훈련기관', '훈련연도'], how='left')
            merged_df['유형별 과정 수'] = merged_df['유형별 과정 수'].fillna(0)
            merged_df['유형별 비중'] = merged_df['유형별 과정 수'] / merged_df['총 과정 수']
            st.dataframe(merged_df)
            analyze_training_institution(df, yearly_data, selected_institution)

        analyze_top5_institutions(df, yearly_data)

    elif analysis_type == "과정 분석":
        analyze_course(df, yearly_data)
    else:
        analyze_ncs(df, yearly_data)


if __name__ == "__main__":
    main()