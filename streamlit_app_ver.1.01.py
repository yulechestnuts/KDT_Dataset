import streamlit as st
import pandas as pd
import numpy as np
import altair as alt
from datetime import datetime, timedelta
import requests
import io
from streamlit.components.v1 import html
import json
import re
from PIL import Image
import plotly.express as px


@st.cache_data
def load_data():
    url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/result_kdtdata_202410.xlsx?raw=true"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            df = pd.read_excel(io.BytesIO(response.content), engine="openpyxl")
            return df
    except Exception as e:
        st.error(f"데이터를 불러올 수 없습니다: {e}")
    return pd.DataFrame()

def calculate_yearly_revenue(df):
    # 연도 컬럼 찾기
    year_columns = [col for col in df.columns if re.match(r'20\d{2}년', col)]
    
    # 각 연도별 매출액 계산
    df['누적매출'] = df[year_columns].sum(axis=1)
    
    # 연도별 매출 데이터 생성
    yearly_data = df[year_columns].copy()
    yearly_data.columns = [int(col.replace('년', '')) for col in yearly_data.columns]
    
    return df, yearly_data

def group_institutions(df):
    # 기관 그룹화 규칙 정의
    institution_groups = {
        '이젠아카데미': ['이젠', '이젠컴퓨터학원', '이젠아이티아카데미'],
        '그린아카데미': ['그린', '그린컴퓨터아카데미', '그린아카데미컴퓨터학원'],
        '더조은아카데미': ['더조은', '더조은컴퓨터아카데미', '더조은아이티아카데미'],
        '코리아IT아카데미': ['코리아IT', '코리아아이티', 'KIT', '코리아IT아카데미'],
        '비트교육센터': ['비트', '비트캠프', '비트교육센터'],
        '하이미디어': ['하이미디어', '하이미디어아카데미', '하이미디어컴퓨터학원'],
        '아이티윌': ['아이티윌', 'IT Will', '아이티윌부산교육센터'],
        '메가스터디': ['메가스터디'],
        '에이콘아카데미' : ['에이콘'],
        '한국ICT인재개발원' : ['ICT'],
        '엠비씨(MBC)아카데미 컴퓨터 교육센터' : ['(MBC)']
    }
    
    df = df.copy()
    
    for group_name, keywords in institution_groups.items():
        mask = df['훈련기관'].str.contains('|'.join(keywords), case=False, na=False)
        df.loc[mask, '훈련기관'] = group_name
    
    return df

def preprocess_data(df):
    if '과정종료일' in df.columns:
        df['과정종료일'] = pd.to_datetime(df['과정종료일'])
        df['회차'] = df['회차'].astype(int)
    
    year_columns = [col for col in df.columns if re.match(r'20\d{2}년', col)]
    
    special_orgs = ['대한상공회의소', '한국표준협회']
    
    partner_courses = df[
        (df['훈련기관'].isin(special_orgs)) & 
        (df['파트너기관'].notna())
    ].copy()
    
    partner_courses['훈련기관'] = partner_courses['파트너기관']
    for year in year_columns:
        partner_courses[year] *= 0.9
    
    df.loc[df['훈련기관'].isin(special_orgs), year_columns] *= 0.1
    
    df = pd.concat([df, partner_courses], ignore_index=True)
    
    df['누적매출'] = df[year_columns].sum(axis=1)
    
    return df

def create_ranking_component(df, yearly_data):
    institution_revenue = df.groupby('훈련기관').agg({
        '누적매출': 'sum',
        '과정명': 'count',
        '과정시작일': 'min',
        '과정종료일': 'max'
    }).reset_index()
    
    yearly_sums = {}
    for year in yearly_data.columns:
        yearly_sums[year] = df.groupby('훈련기관')[f'{year}년'].sum()
    
    # 전체 기관에 대한 데이터 생성 (상위 20개 제한 제거)
    ranking_data = []
    for _, row in institution_revenue.iterrows():
        yearly_revenues = {str(year): float(yearly_sums[year][row['훈련기관']]) 
                         for year in yearly_data.columns}
        
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
                                    {year}년
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
                                            <span style={{marginRight: '16px', color: '#4299e1'}}>
                                                {(revenue / 100000000).toFixed(1)}억원
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


