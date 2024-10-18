import streamlit as st
import pandas as pd
import numpy as np
import altair as alt
from datetime import datetime
import requests
import io
import locale

# Set locale for Korean currency formatting
locale.setlocale(locale.LC_ALL, 'ko_KR.UTF-8')

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
    print("데이터프레임 형태:", df.shape)
    print("데이터프레임 열:", df.columns.tolist())
    
    # 날짜 형식 변환
    if '과정종료일' in df.columns:
        df['과정종료일'] = pd.to_datetime(df['과정종료일'])
    
    # 수료율 계산 (2024-09-30 이전에 종료된 과정만)
    if '수료인원' in df.columns and '수강신청 인원' in df.columns:
        mask = df['과정종료일'] <= pd.Timestamp('2024-09-30')
        df.loc[mask, '수료율'] = df.loc[mask, '수료인원'] / df.loc[mask, '수강신청 인원'] * 100
    
    # 연도별 매출 컬럼
    year_columns = [col for col in df.columns if col.endswith('년') and col[:-1].isdigit()]
    print("연도별 매출 열:", year_columns)
    
    # 누적 매출 계산
    if year_columns:
        df['누적매출'] = df[year_columns].sum(axis=1)
    else:
        print("Warning: 연도별 매출 데이터를 찾을 수 없습니다.")
        df['누적매출'] = 0
    
    # 대한상공회의소와 한국표준협회 특별 처리
    special_orgs = ['대한상공회의소', '한국표준협회']
    for org in special_orgs:
        mask = (df['훈련기관'] == org) & (df['선도기업'].notna()) & (df['파트너기관'].notna())
        if mask.any():
            for _, row in df[mask].iterrows():
                partner_mask = df['훈련기관'] == row['파트너기관']
                for year in year_columns:
                    transfer_amount = row[year]
                    df.loc[mask, year] -= transfer_amount
                    df.loc[partner_mask, year] += transfer_amount
    
    # 누적 매출 다시 계산
    df['누적매출'] = df[year_columns].sum(axis=1)
    
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
    
    # 기관 검색 및 선택
    institution_search = st.text_input("훈련기관 검색")
    filtered_institutions = df['훈련기관'].unique() if not institution_search else [
        inst for inst in df['훈련기관'].unique() if institution_search.lower() in inst.lower()
    ]
    institution = st.selectbox("훈련기관 선택", filtered_institutions)
    
    # 선택된 기관의 데이터
    inst_data = df[df['훈련기관'] == institution]
    
    # 연도별 매출 및 순위 계산
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    total_market = df[year_columns].sum()
    market_share = (inst_data[year_columns].sum() / total_market * 100).round(2)
    ranks = df.groupby('훈련기관')[year_columns].sum().rank(ascending=False, method='min')
    inst_ranks = ranks.loc[institution].astype(int)
    
    # 매출 그래프
    sales_data = pd.DataFrame({
        'Year': year_columns,
        'Sales': inst_data[year_columns].sum().values,
        'Market Share': market_share.values,
        'Rank': inst_ranks.values
    })
    
    sales_chart = alt.Chart(sales_data).mark_bar().encode(
        x='Year',
        y=alt.Y('Sales:Q', axis=alt.Axis(format='~s', title='매출 (원)')),
        tooltip=[
            'Year',
            alt.Tooltip('Sales:Q', format=',d', title='매출 (원)'),
            alt.Tooltip('Market Share:Q', format='.2f', title='시장 점유율 (%)'),
            alt.Tooltip('Rank:Q', title='순위')
        ]
    ).properties(
        title="연도별 매출 및 시장 점유율",
        width=600,
        height=400
    )
    
    text = sales_chart.mark_text(
        align='center',
        baseline='bottom',
        dy=-5,
        fontSize=14
    ).encode(
        text=alt.Text('Sales:Q', format='~s')
    )
    
    st.altair_chart(sales_chart + text, use_container_width=True)
    
    # 요약 정보
    total_sales = inst_data['누적매출'].sum()
    overall_rank = df.groupby('훈련기관')['누적매출'].sum().rank(ascending=False, method='min')[institution]
    st.write(f"**{institution}**의 현재 누적 매출은 **{locale.format_string('%d', total_sales, grouping=True)}원**이며, 시장점유율 순위는 **{overall_rank:.0f}위** 입니다.")
    
    # 과정별 분석
    st.subheader("과정별 분석")
    course_data = inst_data.groupby('과정명').agg({
        '수강신청 인원': 'sum',
        '수료인원': 'sum',
        '만족도': 'mean',
        '누적매출': 'sum',
        '과정종료일': 'max'
    }).sort_values('누적매출', ascending=False)
    
    # 수료율 계산 (2024-09-30 이전에 종료된 과정만)
    completed_courses = course_data[course_data['과정종료일'] <= pd.Timestamp('2024-09-30')]
    course_data.loc[completed_courses.index, '수료율'] = (completed_courses['수료인원'] / completed_courses['수강신청 인원'] * 100).round(2)
    course_data['매출비중'] = (course_data['누적매출'] / course_data['누적매출'].sum() * 100).round(2)
    
    # 상위 10개 과정만 선택
    top_10_courses = course_data.head(10)
    
    # 과정별 매출 그래프
    course_sales_chart = alt.Chart(top_10_courses.reset_index()).mark_bar().encode(
        y=alt.Y('과정명:N', sort='-x', axis=alt.Axis(labelLimit=200)),
        x=alt.X('누적매출:Q', axis=alt.Axis(format='~s', title='누적 매출 (원)')),
        tooltip=[
            '과정명',
            alt.Tooltip('누적매출:Q', format=',d', title='누적 매출 (원)'),
            alt.Tooltip('수료율:Q', format='.2f', title='수료율 (%)'),
            alt.Tooltip('만족도:Q', format='.2f', title='만족도')
        ]
    ).properties(
        title="상위 10개 과정별 누적 매출",
        width=700,
        height=400
    )
    
    text = course_sales_chart.mark_text(
        align='left',
        baseline='middle',
        dx=3,
        fontSize=12
    ).encode(
        text=alt.Text('누적매출:Q', format='~s')
    )
    
    st.altair_chart(course_sales_chart + text, use_container_width=True)
    
    # 과정별 매출 비중 파이 차트
    pie_data = top_10_courses[['매출비중']].reset_index()
    pie_chart = alt.Chart(pie_data).mark_arc().encode(
        theta='매출비중:Q',
        color='과정명:N',
        tooltip=[
            '과정명',
            alt.Tooltip('매출비중:Q', format='.2f', title='매출 비중 (%)')
        ]
    ).properties(
        title="상위 10개 과정별 매출 비중",
        width=500,
        height=500
    )
    
    st.altair_chart(pie_chart, use_container_width=True)
    
    # 인기 과목 정보
    popular_course = course_data.sort_values('수강신청 인원', ascending=False).iloc[0]
    st.write(f"**{institution}**에서 가장 인기 있는 과목은 **{popular_course.name}**으로, "
             f"수강 인원은 **{popular_course['수강신청 인원']:.0f}명**이며, "
             f"수료 인원은 **{popular_course['수료인원']:.0f}명**입니다.")
    
    st.write("(2024-09-30 기준, 과정 종료한 경우만 수료율을 계산했음.)")

