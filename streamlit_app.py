import streamlit as st
import pandas as pd
import numpy as np
import altair as alt
from datetime import datetime
import requests
import io

# 데이터 로드 함수 (캐시 적용)
@st.cache_data
def load_data():
    url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/result_kdtdata.xlsx?raw=true"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            df = pd.read_excel(io.BytesIO(response.content), engine="openpyxl")
            return df
    except Exception as e:
        st.error(f"데이터를 불러올 수 없습니다: {e}")
    return pd.DataFrame({
    })

# 데이터 전처리 함수
def preprocess_data(df):
    # 날짜 형식 변환
    df['과정종료일'] = pd.to_datetime(df['과정종료일'])
    
    # 수료율 계산
    df['수료율'] = df['수료인원'] / df['수강신청 인원'] * 100
    
    # 연도별 매출 컬럼
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    
    # 누적 매출 계산
    df['누적매출'] = df[year_columns].sum(axis=1)
    
    # 대한상공회의소와 한국표준협회 특별 처리
    special_orgs = ['대한상공회의소', '한국표준협회']
    for org in special_orgs:
        mask = (df['훈련기관명'] == org) & (df['선도기업'].notna()) & (df['파트너기관'].notna())
        df.loc[mask, year_columns] *= 0.1
        
        # 파트너기관으로 90% 매출 이전
        partner_mask = df['훈련기관명'].isin(df.loc[mask, '파트너기관'])
        df.loc[partner_mask, year_columns] += df.loc[mask, year_columns].values * 0.9
    
    return df

# 메인 함수
def main():
    st.set_page_config(layout="wide", page_title="K-Digital Training 분석")
    
    # 데이터 로드 및 전처리
    df = load_data()
    df = preprocess_data(df)
    
    # 사이드바 구성
    st.sidebar.title("K-Digital Training 분석")
    analysis_type = st.sidebar.selectbox("분석 유형", ["훈련기관", "과정명", "NCS명"])
    
    if analysis_type == "훈련기관":
        analyze_training_institution(df)
    elif analysis_type == "과정명":
        analyze_course(df)
    else:
        analyze_ncs(df)

# 훈련기관 분석 함수
def analyze_training_institution(df):
    st.title("훈련기관 분석")
    
    # 기관 선택
    institution = st.selectbox("훈련기관 선택", df['훈련기관명'].unique())
    
    # 선택된 기관의 데이터
    inst_data = df[df['훈련기관명'] == institution]
    
    # 연도별 매출 및 순위 계산
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    total_market = df[year_columns].sum()
    market_share = (inst_data[year_columns].sum() / total_market * 100).round(2)
    ranks = df.groupby('훈련기관명')[year_columns].sum().rank(ascending=False, method='min')
    inst_ranks = ranks.loc[institution].astype(int)
    
    # 매출 그래프
    sales_data = pd.DataFrame({
        'Year': year_columns,
        'Sales': inst_data[year_columns].sum().values / 1e8,
        'Market Share': market_share.values,
        'Rank': inst_ranks.values
    })
    
    sales_chart = alt.Chart(sales_data).mark_bar().encode(
        x='Year',
        y='Sales',
        tooltip=['Year', alt.Tooltip('Sales:Q', format='.1f'), 'Market Share', 'Rank']
    ).properties(
        title="연도별 매출 및 시장 점유율",
        width=600,
        height=400
    )
    
    text = sales_chart.mark_text(
        align='center',
        baseline='bottom',
        dy=-5
    ).encode(
        text=alt.Text('Sales:Q', format='.1f')
    )
    
    st.altair_chart(sales_chart + text, use_container_width=True)
    
    # 요약 정보
    total_sales = inst_data['누적매출'].sum() / 1e8
    overall_rank = df.groupby('훈련기관명')['누적매출'].sum().rank(ascending=False, method='min')[institution]
    st.write(f"**{institution}**의 현재 누적 매출은 **{total_sales:.1f}억 원**이며, 시장점유율 순위는 **{overall_rank:.0f}위** 입니다.")
    
    # 과정별 분석
    st.subheader("과정별 분석")
    course_data = inst_data.groupby('과정명').agg({
        '수강신청 인원': 'sum',
        '수료인원': 'sum',
        '만족도': 'mean',
        '누적매출': 'sum'
    }).sort_values('누적매출', ascending=False)
    
    course_data['수료율'] = (course_data['수료인원'] / course_data['수강신청 인원'] * 100).round(2)
    course_data['매출비중'] = (course_data['누적매출'] / course_data['누적매출'].sum() * 100).round(2)
    
    # 과정별 매출 그래프
    course_sales_chart = alt.Chart(course_data.reset_index()).mark_bar().encode(
        y=alt.Y('과정명:N', sort='-x'),
        x='누적매출:Q',
        tooltip=['과정명', alt.Tooltip('누적매출:Q', format='.0f'), '수료율', '만족도']
    ).properties(
        title="과정별 누적 매출",
        width=600,
        height=400
    )
    
    st.altair_chart(course_sales_chart, use_container_width=True)
    
    # 과정별 매출 비중 파이 차트
    pie_data = course_data[['매출비중']].reset_index()
    pie_chart = alt.Chart(pie_data).mark_arc().encode(
        theta='매출비중:Q',
        color='과정명:N',
        tooltip=['과정명', '매출비중']
    ).properties(
        title="과정별 매출 비중",
        width=400,
        height=400
    )
    
    st.altair_chart(pie_chart, use_container_width=True)
    
    # 인기 과목 정보
    popular_course = course_data.sort_values('수강신청 인원', ascending=False).iloc[0]
    st.write(f"**{institution}**에서 가장 인기 있는 과목은 **{popular_course.name}**으로, "
             f"수강 인원은 **{popular_course['수강신청 인원']}명**이며, "
             f"수료 인원은 **{popular_course['수료인원']}명**입니다.")