def analyze_training_institution(df, yearly_data):
    st.title("K-Digital Training 훈련기관 분석 리포트")
    
    # 기관별 통계
    institution_stats = df.groupby('훈련기관').agg({
        '누적매출': 'sum',
        '과정명': 'count',
        '과정시작일': 'min',
        '과정종료일': 'max'
    }).reset_index()
    
    # 연도별 매출 추가
    years = sorted(yearly_data.columns)
    for year in years:
        institution_stats[f'{year}년_매출'] = df.groupby('훈련기관')[f'{year}년'].sum().values
    
    # 전체 시장 규모
    total_market = institution_stats['누적매출'].sum()
    top_institution = institution_stats.nlargest(1, '누적매출').iloc[0]
    avg_revenue = institution_stats['누적매출'].mean()
    
    # 시장 집중도 (HHI)
    market_shares = (institution_stats['누적매출'] / total_market) * 100
    hhi = (market_shares ** 2).sum()
    
    # 리포트 작성
    st.header("시장 개요")
    col1, col2 = st.columns(2)
    
    with col1:
        st.metric("총 시장 규모", f"{total_market/100000000:.1f}억원")
    with col2:
        st.metric("평균 기관별 매출", f"{avg_revenue/100000000:.1f}억원")
    
    st.markdown("---")
    
    # 시장 구조 분석
    st.header("시장 구조 분석")
    st.write(f"""
    - **시장 집중도(HHI)**: {hhi:.1f} (10,000 만점)
        - {'고집중' if hhi > 2500 else '중집중' if hhi > 1500 else '저집중'} 시장 구조
    """)
    
    # 연도별 상위 3개 기관
    st.subheader("연도별 상위 3개 기관")
    for year in years:
        year_stats = institution_stats.nlargest(3, f'{year}년_매출')
        st.write(f"\n**{year}년**")
        for idx, inst in year_stats.iterrows():
            year_total = institution_stats[f'{year}년_매출'].sum()
            market_share = (inst[f'{year}년_매출'] / year_total * 100)
            st.write(f"- {inst['훈련기관']}: {inst[f'{year}년_매출']/100000000:.1f}억원 (시장점유율 {market_share:.1f}%)")
    
    # 기관별 성과 분석
    st.header("기관별 성과 분석")
    
    # 각 기관의 연도별 시장점유율 변화 계산
    for _, inst in institution_stats.nlargest(5, '누적매출').iterrows():
        with st.expander(f"{inst['훈련기관']} 상세 분석"):
            col1, col2 = st.columns(2)
            with col1:
                st.write(f"""
                - **누적 매출**: {inst['누적매출']/100000000:.1f}억원
                - **시장 점유율**: {(inst['누적매출']/total_market*100):.1f}%
                - **운영 과정 수**: {inst['과정명']} 개
                """)
            
            # 시장점유율 변화 계산
            market_share_changes = []
            for i in range(1, len(years)):
                prev_year = years[i-1]
                curr_year = years[i]
                prev_share = (inst[f'{prev_year}년_매출'] / institution_stats[f'{prev_year}년_매출'].sum() * 100)
                curr_share = (inst[f'{curr_year}년_매출'] / institution_stats[f'{curr_year}년_매출'].sum() * 100)
                change = curr_share - prev_share
                market_share_changes.append(f"{curr_year}년: {change:+.1f}%p")
            
            with col2:
                st.write(f"""
                - **운영 기간**: {inst['과정시작일'].strftime('%Y-%m')} ~ {inst['과정종료일'].strftime('%Y-%m')}
                - **시장점유율 변화**:
                  {chr(10).join(f"  {change}" for change in market_share_changes)}
                """)
            
            # 인기 과정 분석 - 수정된 부분
            st.subheader("인기 과정 Top 5")
            
            # 해당 기관의 과정들만 필터링
            inst_courses = df[df['훈련기관'] == inst['훈련기관']].copy()
            
            # 과정별 통계 계산
            course_stats = []
            for _, course in inst_courses.groupby(['과정명', '회차']):
                revenue = course['누적매출'].sum()
                completion_rate = course['수료율'].mean() * 100 if '수료율' in course.columns else 0
                satisfaction = course['만족도'].mean() if '만족도' in course.columns else 0
                
                course_stats.append({
                    '과정명': course['과정명'].iloc[0],
                    '회차': course['회차'].iloc[0],
                    '누적매출(억원)': revenue / 100000000,
                    '수료율(%)': completion_rate,
                    '만족도': satisfaction
                })
            
            # DataFrame 생성 및 정렬
            course_df = pd.DataFrame(course_stats)
            top_courses = course_df.nlargest(5, '누적매출(억원)')
            
            # 소수점 포맷팅
            formatted_courses = top_courses.copy()
            formatted_courses['누적매출(억원)'] = formatted_courses['누적매출(억원)'].round(1)
            formatted_courses['수료율(%)'] = formatted_courses['수료율(%)'].round(1)
            formatted_courses['만족도'] = formatted_courses['만족도'].round(1)
            
            # 데이터프레임 표시
            st.dataframe(
                formatted_courses,
                column_config={
                    '과정명': '과정명',
                    '회차': '회차',
                    '누적매출(억원)': st.column_config.NumberColumn(
                        '누적매출(억원)',
                        format="%.1f"
                    ),
                    '수료율(%)': st.column_config.NumberColumn(
                        '수료율(%)',
                        format="%.1f"
                    ),
                    '만족도': st.column_config.NumberColumn(
                        '만족도',
                        format="%.1f"
                    )
                },
                hide_index=True
            )

