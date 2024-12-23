import streamlit as st
import pandas as pd
from visualization.charts import *
import streamlit.components.v1 as components
import json
from datetime import datetime
import numpy as np
import altair as alt

def analyze_training_institution(df, yearly_data):
    """훈련기관 분석을 수행하고 결과를 시각화하는 함수"""
    
    # 기관별 통계 계산
    institution_stats = df.groupby('훈련기관').agg({
        '누적매출': 'sum',
        '과정명': 'count',
        '과정시작일': 'min',
        '과정종료일': 'max',
        '수강신청인원': 'sum'
    }).reset_index()

    # 연도별 매출 추가
    for year in yearly_data.columns:
        institution_stats[year] = df.groupby('훈련기관')[year].sum().values

    # 연도별, 월별 과정 수와 수강신청 인원 수 계산
    df['개강연도'] = pd.to_datetime(df['과정시작일']).dt.year
    df['개강월'] = pd.to_datetime(df['과정시작일']).dt.month

    yearly_courses = df.groupby(['훈련기관', '개강연도']).agg({
        '과정명': 'count',
        '수강신청인원': 'sum'
    }).reset_index()

    monthly_courses = df.groupby(['훈련기관', '개강월']).agg({
        '과정명': 'count',
        '수강신청인원': 'sum'
    }).reset_index()

    # 전체 시장 규모 계산
    total_market = institution_stats['누적매출'].sum()

    # 리포트 작성
    st.header("시장 개요")
    col1, col2 = st.columns(2)

    with col1:
        st.metric("총 시장 규모", f"{format_currency(total_market)}억원")

    st.markdown("---")

    # 기관별 성과 분석
    st.header("기관별 성과 분석")

    # 상위 5개 기관에 대한 상세 분석
    for _, inst in institution_stats.nlargest(5, '누적매출').iterrows():
        with st.expander(f"{inst['훈련기관']} 상세 분석"):
            # 연도별 매출 가로 바 차트
            st.subheader("연도별 매출 추이")
            yearly_revenue_data = {
                str(year): float(inst[year])
                for year in yearly_data.columns
            }

            chart_data = pd.DataFrame.from_dict(
                yearly_revenue_data,
                orient='index',
                columns=['매출']
            ).reset_index()
            chart_data.columns = ['연도', '매출']

            # bar chart를 streamlit으로 변경
            chart_data['매출'] = chart_data['매출'].apply(lambda x: x/100000000)
            st.bar_chart(
                chart_data.set_index('연도'),
                use_container_width=True,
                height=300
            )

            # 연도별 과정 및 수강신청 인원 현황
            st.subheader("연도별 과정 및 수강신청 인원 현황")
            inst_yearly_courses = yearly_courses[
                yearly_courses['훈련기관'] == inst['훈련기관']
            ]

            col1, col2 = st.columns(2)
            with col1:
                st.dataframe(
                    inst_yearly_courses.set_index('개강연도')[['과정명', '수강신청인원']],
                    column_config={
                        '과정명': st.column_config.Column('개설 과정 수', help='해당 연도에 개설된 과정 수'),
                        '수강신청인원': st.column_config.Column('수강신청 인원 수', help='해당 연도의 총 수강신청 인원 수')
                    },
                    use_container_width=True
                )

            with col2:
                # 월별 과정 및 수강신청 인원 현황
                st.subheader("월별 과정 현황")
                inst_monthly_courses = monthly_courses[
                    monthly_courses['훈련기관'] == inst['훈련기관']
                ]

                st.dataframe(
                    inst_monthly_courses.set_index('개강월')[['과정명', '수강신청인원']],
                    column_config={
                        '과정명': st.column_config.Column('개설 과정 수', help='해당 월에 개설된 과정 수'),
                        '수강신청인원': st.column_config.Column('수강신청 인원 수', help='해당 월의 총 수강신청 인원 수')
                    },
                    use_container_width=True
                )

            # 기관별 과정 상세 정보
            st.subheader("과정별 세부 정보")

            # 해당 기관의 과정 필터링
            inst_courses = df[df['훈련기관'] == inst['훈련기관']]

            # 과정별 상세 정보 테이블
            course_detail_columns = [
                '과정명', '누적매출', '수료율', '만족도', '수강신청인원'
            ]

            course_details = inst_courses[course_detail_columns].copy()

            # 누적매출을 억원 단위로 변환
            course_details['누적매출'] = course_details['누적매출'].apply(lambda x : format_currency(x))

            # 수료율, 만족도 퍼센트 형식으로 변환
            course_details['수료율'] = (course_details['수료율'] * 100).round(1)
            course_details['만족도'] = course_details['만족도'].round(1)

            st.dataframe(
                course_details,
                use_container_width=True,
                hide_index=True,
                column_config={
                    '과정명': st.column_config.Column('과정명'),
                    '누적매출': st.column_config.Column('누적매출 (억원)'),
                    '수료율': st.column_config.Column('수료율 (%)'),
                    '만족도': st.column_config.Column('만족도'),
                    '수강신청인원': st.column_config.Column('수강신청 인원 수')
                }
            )

