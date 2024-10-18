import streamlit as st
import pandas as pd
import numpy as np
import altair as alt
from datetime import datetime
import requests
import io

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

def preprocess_data(df):
    if '과정종료일' in df.columns:
        df['과정종료일'] = pd.to_datetime(df['과정종료일'])
        df['회차'] = df['회차'].astype(int)
    
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    
    # 대한상공회의소와 한국표준협회 매출 이전
    special_orgs = ['대한상공회의소', '한국표준협회']
    for org in special_orgs:
        # 파트너기관이 있는 과정들만 선택
        partner_courses = df[
            (df['훈련기관'] == org) & 
            (df['파트너기관'].notna())
        ].copy()
        
        for _, row in partner_courses.iterrows():
            partner = row['파트너기관']
            course = row['과정명']
            # 파트너기관으로 90% 매출 이전
            for year in year_columns:
                transfer_amount = row[year] * 0.9  # 90% 이전
                df.loc[(df['훈련기관'] == partner) & (df['과정명'] == course), year] += transfer_amount
                df.loc[(df['훈련기관'] == org) & (df['과정명'] == course), year] *= 0.1  # 10% 남김
    
    # 누적매출 다시 계산
    df['누적매출'] = df[year_columns].sum(axis=1)
    
    return df

def analyze_training_institution(df):
    st.title("훈련기관 분석")
    
    # 좌우 컬럼으로 레이아웃 분할
    left_col, right_col = st.columns([2, 3])
    
    with left_col:
        # 검색 기능이 있는 훈련기관 선택
        inst_search = st.text_input("훈련기관 검색", "")
        filtered_institutions = df['훈련기관'].unique()
        if inst_search:
            filtered_institutions = [inst for inst in filtered_institutions if inst_search.lower() in inst.lower()]
        
        institution = st.selectbox("훈련기관 선택", filtered_institutions)
        
        inst_data = df[df['훈련기관'] == institution]
        
        # 연도별 매출 및 시장점유율
        year_columns = ['2021년', '2022년', '2023년', '2024년']
        yearly_sales = inst_data[year_columns].sum() / 1e8
        total_market = df[year_columns].sum() / 1e8
        market_share = (yearly_sales / total_market * 100).round(1)
        
        # 누적 매출 및 순위
        total_revenue = inst_data['누적매출'].sum() / 1e8
        overall_rank = df.groupby('훈련기관')['누적매출'].sum().rank(ascending=False, method='min')[institution]
        
        # 주요 지표 카드 표시
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-title">누적 매출</div>
            <div class="metric-value">{total_revenue:.0f}억원</div>
            <div class="metric-subvalue">시장 점유율 순위: {overall_rank:.0f}위</div>
        </div>
        """, unsafe_allow_html=True)
        
        # 연도별 매출 카드
        for year, sales, share in zip(year_columns, yearly_sales, market_share):
            st.markdown(f"""
            <div class="metric-card">
                <div class="metric-title">{year} 매출</div>
                <div class="metric-value">{sales:.0f}억원</div>
                <div class="metric-subvalue">시장점유율: {share:.1f}%</div>
            </div>
            """, unsafe_allow_html=True)
        
        # 수강생 관련 지표
        total_applicants = inst_data['수강신청 인원'].sum()
        total_completed = inst_data['수료인원'].sum()
        completion_rate = (total_completed / total_applicants * 100) if total_applicants > 0 else 0
        avg_satisfaction = inst_data['만족도'].mean()
        
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-title">수강생 현황</div>
            <div class="metric-value">{int(total_completed):,}명</div>
            <div class="metric-subvalue">
                수강인원: {int(total_applicants):,}명<br>
                수료율: {completion_rate:.1f}%<br>
                평균 만족도: {avg_satisfaction:.2f}
            </div>
        </div>
        """, unsafe_allow_html=True)
    
    with right_col:
        st.subheader("과정별 매출 분석")
        
        # 과정별 매출 분석
        course_data = inst_data.groupby('과정명').agg({
            '수강신청 인원': 'sum',
            '수료인원': 'sum',
            '만족도': 'mean',
            '누적매출': 'sum'
        }).sort_values('누적매출', ascending=False)
        
        # 상위 10개 과정 선택
        top_10_courses = course_data.head(10)
        
        chart_data = pd.DataFrame({
            '과정': top_10_courses.index,
            '매출': top_10_courses['누적매출'] / 1e8,
            '비중': (top_10_courses['누적매출'] / top_10_courses['누적매출'].sum() * 100)
        })
        
        chart = alt.Chart(chart_data).mark_bar().encode(
            y=alt.Y('과정:N', 
                    sort='-x',
                    axis=alt.Axis(labelAngle=0, labelLimit=300)),
            x=alt.X('매출:Q',
                    title='매출 (억원)',
                    axis=alt.Axis(format=',.0f')),
            color=alt.Color('매출:Q', scale=alt.Scale(scheme='blues')),
            tooltip=[
                alt.Tooltip('과정:N', title='과정'),
                alt.Tooltip('매출:Q', title='매출 (억원)', format=',.0f'),
                alt.Tooltip('비중:Q', title='비중 (%)', format='.1f')
            ]
        ).properties(
            title='과정별 매출 현황',
            width=600,
            height=400
        )
        
        text = chart.mark_text(
            align='left',
            baseline='middle',
            dx=5,
            fontSize=12
        ).encode(
            text=alt.Text('비중:Q', format='.1f'),
            color=alt.value('white')
        )
        
        st.altair_chart(chart + text, use_container_width=True)

    # Debugging information
    if institution in ['대한상공회의소', '한국표준협회', '멀티캠퍼스']:
        st.subheader("디버깅 정보")
        for year in year_columns:
            st.write(f"{year} 매출: {df[df['훈련기관'] == institution][year].sum() / 1e8:.2f}억원")

