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
    return pd.DataFrame()

# 데이터 전처리 함수
def preprocess_data(df):
    # 날짜 형식 변환
    if '과정종료일' in df.columns:
        df['과정종료일'] = pd.to_datetime(df['과정종료일'])
    
    # 연도별 매출 컬럼
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    
    # 대한상공회의소와 한국표준협회 매출 이전
    special_orgs = ['대한상공회의소', '한국표준협회']
    for org in special_orgs:
        partner_transfers = df[
            (df['훈련기관'] == org) & 
            (df['파트너기관'].notna())
        ].copy()
        
        for _, row in partner_transfers.iterrows():
            if pd.notna(row['파트너기관']):
                # 해당 파트너기관으로 매출 이전
                partner_mask = df['훈련기관'] == row['파트너기관']
                for year in year_columns:
                    df.loc[partner_mask, year] += row[year]
                # 원래 기관의 매출을 0으로 설정
                df.loc[(df['훈련기관'] == org) & (df['과정명'] == row['과정명']), year_columns] = 0
    
    # 누적 매출 다시 계산
    df['누적매출'] = df[year_columns].sum(axis=1)
    
    return df

def analyze_training_institution(df):
    st.title("훈련기관 분석")
    
    # 기관 검색 및 선택
    inst_search = st.text_input("훈련기관 검색", "")
    filtered_institutions = df['훈련기관'].unique()
    if inst_search:
        filtered_institutions = [inst for inst in filtered_institutions if inst_search.lower() in inst.lower()]
    
    institution = st.selectbox("훈련기관 선택", filtered_institutions)
    
    # 선택된 기관의 데이터
    inst_data = df[df['훈련기관'] == institution]
    
    # 완료된 과정만 필터링
    completed_courses = inst_data[inst_data['과정종료일'] <= pd.Timestamp('2024-09-30')]
    
    # 연도별 매출 및 순위 계산
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    yearly_sales = inst_data[year_columns].sum() / 1e8  # 억 원 단위로 변환
    total_market = df[year_columns].sum() / 1e8
    market_share = (yearly_sales / total_market * 100).round(1)
    
    # 전체 순위 계산
    total_revenue = inst_data['누적매출'].sum() / 1e8
    overall_rank = df.groupby('훈련기관')['누적매출'].sum().rank(ascending=False, method='min')[institution]
    
    # 요약 정보 표시
    st.subheader("기관 종합 현황")
    st.write(f"**{institution}**의 현재 누적 매출은 **{total_revenue:.0f}억 원**이며, "
             f"시장점유율 순위는 **{overall_rank:.0f}위** 입니다.")
    
    # 연도별 매출 표시
    for year, sales, share in zip(year_columns, yearly_sales, market_share):
        st.write(f"{year} 매출: **{sales:.0f}억 원** (시장점유율: {share:.1f}%)")
    
    # 수강생 통계
    total_applicants = completed_courses['수강신청 인원'].sum()
    total_completed = completed_courses['수료인원'].sum()
    completion_rate = (total_completed / total_applicants * 100) if total_applicants > 0 else 0
    avg_satisfaction = completed_courses['만족도'].mean()
    
    st.write(f"수강 인원: **{int(total_applicants):,}명**")
    st.write(f"수료 인원: **{int(total_completed):,}명**")
    st.write(f"수료율: **{completion_rate:.1f}%** (2024-09-30 기준, 과정 종료한 경우만 계산)")
    st.write(f"평균 만족도: **{avg_satisfaction:.2f}**")
    
    # 과정별 분석
    st.subheader("과정별 분석")
    course_data = inst_data.groupby('과정명').agg({
        '수강신청 인원': 'sum',
        '수료인원': 'sum',
        '만족도': 'mean',
        '누적매출': 'sum'
    }).sort_values('누적매출', ascending=False)
    
    # 상위 10개 과정 및 기타
    top_10_courses = course_data.head(10)
    total_revenue = course_data['누적매출'].sum()
    other_revenue = total_revenue - top_10_courses['누적매출'].sum()
    
    # 과정별 매출 데이터 준비
    chart_data = pd.DataFrame({
        '과정명': list(top_10_courses.index) + ['기타'],
        '매출': list(top_10_courses['누적매출'] / 1e8) + [other_revenue / 1e8],
        '비중': list((top_10_courses['누적매출'] / total_revenue * 100)) + 
               [other_revenue / total_revenue * 100]
    })
    
    # 과정별 매출 차트
    chart = alt.Chart(chart_data).mark_bar().encode(
        y=alt.Y('과정명:N', 
                sort='-x',
                axis=alt.Axis(labelAngle=0, labelLimit=300)),
        x=alt.X('매출:Q',
                title='매출 (억원)',
                axis=alt.Axis(format=',.0f')),
        tooltip=[
            alt.Tooltip('과정명:N', title='과정명'),
            alt.Tooltip('매출:Q', title='매출 (억원)', format=',.0f'),
            alt.Tooltip('비중:Q', title='비중 (%)', format='.1f')
        ]
    ).properties(
        title='과정별 매출 (억원)',
        width=700,
        height=400
    )
    
    # 비중 레이블 추가
    text = chart.mark_text(
        align='left',
        baseline='middle',
        dx=5,
        fontSize=12
    ).encode(
        text=alt.Text('비중:Q', format='.1f'),
        color=alt.value('black')
    )
    
    st.altair_chart(chart + text, use_container_width=True)
    
    # 인기 과목 정보
    top_course = top_10_courses.iloc[0]
    st.write(f"**{institution}**에서 가장 높은 매출을 기록한 과목은 **{top_course.name}**으로, "
             f"누적 매출은 **{top_course['누적매출']/1e8:.0f}억 원**이며, "
             f"수강 인원은 **{int(top_course['수강신청 인원']):,}명**, "
             f"수료 인원은 **{int(top_course['수료인원']):,}명**입니다.")