def format_currency(value):
    """금액을 억 원 단위로 포맷팅"""
    return f"{value/100000000:.1f}"

def analyze_course(df, yearly_data):
    """K-Digital Training 과정 분석 및 시각화 함수"""
    st.title("K-Digital Training 과정 분석")

    # 현재 날짜 기준 설정
    today = datetime.now()

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

    # 과정별 데이터 계산 (과정 분석에서 중복 계산 제거)
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

    # 1. 과정 순위 분석 섹션 통합
    st.subheader("과정 순위 분석")

    # Create a two-column layout
    col1, col2 = st.columns([1, 2])

    with col1:
        # 정렬 기준 선택 버튼
        sort_metric = st.radio(
            "정렬 기준 선택",
            ["매출액", "수료율", "만족도"],
            horizontal=False
        )

        # 연도 선택
        selected_year = st.selectbox(
            "연도 선택",
            years,
            index=len(years)-1
        )

    with col2:
        # 상위 5개 과정 바 차트 (정렬 기준 및 연도에 따라 동적 변경)
        st.write(f"#### 상위 5개 과정 ({selected_year} - {sort_metric})")

        # 정렬 기준에 따라 데이터 정렬
        sort_column = {
            "매출액": "매출액_정렬용",
            "수료율": "유효_수료율",
            "만족도": "유효_만족도"
        }[sort_metric]

        sorted_courses = course_metrics.sort_values(sort_column, ascending=False)

        # 상위 5개 과정 데이터 준비
        top_5 = sorted_courses.head(5)

        # 선택된 메트릭에 따라 차트 데이터 준비
        if sort_metric == "매출액":
            chart_value = top_5['총매출']
            format_str = '.1f'
            value_suffix = '억원'
        else:
            chart_value = top_5[sort_column]
            format_str = '.2f'
            value_suffix = ''

        chart_data = pd.DataFrame({
            '과정명': top_5['과정명'] + ' (' + top_5['훈련기관'] + ')',
            sort_metric: chart_value
        })

        # Altair 바 차트 생성
        bar_chart = alt.Chart(chart_data).mark_bar().encode(
            x=alt.X(f'{sort_metric}:Q',
                    title=f'{sort_metric} ({value_suffix})',
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

    # 3. 연도별 매출 추이 (전체)
    st.subheader("연도별 매출 추이 (전체)")
    yearly_revenue = pd.DataFrame()
    for year in years:
        yearly_sum = df[year].sum() / 100000000  # 억 단위로 변환
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

    # Create a unique key for the text input
    search_term = st.text_input("과정명 검색", key="course_search")

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
                yearly_sum = course_data[year].sum() / 100000000  # 억 단위로 변환
                yearly_count = len(course_data[pd.to_numeric(course_data[year], errors='coerce') > 0])  # 해당 연도 개강 횟수

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

def analyze_ncs(df, yearly_data):
    """NCS 분석을 수행하고 결과를 시각화하는 함수"""
    st.title("NCS 분석")

    # NCS별 통계 계산
    ncs_stats = df.groupby('NCS명').agg({
        '누적매출': 'sum',
        '과정명': 'count',
        '과정시작일': 'min',
        '과정종료일': 'max'
    }).reset_index()

    # 연도별 매출 추가
    for year in yearly_data.columns:
        ncs_stats[year] = df.groupby('NCS명')[year].sum().values

    # 1. NCS별 누적매출 바 차트
    st.subheader("NCS별 누적매출")

    # Altair 차트 생성
    base_chart = alt.Chart(ncs_stats).encode(
        x=alt.X('NCS명:N', sort='-y', axis=alt.Axis(labelAngle=-45, labelFontSize=10))
    )

    bars = base_chart.mark_bar().encode(
        y=alt.Y('누적매출:Q', title='누적매출 (원)'),
        tooltip=[
            alt.Tooltip('NCS명:N', title='NCS명'),
            alt.Tooltip('누적매출:Q', title='누적매출', format=',.0f'),
            alt.Tooltip('과정명:Q', title='과정 수')
        ]
    )

    text = base_chart.mark_text(
        align='center',
        baseline='bottom',
        dy=-5,
        fontSize=10
    ).encode(
        y=alt.Y('누적매출:Q'),
        text=alt.Text('누적매출:Q', format='.1e')
    )

    chart = (bars + text).properties(
        width=700,
        height=400,
        title='NCS별 누적매출'
    )

    st.altair_chart(chart, use_container_width=True)

    # 2. 연도별 매출 추이 (라인 차트)
    st.subheader("연도별 매출 추이")

    # 연도별 매출 데이터를 long format으로 변환
    yearly_data_long = pd.DataFrame({
        'NCS명': ncs_stats['NCS명'].repeat(len(yearly_data.columns)),
        '연도': np.tile(yearly_data.columns, len(ncs_stats)),
        '매출': ncs_stats[[f'{year}' for year in yearly_data.columns]].values.flatten()
    })

    # Altair 라인 차트 생성
    line_chart = alt.Chart(yearly_data_long).mark_line(point=True).encode(
        x=alt.X('연도:O', axis=alt.Axis(labelAngle=-45, labelFontSize=10)),
        y=alt.Y('매출:Q', title='매출 (원)'),
        color=alt.Color('NCS명:N', title='NCS명'),
        tooltip=[
            alt.Tooltip('NCS명:N', title='NCS명'),
            alt.Tooltip('연도:O', title='연도'),
            alt.Tooltip('매출:Q', title='매출', format=',.0f')
        ]
    ).properties(
        width=700,
        height=400,
        title='NCS별 연도별 매출 추이'
    )

    st.altair_chart(line_chart, use_container_width=True)

    # 3. 상세 통계 테이블
    st.subheader("NCS별 상세 통계")
    display_stats = ncs_stats.copy()

    # 누적매출 및 연도별 매출을 억원 단위로 변환하여 표시
    display_stats['누적매출'] = display_stats['누적매출'].apply(lambda x: f"{format_currency(x)}억원")
    for year in yearly_data.columns:
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

def format_currency(value):
    """금액을 억 원 단위로 포맷팅"""
    return f"{value/100000000:.1f}"

def create_institution_analysis_component(df, yearly_data):
    institution_stats = df.groupby('훈련기관').agg({
        '누적매출': 'sum',
        '과정명': 'count',
        '과정시작일': 'min',
        '과정종료일': 'max',
        '수강신청인원': 'sum'
    }).reset_index()

    # 연도별 매출 추가
    for year in yearly_data.columns:
        institution_stats[year] = df.groupby('훈련기관')[year].sum().values

    # 연도별, 월별 과정 수와 수강신청 인원 수 계산
    df['개강연도'] = pd.to_datetime(df['과정시작일']).dt.year
    df['개강월'] = pd.to_datetime(df['과정시작일']).dt.month

    yearly_courses = df.groupby(['훈련기관', '개강연도']).agg({
        '과정명': 'count',
        '수강신청인원': 'sum'
    }).reset_index()

    monthly_courses = df.groupby(['훈련기관', '개강월']).agg({
        '과정명': 'count',
        '수강신청인원': 'sum'
    }).reset_index()

    # 전체 시장 규모 계산
    total_market = institution_stats['누적매출'].sum()

    # 시장 점유율이 가장 높은 기관 추출
    top_institution = institution_stats.nlargest(1, '누적매출').iloc[0]

    # 평균 기관별 매출 계산
    avg_revenue = institution_stats['누적매출'].mean()

    # 필터링된 기관 데이터 추출 (검색어 적용)
    search_term = st.session_state.get("institution_search", "")  # 세션 상태에서 검색어 가져오기
    if search_term:
        filtered_institutions = institution_stats[institution_stats['훈련기관'].str.contains(search_term, case=False)]
    else:
        filtered_institutions = institution_stats.nlargest(5, '누적매출')

    # 리포트 데이터 생성
    report_data = []
    for _, inst in filtered_institutions.iterrows():
        yearly_revenue_data = {
            str(year): float(inst[year])
            for year in yearly_data.columns
        }
        
        # 연도별 매출 데이터에 해당 연도의 총 매출 대비 비율 추가
        total_revenue = sum(yearly_revenue_data.values())
        for year in yearly_revenue_data:
            yearly_revenue_data[year] = {
                'amount': yearly_revenue_data[year],
                'percentage': (yearly_revenue_data[year] / total_revenue) * 100 if total_revenue else 0
            }

    js_code = """
        <div id="institution-analysis-root"></div>
        <script src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
        <script type="text/babel">
            const reportData = %s;
            const totalMarket = %s;
            const avgRevenue = %s;

            function MarketOverview({ yearlyRevenueData }) {
            const years = Object.keys(yearlyRevenueData).sort();

            return (
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                <h2 style={{ color: '#007bff', marginBottom: '10px' }}>연도별 총 시장 규모</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {years.map(year => (
                    <div key={year} style={{ background: '#e9ecef', padding: '15px', borderRadius: '8px' }}>
                        <h4 style={{ color: '#007bff', marginBottom: '5px' }}>{year}</h4>
                        <p style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#343a40' }}>
                        {(yearlyRevenueData[year].amount / 100000000).toLocaleString('ko-KR', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                        })}억원
                        </p>
                    </div>
                    ))}
                </div>
                </div>
            );
            }

            function InstitutionPerformance({ institution, yearlyRevenueData, yearlyCourses, monthlyCourses, courseDetails }) {
              const years = Object.keys(yearlyRevenueData).sort();

              // 연도별 매출 추이 차트
              const chartData = years.map(year => ({
                연도: year,
                매출: yearlyRevenueData[year].amount / 100000000
              }));

              const maxRevenue = Math.max(...chartData.map(data => data.매출));

              const formatRevenue = (revenue) => {
                return (revenue).toLocaleString('ko-KR', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }) + '억원';
              };

              return (
                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h3 style={{ color: '#007bff', marginBottom: '10px' }}>{institution} 상세 분석</h3>

                  {/* 연도별 매출 추이 */}
                  <h4 style={{ color: '#007bff', marginTop: '20px' }}>연도별 매출 추이</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {chartData.map((data, index) => (
                      <div key={data.연도} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 'bold', minWidth: '60px' }}>{data.연도}:</span>
                         <div style={{
                          height: '20px',
                          width: `${data.매출 / maxRevenue * 100}%`,
                          background: '#007bff',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: '8px',
                          color: 'white',
                           transition: 'width 1s ease-out'
                        }}>
                         {formatRevenue(data.매출)}
                         </div>
                      </div>
                    ))}
                  </div>

                  {/* 연도별 과정 및 수강신청 인원 현황 */}
                  <h4 style={{ color: '#007bff', marginTop: '20px' }}>연도별 과정 및 수강신청 인원 현황</h4>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ flex: 1, background: '#e9ecef', padding: '15px', borderRadius: '8px' }}>
                      <h5 style={{ color: '#007bff', marginBottom: '5px' }}>연도별</h5>
                      {/* 연도별 데이터 테이블 (yearlyCourses) */}
                      {/* ... (구현 필요) ... */}
                    </div>
                    <div style={{ flex: 1, background: '#e9ecef', padding: '15px', borderRadius: '8px' }}>
                      <h5 style={{ color: '#007bff', marginBottom: '5px' }}>월별</h5>
                      {/* 월별 데이터 테이블 (monthlyCourses) */}
                      {/* ... (구현 필요) ... */}
                    </div>
                  </div>

                  {/* 기관별 과정 상세 정보 */}
                  <h4 style={{ color: '#007bff', marginTop: '20px' }}>과정별 세부 정보</h4>
                  {/* 과정별 상세 정보 테이블 (courseDetails) */}
                  {/* ... (구현 필요) ... */}
                </div>
              );
            }

            function InstitutionAnalysis() {
                const [searchTerm, setSearchTerm] = React.useState('');

                const filteredReportData = reportData.filter(item =>
                    item.institution.toLowerCase().includes(searchTerm.toLowerCase())
                );

                return (
                    <div style={{ padding: '20px' }}>
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
                                    background: '#f8f9fa',
                                    border: '1px solid #ced4da',
                                    borderRadius: '4px',
                                    color: 'black',
                                    marginRight: '10px'
                                }}
                            />
                        </div>
                       {/* 검색 결과 표시 */}
                       {filteredReportData.length > 0 && (
                           <MarketOverview yearlyRevenueData={filteredReportData[0].yearlyRevenueData} />
                        )}
                        {filteredReportData.map(data => (
                            <InstitutionPerformance
                                key={data.institution}
                                institution={data.institution}
                                yearlyRevenueData={data.yearlyRevenueData}
                                yearlyCourses={data.yearlyCourses}
                                monthlyCourses={data.monthlyCourses}
                                courseDetails={data.courseDetails}
                            />
                        ))}
                    </div>
                );
            }

            ReactDOM.render(
                <InstitutionAnalysis />,
                document.getElementById('institution-analysis-root')
            );
        </script>
    """ % (json.dumps(report_data), total_market, avg_revenue)

    return js_code