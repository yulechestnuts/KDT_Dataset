import streamlit as st
import pandas as pd
import altair as alt
import re

def format_revenue(revenue):
    """Formats revenue to be displayed in 억 단위."""
    if pd.isna(revenue) or revenue == 0:
        return "0억"
    return f"{revenue / 100000000:.2f}억"

def create_horizontal_bar_chart(df, institution_name, yearly_data):
    """Generates a horizontal bar chart of revenue by training type."""
    if yearly_data is None or yearly_data.empty:
      return None

    year_columns = [col for col in yearly_data.columns if isinstance(col, str) and re.match(r'^\d{4}년$', col)]
    if not year_columns:
        return None

    df_copy = df.copy()
    df_copy['매출액'] = df_copy[year_columns].sum(axis=1)

    print("DataFrame before GroupBy:")
    print(df_copy.head())

    training_type_revenue = df_copy.groupby('훈련유형')['매출액'].sum().reset_index()

    if training_type_revenue.empty:
        return None

    training_type_revenue['매출액'] = training_type_revenue['매출액'].apply(lambda x: x / 100000000)

    chart = alt.Chart(training_type_revenue).mark_bar().encode(
      y = alt.Y('훈련유형', sort='-x'),
      x = alt.X('매출액', axis=alt.Axis(format='~s', title="매출액 (억 원)")),
      tooltip=['훈련유형', alt.Tooltip('매출액', format=",.2f")]
      ).properties(
          title=f"{institution_name} 훈련 유형별 매출액"
      )
    return chart

def create_yearly_revenue_line_chart(df, institution_name, yearly_data):
    """Generates a line chart of yearly revenue."""
    if yearly_data is None or yearly_data.empty:
      return None

    year_columns = [col for col in yearly_data.columns if isinstance(col, str) and re.match(r'^\d{4}년$', col)]
    if not year_columns:
        return None

    yearly_revenue = df[year_columns].fillna(0).sum().reset_index()
    yearly_revenue.columns = ['연도', '매출액']
    yearly_revenue['매출액'] = yearly_revenue['매출액'] / 100000000 # Convert to 억

    chart = alt.Chart(yearly_revenue).mark_line(point=True).encode(
        x=alt.X('연도', title="연도"),
        y=alt.Y('매출액', title="매출액 (억 원)", axis=alt.Axis(format="~s")),
        tooltip = ['연도',alt.Tooltip('매출액', format=",.2f")]
    ).properties(
        title=f"{institution_name} 연도별 매출액 변화"
    )
    return chart

def create_yearly_revenue_pie_charts(df, institution_name, yearly_data):
    """Generates a series of pie charts of yearly revenue proportions by training type."""
    if yearly_data is None or yearly_data.empty:
      return None

    year_columns = [col for col in yearly_data.columns if isinstance(col, str) and re.match(r'^\d{4}년$', col)]
    if not year_columns:
        return None

    charts = []
    for year in year_columns:
       yearly_data_with_type = df.copy()
       yearly_data_with_type['매출액'] = yearly_data_with_type[[year]].sum(axis=1)

       yearly_sums_by_type = yearly_data_with_type.groupby('훈련유형')['매출액'].sum().reset_index()
       yearly_sums_by_type['매출액'] = yearly_sums_by_type['매출액'].apply(lambda x: x / 100000000)

       if yearly_sums_by_type.empty:
           continue
           
       chart = alt.Chart(yearly_sums_by_type).mark_arc().encode(
            theta=alt.Theta(field="매출액", type="quantitative"),
            color=alt.Color(field="훈련유형", type="nominal"),
            tooltip=[alt.Tooltip('훈련유형'), alt.Tooltip('매출액', format=",.2f")]
       ).properties(
          title=f"{institution_name} {year} 훈련 유형별 매출 비중"
      )
       charts.append(chart)
    return charts