def analyze_ncs(df):
    st.title("NCS 분석")
    
    ncs_search = st.text_input("NCS 검색", "")
    filtered_ncs = df['NCS명'].unique()
    if ncs_search:
        filtered_ncs = [ncs for ncs in filtered_ncs if ncs_search.lower() in ncs.lower()]
    
    ncs = st.selectbox("NCS 선택", filtered_ncs)
    
    ncs_data = df[df['NCS명'] == ncs]
    
    # 전체 수강/수료 인원
    total_applicants = ncs_data['수강신청 인원'].sum()
    total_completed = ncs_data['수료인원'].sum()
    
    # 수료율 계산 (종료된 과정만)
    completed_courses = ncs_data[ncs_data['과정종료일'] <= pd.Timestamp('2024-09-30')]
    completion_rate = (completed_courses['수료인원'].sum() / completed_courses['수강신청 인원'].sum() * 100) if completed_courses['수강신청 인원'].sum() > 0 else 0
    
    total_revenue = ncs_data['누적매출'].sum() / 1e8
    total_market = df['누적매출'].sum() / 1e8
    market_share = (total_revenue / total_market * 100)
    market_rank = df.groupby('NCS명')['누적매출'].sum().rank(ascending=False, method='min')[ncs]
    
    st.subheader("NCS 전체 통계")
    st.write(f"누적 매출: **{total_revenue:.0f}억 원**")
    st.write(f"시장 점유율: **{market_share:.1f}%** (전체 {market_rank:.0f}위)")
    
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    yearly_sales = ncs_data[year_columns].sum() / 1e8
    yearly_market = df[year_columns].sum() / 1e8
    yearly_share = (yearly_sales / yearly_market * 100).round(1)
    
    for year, sales, share in zip(year_columns, yearly_sales, yearly_share):
        st.write(f"{year} 매출: **{sales:.0f}억 원** (시장점유율: {share:.1f}%)")
    
    st.write(f"총 수강 인원: **{int(total_applicants):,}명**")
    st.write(f"총 수료 인원: **{int(total_completed):,}명**")
    st.write(f"수료율: **{completion_rate:.1f}%** (2024-09-30 이전 종료 과정 기준)")
    st.write(f"평균 만족도: **{ncs_data['만족도'].mean():.2f}**")
    
    st.subheader("과정별 분석")

    course_data = ncs_data.groupby(['과정명', '회차']).agg({
        '수강신청 인원': 'sum',
        '수료인원': 'sum',
        '만족도': 'mean',
        '누적매출': 'sum'
    }).reset_index().sort_values('누적매출', ascending=False)
    
    top_10_courses = course_data.head(10)
    total_revenue = course_data['누적매출'].sum()
    other_revenue = total_revenue - top_10_courses['누적매출'].sum()
    
    chart_data = pd.DataFrame({
        '과정': [f"{row['과정명']} ({row['회차']}회차)" for _, row in top_10_courses.iterrows()],
        '매출': list(top_10_courses['누적매출'] / 1e8) + [other_revenue / 1e8],
        '비중': list((top_10_courses['누적매출'] / total_revenue * 100)) + 
               [other_revenue / total_revenue * 100]
    })
    
    chart = alt.Chart(chart_data).mark_bar().encode(
        y=alt.Y('과정:N', 
                sort='-x',
                axis=alt.Axis(labelAngle=0, labelLimit=300)),
        x=alt.X('매출:Q',
                title='매출 (억원)',
                axis=alt.Axis(format=',.0f')),
        tooltip=[
            alt.Tooltip('과정:N', title='과정'),
            alt.Tooltip('매출:Q', title='매출 (억원)', format=',.0f'),
            alt.Tooltip('비중:Q', title='비중 (%)', format='.1f')
        ]
    ).properties(
        title='과정별 매출 (억원)',
        width=700,
        height=400
    )
    
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
    
    if st.button("과정 상세 정보 보기"):
        st.subheader("과정 상세 정보")
        for _, row in top_10_courses.iterrows():
            st.write(f"**{row['과정명']} ({row['회차']}회차)**")
            st.write(f"매출: {row['누적매출']/1e8:.1f}억 원")
            st.write(f"수강인원: {int(row['수강신청 인원']):,}명")
            st.write(f"수료인원: {int(row['수료인원']):,}명")
            st.write(f"만족도: {row['만족도']:.2f}")
            st.write("---")