# 과정명 분석 함수
def analyze_course(df):
    st.title("과정 분석")
    
    # 과정 검색 및 선택
    course_search = st.text_input("과정 검색")
    filtered_courses = df['과정명'].unique() if not course_search else [
        course for course in df['과정명'].unique() if course_search.lower() in course.lower()
    ]
    course = st.selectbox("과정 선택", filtered_courses)
    
    # 선택된 과정의 데이터
    course_data = df[df['과정명'] == course]
    
    # 회차별 정보
    st.subheader("회차별 정보")
    for i, row in course_data.iterrows():
        st.write(f"**{i+1}회차**")
        st.write(f"수강신청 인원: {row['수강신청 인원']:.0f}명")
        st.write(f"수료인원: {row['수료인원']:.0f}명")
        if row['과정종료일'] <= pd.Timestamp('2024-09-30'):
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
    completed_courses = course_data[course_data['과정종료일'] <= pd.Timestamp('2024-09-30')]
    avg_satisfaction = course_data['만족도'].mean()
    
    st.write(f"총 수강신청 인원: **{total_applicants:.0f}명**")
    st.write(f"총 수료인원: **{total_completed:.0f}명**")
    if not completed_courses.empty:
        overall_completion_rate = (completed_courses['수료인원'].sum() / completed_courses['수강신청 인원'].sum() * 100)
        st.write(f"전체 수료율: **{overall_completion_rate:.2f}%**")
    st.write(f"평균 만족도: **{avg_satisfaction:.2f}**")
    
    st.write("(2024-09-30 기준, 과정 종료한 경우만 수료율을 계산했음.)")

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
    
    # NCS 관련 과정 목록
    st.subheader("관련 과정 목록")
    courses_by_revenue = ncs_data.groupby('과정명')['누적매출'].sum().sort_values(ascending=False)
    top_10_courses = courses_by_revenue.head(10)
    
    for course, revenue in top_10_courses.items():
        st.write(f"- {course} (누적매출: {format(int(revenue), ',')}원)")
    
    # NCS 전체 통계
    st.subheader("NCS 전체 통계")
    total_applicants = completed_courses['수강신청 인원'].sum()
    total_completed = completed_courses['수료인원'].sum()
    avg_satisfaction = completed_courses['만족도'].mean()
    
    st.write(f"총 수강신청 인원: **{int(total_applicants):,}명**")
    st.write(f"총 수료인원: **{int(total_completed):,}명**")
    st.write(f"전체 수료율: **{(total_completed/total_applicants*100):.1f}%** (2024-09-30 기준, 과정 종료한 경우만 계산했음)")
    st.write(f"평균 만족도: **{avg_satisfaction:.2f}**")
    
    # 연도별 NCS 관련 과정 매출
    st.subheader("연도별 NCS 관련 과정 매출")
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    yearly_sales = ncs_data[year_columns].sum()
    total_market = df[year_columns].sum()
    market_share = (yearly_sales / total_market * 100).round(2)
    
    sales_data = pd.DataFrame({
        'Year': year_columns,
        'Sales': yearly_sales.values,
        'Market_Share': market_share.values
    })
    
    # 매출 그래프
    sales_chart = alt.Chart(sales_data).mark_bar().encode(
        x=alt.X('Year:N', title='연도'),
        y=alt.Y('Sales:Q', 
                title='매출 (원)',
                axis=alt.Axis(format=',.0f', titleFontSize=14, labelFontSize=12)),
        tooltip=[
            alt.Tooltip('Year:N', title='연도'),
            alt.Tooltip('Sales:Q', title='매출', format=',.0f'),
            alt.Tooltip('Market_Share:Q', title='시장점유율', format='.1f')
        ]
    ).properties(
        title=alt.TitleParams(
            text="연도별 NCS 관련 과정 매출",
            fontSize=16
        ),
        width=600,
        height=400
    )
    
    # 매출 텍스트 레이블 추가
    text = sales_chart.mark_text(
        align='center',
        baseline='bottom',
        dy=-10,
        fontSize=14
    ).encode(
        text=alt.Text('Sales:Q', format=',.0f')
    )
    
    # 시장점유율 표시
    st.altair_chart(sales_chart + text, use_container_width=True)
    
    for year, share in zip(year_columns, market_share):
        st.write(f"{year} 시장점유율: **{share:.1f}%**")

if __name__ == "__main__":
    main()