def format_currency(value):
    """금액을 억 원 단위로 포맷팅"""
    return f"{value/100000000:.1f}"

def calculate_valid_averages(df):
    """날짜 기준으로 유효한 데이터만 사용하여 평균 계산"""
    current_date = pd.Timestamp.now()
    
    # 날짜 컬럼을 datetime으로 변환
    df['과정종료일'] = pd.to_datetime(df['과정종료일'])
    
    # 3주 전 날짜 계산
    three_weeks_ago = current_date - timedelta(weeks=3)
    two_weeks_ago = current_date - timedelta(weeks=2)
    
    # 수료인원: 과정종료일이 3주 이전인 데이터만 사용
    df['유효_수료인원'] = df.apply(
        lambda row: row['수료인원'] if row['과정종료일'] <= three_weeks_ago else None, 
        axis=1
    )
    
    # 수강신청인원: 과정종료일이 2주 이전인 데이터만 사용
    df['유효_수강신청인원'] = df.apply(
        lambda row: row['수강신청 인원'] if row['과정종료일'] <= two_weeks_ago else None,
        axis=1
    )
    
    return df

def standardize_institution_name(row):
    """훈련기관과 파트너기관 이름을 표준화"""
    if pd.notna(row['파트너기관']):
        institutions = sorted([row['파트너기관'], row['훈련기관']])
        return f"{institutions[0]} + {institutions[1]}"
    return row['훈련기관']

def deduplicate_institutions(df):
    """중복된 기관명을 처리하고 데이터를 통합"""
    # 표준화된 기관명 생성
    df['표시_훈련기관'] = df.apply(standardize_institution_name, axis=1)
    
    # 같은 과정명과 회차에 대해 중복된 기관명이 있는 경우를 찾아서 처리
    grouping_columns = ['과정명', '회차', '표시_훈련기관']
    
    # 숫자형 컬럼들을 합산
    numeric_columns = ['누적매출', '수강신청 인원', '수료인원', '총 훈련시간']
    
    # 평균을 내야 하는 컬럼들
    avg_columns = ['수료율', '만족도']
    
    # 그룹별 집계 방식 정의
    agg_dict = {
        **{col: 'sum' for col in numeric_columns},
        **{col: 'mean' for col in avg_columns},
        '과정종료일': 'first',  # 날짜는 첫 번째 값 사용
        '유효_수료인원': 'sum',
        '유효_수강신청인원': 'sum'
    }
    
    # 그룹화하여 중복 제거
    df_deduplicated = df.groupby(grouping_columns).agg(agg_dict).reset_index()
    
    return df_deduplicated

