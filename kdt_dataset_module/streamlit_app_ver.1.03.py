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

from utils.data_loader import load_data_from_github
from utils.data_preprocessing import preprocess_data
from utils.data import calculate_yearly_revenue, group_institutions_advanced, classify_training_type
from visualization.reports import analyze_training_institution, analyze_course, analyze_ncs

@st.cache_data
def load_data():
    url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/result_kdtdata_202411.xlsx?raw=true"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()  # 상태 코드가 200이 아니면 에러 발생
        df = pd.read_excel(io.BytesIO(response.content), engine="openpyxl")
        print("load_data 컬럼 확인:", df.columns)
        if df.empty:
            st.error("데이터를 불러오는데 실패했습니다.")
            return pd.DataFrame(), True  # 변경: 빈 DataFrame과 stop 여부를 반환
        return df, False # 변경: 데이터프레임과 stop 여부 반환
    except requests.exceptions.RequestException as e:
        st.error(f"데이터를 불러올 수 없습니다: {e}")
        return pd.DataFrame(), True # 변경: 빈 DataFrame과 stop 여부를 반환
    except Exception as e:
        st.error(f"데이터 처리 중 오류가 발생했습니다: {e}")
        return pd.DataFrame(), True # 변경: 빈 DataFrame과 stop 여부를 반환

def create_ranking_component(df, yearly_data):
    institution_revenue = df.groupby('훈련기관').agg({
        '누적매출': 'sum',
        '과정명': 'count',
        '과정시작일': 'min',
        '과정종료일': 'max'
    }).reset_index()

    # 연도별 매출 합산하기
    year_columns = [str(col) for col in df.columns if isinstance(col, (int, str)) and re.match(r'20\d{2}년', str(col))]

    # 훈련기관별 연도별 매출 합산
    yearly_sums = {}
    for year in year_columns:
        yearly_sums[year] = df.groupby('훈련기관')[year].sum()

    # ranking_data 생성
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

def main():
    st.set_page_config(layout="wide")
    
    # CSS 수정: HTML 컴포넌트 내부 스크롤 설정
    st.markdown("""
        <style>
        .stHtmlFrame-container {
            height: 800px;
            overflow-y: scroll !important;  /* 세로 스크롤 활성화 */
        }
        iframe {
            height: 100% !important;
            min-height: 800px !important;
        }
        </style>
    """, unsafe_allow_html=True)
    
    df, stop = load_data()
    if stop:
      return
    
    df = preprocess_data(df)
    
    # 연도 컬럼 찾기 수정
    year_columns = [str(col) for col in df.columns if isinstance(col, (int, str)) and re.match(r'20\d{2}년?', str(col))]
    
    df, yearly_data = calculate_yearly_revenue(df)
    
    # HTML 컴포넌트에 overflow 스타일 추가
    js_code = create_ranking_component(df, yearly_data)
    # HTML 컴포넌트에 스크롤 스타일 추가
    js_code = f"""
        <div style="height: 800px; overflow-y: auto;">
            {js_code}
        </div>
    """
    html(js_code, height=800)
    
    analysis_type = st.sidebar.selectbox(
        "분석 유형 선택",
        ["훈련기관 분석", "과정 분석", "NCS 분석"]
    )
    
    if analysis_type == "훈련기관 분석":
        analyze_training_institution(df, yearly_data)
    elif analysis_type == "과정 분석":
        analyze_course(df, yearly_data)
    else:
        analyze_ncs(df, yearly_data)

if __name__ == "__main__":
    main()