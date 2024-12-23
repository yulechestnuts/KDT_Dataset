import streamlit as st
import pandas as pd
from visualization.charts import *
import streamlit.components.v1 as components
import json

# ... (다른 import 문)

def analyze_training_institution(df, yearly_data):
    """훈련기관 분석 함수"""
    # ... (기관별 통계 계산, 필터링, React 컴포넌트 생성 등)
    # ... (st.metric 사용 부분은 st.write, st.dataframe 등으로 대체)
    pass

def analyze_course(df, yearly_data, years):
    """K-Digital Training 과정 분석 및 시각화 함수"""
    st.title("K-Digital Training 과정 분석")

    # ... (이하 생략: 이전 코드와 동일하게 유지)

def analyze_ncs(df, yearly_data, years):
    """NCS 분석을 수행하고 결과를 시각화하는 함수"""
    st.title("NCS 분석")

    # ... (NCS별 통계 계산)

    # 1. NCS별 누적매출 바 차트
    st.subheader("NCS별 누적매출")
    ncs_chart = create_ncs_revenue_bar_chart(ncs_stats)
    st.altair_chart(ncs_chart, use_container_width=True)

    # 2. 연도별 매출 추이 (라인 차트)
    st.subheader("연도별 매출 추이")

    # 연도별 매출 데이터를 long format으로 변환
    yearly_data_long = pd.DataFrame({
        'NCS명': ncs_stats['NCS명'].repeat(len(years)),
        '연도': np.tile(years, len(ncs_stats)),
        '매출': ncs_stats[[f'{year}' for year in years]].values.flatten()
    })

    line_chart = create_ncs_yearly_revenue_line_chart(yearly_data_long)
    st.altair_chart(line_chart, use_container_width=True)

    # 3. 상세 통계 테이블
    st.subheader("NCS별 상세 통계")
    display_stats = ncs_stats.copy()

    # 누적매출 및 연도별 매출을 억원 단위로 변환하여 표시 (한 번만 수행)
    display_stats['누적매출'] = display_stats['누적매출'].apply(lambda x: f"{format_currency(x)}억원")
    for year in years:
        display_stats[year] = display_stats[year].apply(lambda x: f"{format_currency(x)}억원")

    # 상세 통계 테이블 표시
    st.dataframe(
        display_stats,
        column_config={
            "NCS명": "NCS명",
            "누적매출": "누적매출",
            "과정명": "과정 수",
            "과정시작일": "최초 시작일",
            "과정종료일": "최종 종료일",
            **{f'{year}': f'{year} 매출' for year in yearly_data.columns}
        },
        hide_index=True,
        use_container_width=True
    )

# 예시: React 컴포넌트 생성 및 삽입 함수
def create_institution_analysis_component(filtered_institutions, yearly_data, total_market, avg_revenue):
    js_code = f"""
        <div id="institution-analysis-root"></div>
        <script src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
        <script type="text/babel">
            const reportData = {json.dumps(report_data)};
            const totalMarket = {json.dumps(total_market)};
            const avgRevenue = {json.dumps(avg_revenue)};

            // ... (InstitutionAnalysis 컴포넌트 코드)

            ReactDOM.render(
                <InstitutionAnalysis />,
                document.getElementById('institution-analysis-root')
            );
        </script>
    """
    return js_code