def analyze_course(df):
    st.title("과정 분석")
    
    course_search = st.text_input("과정명 검색", "")
    filtered_courses = df['과정명'].unique()
    if course_search:
        filtered_courses = [course for course in filtered_courses if course_search.lower() in course.lower()]
    
    course = st.selectbox("과정 선택", filtered_courses)
    
    course_data = df[df['과정명'] == course]
    completed_courses = course_data[course_data['과정종료일'] <= pd.Timestamp('2024-09-30')]
    
    total_revenue = course_data['누적매출'].sum() / 1e8
    total_market = df['누적매출'].sum() / 1e8
    market_share = (total_revenue / total_market * 100)
    market_rank = df.groupby('과정명')['누적매출'].sum().rank(ascending=False, method='min')[course]
    
    st.subheader("과정 종합 현황")
    st.write(f"누적 매출: **{total_revenue:.0f}억 원**")
    st.write(f"시장 점유율: **{market_share:.1f}%** (전체 {market_rank:.0f}위)")
    
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    yearly_sales = course_data[year_columns].sum() / 1e8
    yearly_market = df[year_columns].sum() / 1e8
    yearly_share = (yearly_sales / yearly_market * 100).round(1)
    
    for year, sales, share in zip(year_columns, yearly_sales, yearly_share):
        st.write(f"{year} 매출: **{sales:.0f}억 원** (시장점유율: {share:.1f}%)")
    
    total_applicants = completed_courses['수강신청 인원'].sum()
    total_completed = completed_courses['수료인원'].sum()
    completion_rate = (total_completed / total_applicants * 100) if total_applicants > 0 else 0
    avg_satisfaction = completed_courses['만족도'].mean()
    
    st.write(f"수강 인원: **{int(total_applicants):,}명**")
    st.write(f"수료 인원: **{int(total_completed):,}명**")
    st.write(f"수료율: **{completion_rate:.1f}%** (2024-09-30 기준, 과정 종료한 경우만 계산)")
    st.write(f"평균 만족도: **{avg_satisfaction:.2f}**")
    
    st.subheader("회차별 분석")
    course_details = course_data.groupby('회차').agg({
        '수강신청 인원': 'sum',
        '수료인원': 'sum',
        '만족도': 'mean',
        '누적매출': 'sum'
    }).reset_index()
    
    for _, row in course_details.iterrows():
        st.write(f"**{row['회차']}회차**")
        st.write(f"매출: {row['누적매출']/1e8:.1f}억 원")
        st.write(f"수강인원: {int(row['수강신청 인원']):,}명")
        st.write(f"수료인원: {int(row['수료인원']):,}명")
        st.write(f"만족도: {row['만족도']:.2f}")
        st.write("---")


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
    
    # 매출 및 시장 점유율 계산
    total_revenue = ncs_data['누적매출'].sum() / 1e8
    total_market = df['누적매출'].sum() / 1e8
    market_share = (total_revenue / total_market * 100)
    market_rank = df.groupby('NCS명')['누적매출'].sum().rank(ascending=False, method='min')[ncs]
    
    # 수강/수료 정보 계산 (종료된 과정만)
    total_applicants = completed_courses['수강신청 인원'].sum()
    total_completed = completed_courses['수료인원'].sum()
    completion_rate = (total_completed / total_applicants * 100) if total_applicants > 0 else 0
    
    # 만족도 계산 (전체 과정 평균)
    avg_satisfaction = completed_courses['만족도'].mean()
    
    # 통계 정보 표시
    st.subheader("NCS 전체 통계")
    st.write(f"누적 매출: **{int(total_revenue)}억 원**")
    st.write(f"시장 점유율: **{market_share:.1f}%** (전체 {int(market_rank)}위)")
    
    # 연도별 매출 분석
    year_columns = ['2021년', '2022년', '2023년', '2024년']
    yearly_sales = ncs_data[year_columns].sum() / 1e8
    yearly_market = df[year_columns].sum() / 1e8
    yearly_share = (yearly_sales / yearly_market * 100).round(1)
    
    for year, sales, share in zip(year_columns, yearly_sales, yearly_share):
        st.write(f"{year} 매출: **{int(sales)}억 원** (시장점유율: {share:.1f}%)")
    
    st.write(f"수강 인원: **{int(total_applicants):,}명**")
    st.write(f"수료 인원: **{int(total_completed):,}명**")
    st.write(f"수료율: **{completion_rate:.1f}%** (2024-09-30 기준, 종료된 과정만 계산)")
    st.write(f"전체 과정 평균 만족도: **{avg_satisfaction:.2f}**")
    
    # 과정별 매출 분석
    st.subheader("과정별 매출 분석")
    
    # 과정별 매출 집계
    course_revenue = ncs_data.groupby('과정명')['누적매출'].sum().sort_values(ascending=False)
    top_10_courses = course_revenue.head(10)
    total_ncs_revenue = course_revenue.sum()
    other_revenue = total_ncs_revenue - top_10_courses.sum()
    
    # 차트 데이터 준비
    chart_data = pd.DataFrame({
        '과정명': list(top_10_courses.index) + ['기타'],
        '매출': list(top_10_courses / 1e8) + [other_revenue / 1e8],
        '비중': list((top_10_courses / total_ncs_revenue * 100)) + 
               [other_revenue / total_ncs_revenue * 100]
    })
    
    # 차트 생성
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
        title='과정별 매출 현황',
        width=700,
        height=400
    )
    
    # 비중(%) 레이블 추가
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
    
    # 과정 상세 정보 표시
    if st.button("과정 상세 정보 보기"):
        st.subheader("과정 상세 정보")
        for course_name in top_10_courses.index:
            course_data = ncs_data[ncs_data['과정명'] == course_name]
            st.write(f"**{course_name}**")
            st.write(f"매출: {int(course_data['누적매출'].sum()/1e8)}억 원")
            st.write(f"수강인원: {int(course_data['수강신청 인원'].sum()):,}명")
            st.write(f"수료인원: {int(course_data['수료인원'].sum()):,}명")
            st.write(f"만족도: {course_data['만족도'].mean():.2f}")
            st.write("---")

def main():
    st.set_page_config(layout="wide", page_title="K-Digital Training 분석")
    
    df = load_data()
    df = preprocess_data(df)
    
    st.sidebar.title("K-Digital Training 분석")
    analysis_type = st.sidebar.selectbox("분석 유형", ["훈련기관", "과정명", "NCS명"])
    
    if analysis_type == "훈련기관":
        analyze_training_institution(df)
    elif analysis_type == "과정명":
        analyze_course(df)
    else:
        analyze_ncs(df)

if __name__ == "__main__":
    main()