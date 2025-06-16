import streamlit as st
import pandas as pd
import numpy as np
import altair as alt
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime
import requests
import io
from streamlit.components.v1 import html
import json
import re
from difflib import SequenceMatcher
import math

# NumPy 타입을 JSON 직렬화하기 위한 사용자 정의 인코더 추가
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NumpyEncoder, self).default(obj)

# utils 모듈에서 함수 직접 임포트 (가독성 및 명시성 향상)
from utils.data_loader import load_data_from_github
from utils.data_preprocessing import preprocess_data
from utils.data import calculate_yearly_revenue, apply_adjusted_revenue
from utils.institution_grouping import group_institutions_advanced
from utils.training_type_classification import classify_training_type
from visualization.reports import analyze_training_institution, analyze_course, analyze_ncs, analyze_top5_institutions
from visualization.charts import create_monthly_revenue_summary_chart

# 차트 함수 직접 구현
# 월별 매출 차트 생성 함수
def create_monthly_revenue_chart(df, selected_year):
    # 선택된 연도의 데이터만 필터링
    year_df = df[df['연도'] == selected_year].copy()
    
    # 월별 매출 계산
    monthly_revenue = year_df.groupby('월')['누적매출'].sum().reset_index()
    monthly_revenue['매출(억원)'] = monthly_revenue['누적매출'] / 100000000  # 억원 단위로 변환
    
    # 피보팅 테이블 생성
    chart = alt.Chart(monthly_revenue).mark_bar().encode(
        x=alt.X('월:O', title='월',axis=alt.Axis(labelAngle=0)),
        y=alt.Y(
            '매출(억원):Q',
            title='매출 (억원)',
            axis=alt.Axis(
                titleAngle=0,        # 제목 가로로
                titleAlign='left',   # 왼쪽 정렬
                titleAnchor='start', # 시작점 기준 정렬
                titleX=-40,          # x축 기준 왼쪽으로 이동 (음수일수록 더 왼쪽)
                titleY=-10           # y축 기준 위쪽으로 이동 (음수일수록 더 위)
            )
        ))
    
    return chart

# 월별 누적 매출 차트 생성 함수
def create_monthly_only_revenue_chart(df, selected_year):
    # 선택된 연도의 데이터만 필터링
    year_df = df[df['연도'] == selected_year].copy()
    
    # 월별 매출 계산
    monthly_revenue = year_df.groupby('월')['누적매출'].sum().reset_index()
    monthly_revenue['매출(억원)'] = monthly_revenue['누적매출'] / 100000000  # 억원 단위로 변환
    
    # 누적 계산
    monthly_revenue = monthly_revenue.sort_values('월')
    monthly_revenue['누적 매출(억원)'] = monthly_revenue['매출(억원)'].cumsum()
    
    # 피보팅 테이블 생성
    chart = alt.Chart(monthly_revenue).mark_line(point=True).encode(
        x=alt.X('월:O', title='월'),
        y=alt.Y('누적 매출(억원):Q', title='누적 매출 (억원)'),
        tooltip=['월:O', alt.Tooltip('누적 매출(억원):Q', format='.1f')]
    ).properties(
        title=f'{selected_year}년 월별 누적 매출',
        width=600
    )
    
    return chart

# 조정된 매출 기준 월별 매출 차트 생성 함수
def create_monthly_revenue_chart_adjusted(df, selected_year):
    # 기본 차트 함수 사용 (조정된 매출은 이미 df에 적용되어 있음)
    return create_monthly_revenue_chart(df, selected_year)

# 월별 랭킹 컴포넌트 생성 함수
def create_monthly_ranking_component(df):
    # 필요한 컬럼 존재 여부 확인 및 디버깅 메시지 추가
    missing_columns = []
    for col in ['훈련기관', '연월', '누적매출']:
        if col not in df.columns:
            missing_columns.append(col)
    
    if missing_columns:
        st.error(f"월별 랭킹 컴포넌트 생성 실패: 필수 컬럼이 없습니다: {', '.join(missing_columns)}")
        return None
    
    # 데이터 복사 (원본 보존)
    df = df.copy()
    
    # 연월 컬럼 확인 및 생성
    if '연월' not in df.columns:
        if '연도' in df.columns and '월' in df.columns:
            # 연월 형식 YYYY-MM 으로 생성
            df['연월'] = df['연도'].astype(str) + '-' + df['월'].astype(str).str.zfill(2)
        else:
            st.error("월별 랭킹 컴포넌트 생성 실패: '연월' 컬럼이 없고, '연도'와 '월' 컬럼도 없습니다.")
            return None
    
    # NaN 값 처리
    df['누적매출'] = df['누적매출'].fillna(0)
    
    # 파트너기관 컬럼 확인 및 생성
    if '파트너기관' not in df.columns:
        df['파트너기관'] = ''
    
    # 훈련유형 컬럼 확인 및 생성
    if '훈련유형' not in df.columns:
        df['훈련유형'] = ''
    
    # 표시용_기관 컬럼 생성 (기본값은 훈련기관)
    df['표시용_기관'] = df['훈련기관']
    
    # 선도기업형 훈련인 경우 파트너기관을 표시
    mask_leading_company = df['훈련유형'].str.contains('선도기업형', na=False)
    has_partner = (df['파트너기관'].notna()) & (df['파트너기관'] != '')
    
    # 훈련유형이 선도기업형이거나 파트너기관이 있는 경우
    mask = mask_leading_company | has_partner
    df.loc[mask & has_partner, '표시용_기관'] = df.loc[mask & has_partner, '파트너기관']
    
    # 누적매출이 0 이상인 데이터만 사용
    df = df[df['누적매출'] > 0]
    
    # 데이터가 비어있는지 확인
    if len(df) == 0:
        st.warning("월별 랭킹 컴포넌트 생성 실패: 누적매출이 0보다 큰 데이터가 없습니다.")
        return None
    
    # 훈련기관별 월별 매출 집계 (표시용 기관 사용)
    try:
        monthly_revenue = df.groupby(['연월', '표시용_기관'])['누적매출'].sum().reset_index()
    except Exception as e:
        st.error(f"월별 랭킹 컴포넌트 생성 실패: 데이터 집계 중 오류 발생 - {e}")
        return None
    
    if monthly_revenue.empty:
        st.warning("월별 랭킹 컴포넌트 생성 실패: 그룹핑 후 데이터가 없습니다.")
        return None
    
    # 연월별 상위 10개 기관 추출
    top_institutions_by_month = {}
    for month in sorted(monthly_revenue['연월'].unique(), reverse=True):
        month_data = monthly_revenue[monthly_revenue['연월'] == month].copy()
        if len(month_data) == 0:
            continue
            
        # 누적매출 기준으로 정렬하고 상위 10개 추출
        top_institutions = month_data.sort_values('누적매출', ascending=False).head(10)
        # 억원 단위 변환 (소수점 첫째 자리까지)
        top_institutions['매출(억원)'] = (top_institutions['누적매출'] / 100000000).round(1)
        top_institutions_by_month[month] = top_institutions
    
    if not top_institutions_by_month:
        st.warning("월별 랭킹 컴포넌트 생성 실패: 추출된 상위 기관 데이터가 없습니다.")
        return None
    
    # HTML 테이블 생성
    html_content = '<div style="max-width: 100%; overflow-x: auto;">\n'
    html_content += '<style>\n'
    html_content += 'table { border-collapse: collapse; width: 100%; }\n'
    html_content += 'th, td { padding: 8px; text-align: left; }\n'
    html_content += 'th { background-color: #f2f2f2; position: sticky; top: 0; }\n'
    html_content += 'tr:nth-child(even) { background-color: #f9f9f9; }\n'
    html_content += 'tr:hover { background-color: #eaeaea; }\n'
    html_content += '.institution-ranking { margin-bottom: 20px; }\n'
    html_content += '</style>\n'
    
    # 랭킹 테이블 생성 (최근 6개월만 표시)
    months_to_show = list(top_institutions_by_month.keys())[:6]
    
    for month in months_to_show:
        top_data = top_institutions_by_month[month]
        
        html_content += '<div class="institution-ranking">\n'
        
        try:
            year, month_num = month.split('-')
            html_content += f'<h3>{year}년 {int(month_num)}월 상위 훈련기관</h3>\n'
        except ValueError:
            # 연월 형식이 예상과 다른 경우 처리
            html_content += f'<h3>{month} 상위 훈련기관</h3>\n'
            
        html_content += '<table>\n'
        html_content += '<tr><th>순위</th><th>훈련기관</th><th>매출(억원)</th></tr>\n'
        
        for i, (_, row) in enumerate(top_data.iterrows(), 1):
            # 표시용_기관 컬럼 사용 (선도기업형 훈련은 파트너기관 표시)
            institution = row["표시용_기관"]
            revenue = row["매출(억원)"]
            
            # HTML 이스케이프 처리
            institution = institution.replace('<', '&lt;').replace('>', '&gt;')
            
            html_content += f'<tr><td>{i}</td><td>{institution}</td><td>{revenue}억원</td></tr>\n'
        
        html_content += '</table>\n'
        html_content += '</div>\n'
    
    html_content += '</div>'
    
    return html_content