def analyze_course(df, yearly_data):
    """K-Digital Training 과정 분석 및 시각화 함수"""
    st.title("K-Digital Training 과정 분석")
    
    # 현재 날짜 기준 설정
    today = pd.Timestamp.now()
    
    # 수료율/만족도 계산 가능 여부 확인 (과정종료일 + 3주 이상 지난 과정)
    df['집계가능'] = df['과정종료일'].apply(lambda x: 
        (today - pd.Timestamp(x)).days >= 21 if pd.notnull(x) else False)
    
    # 유효한 수료율과 만족도 계산 (3주 유예기간 고려)
    df['유효_수료율'] = df.apply(lambda x: 
        x['수료율'] if x['집계가능'] else None, axis=1)
    df['유효_만족도'] = df.apply(lambda x: 
        x['만족도'] if x['집계가능'] else None, axis=1)
    
    # 실제 매출 계산 (2021년 ~ 2025년 합계)
    df['총매출'] = df[['2021년', '2022년', '2023년', '2024년', '2025년']].sum(axis=1)
    
    # 연도별 데이터 처리
    years = sorted(yearly_data.columns)
    
    # 1. 정렬 기준 선택 버튼
    st.subheader("과정 순위 분석")
    sort_metric = st.radio(
        "정렬 기준 선택",
        ["매출액", "수료율", "만족도"],
        horizontal=True
    )
    
    # 연도 선택
    selected_year = st.selectbox(
        "연도 선택",
        years,
        index=len(years)-1
    )
    
    year_column = f'{selected_year}년'
    
    # 과정별 데이터 계산
    course_metrics = df.groupby(['과정명', '훈련기관']).agg({
        '총매출': 'sum',
        '유효_수료율': lambda x: x[x.notnull()].mean() if x.notnull().any() else None,
        '유효_만족도': lambda x: x[x.notnull()].mean() if x.notnull().any() else None,
        '수강신청 인원': 'sum',
        '수료인원': lambda x: x[x.notnull()].sum(),
        '회차': 'count'
    }).reset_index()
    
    # 매출액을 실제 숫자로 저장 (정렬용)
    course_metrics['매출액_정렬용'] = course_metrics['총매출']
    course_metrics['총매출'] = course_metrics['총매출'] / 100000000  # 억원 단위로 변환
    
    # 정렬 기준에 따라 데이터 정렬
    sort_column = {
        "매출액": "매출액_정렬용",
        "수료율": "유효_수료율",
        "만족도": "유효_만족도"
    }[sort_metric]
    
    sorted_courses = course_metrics.sort_values(sort_column, ascending=False)
    
    # 2. 상위 5개 과정 바 차트
    st.subheader(f"상위 5개 과정 ({sort_metric})")
    top_5 = sorted_courses.head()
    
    # 선택된 메트릭에 따라 차트 데이터 준비
    if sort_metric == "매출액":
        chart_value = top_5['총매출']
        format_str = '.1f'
    else:
        chart_value = top_5[sort_column]
        format_str = '.2f'
    
    chart_data = pd.DataFrame({
        '과정명': top_5['과정명'] + ' (' + top_5['훈련기관'] + ')',
        sort_metric: chart_value
    })
    
    bar_chart = alt.Chart(chart_data).mark_bar().encode(
        x=alt.X(f'{sort_metric}:Q', 
                title=sort_metric,
                axis=alt.Axis(labelAngle=0, labelFontSize=12)),
        y=alt.Y('과정명:N', 
                sort='-x', 
                title='과정명',
                axis=alt.Axis(labelFontSize=12)),
        tooltip=[
            alt.Tooltip('과정명:N', title='과정명'),
            alt.Tooltip(f'{sort_metric}:Q', 
                       title=sort_metric, 
                       format=format_str)
        ]
    ).properties(
        height=300
    )
    
    st.altair_chart(bar_chart, use_container_width=True)
    
    # 3. 연도별 매출 추이
    st.subheader("연도별 매출 추이")
    yearly_revenue = pd.DataFrame()
    for year in years:
        yearly_sum = df[f'{year}년'].sum() / 100000000  # 억 단위로 변환
        yearly_revenue = pd.concat([yearly_revenue, pd.DataFrame({
            '연도': [year],
            '매출': [yearly_sum]
        })])
    
    line_chart = alt.Chart(yearly_revenue).mark_bar().encode(
        x=alt.X('연도:N', 
                axis=alt.Axis(labelAngle=0, labelFontSize=12)),
        y=alt.Y('매출:Q',
                axis=alt.Axis(labelFontSize=12)),
        tooltip=[
            alt.Tooltip('연도:N', title='연도'),
            alt.Tooltip('매출:Q', title='매출(억원)', format='.1f')
        ]
    ).properties(
        height=300
    )
    
    st.altair_chart(line_chart, use_container_width=True)
    
    # 4. 과정별 상세 성과
    st.subheader("과정별 상세 성과")
    
    display_df = sorted_courses[['과정명', '훈련기관', '총매출', '유효_수료율', 
                               '유효_만족도', '수강신청 인원', '수료인원', '회차']].copy()
    
    # 표시 형식 지정
    display_df['총매출'] = display_df['총매출'].apply(lambda x: f"{x:.1f}억원")
    display_df['유효_수료율'] = display_df['유효_수료율'].apply(
        lambda x: f"{x*100:.1f}%" if pd.notnull(x) else "집계중")
    display_df['유효_만족도'] = display_df['유효_만족도'].apply(
        lambda x: f"{x:.2f}" if pd.notnull(x) else "집계중")
    
    st.dataframe(
        display_df,
        column_config={
            "과정명": "과정명",
            "훈련기관": "훈련기관",
            "총매출": "매출액",
            "유효_수료율": "수료율",
            "유효_만족도": "만족도",
            "수강신청 인원": st.column_config.NumberColumn("수강신청 인원", format=","),
            "수료인원": st.column_config.NumberColumn("수료인원", format=","),
            "회차": "개강 횟수"
        },
        hide_index=True,
        use_container_width=True
    )
    
    # 5. 과정 검색 및 상세 분석
    st.subheader("과정 검색 및 상세 분석")
    search_term = st.text_input("과정명 검색")
    
    if search_term:
        filtered_df = display_df[display_df['과정명'].str.contains(search_term, case=False)]
        st.dataframe(
            filtered_df,
            use_container_width=True,
            hide_index=True
        )
        
        # 선택된 과정의 연도별 매출 추이
        if len(filtered_df) > 0:
            selected_course = st.selectbox("과정 선택", filtered_df['과정명'].unique())
            st.subheader(f"{selected_course} - 연도별 분석")
            
            # 선택된 과정의 연도별 데이터 추출
            course_yearly_data = pd.DataFrame()
            course_data = df[df['과정명'] == selected_course]
            
            for year in years:
                year_col = f'{year}년'
                yearly_sum = course_data[year_col].sum() / 100000000  # 억 단위로 변환
                yearly_count = len(course_data[course_data[year_col] > 0])  # 해당 연도 개강 횟수
                
                course_yearly_data = pd.concat([course_yearly_data, pd.DataFrame({
                    '연도': [year],
                    '매출': [yearly_sum],
                    '개강횟수': [yearly_count]
                })])
            
            # 매출 추이 차트
            course_chart = alt.Chart(course_yearly_data).mark_bar().encode(
                x=alt.X('연도:N', 
                        axis=alt.Axis(labelAngle=0, labelFontSize=12)),
                y=alt.Y('매출:Q',
                        axis=alt.Axis(labelFontSize=12)),
                tooltip=[
                    alt.Tooltip('연도:N', title='연도'),
                    alt.Tooltip('매출:Q', title='매출(억원)', format='.1f'),
                    alt.Tooltip('개강횟수:Q', title='개강횟수')
                ]
            ).properties(
                height=300,
                title=f"{selected_course} 연도별 매출 추이"
            )
            
            st.altair_chart(course_chart, use_container_width=True)
            
            # 회차별 상세 정보
            st.subheader("회차별 상세 정보")
            course_details = df[df['과정명'] == selected_course].sort_values('회차')
            
            # 집계 가능한 데이터만 수료율과 만족도 표시
            details_display = course_details[['회차', '수강신청 인원', '수료인원', '수료율', '만족도']].copy()
            details_display['수료율'] = details_display.apply(
                lambda x: f"{x['수료율']*100:.1f}%" if course_details.loc[x.name, '집계가능'] else "집계중", 
                axis=1)
            details_display['만족도'] = details_display.apply(
                lambda x: f"{x['만족도']:.2f}" if course_details.loc[x.name, '집계가능'] else "집계중", 
                axis=1)
            
            st.dataframe(
                details_display,
                hide_index=True,
                use_container_width=True
            )
            