def analyze_course(df):
    st.title("과정 분석")
    
    # 과정 검색 및 선택
    course_search = st.text_input("과정명 검색", "")
    filtered_courses = df['과정명'].unique()
    if course_search:
        filtered_courses = [course for course in filtered_courses if course_search.lower() in course.lower()]
    
    course = st.selectbox("과정 선택", filtered_courses)
    
    # 선택된 과정의 데이터
    course_data = df[df['과정명'] == course]
    
    # 완료된 과정만 필터링
    completed_courses = course_data[course_data['과정종료일'] <= pd.Timestamp('2024-09-30')]
    
    # 전체 통계
    total_revenue = course_data['누적매출'].sum() / 1e8
    total_market = df['누적매출'].sum() / 1e8
    market_share = (total_revenue / total_market * 100)
    market_rank = df.groupby('과정명')['누적매출'].sum().rank(ascending=False, method='min')[course]
    
    # 통계 정보 표시
    st.subheader("과정 종합 현황")
    st.write(f"누적 매출: **{total_revenue:.0f}억 원**")
    st.write(f"시장 점유율: **{market_share:.1f}%** (전체 {market_rank:.0f}위)")
    
    # 연도별 매출
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    yearly_sales = course_data[year_columns].sum() / 1e8
    yearly_market = df[year_columns].sum() / 1e8
    yearly_share = (yearly_sales / yearly_market * 100).round(1)
    
    for year, sales, share in zip(year_columns, yearly_sales, yearly_share):
        st.write(f"{year} 매출: **{sales:.0f}억 원** (시장점유율: {share:.1f}%)")
    
    # 수강생 통계
    total_applicants = completed_courses['수강신청 인원'].sum()
    total_completed = completed_courses['수료인원'].sum()
    completion_rate = (total_completed / total_applicants * 100) if total_applicants > 0 else 0
    avg_satisfaction = completed_courses['만족도'].mean()
    
    st.write(f"수강 인원: **{int(total_applicants):,}명**")
    st.write(f"수료 인원: **{int(total_completed):,}명**")
    st.write(f"수료율: **{completion_rate:.1f}%** (2024-09-30 기준, 과정 종료한 경우만 계산)")
    st.write(f"평균 만족도: **{avg_satisfaction:.2f}**")
    
    # 훈련기관별 분석
    st.subheader("훈련기관별 분석")
    inst_data = course_data.groupby('훈련기관').agg({
        '수강신청 인원': 'sum',
        '수료인원': 'sum',
        '만족도': 'mean',
        '누적매출': 'sum'
    }).sort_values('누적매출', ascending=False)
    
    chart = alt.Chart(
        inst_data.reset_index()
    ).mark_bar().encode(
        y=alt.Y('훈련기관:N', 
                sort='-x',
                axis=alt.Axis(labelAngle=0, labelLimit=300)),
        x=alt.X('누적매출:Q',
                title='매출 (억원)',
                axis=alt.Axis(format=',.0f')),
        tooltip=[
            alt.Tooltip('훈련기관:N', title='훈련기관'),
            alt.Tooltip('누적매출:Q', title='매출 (억원)', format=',.0f'),
            alt.Tooltip('만족도:Q', title='만족도', format='.2f')
        ]
    ).transform_calculate(
        매출=alt.datum.누적매출 / 1e8
    ).encode(
        x=alt.X('매출:Q', title='매출 (억원)')
    ).properties(
        title='훈련기관별 매출 (억원)',
        width=700,
        height=400
    )
    
    st.altair_chart(chart, use_container_width=True)

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

