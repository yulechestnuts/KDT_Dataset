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
import os
from dotenv import load_dotenv

# utils 모듈에서 함수 직접 임포트 (가독성 및 명시성 향상)
from utils.data_loader import load_data_from_github
from utils.data_preprocessing import preprocess_data
from utils.data import calculate_yearly_revenue
from utils.institution_grouping import group_institutions_advanced
from utils.training_type_classification import classify_training_type
from visualization.reports import analyze_training_institution, analyze_course, analyze_ncs, analyze_top5_institutions
# from utils.database import get_db_engine, load_data_from_db  # 더 이상 필요 없음
st.set_page_config(layout="wide")  # 👈  st.set_page_config() 를 script 최상단으로 이동

# .env 파일 로드
from dotenv import load_dotenv
load_dotenv()

# 데이터베이스 테이블 이름 (환경 변수에서 가져옴) - CSV 파일 이름으로 사용 가능
TABLE_NAME = os.getenv('TABLE_NAME') # CSV 파일 이름 설정에 활용 가능

@st.cache_data
def load_data():
    """데이터 로드 함수 (GitHub CSV 파일에서 로드)"""
    url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/result_kdtdata_202412.csv?raw=true" # 👈 GitHub CSV Raw URL로 변경!
    try:
        response = requests.get(url, timeout=10) # requests 사용하여 GitHub CSV 파일 다운로드
        response.raise_for_status()  # HTTP 에러 발생 시(4xx 또는 5xx) 예외 발생
        df = pd.read_csv(io.StringIO(response.content.decode('utf-8'))) # 다운로드한 CSV 파일을 pandas DataFrame으로 로드
        st.success("GitHub CSV 데이터 로드 성공!") # 성공 메시지 표시
        st.dataframe(df.head()) # 데이터 미리보기 (처음 몇 줄)
        return df
    except requests.exceptions.RequestException as e:
        st.error(f"GitHub에서 데이터를 불러올 수 없습니다: {e}") # 네트워크 오류, URL 오류 등
    except Exception as e:
        st.error(f"데이터 처리 중 오류가 발생했습니다: {e}") # CSV 파싱 오류, pandas 처리 오류 등
    return pd.DataFrame() # 에러 발생 시 빈 DataFrame 반환


# 스트림릿 UI에서 데이터 로드
data = load_data()

# 데이터가 있으면 표시
if not data.empty:
    st.write(data.head())

@st.cache_data
def create_ranking_component(df, yearly_data):
    """훈련기관별 랭킹 컴포넌트 생성"""
    required_columns = ['훈련기관', '누적매출', '과정명', '과정시작일', '과정종료일']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        print(f"Error: 다음 컬럼이 없습니다: {missing_columns} (create_ranking_component)")
        return None

    # 날짜 형식 검증 및 변환
    try:
        df['과정시작일'] = pd.to_datetime(df['과정시작일'])
        df['과정종료일'] = pd.to_datetime(df['과정종료일'])
    except Exception as e:
        print(f"Error: 날짜 형식 변환 실패 - {e} (create_ranking_component)")
        return None

    # 데이터 그룹화 및 연도별 매출 계산
    institution_revenue = df.groupby('훈련기관').agg({
        '누적매출': 'sum',
        '과정명': 'count',
        '과정시작일': 'min',
        '과정종료일': 'max'
    }).reset_index()

    year_columns = [str(col) for col in df.columns if re.match(r'^\d{4}년$', str(col))]
    yearly_sums = {year: df.groupby('훈련기관')[year].sum() for year in year_columns}

    ranking_data = []
    for _, row in institution_revenue.iterrows():
        yearly_revenues = {
            year: float(yearly_sums[year].get(row['훈련기관'], 0)) for year in year_columns
        }

        try:
            ranking_data.append({
                "institution": row['훈련기관'],
                "revenue": float(row['누적매출']),
                "courses": int(row['과정명']),
                "yearlyRevenue": yearly_revenues,
                "startDate": row['과정시작일'].strftime('%Y-%m'),
                "endDate": row['과정종료일'].strftime('%Y-%m')
            })
        except Exception as e:
            print(f"Error: 랭킹 데이터 생성 중 오류 발생 - {e} (create_ranking_component)")
            return None

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

    df = load_data()
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