def calculate_course_metrics(df, year_column):
    """과정별 매출 및 통계 계산"""
    required_columns = ['과정명', '훈련기관', '수료율', '만족도', '수강신청 인원', '수료인원']
    if not all(col in df.columns for col in required_columns + [year_column]):
        raise ValueError("필요한 열이 데이터프레임에 없습니다.")
        
    return df.groupby(['과정명', '훈련기관']).agg({
        year_column: 'sum',
        '수료율': 'mean',
        '만족도': 'mean',
        '수강신청 인원': 'sum',
        '수료인원': 'sum'
    }).reset_index().sort_values(year_column, ascending=False)

def prepare_ranking_data(course_revenue):
    """React 컴포넌트를 위한 데이터 준비"""
    ranking_data = []
    for _, row in course_revenue.iterrows():
        try:
            ranking_data.append({
                "courseName": str(row['과정명']),
                "institution": str(row['훈련기관']),
                "revenue": float(row[row.index[2]]),  # year_column
                "completionRate": float(row['수료율'] * 100),
                "satisfaction": float(row['만족도']),
                "enrollments": int(row['수강신청 인원']),
                "completions": int(row['수료인원'])
            })
        except (ValueError, TypeError) as error:
            st.warning(f"데이터 변환 중 오류 발생: {str(error)}")
            continue
            
    return ranking_data