# 과정명 분석 함수
def analyze_course(df):
    st.title("과정 분석")
    
    # 과정 선택
    course = st.selectbox("과정 선택", df['과정명'].unique())
    
    # 선택된 과정의 데이터
    course_data = df[df['과정명'] == course]
    
    # 회차별 정보
    st.subheader("회차별 정보")
    for i, row in course_data.iterrows():
        st.write(f"**{i+1}회차**")
        st.write(f"수강신청 인원: {row['수강신청 인원']}명")
        st.write(f"수료인원: {row['수료인원']}명")
        st.write(f"수료율: {row['수료율']:.2f}%")
        st.write(f"만족도: {row['만족도']:.2f}")
        if row['과정종료일'] > datetime.now():
            st.write("*현재 진행중인 과정입니다.*")
        st.write(f"[고용24에서 과정 정보 확인]({row['과정페이지 링크']})")
        st.write("---")
    
    # 과정 전체 통계
    st.subheader("과정 전체 통계")
    total_applicants = course_data['수강신청 인원'].sum()
    total_completed = course_data['수료인원'].sum()
    avg_satisfaction = course_data['만족도'].mean()
    
    st.write(f"총 수강신청 인원: **{total_applicants}명**")
    st.write(f"총 수료인원: **{total_completed}명**")
    st.write(f"전체 수료율: **{(total_completed/total_applicants*100):.2f}%**")
    st.write(f"평균 만족도: **{avg_satisfaction:.2f}**")

# NCS명 분석 함수
def analyze_ncs(df):
    st.title("NCS 분석")
    
    # NCS 선택
    ncs = st.selectbox("NCS 선택", df['NCS명'].unique())
    
    # 선택된 NCS의 데이터
    ncs_data = df[df['NCS명'] == ncs]
    
    # NCS 관련 과정 목록
    st.subheader("관련 과정 목록")
    for course in ncs_data['과정명'].unique():
        st.write(f"- {course}")
    
    # NCS 전체 통계
    st.subheader("NCS 전체 통계")
    total_applicants = ncs_data['수강신청 인원'].sum()
    total_completed = ncs_data['수료인원'].sum()
    avg_satisfaction = ncs_data['만족도'].mean()
    
    st.write(f"총 수강신청 인원: **{total_applicants}명**")
    st.write(f"총 수료인원: **{total_completed}명**")
    st.write(f"전체 수료율: **{(total_completed/total_applicants*100):.2f}%**")
    st.write(f"평균 만족도: **{avg_satisfaction:.2f}**")
    
    # 연도별 NCS 관련 과정 매출
    st.subheader("연도별 NCS 관련 과정 매출")
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    yearly_sales = ncs_data[year_columns].sum() / 1e8
    
    sales_chart = alt.Chart(pd.DataFrame({
        'Year': year_columns,
        'Sales': yearly_sales.values
    })).mark_bar().encode(
        x='Year',
        y='Sales',
        tooltip=['Year', alt.Tooltip('Sales:Q', format='.1f')]
    ).properties(
        title="연도별 NCS 관련 과정 매출 (억 원)",
        width=600,
        height=400
    )
    
    st.altair_chart(sales_chart, use_container_width=True)

if __name__ == "__main__":
    main()