@st.cache_data
def analyze_training_institution(df, yearly_data, selected_institution):
    """Analyzes training institution performance"""
    if not selected_institution:
        st.write("훈련기관을 선택해주세요.")
        return

    institution_df = df[df['훈련기관'] == selected_institution].copy()

    st.write("### 연도별 정보")
    year_columns = [col for col in yearly_data.columns if isinstance(col, str) and re.match(r'^\d{4}년$', col)]
    yearly_summary = institution_df.groupby('훈련연도').agg(
        {'과정명': 'count', '수강신청 인원': 'sum'}
    ).rename(columns={'과정명': '총 과정 수', '수강신청 인원': '총 수강생'})

    if '실 매출 대비' in institution_df.columns:
        institution_df['실 매출 대비'] = pd.to_numeric(institution_df['실 매출 대비'].astype(str).str.replace(',', ''), errors='coerce').fillna(0)
        total_revenue = institution_df.groupby('훈련연도')['실 매출 대비'].sum() / 100000000
        yearly_summary['총 매출'] = total_revenue
    else:
        yearly_summary['총 매출'] = 0  # 숫자 0으로 초기화

    # column_config 설정
    column_config = {'총 매출': st.column_config.NumberColumn(format="%.2f억")}
    for year in year_columns:
        column_config[year] = st.column_config.NumberColumn(format="%.2f억")

    # 연도별 매출액 처리 및 column_config 적용
    for year in year_columns:
        if year in institution_df.columns:
            # 연도별 매출액을 숫자형으로 변환 후 합산
            institution_df[year] = pd.to_numeric(institution_df[year].astype(str).str.replace(',', ''), errors='coerce').fillna(0)
            yearly_summary[year] = institution_df.groupby('훈련연도')[year].sum() / 100000000
        else:
            yearly_summary[year] = 0

    st.dataframe(yearly_summary, column_config=column_config)


    st.write("### 과정별 세부 정보")
    course_summary = institution_df.groupby('과정명', as_index=False).agg(
        {'회차': 'count',
         '수강신청 인원': 'sum',
         '누적매출': 'sum',
         '만족도': 'mean'
         }
    ).rename(columns={'회차': '총 횟수',
                     '수강신청 인원': '총 수강생',
                     '누적매출': '매출액',
                     '만족도': '만족도'
                     })

    # column_config 설정 (과정별 세부 정보)
    course_column_config = {'매출액': st.column_config.NumberColumn(format="%.2f억")}

    # 매출액을 억 단위로 변환
    course_summary['매출액'] = course_summary['매출액'] / 100000000

    st.dataframe(course_summary.sort_values(by='매출액', ascending=False),
    column_config=course_column_config)

    bar_chart = create_horizontal_bar_chart(institution_df, selected_institution, yearly_data)
    if bar_chart:
        st.altair_chart(bar_chart, use_container_width=True)
    else:
        st.write("해당 기관은 훈련 유형별 매출액을 표시할 데이터가 부족합니다.")

    line_chart = create_yearly_revenue_line_chart(institution_df, selected_institution, yearly_data)
    if line_chart:
         st.altair_chart(line_chart, use_container_width=True)
    else:
       st.write("해당 기관은 연도별 매출 변화를 표시할 데이터가 부족합니다.")

    pie_charts = create_yearly_revenue_pie_charts(institution_df, selected_institution, yearly_data)
    if pie_charts:
        for chart in pie_charts:
            st.altair_chart(chart, use_container_width=True)
    else:
         st.write("해당 기관은 연도별 매출 비중을 표시할 데이터가 부족합니다.")

@st.cache_data
def analyze_top5_institutions(df, yearly_data):
    st.subheader("Top 5 훈련기관별 성과 분석")
    top5_institutions = df.groupby('훈련기관')['누적매출'].sum().nlargest(5).index

    for institution in top5_institutions:
         st.write(f"### {institution}")
         institution_df = df[df['훈련기관'] == institution].copy()

         course_summary = institution_df.groupby('과정명', as_index=False).agg(
            {'회차': 'count',
             '수강신청 인원': 'sum',
             '누적매출': 'sum',
             '만족도': 'mean'
             }
        ).rename(columns={'회차': '총 횟수',
                        '수강신청 인원': '총 수강생',
                        '누적매출': '매출액',
                        '만족도': '만족도'
                        })
         course_summary['매출액'] = course_summary['매출액'].apply(lambda x: format_revenue(x))
         course_summary['매출액'] = pd.to_numeric(course_summary['매출액'].str.replace('억', '').fillna(0), errors='coerce')
         st.dataframe(course_summary)
         
    chart = create_horizontal_bar_chart(institution_df, institution, yearly_data)
    if chart:
        st.altair_chart(chart, use_container_width=True)
    else:
        st.write("해당 기관은 훈련 유형별 매출액을 표시할 데이터가 부족합니다.")

@st.cache_data
def analyze_course(df, yearly_data):
    st.subheader("과정 분석")
    st.write("과정 분석 기능은 아직 구현 중입니다.")

def format_revenue(revenue):
    """Formats revenue to be displayed in 억 단위."""
    if pd.isna(revenue) or revenue == 0:
        return "0.00억"
    return f"{revenue:.2f}억"  # revenue가 이미 억 단위로 계산되었으므로 그대로 사용

# @st.cache_data  # 제거
def analyze_ncs(df, yearly_data, ncs_name):  # ncs_name 인자 추가
    st.subheader("NCS 분석")

    if ncs_name:
        filtered_df = df[df['NCS명'].str.contains(ncs_name, case=False, na=False)].copy()

        if not filtered_df.empty:
            course_summary = filtered_df.groupby(['과정명', '훈련기관']).agg({
                '수강신청 인원': 'sum',
                '누적매출': 'sum',
                '만족도': 'mean'
            }).rename(columns={'수강신청 인원': '총 훈련생 수',
                             '누적매출': '총 매출',
                             '만족도': '만족도'})

            year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'^\d{4}년$', col)]

            # 연도별 매출액을 억 단위로 변환
            for year in year_columns:
                if year in filtered_df.columns:
                    course_summary[year] = filtered_df.groupby(['과정명', '훈련기관'])[year].sum() / 100000000
                else:
                    course_summary[year] = 0

            # 총 매출을 억 단위로 변환
            course_summary['총 매출'] = course_summary['총 매출'] / 100000000

            # column_config를 사용하여 표시 형식 지정 및 정렬 설정
            column_config = {
                '총 매출': st.column_config.NumberColumn(format="%.2f 억"),
            }
            for year in year_columns:
                column_config[year] = st.column_config.NumberColumn(format="%.2f 억")

            # 데이터프레임 표시
            st.dataframe(course_summary.sort_values(by='총 매출', ascending=False),
                         column_config=column_config)

        else:
            st.write("검색 결과가 없습니다.")
    else:
        st.write("NCS명을 검색하세요.")