def preprocess_data(df):
    """데이터 전처리 함수"""
    try:
        # 날짜 형식 변환
        if '과정종료일' in df.columns:
            df['과정종료일'] = pd.to_datetime(df['과정종료일'], errors='coerce')
            df['회차'] = pd.to_numeric(df['회차'], errors='coerce').fillna(0).astype(int)
        
        # 연도 컬럼 식별
        year_columns = [col for col in df.columns if re.match(r'20\d{2}년', col)]
        if not year_columns:
            raise ValueError("연도 데이터가 포함된 열을 찾을 수 없습니다.")
        
        # 특수 기관 처리
        special_orgs = ['대한상공회의소', '한국표준협회']
        
        # 파트너 과정 처리
        partner_courses = process_partner_courses(df, special_orgs, year_columns)
        
        # 특수 기관 매출 조정
        df.loc[df['훈련기관'].isin(special_orgs), year_columns] *= 0.1
        
        # 데이터 병합
        df = pd.concat([df, partner_courses], ignore_index=True)
        
        # 누적 매출 계산
        df['누적매출'] = df[year_columns].sum(axis=1)
        
        return df
        
    except Exception as error:
        raise ValueError(f"데이터 전처리 중 오류 발생: {str(error)}")

def process_partner_courses(df, special_orgs, year_columns):
    """파트너 과정 처리"""
    partner_courses = df[
        (df['훈련기관'].isin(special_orgs)) & 
        (df['파트너기관'].notna())
    ].copy()
    
    if not partner_courses.empty:
        partner_courses['훈련기관'] = partner_courses['파트너기관']
        for year in year_columns:
            partner_courses[year] *= 0.9
            
    return partner_courses

def analyze_ncs(df, yearly_data):
    st.title("NCS 분석")
    
    # NCS별 통계
    ncs_stats = df.groupby('NCS명').agg({
        '누적매출': 'sum',
        '과정명': 'count',
        '과정시작일': 'min',
        '과정종료일': 'max'
    }).reset_index()
    
    # 연도별 매출 추가
    for year in yearly_data.columns:
        ncs_stats[f'{year}년_매출'] = df.groupby('NCS명')[f'{year}년'].sum().values
    
    # NCS별 매출 차트
    base_chart = alt.Chart(ncs_stats).encode(
        x=alt.X('NCS명:N', sort='-y', axis=alt.Axis(labelAngle=-45))
    )
    
    bars = base_chart.mark_bar().encode(
        y=alt.Y('누적매출:Q', title='누적매출 (원)'),
        tooltip=['NCS명', '누적매출', '과정명']
    )
    
    text = base_chart.mark_text(
        align='center',
        baseline='bottom',
        dy=-5
    ).encode(
        y=alt.Y('누적매출:Q'),
        text=alt.Text('누적매출:Q', format='.1e')
    )
    
    chart = (bars + text).properties(
        width=800,
        height=400,
        title='NCS명별 누적매출'
    )
    
    st.altair_chart(chart)
    
    # 연도별 매출 추이
    st.subheader("연도별 매출 추이")
    
    yearly_data = pd.DataFrame({
        'NCS명': ncs_stats['NCS명'].repeat(len(yearly_data.columns)),
        '연도': np.tile(yearly_data.columns, len(ncs_stats)),
        '매출': ncs_stats[[f'{year}년_매출' for year in yearly_data.columns]].values.flatten()
    })
    
    line_chart = alt.Chart(yearly_data).mark_line(point=True).encode(
        x='연도:O',
        y='매출:Q',
        color='NCS명:N',
        tooltip=['NCS명', '연도', '매출']
    ).properties(
        width=800,
        height=400,
        title='NCS명별 연도별 매출 추이'
    )
    
    st.altair_chart(line_chart)
    
    # 상세 통계 테이블
    st.subheader("NCS명별 상세 통계")
    display_stats = ncs_stats.copy()
    display_stats['누적매출'] = display_stats['누적매출'].apply(lambda x: f"{x/100000000:.1f}억원")
    for year in yearly_data['연도'].unique():
        display_stats[f'{year}년_매출'] = display_stats[f'{year}년_매출'].apply(lambda x: f"{x/100000000:.1f}억원")
    st.dataframe(display_stats)

