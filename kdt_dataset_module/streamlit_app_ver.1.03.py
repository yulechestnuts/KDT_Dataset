    # streamlit_app_ver.1.03.py
import streamlit as st
import pandas as pd
import numpy as np
import altair as alt
from datetime import datetime
import requests
import io
import json
import re
import plotly.express as px
from difflib import SequenceMatcher
import streamlit.components.v1 as components
from utils.data_loader import load_data_from_github, preprocess_data, calculate_yearly_revenue, group_institutions_advanced, classify_training_type # 수정된 import
from visualization.charts import create_yearly_revenue_chart, create_ncs_revenue_bar_chart, create_ncs_yearly_revenue_line_chart, create_course_ranking_bar_chart, create_course_revenue_chart, format_currency
from visualization.reports import (
        analyze_training_institution,
        analyze_course,
        analyze_ncs,
        create_institution_analysis_component
    )
    
    # 페이지 설정
st.set_page_config(layout="wide")
    
    # CSS 수정: HTML 컴포넌트 내부 스크롤 설정
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
    
    # 깃허브 URL
url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/result_kdtdata_202411.xlsx?raw=true"
    
    # 데이터 로딩 및 전처리
df = load_data_from_github(url)
if df.empty:
        st.error("데이터를 불러오는데 실패했습니다.")
        st.stop()
    
df = preprocess_data(df)
    
    # 연도 컬럼 찾기 수정 (years 변수 생성 및 analyze_course에 전달)
year_columns = [
        str(col)
        for col in df.columns
        if isinstance(col, (int, str)) and re.match(r"20\d{2}년?", str(col))
    ]
years = sorted(year_columns)
    
df, yearly_data = calculate_yearly_revenue(df)
    
    # 분석 유형 선택
analysis_type = st.sidebar.selectbox(
        "분석 유형 선택", ["훈련기관 분석", "과정 분석", "NCS 분석"]
    )
    
    # 페이지 분리
if analysis_type == "훈련기관 분석":
        analyze_training_institution(df, yearly_data)
elif analysis_type == "과정 분석":
        analyze_course(df, yearly_data, years)
elif analysis_type == "NCS 분석":
        analyze_ncs(df, yearly_data)
    
    # React 컴포넌트 로드
try:
        st.markdown("""
            <iframe src="http://localhost:3000/ranking.html" width="100%" height="800" style="border:none;"></iframe>
            """, unsafe_allow_html=True)
except FileNotFoundError:
        st.error("React 컴포넌트를 찾을 수 없습니다. React 컴포넌트를 빌드하고 서버를 실행해주세요.")