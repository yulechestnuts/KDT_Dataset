import streamlit as st
import pandas as pd
import numpy as np
import altair as alt
from datetime import datetime
import requests
import io
from streamlit.components.v1 import html
import json
import re
import plotly.express as px
from difflib import SequenceMatcher

# utils 모듈에서 함수 직접 임포트 (가독성 및 명시성 향상)
from utils.data_loader import load_data_from_github
from utils.data_preprocessing import preprocess_data
from utils.data import calculate_yearly_revenue
from utils.institution_grouping import group_institutions_advanced
from utils.training_type_classification import classify_training_type
from visualization.reports import analyze_training_institution, analyze_course, analyze_ncs, analyze_top5_institutions

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

    # Top 5 과정 데이터 준비 - 매출액 계산 수정
    courses_data = {}
    for institution in df['훈련기관'].unique():
        inst_courses = df[df['훈련기관'] == institution].copy()
        courses_data[institution] = [
            {
                'name': row['과정명'],
                'yearlyRevenue': {
                    year: float(row[year]) if pd.notna(row[year]) else 0
                    for year in year_columns
                },
                'satisfaction': float(row['만족도']) if pd.notna(row['만족도']) else 0,
                'startYear': pd.to_datetime(row['과정시작일']).year,
                'students': int(row['수강신청 인원']) if pd.notna(row['수강신청 인원']) else 0,
                'completedStudents': int(row['수료인원']) if pd.notna(row['수료인원']) else 0  # 수료인원 추가
            }
            for _, row in inst_courses.iterrows()
        ]

    # 연도별 매출 합산
    yearly_revenues = {}
    for institution in institution_revenue.index:
        institution_data = df[df['훈련기관'] == institution]
        yearly_revenues[institution] = {}
        for year in year_columns:
            yearly_revenues[institution][year] = float(institution_data[year].sum())

    # ranking_data 생성
    ranking_data = []
    for institution in institution_revenue.index:
        ranking_data.append({
            "institution": institution,
            "revenue": float(institution_revenue.loc[institution, '누적매출']),
            "courses": int(institution_revenue.loc[institution, 'courses']),
            "yearlyRevenue": yearly_revenues[institution],
            "yearlyCourses": yearly_courses[institution],
            "satisfaction": round(float(satisfaction_data.get(institution, 0)), 1),
            "coursesData": courses_data[institution]  # 전체 과정 데이터 전달
        })

    def calculate_completion_rate(year=None):
        """연도별 수료율 계산 - 과정종료일 기준"""
        if year:
            # 해당 연도에 종료된 과정만 필터링
            year_data = df[pd.to_datetime(df['과정종료일']).dt.year == int(year)]
            # 수료인원이 0인 과정 제외
            valid_data = year_data[year_data['수료인원'] > 0]
            if len(valid_data) == 0:
                return 0
            completion_rate = (valid_data['수료인원'].sum() / valid_data['수강신청 인원'].sum()) * 100
        else:
            # 전체 기간 중 종료된 과정만 필터링
            completed_data = df[pd.to_datetime(df['과정종료일']) <= pd.Timestamp.now()]
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
            const years = Object.keys(rankingData[0].yearlyRevenue).sort();

            const toggleInstitution = (institution) => {
                setExpandedInstitutions(prev => ({
                    ...prev,
                    [institution]: !prev[institution]
                }));
            };

            const getRevenueForDisplay = (item) => {
                if (selectedYear === 'all') {
                    return item.revenue;
                }
                return item.yearlyRevenue[selectedYear] || 0;
            };

            const calculateCourseRevenue = (course, selectedYear) => {
                if (selectedYear === 'all') {
                    return Object.values(course.yearlyRevenue).reduce((sum, val) => sum + val, 0);
                }
                return course.yearlyRevenue[selectedYear] || 0;
            };

            const getTop5Courses = (coursesData, selectedYear) => {
                // 과정명별로 매출과 만족도를 합산
                const aggregatedCourses = coursesData.reduce((acc, course) => {
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
                            weightedSatisfaction: course.satisfaction > 0 ? course.satisfaction * course.students : 0
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
                    .slice(0, 5);
            };

            const filteredAndSortedData = [...rankingData]
                .filter(item =>
                    item.institution.toLowerCase().includes(searchTerm.toLowerCase())
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
                        }}>2025년 2월 28일 기준 개설된 과정 기준</p>

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
                                            cursor: 'pointer'
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
                                                <span style={{
                                                    background: '#2D3748',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    color: '#48BB78',
                                                    fontSize: '14px'
                                                }}>
                                                    만족도: {item.satisfaction}
                                                </span>
                                                <span style={{
                                                    marginLeft: '8px',
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
                                            <h3 style={{color: '#4299e1', marginBottom: '12px'}}>Top 5 과정</h3>
                                            {getTop5Courses(item.coursesData, selectedYear).map((course, idx) => (
                                                <div key={idx} style={{
                                                    marginBottom: '8px',
                                                    padding: '8px',
                                                    background: '#1A202C',
                                                    borderRadius: '4px'
                                                }}>
                                                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                                        <span>#{idx + 1} {course.name} <span style={{color: '#888'}}>(수료인원 {course.totalCompletedStudents}명)</span></span>
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
    """ % (json.dumps(ranking_data), json.dumps(completion_rates))

    return js_code


@st.cache_data
def calculate_and_visualize_revenue(df):
    """사업 유형별 매출 비중 시각화 (선도기업, SSAFY, 기타)"""
    year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'^\d{4}년$', col)]

    # 각 유형별 매출액 계산 함수
    def calculate_revenue_by_type(df, year=None):
        if year:
            total_year_revenue = df[year].sum()
            leading_company_year_revenue = df[df['훈련유형'].str.contains('선도기업형 훈련', na=False)][year].sum()
            ssafy_year_revenue = df[df['과정명'].str.contains(r'\[삼성\] 청년 SW 아카데미', na=False)][year].sum()
            재직자_year_revenue = df[df['훈련유형'].str.contains('재직자 훈련', na=False)][year].sum()
            대학주도_year_revenue = df[df['훈련유형'].str.contains('대학주도형 훈련', na=False)][year].sum()
            심화_year_revenue = df[df['훈련유형'].str.contains('심화 훈련', na=False)][year].sum()
            융합_year_revenue = df[df['훈련유형'].str.contains('융합 훈련', na=False)][year].sum()
            신기술_year_revenue = total_year_revenue - leading_company_year_revenue - ssafy_year_revenue - 재직자_year_revenue - 대학주도_year_revenue - 심화_year_revenue - 융합_year_revenue
            return {
                '유형': ['신기술 훈련', '선도기업형 훈련', 'SSAFY', '재직자 훈련','대학주도형 훈련','심화 훈련','융합 훈련'],
                '매출액': [신기술_year_revenue / 100000000, leading_company_year_revenue / 100000000, ssafy_year_revenue / 100000000, 재직자_year_revenue / 100000000, 대학주도_year_revenue/ 100000000, 심화_year_revenue/ 100000000, 융합_year_revenue/ 100000000]
            }
        else:
            total_revenue = df[year_columns].sum().sum()
            leading_company_revenue = df[df['훈련유형'].str.contains('선도기업형 훈련', na=False)][year_columns].sum().sum()
            ssafy_revenue = df[df['과정명'].str.contains(r'\[삼성\] 청년 SW 아카데미', na=False)][year_columns].sum().sum()
            재직자_revenue = df[df['훈련유형'].str.contains('재직자 훈련', na=False)][year_columns].sum().sum()
            대학주도_revenue = df[df['훈련유형'].str.contains('대학주도형 훈련', na=False)][year_columns].sum().sum()
            심화_revenue = df[df['훈련유형'].str.contains('심화 훈련', na=False)][year_columns].sum().sum()
            융합_revenue = df[df['훈련유형'].str.contains('융합 훈련', na=False)][year_columns].sum().sum()
            신기술_revenue = total_revenue - leading_company_revenue - ssafy_revenue - 재직자_revenue - 대학주도_revenue - 심화_revenue - 융합_revenue
            return {
                '유형': ['신기술 훈련', '선도기업형 훈련', 'SSAFY', '재직자 훈련','대학주도형 훈련','심화 훈련','융합 훈련'],
                '매출액': [신기술_revenue / 100000000, leading_company_revenue / 100000000, ssafy_revenue / 100000000, 재직자_revenue / 100000000, 대학주도_revenue/ 100000000, 심화_revenue/ 100000000, 융합_revenue/ 100000000]
            }

    # 전체 매출 데이터 생성
    total_revenue_data = calculate_revenue_by_type(df)
    total_revenue_df = pd.DataFrame(total_revenue_data)

    # 매출 비중 시각화
    pie_chart = alt.Chart(total_revenue_df).mark_arc().encode(
        theta=alt.Theta(field="매출액", type="quantitative"),
        color=alt.Color(field="유형", type="nominal",
                         scale=alt.Scale(domain=['신기술 훈련', '선도기업형 훈련', 'SSAFY', '재직자 훈련','대학주도형 훈련','심화 훈련','융합 훈련'],
                                        range=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728','#9467bd','#8c564b','#e377c2'])),
        tooltip=['유형', alt.Tooltip('매출액', format=",.2f")]
    ).properties(
        title="전체 사업 유형별 매출 비중 (억 원)"
    )

    st.altair_chart(pie_chart, use_container_width=True)

    # 연도별 매출 데이터 생성
    yearly_data = {}
    for year in year_columns:
        yearly_revenue_data = calculate_revenue_by_type(df, year)
        yearly_data[year] = {item['유형']: item['매출액'] for item in  [{"유형": yearly_revenue_data['유형'][i] , "매출액": yearly_revenue_data['매출액'][i]} for i in range(len(yearly_revenue_data['유형']))] }

    yearly_revenue_df = pd.DataFrame(yearly_data).T.reset_index()
    yearly_revenue_df.rename(columns={'index': '연도'}, inplace=True)

    yearly_revenue_df_melted = yearly_revenue_df.melt(id_vars=['연도'], var_name='유형', value_name='매출액')

    # 막대 그래프 생성
    bar_chart = alt.Chart(yearly_revenue_df_melted).mark_bar().encode(
        x=alt.X('연도', title="연도", axis=alt.Axis(labelAngle=-45)), # x축 레이블 각도 조절
        y=alt.Y('매출액', title="매출액|n(억원)", axis=alt.Axis(format="~s", titleAngle=0)),  # y축 레이블 포맷 및 각도 조절
        color=alt.Color(field="유형", type="nominal",
                         scale=alt.Scale(domain=['신기술 훈련', '선도기업형 훈련', 'SSAFY', '재직자 훈련','대학주도형 훈련','심화 훈련','융합 훈련'],
                                        range=['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728','#9467bd','#8c564b','#e377c2'])),
         tooltip = ['연도','유형',alt.Tooltip('매출액', format=",.2f")]
    ).properties(
        title="연도별 사업 유형별 매출 비중",
        height=600  # 그래프 높이 조절
    )

    st.altair_chart(bar_chart, use_container_width=True)
def aggregate_ncs_data(df):
    """NCS별 데이터를 집계하여 랭킹 컴포넌트에 필요한 형식으로 변환"""
    if 'NCS명' not in df.columns or 'NCS코드' not in df.columns:
        print("Error: 'NCS명' 또는 'NCS코드' 컬럼이 DataFrame에 없습니다.")
        return None

    ncs_revenue = df.groupby(['NCS명', 'NCS코드']).agg({
        '누적매출': 'sum',
        '과정명': 'count',
        '과정시작일': 'min',
        '과정종료일': 'max'
    }).reset_index()

    year_columns = [str(col) for col in df.columns if re.match(r'^\d{4}년$', str(col))]

    # yearly_sums 계산 방식 수정
    yearly_sums = {}
    for year in year_columns:
        yearly_sums[year] = df.groupby(['NCS명', 'NCS코드'])[year].sum().to_dict()

    ranking_data = []
    for _, row in ncs_revenue.iterrows():
        yearly_revenues = {}
        for year in year_columns:
            key = (row['NCS명'], row['NCS코드'])
            if key in yearly_sums[year]:
                yearly_revenues[str(year)] = float(yearly_sums[year][key])
            else:
                yearly_revenues[str(year)] = 0.0

        ranking_data.append({
            "ncsName": f"{row['NCS명']} ({row['NCS코드']})",  # NCS명 (NCS코드) 형식
            "revenue": float(row['누적매출']),
            "courses": int(row['과정명']),
            "yearlyRevenue": yearly_revenues,
            "startDate": row['과정시작일'].strftime('%Y-%m'),
            "endDate": row['과정종료일'].strftime('%Y-%m')
        })

    return ranking_data

def create_ncs_ranking_component(df):
    """NCS별 랭킹 컴포넌트 생성"""
    ncs_ranking_data = aggregate_ncs_data(df)
    if ncs_ranking_data is None:
        st.error("NCS 랭킹 컴포넌트 생성에 실패했습니다. 'NCS명' 또는 'NCS코드' 컬럼이 DataFrame에 없습니다.")
        return None

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

            const calculateCourseRevenue = (course, selectedYear) => {
                if (selectedYear === 'all') {
                    return Object.values(course.yearlyRevenue).reduce((sum, val) => sum + val, 0);
                }
                return course.yearlyRevenue[selectedYear] || 0;
            };

            const getTop5Courses = (coursesData, selectedYear) => {
                // 과정명별로 매출과 만족도를 합산
                const aggregatedCourses = coursesData.reduce((acc, course) => {
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
                            weightedSatisfaction: course.satisfaction > 0 ? course.satisfaction * course.students : 0
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
                    .slice(0, 5);
            };

            const filteredAndSortedData = [...rankingData]
                .filter(item =>
                    item.ncsName.toLowerCase().includes(searchTerm.toLowerCase())
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
                        }}>NCS별 훈련현황</h1>
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
                                placeholder="NCS명 검색..."
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
                            return (
                                <div key={item.ncsName}
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
                                                {item.ncsName}
                                            </span>
                                        </div>
                                        <div>
                                        <span style={{ marginRight: '16px', color: '#4299e1' }}>
                                        {formatRevenue(revenue)}
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
    """ % json.dumps(ncs_ranking_data)

    if js_code is None:
        st.error("NCS 랭킹 컴포넌트 생성에 실패했습니다.")
        return

    js_code = f"""
        <div style="height: 800px; overflow-y: auto;">
            {js_code}
        </div>
    """
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

    url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/result_kdtdata_202503.csv?raw=true" # Define URL here
    df = load_data_from_github(url) # Use load_data_from_github
    if df.empty:
        return

    # 데이터 전처리
    df = preprocess_data(df)
    if df.empty:  # preprocess_data에서 '훈련기관' 컬럼이 없는 경우
      return

    print("Preprocessed DataFrame Columns:", df.columns)

    # 연도별 매출 계산 (전처리 후 수행)
    year_columns = [str(col) for col in df.columns if re.match(r'^\d{4}년$', str(col))]
    df, yearly_data = calculate_yearly_revenue(df)

    # 사이드바에서 분석 유형 선택
    analysis_type = st.sidebar.selectbox(
        "분석 유형 선택",
        ["훈련기관 분석", "과정 분석", "NCS 분석"]
    )

    st.markdown("""
        <style>
            .streamlit-dataframe th {
                writing-mode: horizontal;
            }
        </style>
    """, unsafe_allow_html=True)

    if analysis_type == "훈련기관 분석":
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
        html(js_code, height=800)

        # 선도기업 비중 및 SSAFY 사업 분류 시각화
        calculate_and_visualize_revenue(df)

        selected_institution = st.selectbox("훈련기관 선택", df['훈련기관'].unique(), key='selectbox')
        if selected_institution:
            st.subheader("훈련기관별 훈련 유형별 비중")
            total_courses = df.groupby(['훈련기관', '훈련연도']).size().reset_index(name='총 과정 수')
            type_courses = df.groupby(['훈련기관', '훈련연도', '훈련유형']).size().reset_index(name='유형별 과정 수')
            merged_df = pd.merge(total_courses, type_courses, on=['훈련기관', '훈련연도'], how='left')
            merged_df['유형별 과정 수'] = merged_df['유형별 과정 수'].fillna(0)
            merged_df['유형별 비중'] = merged_df['유형별 과정 수'] / merged_df['총 과정 수']
            st.dataframe(merged_df)
            analyze_training_institution(df, yearly_data, selected_institution)

        analyze_top5_institutions(df, yearly_data)

    elif analysis_type == "과정 분석":
        # KDT 훈련현황 및 매출 비중 표시 (선택 사항)
        # js_code = create_ranking_component(df, yearly_data)  # 필요하다면 주석 해제
        # if js_code:
        #     html(js_code, height=800)
        # calculate_and_visualize_revenue(df)

        analyze_course(df, yearly_data)
    else:
            ## KDT 훈련현황 및 매출 비중 표시 (선택 사항)
            js_code = create_ncs_ranking_component(df)
            if js_code:
                html(js_code, height=800)
            # calculate_and_visualize_revenue(df)

            # NCS명 입력 받기
            ncs_name = st.text_input("NCS명 검색")

            analyze_ncs(df, yearly_data, ncs_name)  # ncs_name 전달


if __name__ == "__main__":
    main()