@st.cache_data
def create_ranking_component(df, yearly_data):
    """훈련기관별 랭킹 컴포넌트 생성"""
    if '훈련기관' not in df.columns:
       print("Error: '훈련기관' 컬럼이 DataFrame에 없습니다. (create_ranking_component)")
       return None
    
    # 연도별 과정 수 계산
    yearly_courses = {}
    year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}년$', col)]
    
    for institution in df['훈련기관'].unique():
        yearly_courses[institution] = {}
        for year in ['2021년', '2022년', '2023년', '2024년', '2025년']:
            year_data = df[(df['훈련기관'] == institution) & 
                          (pd.to_datetime(df['과정시작일']).dt.year == int(year[:4]))]
            yearly_courses[institution][year] = len(year_data)

    # 만족도 계산 수정
    satisfaction_data = {}
    for institution in df['훈련기관'].unique():
        inst_data = df[df['훈련기관'] == institution]
        valid_data = inst_data[inst_data['만족도'] > 0]  # 만족도가 0인 데이터 제외
        if len(valid_data) > 0:
            weighted_satisfaction = (valid_data['만족도'] * valid_data['수강신청 인원']).sum()
            total_students = valid_data['수강신청 인원'].sum()
            satisfaction_data[institution] = round(weighted_satisfaction / total_students, 1)
        else:
            satisfaction_data[institution] = 0

    institution_revenue = df.groupby('훈련기관').agg({
        '누적매출': 'sum',
        '훈련기관': 'count'
    }).rename(columns={'훈련기관': 'courses'})
    
    # 선도기업형/일반KDT 매출 분리 계산
    leading_revenue = {}
    normal_revenue = {}
    
    for institution in df['훈련기관'].unique():
        inst_data = df[df['훈련기관'] == institution]
        leading_inst_data = inst_data[inst_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
        normal_inst_data = inst_data[~inst_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
        
        leading_revenue[institution] = leading_inst_data['누적매출'].sum()
        normal_revenue[institution] = normal_inst_data['누적매출'].sum()

    # Top 5 과정 데이터 준비 - 매출액 계산 수정
    courses_data = {}
    for institution in df['훈련기관'].unique():
        inst_courses = df[df['훈련기관'] == institution].copy()
        courses_data[institution] = [
            {
                'name': row['과정명'],
                'yearlyRevenue': {
                    year: round(float(row[year])) if pd.notna(row[year]) else 0  # 정수로 반올림 처리
                    for year in year_columns
                },
                'satisfaction': float(row['만족도']) if pd.notna(row['만족도']) else 0,
                'startYear': int(pd.to_datetime(row['과정시작일']).year),
                'students': int(row['수강신청 인원']) if pd.notna(row['수강신청 인원']) else 0,
                'completedStudents': int(row['수료인원']) if pd.notna(row['수료인원']) else 0,  # 수료인원 추가
                'isLeadingCompany': '선도기업형 훈련' in str(row.get('훈련유형', '')) # 선도기업 여부는 과정별로 설정
            }
            for _, row in inst_courses.iterrows()
        ]

    # 연도별 매출 합산
    yearly_revenues = {}
    yearly_leading_revenues = {}
    yearly_normal_revenues = {}
    
    for institution in institution_revenue.index:
        institution_data = df[df['훈련기관'] == institution]
        
        # 전체 매출
        yearly_revenues[institution] = {}
        # 선도기업형 매출
        yearly_leading_revenues[institution] = {}
        # 일반KDT 매출
        yearly_normal_revenues[institution] = {}
        
        for year in year_columns:
            # 연도별 전체 매출
            yearly_revenues[institution][year] = float(institution_data[year].sum())
            
            # 연도별 선도기업형 매출
            leading_data = institution_data[institution_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
            yearly_leading_revenues[institution][year] = float(leading_data[year].sum() if not leading_data.empty else 0)
            
            # 연도별 일반KDT 매출
            normal_data = institution_data[~institution_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
            yearly_normal_revenues[institution][year] = float(normal_data[year].sum() if not normal_data.empty else 0)

    # ranking_data 생성
    ranking_data = []
    for institution in institution_revenue.index:
        ranking_data.append({
            "institution": institution,
            "revenue": float(institution_revenue.loc[institution, '누적매출']),
            "courses": int(institution_revenue.loc[institution, 'courses']),
            "yearlyRevenue": yearly_revenues[institution],
            "yearlyLeadingRevenue": yearly_leading_revenues[institution],
            "yearlyNormalRevenue": yearly_normal_revenues[institution],
            "leadingRevenue": float(leading_revenue[institution]),
            "normalRevenue": float(normal_revenue[institution]),
            "yearlyCourses": yearly_courses[institution],
            "satisfaction": round(float(satisfaction_data.get(institution, 0)), 1),
            "coursesData": courses_data[institution],  # 전체 과정 데이터 전달
        })

    def calculate_completion_rate(year=None):
        """연도별 수료율 계산 - 과정종료일 기준, 3주 이내 종료된 과정은 제외"""
        current_date = pd.Timestamp.now()
        # 3주 전 날짜 계산 (21일)
        three_weeks_ago = current_date - pd.Timedelta(days=21)
        
        if year:
            # 해당 연도에 종료된 과정만 필터링
            year_data = df[pd.to_datetime(df['과정종료일']).dt.year == int(year)]
            # 종료일이 3주 이전인 과정만 포함 (최근 3주 내 종료된 과정 제외)
            year_data = year_data[pd.to_datetime(year_data['과정종료일']) < three_weeks_ago]
            # 수료인원이 0인 과정 제외
            valid_data = year_data[year_data['수료인원'] > 0]
            if len(valid_data) == 0:
                return 0
            completion_rate = (valid_data['수료인원'].sum() / valid_data['수강신청 인원'].sum()) * 100
        else:
            # 전체 기간 중 종료된 과정만 필터링 (현재 날짜 이전)
            completed_data = df[pd.to_datetime(df['과정종료일']) <= current_date]
            # 종료일이 3주 이전인 과정만 포함 (최근 3주 내 종료된 과정 제외)
            completed_data = completed_data[pd.to_datetime(completed_data['과정종료일']) < three_weeks_ago]
            # 수료인원이 0인 과정 제외
            valid_data = completed_data[completed_data['수료인원'] > 0]
            if len(valid_data) == 0:
                return 0
            completion_rate = (valid_data['수료인원'].sum() / valid_data['수강신청 인원'].sum()) * 100
        return round(completion_rate, 1)

    # 수료율 계산
    completion_rates = {
        'total': calculate_completion_rate(),
        '2021': calculate_completion_rate(2021),
        '2022': calculate_completion_rate(2022),
        '2023': calculate_completion_rate(2023),
        '2024': calculate_completion_rate(2024),
        '2025': calculate_completion_rate(2025)
    }

    js_code = """
    <div id="ranking-root"></div>
    <script src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
    <script type="text/babel">
        const rankingData = %s;
        const completionRates = %s;

        function RankingDisplay() {
            const [selectedYear, setSelectedYear] = React.useState('all');
            const [searchTerm, setSearchTerm] = React.useState('');
            const [expandedInstitutions, setExpandedInstitutions] = React.useState({});
            const [trainingType, setTrainingType] = React.useState('all'); // 훈련 유형 필터 상태 추가
            const years = Object.keys(rankingData[0].yearlyRevenue).sort();

            const toggleInstitution = (institution) => {
                setExpandedInstitutions(prev => ({
                    ...prev,
                    [institution]: !prev[institution]
                }));
            };

            const getRevenueForDisplay = (item) => {
                // 훈련 유형에 따라 다른 매출 표시
                if (trainingType === 'leading') {
                    // 선도기업형일 경우 선도기업형 매출만 표시
                    if (selectedYear === 'all') {
                        return item.leadingRevenue;
                    }
                    return item.yearlyLeadingRevenue[selectedYear] || 0;
                } else if (trainingType === 'normal') {
                    // 일반KDT일 경우 일반KDT 매출만 표시
                    if (selectedYear === 'all') {
                        return item.normalRevenue;
                    }
                    return item.yearlyNormalRevenue[selectedYear] || 0;
                } else {
                    // 전체일 경우 총 매출 표시
                    if (selectedYear === 'all') {
                        return item.revenue;
                    }
                    return item.yearlyRevenue[selectedYear] || 0;
                }
            };

            const calculateCourseRevenue = (course, selectedYear) => {
                // 과정의 훈련유형에 따른 매출 계산 (여기서는 훈련유형에 관계없이 모든 과정 표시)
                if (selectedYear === 'all') {
                    return Object.values(course.yearlyRevenue).reduce((sum, val) => sum + val, 0);
                }
                return course.yearlyRevenue[selectedYear] || 0;
            };

            const getTop5Courses = (coursesData, selectedYear) => {
                // 과정명별로 매출과 만족도를 합산
                const aggregatedCourses = coursesData.reduce((acc, course) => {
                    // 훈련유형에 따른 필터링
                    if (trainingType === 'leading' && !course.isLeadingCompany) {
                        return acc; // 선도기업형만 표시할 때 일반KDT 과정 제외
                    }
                    if (trainingType === 'normal' && course.isLeadingCompany) {
                        return acc; // 일반KDT만 표시할 때 선도기업형 과정 제외
                    }
                    
                    if (!acc[course.name]) {
                        acc[course.name] = {
                            name: course.name,
                            yearlyRevenue: { ...course.yearlyRevenue },
                            satisfaction: course.satisfaction > 0 ? course.satisfaction : 0,
                            totalCount: 1,
                            yearlyCount: {},
                            latestStartYear: course.startYear,
                            totalStudents: course.satisfaction > 0 ? course.students : 0,
                            totalCompletedStudents: course.completedStudents,  // 수료인원 합계 추가
                            weightedSatisfaction: course.satisfaction > 0 ? course.satisfaction * course.students : 0,
                            isLeadingCompany: course.isLeadingCompany || false // 선도기업 여부 추가
                        };
                        acc[course.name].yearlyCount[course.startYear] = 1;
                    } else {
                        Object.keys(course.yearlyRevenue).forEach(year => {
                            acc[course.name].yearlyRevenue[year] = (acc[course.name].yearlyRevenue[year] || 0) + course.yearlyRevenue[year];
                        });
                        
                        acc[course.name].totalCount += 1;
                        acc[course.name].yearlyCount[course.startYear] = (acc[course.name].yearlyCount[course.startYear] || 0) + 1;
                        acc[course.name].totalCompletedStudents += course.completedStudents;  // 수료인원 누적
                        
                        if (course.satisfaction > 0) {
                            acc[course.name].totalStudents += course.students;
                            acc[course.name].weightedSatisfaction += course.satisfaction * course.students;
                        }
                        // 하나라도 선도기업이면 선도기업으로 표시
                        acc[course.name].isLeadingCompany = acc[course.name].isLeadingCompany || course.isLeadingCompany;
                    }
                    return acc;
                }, {});

                return Object.values(aggregatedCourses)
                    .map(course => ({
                        ...course,
                        revenue: calculateCourseRevenue(course, selectedYear),
                        displayCount: selectedYear === 'all' ? 
                            course.totalCount : 
                            (course.yearlyCount[selectedYear.replace('년', '')] || 0),
                        satisfaction: course.totalStudents > 0 ? 
                            (course.weightedSatisfaction / course.totalStudents).toFixed(1) : 
                            '데이터 없음'
                    }))
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 10);
            };

            // 필터링된 데이터 생성 (훈련 유형 필터 추가)
            const filteredAndSortedData = [...rankingData]
                .filter(item =>
                    item.institution.toLowerCase().includes(searchTerm.toLowerCase()) &&
                    (trainingType === 'all' || 
                     (trainingType === 'leading' && item.leadingRevenue > 0) ||
                     (trainingType === 'normal' && item.normalRevenue > 0))
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
                        padding: '40px 0',
                        position: 'sticky',
                        top: 0,
                        background: 'black',
                        zIndex: 1000
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
                            margin: '10px 0',
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '10px',
                            flexWrap: 'wrap'
                        }}>
                            <button style={{
                                padding: '8px 16px',
                                background: '#333',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white'
                            }}>
                                전체 수료율 <span style={{color: '#4299e1', fontWeight: 'bold'}}>{completionRates.total}</span>%%
                            </button>
                            <button style={{
                                padding: '8px 16px',
                                background: '#333',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white'
                            }}>
                                2021년 수료율 <span style={{color: '#4299e1', fontWeight: 'bold'}}>{completionRates['2021']}</span>%%
                            </button>
                            <button style={{
                                padding: '8px 16px',
                                background: '#333',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white'
                            }}>
                                2022년 수료율 <span style={{color: '#4299e1', fontWeight: 'bold'}}>{completionRates['2022']}</span>%%
                            </button>
                            <button style={{
                                padding: '8px 16px',
                                background: '#333',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white'
                            }}>
                                2023년 수료율 <span style={{color: '#4299e1', fontWeight: 'bold'}}>{completionRates['2023']}</span>%%
                            </button>
                            <button style={{
                                padding: '8px 16px',
                                background: '#333',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white'
                            }}>
                                2024년 수료율 <span style={{color: '#4299e1', fontWeight: 'bold'}}>{completionRates['2024']}</span>%%
                            </button>
                            <button style={{
                                padding: '8px 16px',
                                background: '#333',
                                border: 'none',
                                borderRadius: '4px',
                                color: 'white'
                            }}>
                                2025년 수료율 <span style={{color: '#4299e1', fontWeight: 'bold'}}>{completionRates['2025']}</span>%%
                            </button>
                        </div>

                        <p style={{
                            fontSize: '16px',
                            color: '#888',
                            marginTop: '10px'
                        }}>2025년 4월 30일 기준 개설된 과정 기준</p>

                        <div style={{
                            margin: '20px 0',
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '10px',
                            flexWrap: 'wrap',
                            position: 'sticky',
                            top: '200px',
                            background: 'black',
                            zIndex: 1000,
                            padding: '10px 0'
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
                            {/* 훈련 유형 필터 추가 */}
                            <div style={{ 
                                display: 'flex', 
                                gap: '8px',
                                marginRight: '20px',
                                background: '#1A202C',
                                padding: '4px',
                                borderRadius: '4px'
                            }}>
                                <button
                                    onClick={() => setTrainingType('all')}
                                    style={{
                                        padding: '8px 16px',
                                        background: trainingType === 'all' ? '#4299e1' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer'
                                    }}
                                >전체</button>
                                <button
                                    onClick={() => setTrainingType('leading')}
                                    style={{
                                        padding: '8px 16px',
                                        background: trainingType === 'leading' ? '#4299e1' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer'
                                    }}
                                >선도기업</button>
                                <button
                                    onClick={() => setTrainingType('normal')}
                                    style={{
                                        padding: '8px 16px',
                                        background: trainingType === 'normal' ? '#4299e1' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer'
                                    }}
                                >일반KDT</button>
                            </div>
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
                            const isExpanded = expandedInstitutions[item.institution];
                            return (
                                <div key={item.institution}>
                                    <div
                                        style={{
                                            background: '#222',
                                            borderRadius: '8px',
                                            padding: '16px',
                                            marginBottom: '8px',
                                            position: 'relative',
                                            animation: `slideIn 0.5s ease-out ${index * 0.1}s both`,
                                            cursor: 'pointer',
                                        }}
                                        onClick={() => toggleInstitution(item.institution)}
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
                                                {/* 선도기업 과정 개수 표시 대신 만족도 정보 표시 */}
                                                <span style={{
                                                    background: '#2D3748', 
                                                    padding: '4px 8px', 
                                                    borderRadius: '4px', 
                                                    color: '#4299e1',
                                                    fontSize: '14px',
                                                    marginRight: '8px'
                                                }}>
                                                    만족도: {item.satisfaction}
                                                </span>
                                                <span style={{
                                                    cursor: 'pointer',
                                                    color: isExpanded ? '#4299e1' : '#888',
                                                    transition: 'color 0.3s'
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleInstitution(item.institution);
                                                }}>
                                                    {isExpanded ? '▼' : '▶'}
                                                </span>
                                            </div>
                                            <div>
                                                <span style={{color: '#4299e1', marginRight: '16px'}}>
                                                    {formatRevenue(revenue)}
                                                </span>
                                                <span style={{color: '#888', fontSize: '14px'}}>
                                                    {selectedYear === 'all' ? 
                                                        `(총 ${item.courses}개 과정)` :
                                                        `(${item.yearlyCourses[selectedYear]}개 과정)`
                                                    }
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
                                    {isExpanded && (
                                        <div style={{
                                            background: '#2D3748',
                                            borderRadius: '8px',
                                            padding: '16px',
                                            marginBottom: '16px',
                                            marginLeft: '20px'
                                        }}>
                                            <h3 style={{color: '#4299e1', marginBottom: '12px'}}>Top 10 과정</h3>
                                            {getTop5Courses(item.coursesData, selectedYear).map((course, idx) => (
                                                <div key={idx} style={{
                                                    marginBottom: '8px',
                                                    padding: '8px',
                                                    background: '#1A202C',
                                                    borderRadius: '4px',
                                                    borderLeft: course.isLeadingCompany ? '3px solid #48BB78' : 'none' // 선도기업 과정 표시
                                                }}>
                                                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                                        <span>
                                                            #{idx + 1} {course.name} 
                                                            {course.isLeadingCompany && 
                                                                <span style={{
                                                                    background: '#2D3748', 
                                                                    padding: '2px 4px', 
                                                                    borderRadius: '2px', 
                                                                    color: '#48BB78', 
                                                                    fontSize: '10px',
                                                                    marginLeft: '4px'
                                                                }}>
                                                                    선도기업
                                                                </span>
                                                            }
                                                            <span style={{color: '#888'}}> (수료인원 {course.totalCompletedStudents}명)</span>
                                                        </span>
                                                        <span>
                                                            <span style={{color: '#48BB78', marginRight: '12px'}}>
                                                                만족도: {course.satisfaction}
                                                            </span>
                                                            <span style={{color: '#888', marginRight: '12px'}}>
                                                                {selectedYear === 'all' ? 
                                                                    `(총 ${course.totalCount}회차)` : 
                                                                    `(${selectedYear} ${course.displayCount}회차)`}
                                                            </span>
                                                            <span style={{color: '#4299e1'}}>
                                                                {formatRevenue(course.revenue)}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
    """ % (json.dumps(ranking_data, cls=NumpyEncoder), json.dumps(completion_rates, cls=NumpyEncoder))

    return js_code

def format_revenue(revenue):
    """매출액을 조/억 단위로 포맷팅"""
    if revenue >= 1000000000000:  # 1조 이상
        trillion = int(revenue // 1000000000000)  # 정수 조 단위
        billion = (revenue % 1000000000000) / 100000000  # 억 단위 (소수점 포함)
        
        if billion > 0:
            return f"{trillion}조 {billion:.1f}억원"
        else:
            return f"{trillion}조원"
    else:
        # 1조 미만은 억 단위로 표시 (소수점 포함)
        return f"{revenue/100000000:.1f}억원"

def calculate_and_visualize_revenue(df):
    """선도기업 매출 비중과 총 매출 분석을 시각화합니다."""
    try:
        # 섹션 제목
        st.subheader("매출 분석")
        
        # 선도기업/일반KDT 필터링 옵션
        revenue_type = st.radio(
            "분석 유형 선택",
            ["전체", "선도기업형만", "일반KDT만"],
            horizontal=True,
            key="revenue_type_filter"
        )
        
        # 데이터 필터링
        if revenue_type == "선도기업형만":
            filtered_df = df[df['훈련유형'].str.contains('선도기업형 훈련', na=False)]
            filter_text = "선도기업형"
        elif revenue_type == "일반KDT만":
            filtered_df = df[~df['훈련유형'].str.contains('선도기업형 훈련', na=False)]
            filter_text = "일반KDT"
        else:
            filtered_df = df.copy()
            filter_text = ""
        
        # 연도 선택 옵션
        years = [2021, 2022, 2023, 2024, 2025, "전체 기간"]
        selected_year = st.selectbox("연도 선택", years, index=len(years)-1)
        
        # 선택된 연도로 데이터 필터링
        if selected_year != "전체 기간":
            year_filtered_df = filtered_df[filtered_df['훈련연도'] == selected_year]
            year_text = f"{selected_year}년"
        else:
            year_filtered_df = filtered_df.copy()
            year_text = "전체 기간"
        
        # 훈련유형별 과정 매출 계산
        course_revenue = year_filtered_df.copy()
        
        try:
            # 훈련유형별 통계 계산
            training_type_stats = course_revenue.groupby('훈련유형').agg({
                '누적매출': 'sum',
                '과정명': 'nunique'
            }).reset_index()

            # 총 매출 및 과정 수 계산
            total_revenue = training_type_stats['누적매출'].sum()
            total_courses = training_type_stats['과정명'].sum()
            
            # 매출 단위 변환 (억원)
            training_type_stats['매출(억원)'] = training_type_stats['누적매출'] / 100000000
            
            # 2열 레이아웃 구성
            col1, col2 = st.columns(2)
            
            # 왼쪽 열: 훈련유형별 매출 비중
            with col1:
                # 포맷팅된 매출액 표시
                formatted_revenue = format_revenue(total_revenue)
                st.markdown(f"### {filter_text} {year_text} 총 매출: {formatted_revenue}")
                
                # 파이 차트 - 매출 비중
                fig_revenue = px.pie(
                    training_type_stats, 
                    values='누적매출',
                    names='훈련유형',
                    title=f"{filter_text} {year_text} 훈련유형별 매출 비중",
                    color_discrete_sequence=px.colors.qualitative.Set3
                )
                fig_revenue.update_traces(textposition='inside', textinfo='percent+label')
                st.plotly_chart(fig_revenue, use_container_width=True)
            
            # 오른쪽 열: 훈련유형별 과정 수 비중
            with col2:
                st.markdown(f"### {filter_text} {year_text} 총 과정 수: {int(total_courses)}개")
                
                # 파이 차트 - 과정 수 비중
                fig_courses = px.pie(
                    training_type_stats, 
                    values='과정명',
                    names='훈련유형',
                    title=f"{filter_text} {year_text} 훈련유형별 과정 수 비중",
                    color_discrete_sequence=px.colors.qualitative.Pastel
                )
                fig_courses.update_traces(textposition='inside', textinfo='percent+label')
                st.plotly_chart(fig_courses, use_container_width=True)
            
            # 모든 필터에 대해 상위 훈련기관 바 차트 표시
            # 바 차트 제목과 데이터 필터링 설정
            if revenue_type == "선도기업형만":
                bar_chart_title = f"{year_text} 선도기업형 과정 매출 상위 5개 훈련기관"
                top_institutions_df = year_filtered_df
            elif revenue_type == "일반KDT만":
                bar_chart_title = f"{year_text} 일반KDT 과정 매출 상위 5개 훈련기관"
                top_institutions_df = year_filtered_df
            else:
                bar_chart_title = f"{year_text} 전체 과정 매출 상위 5개 훈련기관"
                top_institutions_df = year_filtered_df
            
            # 훈련기관별 매출 집계
            top_institutions = top_institutions_df.groupby('훈련기관').agg({
                '누적매출': 'sum'
            }).reset_index().sort_values('누적매출', ascending=False).head(5)
            
            top_institutions['매출(억원)'] = top_institutions['누적매출'] / 100000000
            
            st.markdown(f"### {bar_chart_title}")
            
            # 훈련기관 바 차트에 포맷팅된 매출액 텍스트 추가
            fig_top = px.bar(
                top_institutions,
                x='훈련기관',
                y='매출(억원)',
                title=bar_chart_title,
                color='매출(억원)',
                color_continuous_scale=px.colors.sequential.Viridis
            )
            
            # 바 차트 위에 포맷팅된 매출액 표시
            fig_top.update_traces(
                text=[format_revenue(rev) for rev in top_institutions['누적매출']],
                textposition='outside'
            )
            
            # 바 차트 레이아웃 조정 - 높이 증가 및 마진 추가
            fig_top.update_layout(
                height=500,  # 높이 증가
                margin=dict(t=50, b=100),  # 위, 아래 마진 추가
                xaxis=dict(tickangle=-30),
                yaxis=dict(tickangle=0)  # 축 레이블 기울기 조정
            )
            
            st.plotly_chart(fig_top, use_container_width=True)
            
            # 매출액 상세 테이블 (옵션)
            if st.checkbox("훈련기관별 매출액 상세보기", False):
                display_table = top_institutions.copy()
                display_table['매출액'] = display_table['누적매출'].apply(format_revenue)
                st.table(display_table[['훈련기관', '매출액']])
        
        except Exception as e:
            st.error(f"매출 계산 중 오류가 발생했습니다: {e}")
            import traceback
            st.error(traceback.format_exc())
    
    except Exception as e:
        st.error(f"매출 분석 중 오류가 발생했습니다: {e}")
        import traceback
        st.error(traceback.format_exc())

        
@st.cache_data
def create_ncs_ranking_component(df):
    """NCS 분류별 랭킹 컴포넌트 생성"""
    try:
        if 'NCS명' not in df.columns:
            st.warning("'NCS명' 컬럼이 DataFrame에 없습니다.")
            return None
        
        # NCS별 매출 및 과정 수 계산
        ncs_stats = df.groupby('NCS명', as_index=False).agg({
            '누적매출': 'sum',
            '과정명': 'count'
        }).rename(columns={
            '누적매출': 'revenue',
            '과정명': 'courses'
        })
        
        # NCS명이 빈 값인 경우 처리
        ncs_stats = ncs_stats[ncs_stats['NCS명'].notna() & (ncs_stats['NCS명'] != '')].copy()
        
        # 매출액 기준 상위 20개로 제한
        top_ncs = ncs_stats.nlargest(20, 'revenue')
        
        # NCS명 컬럼 이름 변경
        top_ncs = top_ncs.rename(columns={'NCS명': 'ncs'})
        
        # 억 단위 변환
        top_ncs['revenue_billions'] = top_ncs['revenue'] / 100000000
        
        # NumPy 값을 Python 기본 타입으로 변환
        top_ncs_json = json.loads(json.dumps(top_ncs.to_dict(orient='records'), cls=NumpyEncoder))
        
        # HTML 컴포넌트 생성
        html_content = f"""
        <div style="padding: 20px; font-family: Arial, sans-serif;">
            <h2 style="text-align: center; margin-bottom: 30px;">NCS 분류별 매출 TOP 20</h2>
            <div style="max-width: 1000px; margin: 0 auto;">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
        """
        
        for row in top_ncs_json:
            html_content += f"""
                    <div style="background-color: #f8f9fa; border-radius: 10px; padding: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h3 style="margin-top: 0; color: #2c3e50;">{row['ncs']}</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #3498db; margin: 10px 0;">{row['revenue_billions']:.2f}억원</p>
                        <p style="color: #7f8c8d;">총 {row['courses']}개 과정</p>
                    </div>
            """
        
        html_content += """
                </div>
            </div>
        </div>
        """
        
        return html_content
    except Exception as e:
        st.error(f"NCS 랭킹 컴포넌트 생성 중 오류가 발생했습니다: {e}")
        import traceback
        st.error(traceback.format_exc())
        return None

def create_monthly_performance_summary(df_for_summary, use_adjusted_revenue_flag):
    st.subheader("월별 Top 훈련기관 성과 조회")

    # 필수 컬럼 확인
    required_cols_summary = ['훈련연도', '과정시작일', '누적매출', '수강신청 인원', '훈련기관']
    if any(col not in df_for_summary.columns for col in required_cols_summary):
        st.error("월별 성과 요약에 필요한 컬럼(훈련연도, 과정시작일, 누적매출, 수강신청 인원, 훈련기관)이 부족합니다.")
        return

    # 데이터 정제 (결측치 처리 및 타입 변환)
    df_summary_cleaned = df_for_summary.dropna(subset=['과정시작일', '훈련연도']).copy()
    try:
        df_summary_cleaned['과정시작일'] = pd.to_datetime(df_summary_cleaned['과정시작일'])
        df_summary_cleaned['훈련연도'] = df_summary_cleaned['훈련연도'].astype(int)
    except Exception as e:
        st.error(f"월별 요약 정보 생성 중 날짜 또는 연도 컬럼 처리 오류: {e}")
        return

    # 사용자 입력 UI
    col_yr, col_mon, col_top_n = st.columns([2, 2, 1])
    with col_yr:
        unique_years_in_data = sorted(df_summary_cleaned['훈련연도'].unique(), reverse=True)
        if not unique_years_in_data: # 데이터에 유효한 연도가 없는 경우
            st.warning("분석할 연도 데이터가 없습니다.")
            return
        selected_year = st.selectbox("연도 선택 ", unique_years_in_data, key="perf_summary_year_selector") # 고유한 key
    with col_mon:
        # 현재 선택된 연도가 올해와 같으면 현재 월, 아니면 1월을 기본값으로
        default_month_index = datetime.now().month - 1 if selected_year == datetime.now().year else 0
        selected_month = st.selectbox("월 선택 ", range(1, 13),
                                      index=default_month_index,
                                      format_func=lambda x: f"{x}월",
                                      key="perf_summary_month_selector") # 고유한 key
    with col_top_n:
        top_n = st.number_input("Top N ", min_value=1, value=10, step=1, key="perf_summary_top_n_selector") # 고유한 key

    # 선택된 연/월 데이터 필터링
    monthly_filtered_data = df_summary_cleaned[
        (df_summary_cleaned['훈련연도'] == selected_year) &
        (df_summary_cleaned['과정시작일'].dt.month == selected_month)
    ]

    if monthly_filtered_data.empty:
        st.info(f"{selected_year}년 {selected_month}월에 해당하는 과정 데이터가 없습니다.")
        return

    # '누적매출' 컬럼은 이미 main 함수에서 use_adjusted_revenue_flag에 따라 조정된 상태로 전달됨
    total_revenue_for_month_display = monthly_filtered_data['누적매출'].sum() # 최종 표시는 10배수
    total_students_for_month_display = monthly_filtered_data['수강신청 인원'].sum()
    adj_text_display = " (수료율 조정 적용)" if use_adjusted_revenue_flag else ""

    # 총계 정보 표시
    st.markdown("---") # 구분선
    metric_col1, metric_col2 = st.columns(2)
    metric_col1.metric(
        label=f"{selected_year}년 {selected_month}월 총 매출{adj_text_display}",
        value=format_revenue(total_revenue_for_month_display) # format_revenue는 10배수된 값을 받아 처리
    )
    metric_col2.metric(
        label=f"{selected_year}년 {selected_month}월 총 수강생",
        value=f"{int(total_students_for_month_display)}명"
    )
    st.markdown("---") # 구분선

    # 훈련기관별 성과 집계
    institution_summary_perf = monthly_filtered_data.groupby('훈련기관').agg(
        total_revenue_inst=('누적매출', 'sum'), # 이미 조정된 '누적매출' 사용
        num_students_inst=('수강신청 인원', 'sum')
    ).reset_index()

    # 매출액 10배수 및 억원 단위 변환 (표시용)
    institution_summary_perf['매출액(억)'] = institution_summary_perf['total_revenue_inst'] / 100000000

    # Top N 기관 필터링 및 표시
    top_n_institutions_display = institution_summary_perf.sort_values('매출액(억)', ascending=False).head(top_n)

    if not top_n_institutions_display.empty:
        st.write(f"**{selected_year}년 {selected_month}월 Top {top_n} 훈련기관{adj_text_display}**")
        # 매출액(억) 컬럼 반올림 처리 - 소수점 첫째 자리까지 표시
        top_n_institutions_display['매출액(억)'] = top_n_institutions_display['매출액(억)'].round(1)
        
        st.dataframe(
            top_n_institutions_display[['훈련기관', '매출액(억)', 'num_students_inst']].rename(
                columns={'num_students_inst': '수강생 수'}
            ),
            use_container_width=True,
            column_config={
                "매출액(억)": st.column_config.NumberColumn(format="%.1f억원"), # 소수점 첫째 자리까지 표시
                "수강생 수": st.column_config.NumberColumn(format="%d명"),
            },
            hide_index=True
        )
    else:
        st.info(f"{selected_year}년 {selected_month}월에 집계된 훈련기관 성과 데이터가 없습니다.")


def render_institution_info(data, show_leading_only=False):
    """훈련기관 정보를 시각화합니다."""
    
    # 데이터 필터링 (선도기업형만 또는 전체)
    if show_leading_only:
        filtered_data = data[data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
    else:
        filtered_data = data.copy()
    
    # 훈련기관별 통계 계산
    institution_stats = filtered_data.groupby('훈련기관').agg({
        '과정명': 'nunique',
        '누적매출': 'sum',
        '만족도': 'mean'
    }).reset_index()
    
    # 상위 4개 훈련기관 필터링
    top_institutions = institution_stats.nlargest(4, '누적매출')
    
    # 안내 메시지 수정
    st.markdown("""
    <div style="background-color: #f0f2f6; padding: 10px; border-radius: 5px; margin-bottom: 20px;">
        <strong>참고:</strong> 아래 표시된 금액은 실제 매출액(전체)입니다.
        훈련과정 수는 중복을 제외한 고유한 과정의 수를 나타냅니다.
    </div>
    """, unsafe_allow_html=True)
    
    col1, col2, col3, col4 = st.columns(4)
    columns = [col1, col2, col3, col4]
    
    for i, (_, row) in enumerate(top_institutions.iterrows()):
        if i < len(columns):
            with columns[i]:
                # 카드 콘텐츠
                institution_name = row['훈련기관']
                course_count = int(row['과정명'])
                revenue = row['누적매출'] # 실제 금액(10배)으로 표시
                satisfaction = row['만족도']
                
                # 매출액 포맷팅 (1억 단위)
                revenue_billions = revenue / 100000000
                # 소수점 첫째 자리까지 반올림
                revenue_billions_rounded = round(revenue_billions, 1)
                
                # HTML 카드 디자인
                card_html = f"""
                <div style="
                    padding: 15px; 
                    border-radius: 10px; 
                    background-color: rgba(72, 187, 120, 0.1); 
                    border: 1px solid #48BB78;
                    height: 180px;
                ">
                    <h3 style="color: #2D3748; font-size: 18px; margin-bottom: 10px; text-align: center;">
                        {institution_name}
                    </h3>
                    <div style="color: #48BB78; font-size: 28px; font-weight: bold; text-align: center; margin-bottom: 10px;">
                        {revenue_billions_rounded:.1f}억원
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 15px;">
                        <div style="text-align: center; width: 100%;">
                            <div style="color: #718096; font-size: 14px;">훈련과정 수</div>
                            <div style="color: #2D3748; font-weight: bold; font-size: 16px;">{course_count}개</div>
                        </div>
                    </div>
                </div>
                """
                st.markdown(card_html, unsafe_allow_html=True)

def visualize_by_institutions(df):
    """훈련기관별 분석을 시각화합니다."""
    try:
        # 섹션 구분선
        st.markdown("---")
        
        # 섹션 헤더
        st.subheader("훈련기관별 분석")
        
        # 선도기업 또는 일반 KDT 선택 버튼
        type_selection = st.radio(
            "훈련유형 선택",
            ["전체", "선도기업형", "일반KDT"],
            horizontal=True,
            key="institution_type_filter"
        )
        
        # 선택에 따른 데이터 필터링
        if type_selection == "선도기업형":
            filtered_df = df[df['훈련유형'].str.contains('선도기업형 훈련', na=False)]
            show_leading = True
        elif type_selection == "일반KDT":
            filtered_df = df[~df['훈련유형'].str.contains('선도기업형 훈련', na=False)]
            show_leading = False
        else:
            filtered_df = df.copy()
            show_leading = False
        
        # 훈련기관 검색 기능 추가
        st.markdown("### 훈련기관 검색 및 비교")
        col1, col2 = st.columns(2)
        
        with col1:
            search_term = st.text_input("훈련기관 검색", "", key="institution_search")
            if search_term:
                search_results = filtered_df[filtered_df['훈련기관'].str.contains(search_term, case=False, na=False)]
                if not search_results.empty:
                    selected_institution = st.selectbox(
                        "검색된 훈련기관 선택",
                        search_results['훈련기관'].unique(),
                        key="selected_institution"
                    )
                else:
                    st.warning("검색 결과가 없습니다.")
                    selected_institution = None
            else:
                selected_institution = None
        
        with col2:
            if selected_institution:
                compare_term = st.text_input("비교할 훈련기관 검색", "", key="compare_search")
                if compare_term:
                    compare_results = filtered_df[filtered_df['훈련기관'].str.contains(compare_term, case=False, na=False)]
                    if not compare_results.empty:
                        compare_institution = st.selectbox(
                            "비교할 훈련기관 선택",
                            compare_results['훈련기관'].unique(),
                            key="compare_institution"
                        )
                    else:
                        st.warning("비교 검색 결과가 없습니다.")
                        compare_institution = None
                else:
                    compare_institution = None
            else:
                compare_institution = None
        
        # 선택된 훈련기관이 있는 경우 상세 분석 표시
        if selected_institution:
            st.markdown(f"### {selected_institution} 상세 분석")
            
            # 선택된 훈련기관 데이터 - 원본 데이터(df)에서 직접 가져와 필터링
            # 이렇게 하면 훈련유형 선택에 영향을 받지 않고 메인 컴포넌트와 동일한 결과값 산출
            selected_data = df[df['훈련기관'] == selected_institution]
            
            # 연도별 데이터 준비
            year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}년$', col)]
            
            # 연도별 매출 계산 - 누적매출 컬럼 사용
            # 각 과정의 연도별 매출액 산출을 위해 각 연도에 해당하는 과정만 필터링하여 누적매출 사용
            yearly_revenue = {}
            yearly_leading = {}
            yearly_normal = {}
            
            for year in year_columns:
                # 해당 연도에 해당하는 과정 필터링
                year_str = year[:4]  # '2022년' -> '2022'
                year_start = f"{year_str}-01-01"
                year_end = f"{year_str}-12-31"
                
                # 해당 연도에 시작된 과정만 필터링
                year_data = selected_data[
                    (pd.to_datetime(selected_data['과정시작일']) >= year_start) & 
                    (pd.to_datetime(selected_data['과정시작일']) <= year_end)
                ]
                
                # 누적매출 사용
                yearly_revenue[year] = year_data['누적매출'].sum()
                
                # 선도기업형 훈련 필터링
                leading_year_data = year_data[year_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
                yearly_leading[year] = leading_year_data['누적매출'].sum() if not leading_year_data.empty else 0
                
                # 일반KDT 훈련 필터링
                normal_year_data = year_data[~year_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
                yearly_normal[year] = normal_year_data['누적매출'].sum() if not normal_year_data.empty else 0
            
            # 매출 정보 표시
            col1, col2, col3 = st.columns(3)
            with col1:
                # 누적매출 컬럼을 사용하여 계산 (메인 컴포넌트와 동일한 방식)
                total_revenue = selected_data['누적매출'].sum()
                st.metric("총 매출", format_revenue(total_revenue))
            with col2:
                # 선도기업형 매출 계산 (누적매출 컬럼 사용)
                leading_data = selected_data[selected_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
                total_leading = leading_data['누적매출'].sum() if not leading_data.empty else 0
                st.metric("선도기업형 매출", format_revenue(total_leading))
            with col3:
                # 일반KDT 매출 계산 (누적매출 컬럼 사용)
                normal_data = selected_data[~selected_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
                total_normal = normal_data['누적매출'].sum() if not normal_data.empty else 0
                st.metric("일반KDT 매출", format_revenue(total_normal))
            
            # 연도별 매출 추이 차트 (동일한 방식으로 유지하지만, 이후 연도별 집계에는 연도별 컬럼 필요)
            yearly_data = pd.DataFrame({
                '연도': [year[:4] for year in year_columns],
                '총매출': [yearly_revenue[year] for year in year_columns],
                '선도기업형': [yearly_leading[year] for year in year_columns],
                '일반KDT': [yearly_normal[year] for year in year_columns]
            })
            
            fig = px.line(
                yearly_data,
                x='연도',
                y=['선도기업형', '일반KDT'],
                title=f"{selected_institution} 연도별 매출 추이",
                markers=True
            )
            fig.update_layout(
                yaxis_title='매출액(원)',
                legend_title='훈련유형',
                yaxis_tickformat=',.1f',  # 소수점 첫째 자리까지 표시
                xaxis_type='category'
            )
            st.plotly_chart(fig, use_container_width=True)
            
            # 비교 기관이 있는 경우 비교 차트 표시
            if compare_institution:
                # 비교 기관 데이터도 원본 데이터(df)에서 직접 가져오도록 수정
                compare_data = df[df['훈련기관'] == compare_institution]
                
                # 비교 기관의 데이터 계산
                # 연도별 차트를 위한 연도별 매출 계산
                compare_yearly_revenue = {}
                compare_yearly_leading = {}
                compare_yearly_normal = {}
                
                # 연도별 계산 - 누적매출 컬럼 사용
                for year in year_columns:
                    # 해당 연도에 해당하는 과정 필터링
                    year_str = year[:4]  # '2022년' -> '2022'
                    year_start = f"{year_str}-01-01"
                    year_end = f"{year_str}-12-31"
                    
                    # 해당 연도에 시작된 과정만 필터링
                    year_data = compare_data[
                        (pd.to_datetime(compare_data['과정시작일']) >= year_start) & 
                        (pd.to_datetime(compare_data['과정시작일']) <= year_end)
                    ]
                    
                    # 누적매출 사용
                    compare_yearly_revenue[year] = year_data['누적매출'].sum()
                    
                    # 선도기업형 훈련 필터링
                    leading_year_data = year_data[year_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
                    compare_yearly_leading[year] = leading_year_data['누적매출'].sum() if not leading_year_data.empty else 0
                    
                    # 일반KDT 훈련 필터링
                    normal_year_data = year_data[~year_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
                    compare_yearly_normal[year] = normal_year_data['누적매출'].sum() if not normal_year_data.empty else 0
                
                # 비교 차트 데이터 준비 (데이터 형태 변경)
                # 각 훈련기관별 데이터를 별도로 생성한 후 합치는 방식으로 변경
                inst1_data = []
                inst2_data = []
                
                # 선택된 훈련기관 데이터
                for year in year_columns:
                    inst1_data.append({
                        '연도': year[:4],
                        '훈련기관': selected_institution,
                        '총매출': yearly_revenue[year],
                        '선도기업형': yearly_leading[year],
                        '일반KDT': yearly_normal[year]
                    })
                
                # 비교 훈련기관 데이터
                for year in year_columns:
                    inst2_data.append({
                        '연도': year[:4],
                        '훈련기관': compare_institution,
                        '총매출': compare_yearly_revenue[year],
                        '선도기업형': compare_yearly_leading[year],
                        '일반KDT': compare_yearly_normal[year]
                    })
                
                # 두 기관 데이터 합치기
                comparison_data = pd.DataFrame(inst1_data + inst2_data)
                
                # 비교 차트 표시 (누적 막대 차트로 변경)
                fig = px.bar(
                    comparison_data,
                    x='연도',
                    y='총매출',
                    color='훈련기관',
                    title=f"{selected_institution} vs {compare_institution} 연도별 매출 비교",
                    barmode='group',
                    color_discrete_sequence=['#FFA500', '#008000']
                )
                fig.update_layout(
                    yaxis_title='매출액(원)',
                    legend_title='훈련기관',
                    yaxis_tickformat=',.1f',  # 소수점 첫째 자리까지 표시
                    xaxis_type='category'
                )
                st.plotly_chart(fig, use_container_width=True)
                
                # 비교 기관의 매출 정보 표시
                st.markdown(f"### {compare_institution} 매출 정보")
                col1, col2, col3 = st.columns(3)
                with col1:
                    compare_total = sum(compare_yearly_revenue.values())
                    st.metric("총 매출", format_revenue(compare_total))
                with col2:
                    compare_leading = sum(compare_yearly_leading.values())
                    st.metric("선도기업형 매출", format_revenue(compare_leading))
                with col3:
                    compare_normal = sum(compare_yearly_normal.values())
                    st.metric("일반KDT 매출", format_revenue(compare_normal))
        
        # 상위 훈련기관 표시
        st.markdown("### 상위 훈련기관")
        render_institution_info(filtered_df, show_leading)
        
        # 훈련기관별 과정 수 및 매출액
        st.markdown("### 훈련기관별 매출액 및 과정 수")
        
        # 기본 통계 계산
        institution_stats = filtered_df.groupby('훈련기관').agg({
            '과정명': 'nunique',
            '누적매출': 'sum'
        }).reset_index().sort_values('누적매출', ascending=False).head(10)
        
        # 매출액 포맷팅
        institution_stats['누적매출(포맷)'] = institution_stats['누적매출'].apply(format_revenue)
        
        # 차트 생성
        fig = px.bar(
            institution_stats,
            x='훈련기관',
            y='누적매출',
            title=f'훈련기관별 매출액 (상위 10개, {"선도기업형" if type_selection == "선도기업형" else "일반KDT" if type_selection == "일반KDT" else "전체"})',
            color='누적매출',
            color_continuous_scale=px.colors.sequential.Greens,
            height=400,
            text='누적매출(포맷)'
        )
        fig.update_layout(
            yaxis_title='매출액(원)',
            yaxis_tickangle=0,
            yaxis_tickformat=',.0f'
        )
        st.plotly_chart(fig, use_container_width=True)
        
        # 과정 수 차트
        fig = px.bar(
            institution_stats,
            x='훈련기관',
            y='과정명',
            title=f'훈련기관별 과정 수 (상위 10개, {"선도기업형" if type_selection == "선도기업형" else "일반KDT" if type_selection == "일반KDT" else "전체"})',
            color='과정명',
            color_continuous_scale=px.colors.sequential.Blues,
            height=400
        )
        fig.update_layout(yaxis_title='훈련과정 수', yaxis_tickangle=0)
        st.plotly_chart(fig, use_container_width=True)
        
    except Exception as e:
        st.error(f"훈련기관별 분석 중 오류가 발생했습니다: {e}")
        import traceback
        st.error(traceback.format_exc())
        
def visualize_by_institution_training_type(df):
    """훈련기관별 훈련유형 비중을 시각화합니다."""
    # 이 함수는 사용자 요청대로 제거합니다

def create_yearly_revenue_chart(yearly_data):
    """연도별 매출 추이 차트를 생성합니다."""
    yearly_revenue = pd.DataFrame()
    for year in yearly_data.columns:
        yearly_sum = yearly_data[year].sum() / 100000000  # 억 단위로 변환
        yearly_revenue = pd.concat([yearly_revenue, pd.DataFrame({
            '연도': [year],
            '매출': [yearly_sum]
        })])

    line_chart = alt.Chart(yearly_revenue).mark_bar().encode(
        x=alt.X('연도:N', axis=alt.Axis(labelAngle=0, labelFontSize=12)),
        y=alt.Y('매출:Q', axis=alt.Axis(labelFontSize=12, labelAngle=0)),
        tooltip=[
            alt.Tooltip('연도:N', title='연도'),
            alt.Tooltip('매출:Q', title='매출(억원)', format='.1f')
        ]
    ).properties(
        height=300
    )
    return line_chart

def calculate_adjusted_revenue(row, current_date=None):
    """
    훈련과정의 매출액을 실제 수료율 기준으로 조정하여 계산합니다.
    현재는 매출액이 수강신청인원의 80%로 계산되었다고 가정하며, 실제 수료율을 고려해 조정합니다.
    과정 진행 중에는 시간 경과에 따라 로그함수적 곡선을 그리며 점진적으로 매출액을 조정합니다.
    과정 초기에는 수강신청인원에 가깝게 유지되다가 종료일에 가까워질수록 수료인원 기준으로 조정됩니다.
    """
    if current_date is None:
        current_date = pd.Timestamp.now()
    
    # 필수 컬럼 확인
    required_cols = ['과정시작일', '과정종료일', '수강신청 인원', '수료인원', '누적매출']
    for col in required_cols:
        if col not in row or pd.isna(row[col]):
            return row['누적매출'] if '누적매출' in row else 0
    
    start_date = pd.to_datetime(row['과정시작일'])
    end_date = pd.to_datetime(row['과정종료일'])
    total_days = max(1, (end_date - start_date).days)  # 0으로 나누기 방지
    
    # 수강생이 없는 경우 기존 매출액 반환
    if row['수강신청 인원'] == 0:
        return row['누적매출']
    
    # 실제 수료율 계산
    completion_ratio = row['수료인원'] / row['수강신청 인원']
    
    # 기준 수료율 (원래 예상했던 수료율)
    base_completion_rate = 0.8  # 80%
    
    # 과정 종료 후: 실제 수료율 기반으로 매출액 조정
    if current_date >= end_date:
        # 매출 조정 비율 계산 (실제 수료율 / 기준 수료율)
        # 수료율 100%면 1.25배, 80%면 1.0배, 60%면 0.9배 (최소 90%는 보장)
        adjustment_ratio = min(completion_ratio / base_completion_rate, 1.25)
        adjustment_ratio = max(adjustment_ratio, 0.9)  # 최소 90% 보장
        
        # 최종 조정된 매출액
        adjusted_revenue = row['누적매출'] * adjustment_ratio
        return adjusted_revenue
    
    # 과정 시작 전: 매출 없음
    if current_date < start_date:
        return 0
    
    # 과정 진행 중: 로그 함수적 곡선 적용
    elapsed_days = max(0, (current_date - start_date).days)
    progress_ratio = min(1.0, elapsed_days / total_days)  # 진행 비율 (0~1)
    
    # 로그 함수적 곡선 적용 (초기에는 천천히, 후반에 급격히 변화)
    # 로그 커브 파라미터 조정 (낮을수록 후반부에 변화가 급격해짐)
    log_base = 10
    log_curve = 1 - math.log(1 + (log_base - 1) * progress_ratio, log_base)
    
    # 초기 매출액 (수강신청인원 기준)
    enrollment_based_revenue = row['누적매출']
    
    # 최종 매출액 (수료인원 기준)
    completion_adjustment_ratio = min(completion_ratio / base_completion_rate, 1.25)
    completion_adjustment_ratio = max(completion_adjustment_ratio, 0.9)
    completion_based_revenue = row['누적매출'] * completion_adjustment_ratio
    
    # 로그 커브에 따른 가중평균 적용 (초기: 수강신청인원 기준, 후기: 수료인원 기준)
    # log_curve가 1에 가까울수록 enrollment_based_revenue 비중이 높아짐
    adjusted_revenue = (log_curve * enrollment_based_revenue) + ((1 - log_curve) * completion_based_revenue)
    
    # 기본 진행률 반영 (시간 경과에 따른 매출 인식)
    # 최소 인식률은 30%로 설정 (과정 시작 직후라도 일정 부분은 매출 인식)
    recognition_ratio = 0.3 + (0.7 * progress_ratio)
    
    # 최종 매출액 계산
    final_adjusted_revenue = adjusted_revenue * recognition_ratio
    
    return final_adjusted_revenue

def create_monthly_ranking_component(df):
    st.subheader("월별 훈련기관 매출 랭킹")
    
    # 필수 컬럼 검증
    required_columns = ['과정시작일', '훈련기관', '과정명', '누적매출', '수강신청 인원']
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        st.error(f"필수 컬럼이 누락되었습니다: {', '.join(missing_columns)}")
        return None
    
    # 초기 데이터 상태 기록
    st.info(f"초기 데이터 건수: {len(df)}건")
    
    # 날짜 변환 및 연도/월 컬럼 생성
    try:
        df = df.copy()  # 원본 데이터 보존
        df['과정시작일'] = pd.to_datetime(df['과정시작일'], errors='coerce')
        # 날짜 변환 실패한 레코드 제외
        df = df[df['과정시작일'].notna()]
        df['연도'] = df['과정시작일'].dt.year
        df['월'] = df['과정시작일'].dt.month
    except Exception as e:
        st.error(f"날짜 변환 중 오류 발생: {e}")
        return None
    
    # 연도/월 선택
    col1, col2 = st.columns(2)
    with col1:
        available_years = sorted(df['연도'].dropna().unique())
        if not available_years:
            st.error("유효한 연도 데이터가 없습니다.")
            return None
        selected_year = st.selectbox("연도 선택", available_years, index=len(available_years)-1)  # 가장 최근 연도를 기본값으로
    
    with col2:
        selected_month = st.selectbox("월 선택", list(range(1, 13)), format_func=lambda x: f"{x}월")
    
    # 데이터 전처리 - 숫자형 컬럼 변환
    numeric_columns = ['누적매출', '수강신청 인원', '수료인원']
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    # 1. 과정 시작일이 선택한 연도/월에 해당하는 과정만 필터링 (개강 기준)
    try:
        monthly_df = df[(df['연도'] == selected_year) & (df['월'] == selected_month)]
        st.info(f"1차 필터링 후 데이터 건수: {selected_year}년 {selected_month}월 개강 과정 {len(monthly_df)}건")
        
        if monthly_df.empty:
            st.warning(f"{selected_year}년 {selected_month}월에 개강한 과정이 없습니다.")
            return None
            
        # 2. 수강신청 인원 처리 (0 이하 값 필터링)
        if '수강신청 인원' in monthly_df.columns:
            zero_students = monthly_df[monthly_df['수강신청 인원'] <= 0].shape[0]
            if zero_students > 0:
                monthly_df = monthly_df[monthly_df['수강신청 인원'] > 0]
                st.info(f"수강신청 인원이 0인 과정 {zero_students}건 제외 (남은 건수: {len(monthly_df)})")
        
        # 3. 누적매출 처리 (0 이하 값 필터링)
        if '누적매출' in monthly_df.columns:
            zero_revenue = monthly_df[monthly_df['누적매출'] <= 0].shape[0]
            if zero_revenue > 0:
                monthly_df = monthly_df[monthly_df['누적매출'] > 0]
                st.info(f"누적매출이 0인 과정 {zero_revenue}건 제외 (남은 건수: {len(monthly_df)})")
        
        # 4. 중복 과정 제거
        before_dedup = len(monthly_df)
        if '훈련과정 ID' in monthly_df.columns:
            monthly_df = monthly_df.drop_duplicates(subset=['훈련과정 ID'])
            if len(monthly_df) < before_dedup:
                st.info(f"훈련과정 ID 기준 중복 제거: {before_dedup - len(monthly_df)}건 (남은 건수: {len(monthly_df)})")
        elif '회차' in monthly_df.columns:
            # 회차 정보가 있는 경우 회차 정보도 중복 제거 기준에 포함
            monthly_df = monthly_df.drop_duplicates(subset=['훈련기관', '과정명', '회차', '과정시작일'])
            if len(monthly_df) < before_dedup:
                st.info(f"훈련기관, 과정명, 회차, 과정시작일 기준 중복 제거: {before_dedup - len(monthly_df)}건 (남은 건수: {len(monthly_df)})")
        else:
            monthly_df = monthly_df.drop_duplicates(subset=['훈련기관', '과정명', '과정시작일'])
            if len(monthly_df) < before_dedup:
                st.info(f"훈련기관, 과정명, 과정시작일 기준 중복 제거: {before_dedup - len(monthly_df)}건 (남은 건수: {len(monthly_df)})")
        
        # 5. 날짜 유효성 검사
        if '과정종료일' in monthly_df.columns:
            # 날짜는 이미 datetime 형식으로 변환되어 있음 (시작 부분에서 처리)
            # 시작일이 종료일보다 이전인지 확인
            invalid_dates = monthly_df[~(monthly_df['과정시작일'] < monthly_df['과정종료일'])].shape[0]
            if invalid_dates > 0:
                monthly_df = monthly_df[monthly_df['과정시작일'] < monthly_df['과정종료일']]
                st.info(f"시작일/종료일 오류 과정 {invalid_dates}건 제외 (남은 건수: {len(monthly_df)})")
        
        # 6. 매출액 검증 및 전처리
        if '누적매출' not in monthly_df.columns:
            st.error("누적매출 필드가 데이터에 없습니다.")
            return None
            
        # 7. 최종 데이터 건수 확인
        if monthly_df.empty:
            st.warning(f"{selected_year}년 {selected_month}월에 해당하는 유효한 과정이 없습니다.")
            return None
            
        st.success(f"최종 분석 데이터: {len(monthly_df)}건의 과정 (훈련기관 개수: {monthly_df['훈련기관'].nunique()}개)")
        
    except Exception as e:
        st.error(f"데이터 필터링 중 오류 발생: {e}")
        import traceback
        st.exception(traceback.format_exc())
        return None

    # monthly_df.empty 체크는 위에서 이미 함

    # 수강신청 인원이 0인 과정 추가 확인 및 제거
    if '수강신청 인원' in monthly_df.columns:
        if monthly_df[monthly_df['수강신청 인원'] == 0].shape[0] > 0:
            st.warning(f"수강신청 인원이 0인 과정 {monthly_df[monthly_df['수강신청 인원'] == 0].shape[0]}개가 제외되었습니다.")
        monthly_df = monthly_df[monthly_df['수강신청 인원'] > 0]
        
    # 데이터 타입 변환 확인
    for col in ['누적매출', '수강신청 인원', '수료인원']:
        if col in monthly_df.columns:
            monthly_df[col] = pd.to_numeric(monthly_df[col], errors='coerce').fillna(0)
            
    # 중복 과정 추가 확인 및 제거
    if '과정ID' in monthly_df.columns:
        duplicates = monthly_df[monthly_df.duplicated(subset=['과정ID'], keep=False)]
        if not duplicates.empty:
            st.warning(f"{duplicates.shape[0]}개의 중복 과정이 발견되어 제거되었습니다.")
    elif '회차' in monthly_df.columns and all(col in monthly_df.columns for col in ['훈련기관', '과정명', '과정시작일']):
        # 회차 정보가 있는 경우 회차 정보도 중복 제거 기준에 포함
        duplicates = monthly_df[monthly_df.duplicated(subset=['훈련기관', '과정명', '회차', '과정시작일'], keep=False)]
        if not duplicates.empty:
            st.warning(f"{duplicates.shape[0]}개의 중복 과정이 발견되어 제거되었습니다.")
    elif all(col in monthly_df.columns for col in ['훈련기관', '과정명', '과정시작일']):
        duplicates = monthly_df[monthly_df.duplicated(subset=['훈련기관', '과정명', '과정시작일'], keep=False)]
        if not duplicates.empty:
            st.warning(f"{duplicates.shape[0]}개의 중복 과정이 발견되어 제거되었습니다.")
    
    # 기관별 집계 - 누적매출 필드 사용
    # 중요: 여기서 기관별 매출 계산이 이루어짐
    ranking_df = monthly_df.groupby('훈련기관').agg({
        '누적매출': 'sum',  # 누적매출 사용 (훈련기관 분석과 동일)
        '수강신청 인원': 'sum',
        '수료인원': 'sum',  # 수료인원 추가
        '과정명': 'count'  # 과정 개수 추가
    }).reset_index().rename(columns={
        '누적매출': '총매출', 
        '수강신청 인원': '총인원', 
        '수료인원': '총수료인원',
        '과정명': '과정 개수'})
    
    # 억단위 표시를 위한 계산 (반올림하여 1억 단위로 표시)
    ranking_df['총매출(억)'] = (ranking_df['총매출'] / 100000000).round(1)
    
    # 매출 데이터 추가 검증
    if ranking_df['총매출'].max() > 1000000000000:  # 1조원 이상인 경우
        st.warning(f"비정상적으로 큰 매출액이 발견되었습니다: {ranking_df['총매출'].max() / 100000000:.1f}억원")
    
    # 수료율 계산
    ranking_df['수료율'] = (ranking_df['총수료인원'] / ranking_df['총인원'] * 100).round(1)
    
    # 매출액 기준 정렬
    ranking_df = ranking_df.sort_values('총매출', ascending=False)

    # 표 표시 (수료율 컬럼 추가)
    # 1부터 시작하는 랭킹 만들기
    ranking_with_rank = ranking_df.copy()
    ranking_with_rank.reset_index(drop=True, inplace=True)
    ranking_with_rank.index = ranking_with_rank.index + 1  # 0부터 시작하는 인덱스를 1부터 시작하도록 변경
    ranking_with_rank.index.name = '순위'  # 인덱스 이름을 '순위'로 설정
    
    st.dataframe(
        ranking_with_rank[['훈련기관', '총매출(억)', '총인원', '총수료인원', '수료율', '과정 개수']],
        use_container_width=True
    )

    # 상위 10개 그래프 - 매출과 훈련생 수를 동시에 표시하는 듀얼 축 차트 생성
    st.markdown("### 상위 10개 기관 매출 및 훈련생 수 시각화")
    
    # 상위 10개 기관 데이터 준비
    top10_df = ranking_df.head(10).copy()
    
    # 매출과 훈련생 수를 함께 표시하는 듀얼 축 차트 생성
    fig = px.bar(
        top10_df,
        x='훈련기관',
        y='총매출(억)',
        text='총매출(억)',
        title=f"{selected_year}년 {selected_month}월 훈련기관 매출 및 훈련생 TOP 10",
        color_discrete_sequence=['#1f77b4']
    )
    
    # 훈련생 수를 선 그래프로 추가 (보조 y축 사용)
    fig.add_trace(
        go.Scatter(
            x=top10_df['훈련기관'], 
            y=top10_df['총인원'],
            mode='lines+markers',
            name='수강신청 인원',
            line=dict(color='#ff7f0e', width=3),
            marker=dict(size=8),
            yaxis='y2'
        )
    )
    
    # 레이아웃 설정
    fig.update_layout(
        yaxis=dict(title='매출(억원)', titlefont=dict(color='#1f77b4')),
        yaxis2=dict(
            title='수강신청 인원',
            titlefont=dict(color='#ff7f0e'),
            anchor='x',
            overlaying='y',
            side='right'
        ),
        xaxis=dict(title='훈련기관'),
        xaxis_tickangle=0,  # x축 레이블을 수평으로 유지
        legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='right', x=1),
        height=500,
        margin=dict(l=50, r=50, t=80, b=80)
    )
    
    # 텍스트 레이블 포맷팅
    fig.update_traces(
        texttemplate='%{text:.1f}억', 
        textposition='outside',
        selector=dict(type='bar')
    )
    
    st.plotly_chart(fig, use_container_width=True)

    # 표에 확장 기능 추가 - 각 행을 확장하면 과정 목록을 볼 수 있도록
    st.markdown("### 기관별 과정 목록")
    
    # 각 기관별로 expander 생성
    for idx, row in ranking_df.iterrows():
        institution = row['훈련기관']
        total_revenue = row['총매출(억)']
        total_students = row['총인원']
        total_completed = row['총수료인원']
        completion_rate = row['수료율']
        course_count = row['과정 개수']
        
        # 수료율 정보 추가
        with st.expander(f"**{institution}** - 매출: {total_revenue:.1f}억원 | 수강생: {total_students}명 | 수료인원: {total_completed}명 | 수료율: {completion_rate}% | 과정 수: {course_count}개"):
            # 해당 기관의 과정 목록 가져오기
            courses_df = monthly_df[monthly_df['훈련기관'] == institution]
            # 누적매출 기준 정렬 (훈련기관 분석과 동일)
            # 기관별 과정 데이터에서 수강신청 인원 0인 과정 제거
            if '수강신청 인원' in courses_df.columns:
                courses_df = courses_df[courses_df['수강신청 인원'] > 0]
                
            # 데이터 타입 변환 확인
            for col in ['누적매출', '수강신청 인원', '수료인원']:
                if col in courses_df.columns:
                    courses_df[col] = pd.to_numeric(courses_df[col], errors='coerce').fillna(0)
            
            # 누적매출 기준 정렬 - 해당 과정의 전체 매출액 기준
            courses_df = courses_df.sort_values('누적매출', ascending=False)
            
            # 억단위로 변환 (반올림하여 1억 단위로 표시)
            # 각 과정의 전체 기간 매출액을 1억 단위로 표시
            courses_df['매출액(억)'] = (courses_df['누적매출'] / 100000000).round(1)  # 누적매출 사용
            
            # 비정상적으로 큰 매출액 검사
            if not courses_df.empty and courses_df['매출액(억)'].max() > 1000:
                # 1000억 원 이상의 비정상적인 과정 발견 시 경고
                abnormal_courses = courses_df[courses_df['매출액(억)'] > 1000]
                for _, row in abnormal_courses.iterrows():
                    st.warning(f"비정상적으로 큰 매출액이 발견되었습니다: {row['과정명']} - {row['매출액(억)']:.1f}억원")
            
            # 과정별 수료율 계산
            courses_df['수료율'] = (courses_df['수료인원'] / courses_df['수강신청 인원'] * 100).round(1)
            
            # 과정 목록 테이블 표시 (수료율 컬럼 추가)
            st.dataframe(
                courses_df[['과정명', '매출액(억)', '수강신청 인원', '수료인원', '수료율']].reset_index(drop=True),
                use_container_width=True
            )
            
            # 과정별 매출 시각화 (상위 5개)
            if not courses_df.empty:
                fig = px.bar(
                    courses_df.head(5),  # 상위 5개 과정만 표시
                    x='과정명',
                    y='매출액(억)',
                    text='매출액(억)',
                    title=f"{institution}의 과정별 매출 (상위 5개)",
                    color='매출액(억)',
                    color_continuous_scale='Greens'
                )
                fig.update_traces(texttemplate='%{text:.1f}억', textposition='outside')
                fig.update_layout(xaxis_tickangle=-45)
                st.plotly_chart(fig, use_container_width=True)

                # JavaScript 코드 삽입
                js_code = """
                <script>
                document.addEventListener('DOMContentLoaded', function() {
                    // Streamlit이 로드된 후에 테이블 셀에 이벤트 리스너 추가
                    setTimeout(function() {
                        const tables = document.querySelectorAll('.stDataFrame table');
                        if (tables.length > 0) {
                            const firstTable = tables[0];
                            const rows = firstTable.querySelectorAll('tbody tr');
                            
                            rows.forEach(row => {
                                row.style.cursor = 'pointer';
                                row.addEventListener('click', function() {
                                    const cells = this.querySelectorAll('td');
                                    if (cells.length > 0) {
                                        const institution = cells[0].textContent.trim();
                                        // 해당 기관명을 가진 expander 찾기
                                        const expanders = document.querySelectorAll('.streamlit-expanderHeader');
                                        for (let expander of expanders) {
                                            if (expander.textContent.includes(institution)) {
                                                // 스크롤하여 expander로 이동
                                                expander.scrollIntoView({ behavior: 'smooth' });
                                                // expander가 닫혀있으면 클릭하여 열기
                                                if (!expander.parentElement.classList.contains('streamlit-expander--expanded')) {
                                                    setTimeout(() => {
                                                        expander.click();
                                                    }, 300);
                                                }
                                                break;
                                            }
                                        }
                                    }
                                });
                            });
                        }
                    }, 1000); // Streamlit이 DOM을 완전히 렌더링할 시간 부여
                });
                </script>
                """
                
    # JavaScript 코드 삽입
    st.components.v1.html(js_code, height=0)
    
    # 이 함수는 None 값이 아닌 JavaScript 코드를 반환해야 함
    return js_code


def main():
    st.set_page_config(layout="wide")

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

    try:
        url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/result_kdtdata_202505.csv?raw=true" # Define URL here
        df = load_data_from_github(url) # Use load_data_from_github
        if df.empty:
            st.error("데이터를 불러올 수 없습니다.")
            return

        # 데이터 전처리
        df = preprocess_data(df)
        if df.empty:  # preprocess_data에서 '훈련기관' 컬럼이 없는 경우
          st.error("데이터 전처리 중 오류가 발생했습니다. '훈련기관' 컬럼이 없습니다.")
          return

        # Int64 타입을 float로 변환
        numeric_cols = ['누적매출', '수강신청 인원', '수료인원']
        for col in numeric_cols:
            if col in df.columns and df[col].dtype.name == 'Int64':
                df[col] = df[col].astype(float)

        # 사이드바에서 매출 계산 방식 선택 (전체 앱에 적용)
        st.sidebar.title("매출 계산 방식")
        revenue_calculation = st.sidebar.radio(
            "매출 계산 방식 선택",
            ["기존 방식", "수료율 기반 조정"],
            index=1,  # 기본값은 수료율 기반 조정
            help="기존 방식: 원래 매출액 그대로 표시, 수료율 기반 조정: 실제 수료율을 반영하여 매출액 조정"
        )
        
        # 수료율 기반 조정 여부
        use_adjusted_revenue = revenue_calculation == "수료율 기반 조정"

        # 조정된 매출 계산 (옵션 선택 시)
        if use_adjusted_revenue:
            adjusted_df = apply_adjusted_revenue(df)
            
            # 기존 df 백업 및 조정된 값으로 대체
            original_df = df.copy()
            
            # 연도별 매출 컬럼 처리
            year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}년$', col)]
            
            # 누적매출 컬럼 대체
            df['누적매출'] = adjusted_df['조정_누적매출']
            
            # 연도별 매출 컬럼 대체
            for year in year_columns:
                if f'조정_{year}' in adjusted_df.columns:
                    df[year] = adjusted_df[f'조정_{year}']
        
        # 연도별 매출 계산 (전처리 후 수행) - 조정된 df 기준으로 계산
        year_columns = [str(col) for col in df.columns if re.match(r'^\d{4}년$', str(col))]
        df, yearly_data = calculate_yearly_revenue(df)

        # 사이드바에서 분석 유형 선택
        analysis_type = st.sidebar.radio(
            "분석 유형",
            ["훈련기관 분석", "월별 매출 분석", "NCS 분석", "전체 매출 분석", "훈련과정 분석"],
            index=0
        )

        st.markdown("""
            <style>
                .streamlit-dataframe th {
                    writing-mode: horizontal;
                }
            </style>
        """, unsafe_allow_html=True)

        if analysis_type == "훈련기관 분석":
            # 매출 계산 방식 안내
            if use_adjusted_revenue:
                st.info("""
                    **수료율 기반 조정 매출을 사용 중입니다.**
                    
                    이 방식은 실제 수료율을 반영하여 매출액을 조정합니다:
                    - 기존 방식은 수강신청인원의 80%를 기준으로 매출을 계산
                    - 수료율 기반 조정은 통합 수료율과 실제 수료인원을 기준으로 매출을 재계산
                    - 수료율이 평균보다 높은 과정은 추가 가중치를 부여하여 실제 매출에 가깝게 조정
                """)
            
            # 랭킹 컴포넌트 생성 및 표시
            js_code = create_ranking_component(df, yearly_data)
            if js_code is None:
              st.error("랭킹 컴포넌트 생성에 실패했습니다. '훈련기관' 컬럼이 없는지 확인해주세요.")
              return
            js_code = f"""
                <div style="height: 800px; overflow-y: auto;">
                    {js_code}
                </div>
            """
            st.components.v1.html(js_code, height=800)

            # 선도기업 비중 및 SSAFY 사업 분류 시각화
            calculate_and_visualize_revenue(df)

            visualize_by_institutions(df)

            analyze_top5_institutions(df, yearly_data)
            # 원래 df로 복구 (다른 분석 페이지를 위해)
            if use_adjusted_revenue:
                df = original_df.copy()

        elif analysis_type == "NCS 분석":
            st.title("NCS 분석")
            
            # 조정된 데이터 사용 시 df를 업데이트
            if use_adjusted_revenue:
                st.info("""
                    **수료율 기반 조정 매출을 사용 중입니다.**
                    
                    이 방식은 실제 수료율을 반영하여 매출액을 조정합니다:
                    - 기존 방식은 수강신청인원의 80%를 기준으로 매출을 계산
                    - 수료율 기반 조정은 통합 수료율과 실제 수료인원을 기준으로 매출을 재계산
                    - 수료율이 평균보다 높은 과정은 추가 가중치를 부여하여 실제 매출에 가깝게 조정
                """)
                
                # 조정된 매출로 df 업데이트
                adjusted_df = apply_adjusted_revenue(df)
                temp_df = df.copy()
                df['누적매출'] = adjusted_df['조정_누적매출']
                
                # 연도별 매출 컬럼도 업데이트
                year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}\ub144$', col)]
                for year in year_columns:
                    if f'조정_{year}' in adjusted_df.columns:
                        df[year] = adjusted_df[f'조정_{year}']
                        
                # 연도별 매출 재계산
                df, yearly_data = calculate_yearly_revenue(df)
                
                # 원본 데이터 보관
                original_df = df.copy()
            
            try:
                # NCS 랭킹 컴포넌트 생성 및 표시
                js_code = create_ncs_ranking_component(df)
                if js_code:
                    st.components.v1.html(js_code, height=800)
                # calculate_and_visualize_revenue(df)

                # NCS명 입력 받기
                ncs_name = st.text_input("NCS명 검색")

                analyze_ncs(df, yearly_data, ncs_name)  # ncs_name 전달
                
                # 원래 df로 복구
                if use_adjusted_revenue:
                    df = original_df.copy()
            except Exception as e:
                st.error(f"NCS 분석 중 오류가 발생했습니다: {e}")
                import traceback
                st.error(traceback.format_exc())
                
        elif analysis_type == "훈련과정 분석":
            # 수료율 기반 조정 매출 안내
            if use_adjusted_revenue:
                st.info("""
                    **수료율 기반 조정 매출을 사용 중입니다.**
                    
                    이 방식은 실제 수료율을 반영하여 매출액을 조정합니다:
                    - 기존 방식은 수강신청인원의 80%를 기준으로 매출을 계산
                    - 수료율 기반 조정은 통합 수료율과 실제 수료인원을 기준으로 매출을 재계산
                    - 수료율이 평균보다 높은 과정은 추가 가중치를 부여하여 실제 매출에 가깝게 조정
                """)
                
                # 조정된 매출로 df 업데이트
                adjusted_df = apply_adjusted_revenue(df)
                temp_df = df.copy()
                df['누적매출'] = adjusted_df['조정_누적매출']
                
                # 연도별 매출 컬럼도 업데이트
                year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}\ub144$', col)]
                for year in year_columns:
                    if f'조정_{year}' in adjusted_df.columns:
                        df[year] = adjusted_df[f'조정_{year}']
                        
                # 연도별 매출 재계산
                df, yearly_data = calculate_yearly_revenue(df)
                
                # 원본 데이터 보관
                original_df = df.copy()
            
            try:
                # 훈련과정 분석 함수 호출
                analyze_courses(df)
                
                # 원래 df로 복구
                if use_adjusted_revenue:
                    df = original_df.copy()
            except Exception as e:
                st.error(f"훈련과정 분석 중 오류가 발생했습니다: {e}")
                import traceback
                st.error(traceback.format_exc())
                
        elif analysis_type == "월별 매출 분석":
            st.title("월별 매출 분석")
            
            # 매출액 계산 방식 안내
            if use_adjusted_revenue:
                st.info("""
                    **수료율 기반 조정 매출을 사용 중입니다.**
                    
                    이 방식은 실제 수료율을 반영하여 매출액을 조정합니다:
                    - 기존 방식은 수강신청인원의 80%를 기준으로 매출을 계산
                    - 수료율 기반 조정은 통합 수료율과 실제 수료인원을 기준으로 매출을 재계산
                    - 수료율이 평균보다 높은 과정은 추가 가중치를 부여하여 실제 매출에 가깝게 조정
                """)
            
            # 조정된 데이터 사용 시 df를 업데이트
            if use_adjusted_revenue:
                # 조정된 매출로 df 업데이트
                adjusted_df = apply_adjusted_revenue(df)
                temp_df = df.copy()
                df['누적매출'] = adjusted_df['조정_누적매출']
                
                # 연도별 매출 컬럼도 업데이트
                year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}년$', col)]
                for year in year_columns:
                    if f'조정_{year}' in adjusted_df.columns:
                        df[year] = adjusted_df[f'조정_{year}']
            
            if use_adjusted_revenue:
                # 수료율 조정된 월별 매출 차트
                create_monthly_ranking_component(df)
                st.subheader("전체 월별 매출 및 수강생 추이 (수료율 조정)")
                try:
                    adjusted_monthly_chart = create_monthly_revenue_chart_adjusted(df if not use_adjusted_revenue else temp_df)
                    st.altair_chart(adjusted_monthly_chart, use_container_width=True)
                    st.caption("※ 이 차트는 실제 수료율을 기반으로 매출액을 조정한 결과입니다. 점선은 기존 매출액, 실선은 조정된 매출액입니다.")
                    
                    # 수료율 조정 설명
                    with st.expander("수료율 기반 매출 조정 방식 설명"):
                        st.markdown("""
                            ### 수료율 기반 매출 조정 방식
                            
                            1. **기본 가정**: 원래 매출액은 수강신청인원의 80%를 기준으로 계산되었다고 가정합니다.
                            2. **통합 수료율 고려**: 전체 평균 수료율보다 높은 과정에는 추가 가중치를 부여합니다.
                            3. **매출 하한 설정**: 실제 수료율이 낮아도 기존 매출의 90% 이상을 보장하여 현실적인 매출을 유지합니다.
                            4. **시간 경과 반영**: 과정이 진행 중인 경우, 경과 시간에 비례하여 매출을 인식합니다.
                            
                            이 방식은 실제 수료인원을 기반으로 훈련비 지급 구조를 더 정확하게 반영합니다.
                        """)
                except Exception as e:
                    st.error(f"수료율 조정 매출 차트 생성 중 오류가 발생했습니다: {e}")
                    import traceback
                    st.error(traceback.format_exc())
            else:
                # 기존 차트들 표시
                # 전체 월별 매출 요약 차트 (연도-월 기준)
                st.subheader("전체 월별 매출 및 수강생 추이 (연도-월 기준)")
                try:
                    monthly_chart = create_monthly_revenue_chart(df)
                    st.altair_chart(monthly_chart, use_container_width=True)
                except Exception as e:
                    st.error(f"월별 매출 차트 생성 중 오류가 발생했습니다: {e}")
            
            # 순수 월별 차트 추가 (연도 구분 없이)
            st.subheader("전체 월별 매출 및 수강생 추이 (월별 통합)")
            try:
                if use_adjusted_revenue:
                    # 수료율 조정 버전
                    adjusted_df = apply_adjusted_revenue(temp_df if use_adjusted_revenue else df)
                    adjusted_df['조정_월'] = pd.to_datetime(adjusted_df['과정시작일']).dt.month.astype(str) + '월'
                    monthly_adjusted_data = adjusted_df.groupby('조정_월').agg({
                        '조정_누적매출': 'sum',
                        '수강신청 인원': 'sum',
                        '수료인원': 'sum'
                    }).reset_index()
                    
                    # 월 정렬
                    month_order = {'1월': 1, '2월': 2, '3월': 3, '4월': 4, '5월': 5, '6월': 6, 
                                   '7월': 7, '8월': 8, '9월': 9, '10월': 10, '11월': 11, '12월': 12}
                    monthly_adjusted_data['월_정렬'] = monthly_adjusted_data['조정_월'].map(month_order)
                    monthly_adjusted_data = monthly_adjusted_data.sort_values('월_정렬')
                    
                    # 실제 금액(10배)으로 표시
                    monthly_adjusted_data['조정_매출(억)'] = monthly_adjusted_data['조정_누적매출'] / 100000000
                    
                    # 차트 생성
                    base = alt.Chart(monthly_adjusted_data).encode(
                        x=alt.X('조정_월:N', sort=list(month_order.keys()), axis=alt.Axis(title='월'))
                    )
                    
                    line = base.mark_line(stroke='#48BB78', point=True, strokeWidth=3).encode(
                        y=alt.Y('조정_매출(억):Q', axis=alt.Axis(title='매출액 (억원)', titleColor='#48BB78', labelAngle=0)),
                        tooltip=[
                            alt.Tooltip('조정_월:N', title='월'),
                            alt.Tooltip('조정_매출(억):Q', title='수료율 조정 매출액 (억원)', format='.2f'),
                        ]
                    )
                    
                    bar = base.mark_bar(color='#f6ad55', opacity=0.5).encode(
                        y=alt.Y('수강신청 인원:Q', axis=alt.Axis(title='수강신청 인원', titleColor='#f6ad55', labelAngle=0)),
                        tooltip=[
                            alt.Tooltip('조정_월:N', title='월'),
                            alt.Tooltip('수강신청 인원:Q', title='수강신청 인원', format=',d'),
                            alt.Tooltip('수료인원:Q', title='수료인원', format=',d')
                        ]
                    )
                    
                    monthly_only_chart = alt.layer(bar, line).resolve_scale(
                        y='independent'
                    ).properties(
                        width=800,
                        height=400,
                        title=f"전체 월별 매출 및 수강생 추이 (월별 통합, 수료율 조정)"
                    )
                else:
                    # 기존 방식
                    monthly_only_chart = create_monthly_only_revenue_chart(df)
                
                st.altair_chart(monthly_only_chart, use_container_width=True)
                st.caption("※ 이 차트는 연도 구분 없이 월별로만 데이터를 집계한 결과입니다.")
            except Exception as e:
                st.error(f"월별 통합 차트 생성 중 오류가 발생했습니다: {e}")
                import traceback
                st.error(traceback.format_exc())
                # 월별 성과 요약 정보 표시
                create_monthly_performance_summary(df, use_adjusted_revenue, original_df if use_adjusted_revenue else None)


            # 월별 매출 요약 테이블 금액 수정
            st.subheader("월별 매출 요약")
            try:
                monthly_data = create_monthly_revenue_summary_chart(df)
                
                # 실제 금액(10배)으로 표시 및 수료율 조정 적용
                if use_adjusted_revenue:
                    # 현재 날짜
                    current_date = pd.Timestamp.now()
                    
                    # 각 월별 데이터에 대해 조정 적용
                    # 월별 데이터를 원래 데이터프레임과 연결하여 조정
                    monthly_adjusted = []
                    for _, row in monthly_data.iterrows():
                        month = row['월']
                        # 월별 분석용 데이터프레임에서 해당 월 데이터 추출
                        # 안전하게 이미 확인된 컬럼만 사용
                        try:
                            # 월 컬럼 사용 시도
                            if '월' in df.columns:
                                month_df = df[df['월'].astype(str) == month.split('-')[-1] if '-' in month else month]
                            # 과정시작일 컬럼 사용 시도
                            elif '과정시작일' in df.columns:
                                month_df = df[pd.to_datetime(df['과정시작일']).dt.to_period('M').astype(str) == month]
                            else:
                                # 둘 다 없으면 빈 데이터프레임 사용
                                month_df = pd.DataFrame()
                        except Exception as e:
                            st.warning(f"월별 데이터 추출 오류: {e}")
                            month_df = pd.DataFrame()
                        
                        if not month_df.empty:
                            adjusted_month_df = apply_adjusted_revenue(month_df, current_date)
                            # 10배 곱하기 제거하여 올바른 금액 계산 (억원 단위로 변환)
                            adjusted_sum = adjusted_month_df['조정_누적매출'].sum() / 100000000
                            monthly_adjusted.append({
                                '월': month,
                                '매출(억)': adjusted_sum,
                                '수강신청 인원': row['수강신청 인원'],
                                '수료인원': row['수료인원'],
                                '과정수': row['과정수']
                            })
                        else:
                            # 원래 데이터가 없는 경우 그대로 유지
                            monthly_adjusted.append({
                                '월': month,
                                '매출(억)': row['매출(억)'],
                                '수강신청 인원': row['수강신청 인원'],
                                '수료인원': row['수료인원'],
                                '과정수': row['과정수']
                            })
                    
                    monthly_display = pd.DataFrame(monthly_adjusted)
                else:
                    # 기존 방식 - 단순 10배
                    monthly_data['매출(억)'] = monthly_data['매출(억)']
                    monthly_display = monthly_data
                
                st.dataframe(
                    monthly_display[['월', '매출(억)', '수강신청 인원', '수료인원', '과정수']].sort_values('월', ascending=False),
                    use_container_width=True
                )
            except Exception as e:
                st.error(f"월별 매출 요약 테이블 생성 중 오류가 발생했습니다: {e}")
                import traceback
                st.error(traceback.format_exc())
            
            # 훈련기관별 월별 매출 흐름 차트
            st.subheader("훈련기관별 월별 매출 분석")
            institution_search = st.text_input("훈련기관 검색", "")
            
            if institution_search:
                # 검색어와 유사한 훈련기관 찾기
                similar_institutions = []
                for inst in df['훈련기관'].unique():
                    if institution_search.lower() in inst.lower():
                        similar_institutions.append(inst)
                
                if similar_institutions:
                    selected_institution = st.selectbox("검색된 훈련기관 선택", similar_institutions)
                    
                    # 선택된 훈련기관의 월별 매출 흐름 차트 (연도-월 기준)
                    st.subheader(f"{selected_institution} 월별 매출 및 수강생 추이 (연도-월 기준)")
                    try:
                        if use_adjusted_revenue:
                            # 수료율 조정 적용
                            institution_monthly_chart = create_monthly_revenue_chart_adjusted(temp_df, selected_institution)
                        else:
                            # 기존 방식
                            institution_monthly_chart = create_monthly_revenue_chart(df, selected_institution)
                            
                        st.altair_chart(institution_monthly_chart, use_container_width=True)
                    except Exception as e:
                        st.error(f"기관별 월별 매출 차트 생성 중 오류가 발생했습니다: {e}")
                        import traceback
                        st.error(traceback.format_exc())
                    
                    # 선택된 훈련기관의 순수 월별 매출 흐름 차트 (연도 구분 없이)
                    st.subheader(f"{selected_institution} 월별 매출 및 수강생 추이 (월별 통합)")
                    try:
                        if use_adjusted_revenue:
                            # 기관 필터링된 데이터에 수료율 조정 적용
                            inst_data = temp_df[temp_df['훈련기관'] == selected_institution]
                            adjusted_inst_data = apply_adjusted_revenue(inst_data)
                            
                            # 차트 생성을 위한 커스텀 함수 적용
                            adjusted_inst_data['월'] = pd.to_datetime(adjusted_inst_data['과정시작일']).dt.month.astype(str) + '월'
                            
                            monthly_inst_data = adjusted_inst_data.groupby('월').agg({
                                '조정_누적매출': 'sum',
                                '수강신청 인원': 'sum',
                                '수료인원': 'sum'
                            }).reset_index()
                            
                            # 월 정렬
                            month_order = {'1월': 1, '2월': 2, '3월': 3, '4월': 4, '5월': 5, '6월': 6, 
                                           '7월': 7, '8월': 8, '9월': 9, '10월': 10, '11월': 11, '12월': 12}
                            monthly_inst_data['월_정렬'] = monthly_inst_data['월'].map(month_order)
                            monthly_inst_data = monthly_inst_data.sort_values('월_정렬')
                            
                            # 실제 금액(10배)으로 표시
                            monthly_inst_data['조정_매출(억)'] = monthly_inst_data['조정_누적매출'] / 100000000
                            
                            # 차트 생성
                            base = alt.Chart(monthly_inst_data).encode(
                                x=alt.X('월:N', sort=list(month_order.keys()), axis=alt.Axis(title='월'))
                            )
                            
                            line = base.mark_line(stroke='#48BB78', point=True, strokeWidth=3).encode(
                                y=alt.Y('조정_매출(억):Q', axis=alt.Axis(title='매출액 (억원)', titleColor='#48BB78', labelAngle=0)),
                                tooltip=[
                                    alt.Tooltip('월:N', title='월'),
                                    alt.Tooltip('조정_매출(억):Q', title='수료율 조정 매출액 (억원)', format='.2f'),
                                ]
                            )
                            
                            bar = base.mark_bar(color='#f6ad55', opacity=0.5).encode(
                                y=alt.Y('수강신청 인원:Q', axis=alt.Axis(title='수강신청 인원', titleColor='#f6ad55', labelAngle=0)),
                                tooltip=[
                                    alt.Tooltip('월:N', title='월'),
                                    alt.Tooltip('수강신청 인원:Q', title='수강신청 인원', format=',d'),
                                    alt.Tooltip('수료인원:Q', title='수료인원', format=',d')
                                ]
                            )
                            
                            institution_monthly_only_chart = alt.layer(bar, line).resolve_scale(
                                y='independent'
                            ).properties(
                                width=800,
                                height=400,
                                title=f"{selected_institution} 월별 매출 및 수강생 추이 (월별 통합, 수료율 조정)"
                            )
                        else:
                            # 기존 방식
                            institution_monthly_only_chart = create_monthly_only_revenue_chart(df, selected_institution)
                        
                        st.altair_chart(institution_monthly_only_chart, use_container_width=True)
                        st.caption("※ 이 차트는 연도 구분 없이 월별로만 데이터를 집계한 결과입니다.")
                    except Exception as e:
                        st.error(f"기관별 월별 통합 차트 생성 중 오류가 발생했습니다: {e}")
                        import traceback
                        st.error(traceback.format_exc())
                    
                    # 훈련기관 상세 정보
                    st.subheader(f"{selected_institution} 상세 정보")
                    inst_data = df[df['훈련기관'] == selected_institution]
                    
                    # 조정된 매출액 계산
                    adjusted_revenue = None
                    if use_adjusted_revenue:
                        orig_inst_data = temp_df[temp_df['훈련기관'] == selected_institution]
                        adjusted_inst_data = apply_adjusted_revenue(orig_inst_data)
                        adjusted_revenue = adjusted_inst_data['조정_누적매출'].sum() / 100000000
                    
                    # 기본 통계
                    col1, col2, col3, col4 = st.columns(4)
                    with col1:
                        st.metric("총 과정수", f"{len(inst_data)}개")
                    with col2:
                        if use_adjusted_revenue and adjusted_revenue is not None:
                            original_rev = orig_inst_data['누적매출'].sum() / 100000000
                            st.metric(
                                "총 매출액 (조정)", 
                                f"{adjusted_revenue:.1f}억원",
                                delta=f"{adjusted_revenue - original_rev:.1f}억원"
                            )
                        else:
                            st.metric("총 매출액", f"{inst_data['누적매출'].sum() / 100000000:.1f}억원")
                    with col3:
                        st.metric("총 수강생", f"{inst_data['수강신청 인원'].sum():.0f}명")
                    with col4:
                        completion_rate = inst_data['수료인원'].sum() / inst_data['수강신청 인원'].sum() * 100 if inst_data['수강신청 인원'].sum() > 0 else 0
                        st.metric("수료율", f"{completion_rate:.1f}%")
                    
                    # 과정 목록
                    st.subheader(f"{selected_institution} 과정 목록")
                    
                    if use_adjusted_revenue:
                        # 수료율 조정된 과정별 매출 표시
                        display_df = inst_data[['과정명', '과정시작일', '과정종료일', '수강신청 인원', '수료인원', '누적매출']].copy()
                        
                        # 조정된 매출 계산
                        adjusted_inst_data = apply_adjusted_revenue(inst_data)
                        display_df['조정_누적매출'] = adjusted_inst_data['조정_누적매출'].values
                        
                        # 표시할 억단위 매출 계산
                        display_df['매출(억)'] = display_df['누적매출'] / 100000000
                        display_df['조정_매출(억)'] = display_df['조정_누적매출'] / 100000000
                        
                        # 표시할 컬럼 선택
                        st.dataframe(
                            display_df[['과정명', '과정시작일', '과정종료일', '수강신청 인원', '수료인원', '매출(억)', '조정_매출(억)']].sort_values('과정시작일', ascending=False),
                            use_container_width=True
                        )
                    else:
                        # 기존 표시
                        display_df = inst_data[['과정명', '과정시작일', '과정종료일', '수강신청 인원', '수료인원', '누적매출']].copy()
                        display_df['매출(억)'] = display_df['누적매출'] / 100000000
                        st.dataframe(
                            display_df[['과정명', '과정시작일', '과정종료일', '수강신청 인원', '수료인원', '매출(억)']].sort_values('과정시작일', ascending=False),
                            use_container_width=True
                        )
                else:
                    st.warning(f"'{institution_search}' 검색 결과가 없습니다.")
        else:
            ## KDT 훈련현황 및 매출 비중 표시 (선택 사항)
            js_code = create_ncs_ranking_component(df)
            if js_code:
                st.components.v1.html(js_code, height=800)
            # calculate_and_visualize_revenue(df)

            # NCS명 입력 받기
            ncs_name = st.text_input("NCS명 검색")

            analyze_ncs(df, yearly_data, ncs_name)  # ncs_name 전달
    except Exception as e:
        st.error(f"애플리케이션 실행 중 오류가 발생했습니다: {e}")
        import traceback
        st.error(traceback.format_exc())

if __name__ == "__main__":
    # 훈련과정 분석 기능
    def analyze_courses(df):
        st.title("훈련과정 분석")
        
        # 기본 필터링 옵션
        col1, col2 = st.columns(2)
        with col1:
            training_type_filter = st.radio(
                "훈련유형 선택",
                ["전체", "선도기업형 훈련", "일반KDT"],
                horizontal=True
            )
        
        with col2:
            year_filter = st.selectbox(
                "연도 선택",
                ["전체연도"] + sorted(df['연도'].unique().tolist(), reverse=True)
            )
        
        # 필터링 적용
        filtered_df = df.copy()
        
        if training_type_filter == "선도기업형 훈련":
            filtered_df = filtered_df[filtered_df['훈련유형'].str.contains('선도기업형 훈련', na=False)]
        elif training_type_filter == "일반KDT":
            filtered_df = filtered_df[~filtered_df['훈련유형'].str.contains('선도기업형 훈련', na=False)]
        
        if year_filter != "전체연도":
            filtered_df = filtered_df[filtered_df['연도'] == year_filter]
        
        # 과정 검색 기능
        st.subheader("훈련과정 검색")
        
        search_tab1, search_tab2 = st.tabs(["과정명 검색", "훈련과정 ID 검색"])
        
        with search_tab1:
            course_name_search = st.text_input("과정명 검색 (일부 포함)", key="course_name_search")
            
            if course_name_search:
                # 과정명 검색 실행
                search_results = filtered_df[filtered_df['과정명'].str.contains(course_name_search, case=False, na=False)]
                
                if not search_results.empty:
                    st.write(f"{len(search_results)} 개의 검색 결과가 있습니다.")
                    
                    # 유니크한 과정명 검색 결과 출력
                    unique_courses = search_results['과정명'].unique()
                    selected_course = st.selectbox("조회할 과정 선택", unique_courses)
                    
                    if selected_course:
                        # 선택한 과정의 모든 회차 정보 출력
                        course_instances = search_results[search_results['과정명'] == selected_course].sort_values('과정시작일', ascending=False)
                        
                        # 과정 정보 요약
                        total_instances = len(course_instances)
                        total_students = course_instances['수강신청 인원'].sum()
                        total_completions = course_instances['수료인원'].sum()
                        avg_completion_rate = (total_completions / total_students * 100) if total_students > 0 else 0
                        total_revenue = course_instances['누적매출'].sum() / 100000000  # 억원 단위
                        
                        # 요약 정보 표시
                        summary_col1, summary_col2, summary_col3 = st.columns(3)
                        with summary_col1:
                            st.metric("개설 회차 수", f"{total_instances}회")
                        with summary_col2:
                            st.metric("총 수강생 수", f"{int(total_students)}명")
                        with summary_col3:
                            st.metric("평균 수료율", f"{avg_completion_rate:.1f}%")
                        
                        summary_col4, summary_col5 = st.columns(2)
                        with summary_col4:
                            st.metric("총 매출액", f"{total_revenue:.1f}억원")
                        with summary_col5:
                            main_institution = course_instances['훈련기관'].value_counts().index[0] if not course_instances.empty else "정보 없음"
                            st.metric("주요 훈련기관", main_institution)
                        
                        # 과정 상세 정보 데이터프레임 표시
                        st.subheader(f"{selected_course} - 회차별 정보")
                        
                        # 표시할 정보 준비
                        display_df = course_instances[[
                            '훈련기관', '과정시작일', '과정종료일', 
                            '훈련유형', '수강신청 인원', '수료인원', '누적매출'
                        ]].copy()
                        
                        # 수료율 계산 추가
                        display_df['수료율'] = (display_df['수료인원'] / display_df['수강신청 인원'] * 100).round(1)
                        
                        # 매출액 단위 변환 (억원)
                        display_df['매출액(억)'] = (display_df['누적매출'] / 100000000).round(1)
                        
                        # 축약된 데이터프레임 표시
                        st.dataframe(
                            display_df[[
                                '훈련기관', '과정시작일', '과정종료일', 
                                '훈련유형', '수강신청 인원', '수료인원', '수료율', '매출액(억)'
                            ]],
                            use_container_width=True,
                            column_config={
                                "훈련기관": st.column_config.TextColumn("훈련기관"),
                                "과정시작일": st.column_config.DateColumn("과정시작일", format="YYYY-MM-DD"),
                                "과정종료일": st.column_config.DateColumn("과정종료일", format="YYYY-MM-DD"),
                                "훈련유형": st.column_config.TextColumn("훈련유형"),
                                "수강신청 인원": st.column_config.NumberColumn("수강신청 인원", format="%d명"),
                                "수료인원": st.column_config.NumberColumn("수료인원", format="%d명"),
                                "수료율": st.column_config.NumberColumn("수료율", format="%.1f%%"),
                                "매출액(억)": st.column_config.NumberColumn("매출액", format="%.1f억원")
                            },
                            hide_index=True
                        )
                        
                        # 회차별 수강생 추이 차트
                        if len(course_instances) > 1:
                            st.subheader(f"{selected_course} - 회차별 추이")
                            
                            # 차트용 데이터 준비
                            chart_df = course_instances.copy()
                            chart_df['과정시작일_str'] = pd.to_datetime(chart_df['과정시작일']).dt.strftime('%Y-%m-%d')
                            chart_df = chart_df.sort_values('과정시작일')
                            
                            # 차트 생성
                            fig = px.line(
                                chart_df, 
                                x='과정시작일_str', 
                                y=['수강신청 인원', '수료인원'],
                                title=f"{selected_course} - 회차별 수강생 추이",
                                labels={'과정시작일_str': '과정 시작일', 'value': '인원 수', 'variable': '구분'},
                                markers=True
                            )
                            
                            # y축 레이블 수정
                            fig.update_layout(
                                yaxis_title='인원 수',
                                xaxis_title='과정 시작일',
                                legend_title='구분',
                                hovermode='x unified'
                            )
                            
                            # 차트 표시
                            st.plotly_chart(fig, use_container_width=True)
                            
                            # 수료율 추이 차트
                            fig2 = px.line(
                                chart_df, 
                                x='과정시작일_str', 
                                y='수료율',
                                title=f"{selected_course} - 회차별 수료율 추이",
                                labels={'과정시작일_str': '과정 시작일', '수료율': '수료율 (%)'},
                                markers=True
                            )
                            
                            # y축 레이블 수정
                            fig2.update_layout(
                                yaxis_title='수료율 (%)',
                                xaxis_title='과정 시작일',
                                hovermode='x unified'
                            )
                            
                            # 차트 표시
                            st.plotly_chart(fig2, use_container_width=True)
                else:
                    st.warning(f"{course_name_search} 검색 결과가 없습니다.")
        
        with search_tab2:
            course_id_search = st.text_input("훈련과정 ID 검색", key="course_id_search")
            
            if course_id_search:
                # ID 검색 실행
                id_search_results = filtered_df[filtered_df['훈련과정 ID'].astype(str).str.contains(course_id_search, case=False, na=False)]
                
                if not id_search_results.empty:
                    st.write(f"{len(id_search_results)} 개의 검색 결과가 있습니다.")
                    
                    # 유니크한 과정ID 검색 결과 출력
                    unique_course_ids = id_search_results['훈련과정ID'].unique()
                    selected_course_id = st.selectbox("조회할 과정 ID 선택", unique_course_ids)
                    
                    if selected_course_id:
                        # 선택한 과정ID의 정보 출력
                        course_id_instance = id_search_results[id_search_results['훈련과정 ID'] == selected_course_id].sort_values('과정시작일', ascending=False)
                        
                        # 과정 정보 표시
                        course_name = course_id_instance['과정명'].iloc[0] if not course_id_instance.empty else "정보 없음"
                        st.subheader(f"훈련련과정 ID: {selected_course_id} - {course_name}")
                        
                        # 과정 상세 정보 데이터프레임 표시
                        if not course_id_instance.empty:
                            # 표시할 정보 준비
                            display_df = course_id_instance[[
                                '훈련기관', '과정시작일', '과정종료일', 
                                '훈련유형', '수강신청 인원', '수료인원', '누적매출'
                            ]].copy()
                            
                            # 수료율 계산 추가
                            display_df['수료율'] = (display_df['수료인원'] / display_df['수강신청 인원'] * 100).round(1)
                            
                            # 매출액 단위 변환 (억원)
                            display_df['매출액(억)'] = (display_df['누적매출'] / 100000000).round(1)
                            
                            # 축약된 데이터프레임 표시
                            st.dataframe(
                                display_df[[
                                    '훈련기관', '과정시작일', '과정종료일', 
                                    '훈련유형', '수강신청 인원', '수료인원', '수료율', '매출액(억)'
                                ]],
                                use_container_width=True,
                                column_config={
                                    "훈련기관": st.column_config.TextColumn("훈련기관"),
                                    "과정시작일": st.column_config.DateColumn("과정시작일", format="YYYY-MM-DD"),
                                    "과정종료일": st.column_config.DateColumn("과정종료일", format="YYYY-MM-DD"),
                                    "훈련유형": st.column_config.TextColumn("훈련유형"),
                                    "수강신청 인원": st.column_config.NumberColumn("수강신청 인원", format="%d명"),
                                    "수료인원": st.column_config.NumberColumn("수료인원", format="%d명"),
                                    "수료율": st.column_config.NumberColumn("수료율", format="%.1f%%"),
                                    "매출액(억)": st.column_config.NumberColumn("매출액", format="%.1f억원")
                                },
                                hide_index=True
                            )
                        else:
                            st.info("해당 과정ID에 대한 정보가 없습니다.")
                else:
                    st.warning(f"훈련과정 ID {course_id_search}에 대한 검색 결과가 없습니다.")
    
# 페이지 설정 함수 정의
def setup_page():
    st.set_page_config(layout="wide")
    
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
    
# 데이터 로딩 및 전처리 함수 정의
def load_and_preprocess_data():
    url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/result_kdtdata_202505.csv?raw=true"
    df = load_data_from_github(url)
    if df.empty:
        st.error("데이터를 불러올 수 없습니다.")
        return pd.DataFrame()

    # 데이터 전처리
    df = preprocess_data(df)
    if df.empty:  # preprocess_data에서 '훈련기관' 컬럼이 없는 경우
        st.error("데이터 전처리 중 오류가 발생했습니다. '훈련기관' 컬럼이 없습니다.")
        return pd.DataFrame()

    # Int64 타입을 float로 변환
    numeric_cols = ['누적매출', '수강신청 인원', '수료인원']
    for col in numeric_cols:
        if col in df.columns and df[col].dtype.name == 'Int64':
            df[col] = df[col].astype(float)
    
    # '과정시작일' 컬럼에서 '연도'와 '월' 컬럼 추출
    if '과정시작일' in df.columns:
        # 문자열인 경우 날짜형으로 변환
        if df['과정시작일'].dtype == 'object':
            try:
                df['과정시작일'] = pd.to_datetime(df['과정시작일'])
            except:
                pass  # 변환 오류 무시
        
        # 날짜형으로 변환되었다면 연도와 월 추출
        if pd.api.types.is_datetime64_any_dtype(df['과정시작일']):
            df['연도'] = df['과정시작일'].dt.year
            df['월'] = df['과정시작일'].dt.month
            # 연월 컴포지트 컬럼 (정렬을 위해)
            df['연월'] = df['연도'].astype(str) + '-' + df['월'].astype(str).str.zfill(2)
        else:
            # 문자열에서 연도와 월 추출 시도 (YYYY-MM-DD 형태 가정)
            try:
                df['연도'] = df['과정시작일'].str.slice(0, 4).astype(int)
                df['월'] = df['과정시작일'].str.slice(5, 7).astype(int)
                df['연월'] = df['과정시작일'].str.slice(0, 7)
            except:
                # 연도 추출 실패 시 기본값 설정
                df['연도'] = 2023  # 기본값으로 2023년 설정
                df['월'] = 1      # 기본값으로 1월 설정
                df['연월'] = '2023-01'
    else:
        # '과정시작일' 컬럼이 없는 경우 기본값 설정
        df['연도'] = 2023  # 기본값으로 2023년 설정
        df['월'] = 1      # 기본값으로 1월 설정
        df['연월'] = '2023-01'
    
    # 매출액 필터링은 필요한 부분에서만 선택적으로 적용할 수 있도록 중지
    # 원본 데이터는 보존하고, 월별 분석 등에서 필요할 때 별도로 필터링된 복사본 사용
    
    return df

def main():
    try:
        # 페이지 설정
        setup_page()
        
        # 데이터 로딩 및 전처리
        df = load_and_preprocess_data()
        
        # 수료율 기반 조정 매출 계산 방식 선택 (기본값을 수료율 기반 조정으로 설정)
        revenue_calculation = st.sidebar.radio(
            "매출 계산 방식",
            ["기본 계산", "수료율 기반 조정"],
            index=1,  # 수료율 기반 조정을 기본값으로 설정
            help="수료율 기반 조정 옵션은 실제 수료인원과 수료율을 고려하여 매출을 계산합니다."
        )
        
        # 수료율 기반 조정 여부
        use_adjusted_revenue = revenue_calculation == "수료율 기반 조정"

        # 조정된 매출 계산 (옵션 선택 시)
        if use_adjusted_revenue:
            adjusted_df = apply_adjusted_revenue(df)
            
            # 기존 df 백업 및 조정된 값으로 대체
            original_df = df.copy()
            
            # 연도별 매출 컬럼 처리
            year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}\ub144$', col)]
            
            # 누적매출 컬럼 대체
            df['\ub204\uc801\ub9e4\ucd9c'] = adjusted_df['\uc870\uc815_\ub204\uc801\ub9e4\ucd9c']
            
            # 연도별 매출 컬럼 대체
            for year in year_columns:
                if f'\uc870\uc815_{year}' in adjusted_df.columns:
                    df[year] = adjusted_df[f'\uc870\uc815_{year}']
        
        # 연도별 매출 계산 (전처리 후 수행) - 조정된 df 기준으로 계산
        year_columns = [str(col) for col in df.columns if re.match(r'^\d{4}\ub144$', str(col))]
        df, yearly_data = calculate_yearly_revenue(df)

        # 사이드바에서 분석 유형 선택
        analysis_type = st.sidebar.radio(
            "분석 유형",
            ["훈련기관 분석", "월별 매출 분석", "NCS 분석", "전체 매출 분석", "훈련과정 분석"],
            index=0
        )

        st.markdown("""
            <style>
                .streamlit-dataframe th {
                    writing-mode: horizontal;
                }
            </style>
        """, unsafe_allow_html=True)

        if analysis_type == "훈련기관 분석":
            # 매출 계산 방식 안내
            if use_adjusted_revenue:
                st.info("""
                    **수료율 기반 조정 매출을 사용 중입니다.**
                    
                    이 방식은 실제 수료율을 반영하여 매출액을 조정합니다:
                    - 기존 방식은 수강신청인원의 80%를 기준으로 매출을 계산
                    - 수료율 기반 조정은 통합 수료율과 실제 수료인원을 기준으로 매출을 재계산
                    - 수료율이 평균보다 높은 과정은 추가 가중치를 부여하여 실제 매출에 가깝게 조정
                """)
            
            # 랭킹 컴포넌트 생성 및 표시
            js_code = create_ranking_component(df, yearly_data)
            if js_code is None:
              st.error("랭킹 컴포넌트 생성에 실패했습니다. '훈련기관' 컬럼이 없는지 확인해주세요.")
              return
            js_code = f"""
                <div style="height: 800px; overflow-y: auto;">
                    {js_code}
                </div>
            """
            st.components.v1.html(js_code, height=800)

            # 선도기업 비중 및 SSAFY 사업 분류 시각화
            calculate_and_visualize_revenue(df)

            visualize_by_institutions(df)

            analyze_top5_institutions(df, yearly_data)
            # 원래 df로 복구 (다른 분석 페이지를 위해)
            if use_adjusted_revenue:
                df = original_df.copy()

        elif analysis_type == "NCS 분석":
            st.title("NCS 분석")
            
            # 조정된 데이터 사용 시 df를 업데이트
            if use_adjusted_revenue:
                st.info("""
                    **수료율 기반 조정 매출을 사용 중입니다.**
                    
                    이 방식은 실제 수료율을 반영하여 매출액을 조정합니다:
                    - 기존 방식은 수강신청인원의 80%를 기준으로 매출을 계산
                    - 수료율 기반 조정은 통합 수료율과 실제 수료인원을 기준으로 매출을 재계산
                    - 수료율이 평균보다 높은 과정은 추가 가중치를 부여하여 실제 매출에 가깝게 조정
                """)
                
                # 조정된 매출로 df 업데이트
                adjusted_df = apply_adjusted_revenue(df)
                temp_df = df.copy()
                df['\ub204\uc801\ub9e4\ucd9c'] = adjusted_df['\uc870\uc815_\ub204\uc801\ub9e4\ucd9c']
                
                # 연도별 매출 컬럼도 업데이트
                year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}\ub144$', col)]
                for year in year_columns:
                    if f'\uc870\uc815_{year}' in adjusted_df.columns:
                        df[year] = adjusted_df[f'\uc870\uc815_{year}']
                        
                # 연도별 매출 재계산
                df, yearly_data = calculate_yearly_revenue(df)
                
                # 원본 데이터 보관
                original_df = df.copy()
                
            # NCS 랭킹 컴포넌트 생성 및 표시
            ncs_js_code = create_ncs_ranking_component(df)
            
            if ncs_js_code is None:
                st.error("NCS 랭킹 컴포넌트 생성에 실패했습니다. 'NCS명' 컬럼이 없는지 확인해주세요.")
            else:
                st.components.v1.html(ncs_js_code, height=800)
                
            # NCS 세부 분석
            ncs_name = st.text_input("NCS명 검색")
            
            analyze_ncs(df, yearly_data, ncs_name)  # ncs_name 전달
            
            # 원래 df로 복구
            if use_adjusted_revenue:
                df = original_df.copy()

        elif analysis_type == "월별 매출 분석":
            st.title("월별 매출 분석")
            
            if use_adjusted_revenue:
                st.info("""
                    **수료율 기반 조정 매출을 사용 중입니다.**
                    
                    이 방식은 실제 수료율을 반영하여 매출액을 조정합니다:
                    - 기존 방식은 수강신청인원의 80%를 기준으로 매출을 계산
                    - 수료율 기반 조정은 통합 수료율과 실제 수료인원을 기준으로 매출을 재계산
                    - 수료율이 평균보다 높은 과정은 추가 가중치를 부여하여 실제 매출에 가깝게 조정
                """)
            
            # 월별 분석용 데이터프레임 생성 (원본 보존)
            analysis_df = df.copy()
            
            # 매출액 필터링 제거 (사용자 요청에 따름)
            # 원본 데이터 그대로 사용
            
            # '연월' 컬럼 생성 확인 (없을 경우 생성)
            if '연월' not in analysis_df.columns and '연도' in analysis_df.columns and '월' in analysis_df.columns:
                analysis_df['연월'] = analysis_df['연도'].astype(str) + '-' + analysis_df['월'].astype(str).str.zfill(2)
            
            # 월별 매출 시각화
            col1, col2 = st.columns(2)
            with col1:
                selected_year = st.selectbox(
                    "연도 선택", 
                    sorted(analysis_df['연도'].unique(), reverse=True), 
                    index=0
                )
            
            with col2:
                show_monthly_revenue_option = st.radio(
                    "매출 표시 방식",
                    ["월별 매출", "월별 누적 매출"],
                    index=0,
                    horizontal=True
                )
            
            # 차트 생성
            if show_monthly_revenue_option == "월별 매출":
                if use_adjusted_revenue:
                    # 조정된 매출 기준 차트
                    monthly_chart = create_monthly_revenue_chart_adjusted(analysis_df, selected_year)
                else:
                    # 기본 매출 차트
                    monthly_chart = create_monthly_revenue_chart(analysis_df, selected_year)
            else:
                # 누적 매출 차트
                monthly_chart = create_monthly_only_revenue_chart(analysis_df, selected_year)
            
            st.altair_chart(monthly_chart, use_container_width=True)
            
            # 월별 요약 정보 표시
            create_monthly_performance_summary(analysis_df, use_adjusted_revenue)
            
            # 월별 랭킹
            st.subheader(f"{selected_year}년 월별 상위 훈련기관 랭킹")
            
            # 월별 랭킹 컴포넌트 생성
            monthly_ranking_js = create_monthly_ranking_component(analysis_df)
            if monthly_ranking_js is not None:
                st.components.v1.html(monthly_ranking_js, height=600)
            else:
                st.error("월별 랭킹 컴포넌트 생성에 실패했습니다.")

        elif analysis_type == "전체 매출 분석":
            st.title("전체 매출 분석")
            
            if use_adjusted_revenue:
                st.info("""
                    **수료율 기반 조정 매출을 사용 중입니다.**
                    
                    이 방식은 실제 수료율을 반영하여 매출액을 조정합니다:
                    - 기존 방식은 수강신청인원의 80%를 기준으로 매출을 계산
                    - 수료율 기반 조정은 통합 수료율과 실제 수료인원을 기준으로 매출을 재계산
                    - 수료율이 평균보다 높은 과정은 추가 가중치를 부여하여 실제 매출에 가깝게 조정
                """)
            
            # 연도별 매출 합계 차트
            yearly_chart = create_yearly_revenue_chart(yearly_data)
            st.altair_chart(yearly_chart, use_container_width=True)
            
            # 원래 df로 복구
            if use_adjusted_revenue:
                df = original_df.copy()
        
        elif analysis_type == "훈련과정 분석":
            # 훈련과정 분석 함수 호출
            try:
                # 훈련과정 검색 기능
                st.subheader("훈련과정 검색")
                
                search_tab1, search_tab2 = st.tabs(["과정명 검색", "훈련과정 ID 검색"])
                
                with search_tab1:
                    course_name_search = st.text_input("과정명 검색 (일부 포함)", key="course_name_search")
                    
                    if course_name_search:
                        # 과정명 검색 실행
                        search_results = df[df['과정명'].str.contains(course_name_search, case=False, na=False)]
                        
                        if not search_results.empty:
                            st.write(f"{len(search_results)} 개의 검색 결과가 있습니다.")
                            
                            # 유니크한 과정명 검색 결과 출력
                            unique_courses = search_results['과정명'].unique()
                            selected_course = st.selectbox("조회할 과정 선택", unique_courses)
                            
                            if selected_course:
                                # 선택한 과정의 모든 회차 정보 출력
                                course_instances = search_results[search_results['과정명'] == selected_course].sort_values('과정시작일', ascending=False)
                                
                                # 과정 정보 요약
                                total_instances = len(course_instances)
                                total_students = course_instances['수강신청 인원'].sum()
                                total_completions = course_instances['수료인원'].sum()
                                avg_completion_rate = (total_completions / total_students * 100) if total_students > 0 else 0
                                total_revenue = course_instances['누적매출'].sum() / 100000000  # 억원 단위
                                
                                # 요약 정보 표시
                                summary_col1, summary_col2, summary_col3 = st.columns(3)
                                with summary_col1:
                                    st.metric("개설 회차 수", f"{total_instances}회")
                                with summary_col2:
                                    st.metric("총 수강생 수", f"{int(total_students)}명")
                                with summary_col3:
                                    st.metric("평균 수료율", f"{avg_completion_rate:.1f}%")
                                
                                summary_col4, summary_col5 = st.columns(2)
                                with summary_col4:
                                    st.metric("총 매출액", f"{total_revenue:.1f}억원")
                                with summary_col5:
                                    main_institution = course_instances['훈련기관'].value_counts().index[0] if not course_instances.empty else "정보 없음"
                                    st.metric("주요 훈련기관", main_institution)
                                
                                # 과정 상세 정보 데이터프레임 표시
                                st.subheader(f"{selected_course} - 회차별 정보")
                                
                                # 표시할 정보 준비
                                display_df = course_instances[[
                                    '훈련기관', '과정시작일', '과정종료일', 
                                    '훈련유형', '수강신청 인원', '수료인원', '누적매출'
                                ]].copy()
                                
                                # 수료율 계산 추가
                                display_df['수료율'] = (display_df['수료인원'] / display_df['수강신청 인원'] * 100).round(1)
                                
                                # 매출액 단위 변환 (억원)
                                display_df['매출액(억)'] = (display_df['누적매출'] / 100000000).round(1)
                                
                                # 축약된 데이터프레임 표시
                                st.dataframe(
                                    display_df[[
                                        '훈련기관', '과정시작일', '과정종료일', 
                                        '훈련유형', '수강신청 인원', '수료인원', '수료율', '매출액(억)'
                                    ]],
                                    use_container_width=True,
                                    column_config={
                                        "훈련기관": st.column_config.TextColumn("훈련기관"),
                                        "과정시작일": st.column_config.DateColumn("과정시작일", format="YYYY-MM-DD"),
                                        "과정종료일": st.column_config.DateColumn("과정종료일", format="YYYY-MM-DD"),
                                        "훈련유형": st.column_config.TextColumn("훈련유형"),
                                        "수강신청 인원": st.column_config.NumberColumn("수강신청 인원", format="%d명"),
                                        "수료인원": st.column_config.NumberColumn("수료인원", format="%d명"),
                                        "수료율": st.column_config.NumberColumn("수료율", format="%.1f%%"),
                                        "매출액(억)": st.column_config.NumberColumn("매출액", format="%.1f억원")
                                    },
                                    hide_index=True
                                )
                                
                                # 회차별 수강생 추이 차트
                                if len(course_instances) > 1:
                                    st.subheader(f"{selected_course} - 회차별 추이")
                                    
                                    # 차트용 데이터 준비
                                    chart_df = course_instances.copy()
                                    chart_df['과정시작일_str'] = pd.to_datetime(chart_df['과정시작일']).dt.strftime('%Y-%m-%d')
                                    chart_df = chart_df.sort_values('과정시작일')
                                    
                                    # 차트 생성
                                    fig = px.line(
                                        chart_df, 
                                        x='과정시작일_str', 
                                        y=['수강신청 인원', '수료인원'],
                                        title=f"{selected_course} - 회차별 수강생 추이",
                                        labels={'과정시작일_str': '과정 시작일', 'value': '인원 수', 'variable': '구분'},
                                        markers=True
                                    )
                                    
                                    # y축 레이블 수정
                                    fig.update_layout(
                                        yaxis_title='인원 수',
                                        xaxis_title='과정 시작일',
                                        legend_title='구분',
                                        hovermode='x unified'
                                    )
                                    
                                    # 차트 표시
                                    st.plotly_chart(fig, use_container_width=True)
                                    
                                    # 수료율 추이 차트
                                    fig2 = px.line(
                                        chart_df, 
                                        x='과정시작일_str', 
                                        y='수료율',
                                        title=f"{selected_course} - 회차별 수료율 추이",
                                        labels={'과정시작일_str': '과정 시작일', '수료율': '수료율 (%)'},
                                        markers=True
                                    )
                                    
                                    # y축 레이블 수정
                                    fig2.update_layout(
                                        yaxis_title='수료율 (%)',
                                        xaxis_title='과정 시작일',
                                        hovermode='x unified'
                                    )
                                    
                                    # 차트 표시
                                    st.plotly_chart(fig2, use_container_width=True)
                        else:
                            st.warning(f"{course_name_search} 검색 결과가 없습니다.")
                
                with search_tab2:
                    course_id_search = st.text_input("훈련과정 ID 검색", key="course_id_search")
                    
                    if course_id_search:
                        # ID 검색 실행
                        id_search_results = df[df['훈련과정 ID'].astype(str).str.contains(course_id_search, case=False, na=False)]
                        
                        if not id_search_results.empty:
                            st.write(f"{len(id_search_results)} 개의 검색 결과가 있습니다.")
                            
                            # 유니크한 과정ID 검색 결과 출력
                            unique_course_ids = id_search_results['훈련과정 ID'].unique()
                            selected_course_id = st.selectbox("조회할 훈련과정 ID 선택", unique_course_ids)
                            
                            if selected_course_id:
                                # 선택한 과정ID의 정보 출력
                                course_id_instance = id_search_results[id_search_results['훈련과정 ID'] == selected_course_id].sort_values('과정시작일', ascending=False)
                                
                                # 과정 정보 표시
                                course_name = course_id_instance['과정명'].iloc[0] if not course_id_instance.empty else "정보 없음"
                                st.subheader(f"훈련과정 ID: {selected_course_id} - {course_name}")
                                
                                # 과정 상세 정보 데이터프레임 표시
                                if not course_id_instance.empty:
                                    # 표시할 정보 준비
                                    display_df = course_id_instance[[
                                        '훈련기관', '과정시작일', '과정종료일', 
                                        '훈련유형', '수강신청 인원', '수료인원', '누적매출'
                                    ]].copy()
                                    
                                    # 수료율 계산 추가
                                    display_df['수료율'] = (display_df['수료인원'] / display_df['수강신청 인원'] * 100).round(1)
                                    
                                    # 매출액 단위 변환 (억원)
                                    display_df['매출액(억)'] = (display_df['누적매출'] / 100000000).round(1)
                                    
                                    # 축약된 데이터프레임 표시
                                    st.dataframe(
                                        display_df[[
                                            '훈련기관', '과정시작일', '과정종료일', 
                                            '훈련유형', '수강신청 인원', '수료인원', '수료율', '매출액(억)'
                                        ]],
                                        use_container_width=True,
                                        column_config={
                                            "훈련기관": st.column_config.TextColumn("훈련기관"),
                                            "과정시작일": st.column_config.DateColumn("과정시작일", format="YYYY-MM-DD"),
                                            "과정종료일": st.column_config.DateColumn("과정종료일", format="YYYY-MM-DD"),
                                            "훈련유형": st.column_config.TextColumn("훈련유형"),
                                            "수강신청 인원": st.column_config.NumberColumn("수강신청 인원", format="%d명"),
                                            "수료인원": st.column_config.NumberColumn("수료인원", format="%d명"),
                                            "수료율": st.column_config.NumberColumn("수료율", format="%.1f%%"),
                                            "매출액(억)": st.column_config.NumberColumn("매출액", format="%.1f억원")
                                        },
                                        hide_index=True
                                    )
                                else:
                                    st.info("해당 훈련과정 ID에 대한 정보가 없습니다.")
                        else:
                            st.warning(f"훈련과정 ID {course_id_search}에 대한 검색 결과가 없습니다.")
            except Exception as e:
                st.error(f"훈련과정 분석 중 오류가 발생했습니다: {e}")
                import traceback
                st.error(traceback.format_exc())
    
    except Exception as e:
        st.error(f"오류가 발생했습니다: {e}")
        import traceback
        st.error(traceback.format_exc())

main()