def analyze_training_institution(df, yearly_data):
    st.title("K-Digital Training 훈련기관 분석 리포트")
    
    # 필요한 열이 존재하는지 확인
    required_columns = ['훈련기관', '누적매출', '과정명', '과정시작일', '과정종료일', '수강신청 인원']
    for col in required_columns:
        if col not in df.columns:
            st.error(f"필수 열 '{col}'이 데이터프레임에 없습니다.")
            return
        
    # 연도 확인 및 처리
    year_columns = [col for col in yearly_data.columns if col.endswith('년')]
    if not year_columns:
        st.error(f"연도별 데이터 열이 존재하지 않습니다. 현재 열: {list(yearly_data.columns)}")
        return

    # 연도별 매출 추가 시 수정
    for year in year_columns:
        institution_stats[year + '_매출'] = yearly_data.groupby('훈련기관')[year].sum().reindex(institution_stats['훈련기관']).fillna(0)
            
    try:
        # 기관별 통계
        institution_stats = df.groupby('훈련기관').agg({
            '누적매출': 'sum',
            '과정명': 'count',
            '과정시작일': 'min',
            '과정종료일': 'max',
            '수강신청 인원': 'sum'
        }).reset_index()
        
        # 연도별 매출 추가 (안전한 방식)
        for year in year_columns:
            institution_stats[year + '_매출'] = df.groupby('훈련기관')[year].sum().reindex(institution_stats['훈련기관']).fillna(0)
        
        # 날짜 열 안전하게 변환
        df['개강연도'] = pd.to_datetime(df['과정시작일'], errors='coerce').dt.year
        df['개강월'] = pd.to_datetime(df['과정시작일'], errors='coerce').dt.month
        
        # NaN 값 제거
        df = df.dropna(subset=['개강연도', '개강월'])
        
        # 연도별, 월별 과정 수와 수강신청 인원 수 계산
        yearly_courses = df.groupby(['훈련기관', '개강연도']).agg({
            '과정명': 'count',
            '수강신청 인원': 'sum'
        }).reset_index()
        
        monthly_courses = df.groupby(['훈련기관', '개강월']).agg({
            '과정명': 'count', 
            '수강신청 인원': 'sum'
        }).reset_index()
        
        # 전체 시장 규모
        total_market = institution_stats['누적매출'].sum()
        top_institution = institution_stats.nlargest(1, '누적매출').iloc[0]
        avg_revenue = institution_stats['누적매출'].mean()
        
        # 시장 집중도 (HHI)
        market_shares = (institution_stats['누적매출'] / total_market) * 100
        hhi = (market_shares ** 2).sum()
        
        # 리포트 작성
        st.header("시장 개요")
        col1, col2 = st.columns(2)
        
        with col1:
            st.metric("총 시장 규모", f"{total_market/100000000:.1f}억원")
        with col2:
            st.metric("평균 기관별 매출", f"{avg_revenue/100000000:.1f}억원")
        
        st.markdown("---")
        
        # 시장 구조 분석
        st.header("시장 구조 분석")
        st.write(f"""
        - **시장 집중도(HHI)**: {hhi:.1f} (10,000 만점)
            - {'고집중' if hhi > 2500 else '중집중' if hhi > 1500 else '저집중'} 시장 구조
        - **선두 기관**: {top_institution['훈련기관']} (시장점유율 {(top_institution['누적매출']/total_market*100):.1f}%)
        - **활성 훈련기관 수**: {len(institution_stats)} 개
        """)
        
        # 기관별 검색 기능
        st.header("기관별 성과 분석")
        
        # 기관 검색 드롭다운
        selected_institution = st.selectbox(
            "분석할 훈련기관 선택", 
            ["전체"] + list(institution_stats['훈련기관'])
        )
        
        # 선택된 기관 필터링
        if selected_institution != "전체":
            institution_stats = institution_stats[institution_stats['훈련기관'] == selected_institution]
        
        # 상위 기관들에 대한 상세 분석
        for _, inst in institution_stats.iterrows():
            with st.expander(f"{inst['훈련기관']} 상세 분석"):
                # 연도별 매출 추이 - Plotly를 이용한 애플 스타일 그래프
                st.subheader("연도별 매출 추이")
                
                # 안전한 연도별 매출 데이터 추출
                yearly_revenue_data = {
                    col.replace('년_매출', ''): float(inst.get(col, 0)) / 100000000  
                    for col in institution_stats.columns 
                    if col.endswith('년_매출')
                }
                
                chart_data = pd.DataFrame.from_dict(
                    yearly_revenue_data, 
                    orient='index', 
                    columns=['매출']
                ).reset_index()
                chart_data.columns = ['연도', '매출']
                
                # Plotly를 사용한 애플 스타일 그래프
                if not chart_data.empty and chart_data['매출'].sum() > 0:
                    fig = px.line(
                        chart_data, 
                        x='연도', 
                        y='매출',
                        title='연도별 매출 추이',
                        labels={'매출': '매출 (억원)', '연도': '연도'},
                        template='plotly_white',
                        markers=True
                    )
                    fig.update_traces(
                        line=dict(color='#007AFF', width=3),
                        marker=dict(color='#007AFF', size=10)
                    )
                    fig.update_layout(
                        plot_bgcolor='white',
                        paper_bgcolor='white',
                        font=dict(family='San Francisco', size=12),
                        title_font_size=16
                    )
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.warning("해당 기관의 연도별 매출 데이터가 없습니다.")
                
                # 연도별 과정 및 수강신청 인원 현황
                st.subheader("연도별 과정 및 수강신청 인원 현황")
                inst_yearly_courses = yearly_courses[
                    yearly_courses['훈련기관'] == inst['훈련기관']
                ]
                
                # 월별 과정 현황
                inst_monthly_courses = monthly_courses[
                    monthly_courses['훈련기관'] == inst['훈련기관']
                ]
                
                # 두 테이블을 나란히 배치
                col1, col2 = st.columns(2)
                with col1:
                    st.markdown("#### 연도별 현황")
                    if not inst_yearly_courses.empty:
                        st.dataframe(
                            inst_yearly_courses.set_index('개강연도')[['과정명', '수강신청 인원']],
                            column_config={
                                '과정명': st.column_config.Column('개설 과정 수', help='해당 연도에 개설된 과정 수'),
                                '수강신청 인원': st.column_config.Column('수강신청 인원 수', help='해당 연도의 총 수강신청 인원 수')
                            },
                            use_container_width=True
                        )
                    else:
                        st.warning("연도별 데이터 없음")
                
                with col2:
                    st.markdown("#### 월별 현황")
                    if not inst_monthly_courses.empty:
                        st.dataframe(
                            inst_monthly_courses.set_index('개강월')[['과정명', '수강신청 인원']],
                            column_config={
                                '과정명': st.column_config.Column('개설 과정 수', help='해당 월에 개설된 과정 수'),
                                '수강신청 인원': st.column_config.Column('수강신청 인원 수', help='해당 월의 총 수강신청 인원 수')
                            },
                            use_container_width=True
                        )
                    else:
                        st.warning("월별 데이터 없음")
                
                # 과정별 세부 정보 (동일 과정명 통합)
                st.subheader("과정별 세부 정보")
                
                # 해당 기관의 과정 필터링
                inst_courses = df[df['훈련기관'] == inst['훈련기관']]
                
                # 과정별 상세 정보 통합
                course_detail_columns = [
                    '과정명', '누적매출', '수료율', '만족도', '수강신청 인원'
                ]
                
                # 필요한 열이 모두 있는지 확인
                missing_columns = [col for col in course_detail_columns if col not in inst_courses.columns]
                if missing_columns:
                    st.error(f"다음 열이 누락되었습니다: {missing_columns}")
                    continue
                
                # 동일 과정명 통합
                course_details = inst_courses.groupby('과정명').agg({
                    '누적매출': 'sum',
                    '수료율': 'mean',
                    '만족도': 'mean',
                    '수강신청 인원': 'sum'
                }).reset_index()
                
                # 숫자형 데이터로 변환 및 안전한 처리
                course_details['누적매출'] = pd.to_numeric(course_details['누적매출'], errors='coerce') / 100000000
                course_details['수료율'] = pd.to_numeric(course_details['수료율'], errors='coerce') * 100
                course_details['만족도'] = pd.to_numeric(course_details['만족도'], errors='coerce')
                
                course_details = course_details.round({
                    '누적매출': 1, 
                    '수료율': 1, 
                    '만족도': 1
                })
                
                st.dataframe(
                    course_details, 
                    use_container_width=True,
                    hide_index=True,
                    column_config={
                        '과정명': st.column_config.Column('과정명'),
                        '누적매출': st.column_config.Column('누적매출 (억원)'),
                        '수료율': st.column_config.Column('수료율 (%)'),
                        '만족도': st.column_config.Column('만족도'),
                        '수강신청 인원': st.column_config.Column('수강신청 인원 수')
                    }
                )

    except Exception as e:
        st.error(f"데이터 처리 중 오류 발생: {str(e)}")
        st.error("데이터를 확인해주세요.")

            
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
    
    df = load_data()
    if df.empty:
        return
    
    df = preprocess_data(df)
    df = group_institutions(df)
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