def analyze_ncs(df):
    st.title("NCS 분석")
    
    # NCS 검색 및 선택
    ncs_search = st.text_input("NCS 검색", "")
    filtered_ncs = df['NCS명'].unique()
    if ncs_search:
        filtered_ncs = [ncs for ncs in filtered_ncs if ncs_search.lower() in ncs.lower()]
    
    ncs = st.selectbox("NCS 선택", filtered_ncs)
    
    # 선택된 NCS의 데이터
    ncs_data = df[df['NCS명'] == ncs]
    
    # 과정 종료일 기준으로 데이터 필터링 (2024-09-30 이전 종료된 과정만)
    completed_courses = ncs_data[ncs_data['과정종료일'] <= pd.Timestamp('2024-09-30')]
    
    # 전체 통계 계산
    total_revenue = ncs_data['누적매출'].sum() / 1e8  # 억 원 단위로 변환
    total_applicants = completed_courses['수강신청 인원'].sum()
    total_completed = completed_courses['수료인원'].sum()
    completion_rate = (total_completed / total_applicants * 100) if total_applicants > 0 else 0
    
    # 인기 과정 기준 만족도 평균 계산
    top_courses = ncs_data.nlargest(10, '누적매출')
    avg_satisfaction = top_courses['만족도'].mean()
    
    # 시장 점유율 및 순위 계산
    total_market = df['누적매출'].sum() / 1e8
    market_share = (total_revenue / total_market * 100)
    market_rank = df.groupby('NCS명')['누적매출'].sum().rank(ascending=False, method='min')[ncs]
    
    # 상위 10개 과정 및 기타 계산
    courses_by_revenue = ncs_data.groupby('과정명')['누적매출'].sum().sort_values(ascending=False)
    top_10_courses = courses_by_revenue.head(10)
    total_ncs_revenue = courses_by_revenue.sum()
    other_revenue = total_ncs_revenue - top_10_courses.sum()
    
    # 통계 정보 표시
    st.subheader("NCS 전체 통계")
    st.write(f"누적 매출: **{total_revenue:.0f}억 원**")
    st.write(f"시장 점유율: **{market_share:.1f}%** (전체 {market_rank:.0f}위)")
    st.write(f"수강 인원: **{int(total_applicants):,}명**")
    st.write(f"수료 인원: **{int(total_completed):,}명**")
    st.write(f"수료율: **{completion_rate:.1f}%** (2024-09-30 기준, 과정 종료한 경우만 계산)")
    st.write(f"인기 과정 평균 만족도: **{avg_satisfaction:.2f}**")
    
    # 연도별 매출 분석
    st.subheader("연도별 매출 분석")
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    yearly_sales = ncs_data[year_columns].sum() / 1e8
    yearly_market = df[year_columns].sum() / 1e8
    yearly_share = (yearly_sales / yearly_market * 100).round(1)
    
    for year, sales, share in zip(year_columns, yearly_sales, yearly_share):
        st.write(f"{year} 매출: **{sales:.0f}억 원** (시장점유율: {share:.1f}%)")
    
    # 과정별 매출 차트
    st.subheader("상위 10개 과정 매출 현황")
    course_data = pd.DataFrame({
        '과정명': list(top_10_courses.index) + ['기타'],
        '매출': list(top_10_courses.values / 1e8) + [other_revenue / 1e8],
        '비중': list((top_10_courses / total_ncs_revenue * 100)) + [other_revenue / total_ncs_revenue * 100]
    })
    
    chart = alt.Chart(course_data).mark_bar().encode(
        y=alt.Y('과정명:N', 
                sort='-x',
                axis=alt.Axis(labelAngle=0, labelLimit=300)),  # 레이블 가로 표시
        x=alt.X('매출:Q',
                title='매출 (억원)',
                axis=alt.Axis(format=',.0f')),
        tooltip=[
            alt.Tooltip('과정명:N', title='과정명'),
            alt.Tooltip('매출:Q', title='매출 (억원)', format=',.0f'),
            alt.Tooltip('비중:Q', title='비중', format='.1f')
        ]
    ).properties(
        title='과정별 매출 (억원)',
        width=700,
        height=400
    )
    
    # 매출 레이블 추가
    text = chart.mark_text(
        align='left',
        baseline='middle',
        dx=5,
        fontSize=12
    ).encode(
        text=alt.Text('비중:Q', format='.1f'),
        color=alt.value('black')
    )
    
    st.altair_chart(chart + text, use_container_width=True)

if __name__ == "__main__":
    main()