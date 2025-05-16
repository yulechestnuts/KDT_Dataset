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
from utils.data import calculate_yearly_revenue
from utils.institution_grouping import group_institutions_advanced
from utils.training_type_classification import classify_training_type
from visualization.reports import analyze_training_institution, analyze_course, analyze_ncs, analyze_top5_institutions
from visualization.charts import create_monthly_revenue_chart, create_monthly_revenue_summary_chart

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
                    year: float(row[year]) if pd.notna(row[year]) else 0
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
                    .slice(0, 5);
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
                        }}>2025년 3월 31일 기준 개설된 과정 기준</p>

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
                                            <h3 style={{color: '#4299e1', marginBottom: '12px'}}>Top 5 과정</h3>
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
                revenue = row['누적매출'] * 10  # 실제 금액(10배)으로 표시
                satisfaction = row['만족도']
                
                # 매출액 포맷팅 (10억 단위)
                revenue_billions = revenue / 1000000000
                
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
                        {revenue_billions:.1f}억원
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
            
            # 선택된 훈련기관 데이터
            selected_data = filtered_df[filtered_df['훈련기관'] == selected_institution]
            
            # 연도별 데이터 준비
            year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}년$', col)]
            
            # 연도별 매출 계산
            yearly_revenue = {}
            yearly_leading = {}
            yearly_normal = {}
            
            for year in year_columns:
                year_data = selected_data[selected_data['훈련연도'] == int(year[:4])]
                leading_data = year_data[year_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
                normal_data = year_data[~year_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
                
                yearly_revenue[year] = year_data[year].sum()
                yearly_leading[year] = leading_data[year].sum()
                yearly_normal[year] = normal_data[year].sum()
            
            # 매출 정보 표시
            col1, col2, col3 = st.columns(3)
            with col1:
                total_revenue = sum(yearly_revenue.values())
                st.metric("총 매출", format_revenue(total_revenue))
            with col2:
                total_leading = sum(yearly_leading.values())
                st.metric("선도기업형 매출", format_revenue(total_leading))
            with col3:
                total_normal = sum(yearly_normal.values())
                st.metric("일반KDT 매출", format_revenue(total_normal))
            
            # 연도별 매출 추이 차트
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
                yaxis_tickformat=',.0f',
                xaxis_type='category'
            )
            st.plotly_chart(fig, use_container_width=True)
            
            # 비교 기관이 있는 경우 비교 차트 표시
            if compare_institution:
                compare_data = filtered_df[filtered_df['훈련기관'] == compare_institution]
                
                # 비교 기관의 연도별 매출 계산
                compare_yearly_revenue = {}
                compare_yearly_leading = {}
                compare_yearly_normal = {}
                
                for year in year_columns:
                    year_data = compare_data[compare_data['훈련연도'] == int(year[:4])]
                    leading_data = year_data[year_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
                    normal_data = year_data[~year_data['훈련유형'].str.contains('선도기업형 훈련', na=False)]
                    
                    compare_yearly_revenue[year] = year_data[year].sum()
                    compare_yearly_leading[year] = leading_data[year].sum() * 0.1
                    compare_yearly_normal[year] = normal_data[year].sum()
                
                # 비교 차트 데이터 준비
                comparison_data = pd.DataFrame({
                    '연도': [year[:4] for year in year_columns],
                    '훈련기관': [selected_institution] * len(year_columns) + [compare_institution] * len(year_columns),
                    '총매출': [yearly_revenue[year] for year in year_columns] + [compare_yearly_revenue[year] for year in year_columns],
                    '선도기업형': [yearly_leading[year] for year in year_columns] + [compare_yearly_leading[year] for year in year_columns],
                    '일반KDT': [yearly_normal[year] for year in year_columns] + [compare_yearly_normal[year] for year in year_columns]
                })
                
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
                    yaxis_tickformat=',.0f',
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

def apply_adjusted_revenue(df, override_date=None):
    """
    수료율을 기반으로 매출액을 조정하는 함수
    최신 데이터에 대응하도록 현재 날짜를 명시적으로 설정
    
    Args:
        df: 원본 데이터프레임
        override_date: 현재 날짜를 덮어쓰는 값 (None이면 시스템 현재 날짜 사용)
    
    Returns:
        수료율 조정된 매출액이 추가된 데이터프레임
    """
    import pandas as pd
    
    # 데이터 복사
    df_adjusted = df.copy()
    
    # 현재 날짜 설정 - 명시적으로 설정하거나 시스템 현재 날짜 사용
    if override_date is not None:
        current_date = pd.Timestamp(override_date)
    else:
        current_date = pd.Timestamp.now()
        
    # 로깅을 통해 사용된 날짜 확인
    print(f"수료율 조정에 사용된 현재 날짜: {current_date}")
    
    # 과정 시작일/종료일을 datetime으로 변환
    df_adjusted['과정시작일'] = pd.to_datetime(df_adjusted['과정시작일'])
    df_adjusted['과정종료일'] = pd.to_datetime(df_adjusted['과정종료일'])
    
    # 통합 수료율 계산 (전체 수료인원 / 전체 수강신청 인원)
    total_enrollment = df_adjusted['수강신청 인원'].sum()
    total_completion = df_adjusted['수료인원'].sum()
    overall_completion_rate = total_completion / total_enrollment if total_enrollment > 0 else 0
    
    # 조정된 매출액 계산
    df_adjusted['조정_누적매출'] = df_adjusted.apply(
        lambda row: calculate_adjusted_revenue(row, current_date, overall_completion_rate),
        axis=1
    )
    
    # 연도별 매출액도 조정
    year_columns = [col for col in df_adjusted.columns if isinstance(col, str) and col.endswith('년')]
    for year_col in year_columns:
        df_adjusted[f'조정_{year_col}'] = df_adjusted.apply(
            lambda row: adjust_yearly_revenue(row, year_col, current_date, overall_completion_rate),
            axis=1
        )
    
    return df_adjusted

def calculate_adjusted_revenue(row, current_date, overall_completion_rate):
    """
    개별 과정의 수료율 기반 매출액 조정 계산
    
    Args:
        row: 데이터프레임의 행
        current_date: 현재 날짜
        overall_completion_rate: 전체 수료율
    
    Returns:
        조정된 매출액
    """
    import numpy as np
    
    # 누적매출이 없으면 0 반환
    if pd.isna(row['누적매출']) or row['누적매출'] == 0:
        return 0
    
    # 과정이 아직 시작되지 않았으면 원래 매출액 유지
    if row['과정시작일'] > current_date:
        return row['누적매출']
    
    # 수강신청 인원이 없으면 원래 매출액 유지
    if pd.isna(row['수강신청 인원']) or row['수강신청 인원'] == 0:
        return row['누적매출']
    
    # 실제 완료율 계산 (과정이 완료된 경우)
    if row['과정종료일'] <= current_date:
        actual_completion_rate = row['수료인원'] / row['수강신청 인원'] if row['수강신청 인원'] > 0 else 0
    else:
        # 과정이 진행 중인 경우 - 경과 비율에 따라 계산
        total_duration = (row['과정종료일'] - row['과정시작일']).days
        elapsed_duration = (current_date - row['과정시작일']).days
        progress_ratio = min(max(elapsed_duration / total_duration if total_duration > 0 else 0, 0), 1)
        
        # 진행 비율에 따른 예상 수료율 계산 (단순 선형 비례)
        if pd.notna(row['수료인원']) and row['수료인원'] > 0:
            # 이미 수료자가 있는 경우 해당 수료율 사용
            actual_completion_rate = row['수료인원'] / row['수강신청 인원']
        else:
            # 수료자가 없는 경우 통합 수료율 기준으로 예상
            actual_completion_rate = overall_completion_rate * progress_ratio
    
    # 예상 수료율 기준으로 매출 조정
    # 기본 전제: 원래 매출은 수강신청인원의 80%를 기준으로 계산됨
    base_completion_rate = 0.8
    
    # 수료율 기반 조정 계수 계산 
    # (실제 수료율 / 기본 수료율 80%)
    adjustment_factor = actual_completion_rate / base_completion_rate
    
    # 수료율이 전체 평균보다 높은 경우 가중치 부여
    if actual_completion_rate > overall_completion_rate:
        # 초과 비율에 대한 추가 가중치 (최대 20% 추가)
        bonus_factor = 1 + min((actual_completion_rate - overall_completion_rate) / overall_completion_rate, 0.2)
        adjustment_factor *= bonus_factor
    
    # 조정 계수 범위 제한 (기존 매출의 90%~120%)
    adjustment_factor = min(max(adjustment_factor, 0.9), 1.2)
    
    # 조정된 매출액 계산
    adjusted_revenue = row['누적매출'] * adjustment_factor
    
    return adjusted_revenue

def create_monthly_revenue_chart_adjusted(df, institution=None, override_date=None):
    """
    수료율 조정된 월별 매출 흐름 차트 생성 - 기관별 필터링 가능
    
    Args:
        df: 데이터프레임
        institution: 훈련기관명 (None이면 전체)
        override_date: 현재 날짜를 덮어쓰는 값 (None이면 시스템 현재 날짜 사용)
    """
    import pandas as pd
    import altair as alt
    
    # 현재 날짜 설정 - 명시적으로 설정하거나 시스템 현재 날짜 사용
    if override_date is not None:
        current_date = pd.Timestamp(override_date)
    else:
        current_date = pd.Timestamp.now()
        
    # 로깅을 통해 사용된 날짜 확인
    print(f"월별 차트 생성에 사용된 현재 날짜: {current_date}")
    
    # 데이터 복사 및 수료율 기반 매출액 조정 적용
    df_monthly = apply_adjusted_revenue(df, current_date)
    
    # 수치형 컬럼 float 타입으로 변환
    numeric_cols = ['누적매출', '조정_누적매출', '수강신청 인원', '수료인원']
    for col in numeric_cols:
        if col in df_monthly.columns and pd.api.types.is_integer_dtype(df_monthly[col]):
            df_monthly[col] = df_monthly[col].astype(float)
    
    # 기관별 필터링
    if institution:
        df_monthly = df_monthly[df_monthly['훈련기관'] == institution]
    
    # 시작일을 월 단위로 변환
    df_monthly['월'] = pd.to_datetime(df_monthly['과정시작일']).dt.to_period('M').astype(str)
    
    # 월별 매출, 수강생 수 집계
    monthly_data = df_monthly.groupby('월').agg({
        '누적매출': 'sum',
        '조정_누적매출': 'sum',
        '수강신청 인원': 'sum',
        '수료인원': 'sum'
    }).reset_index()
    
    # 실제 금액(10배)으로 변환
    monthly_data['매출(억)'] = monthly_data['누적매출'] * 10 / 100000000
    monthly_data['조정_매출(억)'] = monthly_data['조정_누적매출'] * 10 / 100000000
    
    # 월 정렬을 위해 datetime으로 변환
    monthly_data['날짜'] = pd.to_datetime(monthly_data['월'] + '-01')
    monthly_data = monthly_data.sort_values('날짜')
    
    # 빈 데이터 처리
    if len(monthly_data) == 0:
        # 빈 차트 반환
        return alt.Chart().mark_text(
            text="데이터가 없습니다.",
            fontSize=20
        ).properties(
            width=800,
            height=400,
            title=f"{institution or '전체'} 월별 매출 및 수강생 추이 (수료율 조정)"
        )
    
    # 이중 축 차트 생성 - Y축 레이블 수평으로 변경
    base = alt.Chart(monthly_data).encode(
        x=alt.X('월:N', sort=None, axis=alt.Axis(labelAngle=-45, title='월'))
    )
    
    # 기존 매출 라인 (점선)
    line1 = base.mark_line(
        stroke='#4299e1', 
        point=True,
        strokeDash=[5, 5],
        opacity=0.6
    ).encode(
        y=alt.Y('매출(억):Q', axis=alt.Axis(title='매출액 (억원)', titleColor='#4299e1', labelAngle=0)),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('매출(억):Q', title='기존 매출액 (억원)', format='.2f'),
        ]
    )
    
    # 수료율 조정 매출 라인 (실선)
    line2 = base.mark_line(
        stroke='#48BB78',
        point=True,
        strokeWidth=3
    ).encode(
        y=alt.Y('조정_매출(억):Q', axis=alt.Axis(title='매출액 (억원)', titleColor='#4299e1', labelAngle=0)),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('조정_매출(억):Q', title='수료율 조정 매출액 (억원)', format='.2f'),
        ]
    )
    
    # 수강신청 인원 바 차트
    bar = base.mark_bar(color='#f6ad55', opacity=0.5).encode(
        y=alt.Y('수강신청 인원:Q', axis=alt.Axis(title='수강신청 인원', titleColor='#f6ad55', labelAngle=0)),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('수강신청 인원:Q', title='수강신청 인원', format=',d'),
            alt.Tooltip('수료인원:Q', title='수료인원', format=',d')
        ]
    )
    
    # 레이어 결합
    chart = alt.layer(bar, line1, line2).resolve_scale(
        y='independent'
    ).properties(
        width=800,
        height=400,
        title=f"{institution or '전체'} 월별 매출 및 수강생 추이 (수료율 조정, 현재 날짜: {current_date.strftime('%Y-%m-%d')})"
    )
    
    return chart

def create_monthly_only_revenue_chart(df, institution=None):
    """월별로만 집계한 매출 흐름 차트 생성 (연도 구분 없이)"""
    # 데이터 복사
    df_monthly = df.copy()
    
    # 수치형 컬럼 float 타입으로 변환
    numeric_cols = ['누적매출', '수강신청 인원', '수료인원']
    for col in numeric_cols:
        if col in df_monthly.columns and df_monthly[col].dtype.name == 'Int64':
            df_monthly[col] = df_monthly[col].astype(float)
    
    # 기관별 필터링
    if institution:
        df_monthly = df_monthly[df_monthly['훈련기관'] == institution]
    
    # 시작일을 월 단위로 변환 (날짜에서 월만 추출)
    df_monthly['월'] = pd.to_datetime(df_monthly['과정시작일']).dt.month.astype(str) + '월'
    
    # 월별 매출, 수강생 수 집계
    monthly_data = df_monthly.groupby('월').agg({
        '누적매출': 'sum',
        '수강신청 인원': 'sum',
        '수료인원': 'sum'
    }).reset_index()
    
    # 실제 금액(10배)으로 변환
    monthly_data['매출(억)'] = monthly_data['누적매출'] * 10 / 100000000
    
    # 월 정렬
    month_order = {'1월': 1, '2월': 2, '3월': 3, '4월': 4, '5월': 5, '6월': 6, 
                   '7월': 7, '8월': 8, '9월': 9, '10월': 10, '11월': 11, '12월': 12}
    monthly_data['월_정렬'] = monthly_data['월'].map(month_order)
    monthly_data = monthly_data.sort_values('월_정렬')
    
    # 빈 데이터 처리
    if len(monthly_data) == 0:
        # 빈 차트 반환
        import streamlit as st
        return alt.Chart().mark_text(
            text="데이터가 없습니다.",
            fontSize=20
        ).properties(
            width=800,
            height=400,
            title=f"{institution or '전체'} 월별 매출 및 수강생 추이 (연도 통합)"
        )
    
    # 이중 축 차트 생성 - Y축 레이블 수평으로 변경
    base = alt.Chart(monthly_data).encode(
        x=alt.X('월:N', sort=list(month_order.keys()), axis=alt.Axis(title='월'))
    )
    
    line = base.mark_line(stroke='#4299e1', point=True).encode(
        y=alt.Y('매출(억):Q', axis=alt.Axis(title='매출액 (억원)', titleColor='#4299e1', labelAngle=0)),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('매출(억):Q', title='매출액 (억원)', format='.2f'),
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
    
    chart = alt.layer(line, bar).resolve_scale(
        y='independent'
    ).properties(
        width=800,
        height=400,
        title=f"{institution or '전체'} 월별 매출 및 수강생 추이 (연도 통합)"
    )
    
    return chart

def create_monthly_revenue_chart(df, institution=None):
    """월별 매출 흐름 차트 생성 - 기관별 필터링 가능"""
    # 데이터 복사
    df_monthly = df.copy()
    
    # 수치형 컬럼 float 타입으로 변환
    numeric_cols = ['누적매출', '수강신청 인원', '수료인원']
    for col in numeric_cols:
        if col in df_monthly.columns and df_monthly[col].dtype.name == 'Int64':
            df_monthly[col] = df_monthly[col].astype(float)
    
    # 기관별 필터링
    if institution:
        df_monthly = df_monthly[df_monthly['훈련기관'] == institution]
    
    # 시작일을 월 단위로 변환
    df_monthly['월'] = pd.to_datetime(df_monthly['과정시작일']).dt.to_period('M').astype(str)
    
    # 월별 매출, 수강생 수 집계
    monthly_data = df_monthly.groupby('월').agg({
        '누적매출': 'sum',
        '수강신청 인원': 'sum',
        '수료인원': 'sum'
    }).reset_index()
    
    # 실제 금액(10배)으로 변환
    monthly_data['매출(억)'] = monthly_data['누적매출'] * 10 / 100000000
    
    # 월 정렬을 위해 datetime으로 변환
    monthly_data['날짜'] = pd.to_datetime(monthly_data['월'] + '-01')
    monthly_data = monthly_data.sort_values('날짜')
    
    # 빈 데이터 처리
    if len(monthly_data) == 0:
        # 빈 차트 반환
        return alt.Chart().mark_text(
            text="데이터가 없습니다.",
            fontSize=20
        ).properties(
            width=800,
            height=400,
            title=f"{institution or '전체'} 월별 매출 및 수강생 추이"
        )
    
    # 이중 축 차트 생성 - Y축 레이블 수평으로 변경
    base = alt.Chart(monthly_data).encode(
        x=alt.X('월:N', sort=None, axis=alt.Axis(labelAngle=-45, title='월'))
    )
    
    line = base.mark_line(stroke='#4299e1', point=True).encode(
        y=alt.Y('매출(억):Q', axis=alt.Axis(title='매출액 (억원)', titleColor='#4299e1', labelAngle=0)),
        tooltip=[
            alt.Tooltip('월:N', title='월'),
            alt.Tooltip('매출(억):Q', title='매출액 (억원)', format='.2f'),
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
    
    chart = alt.layer(line, bar).resolve_scale(
        y='independent'
    ).properties(
        width=800,
        height=400,
        title=f"{institution or '전체'} 월별 매출 및 수강생 추이"
    )
    
    return chart

def adjust_yearly_revenue(row, year_col, current_date, overall_completion_rate):
    """
    연도별 매출액 조정
    
    Args:
        row: 데이터프레임의 행
        year_col: 연도 컬럼명 (예: '2023년')
        current_date: 현재 날짜
        overall_completion_rate: 전체 수료율
    
    Returns:
        조정된 연도별 매출액
    """
    # 해당 연도 매출이 없으면 0 반환
    if pd.isna(row[year_col]) or row[year_col] == 0:
        return 0
    
    # 과정이 아직 시작되지 않았으면 원래 매출액 유지
    if row['과정시작일'] > current_date:
        return row[year_col]
    
    # 수강신청 인원이 없으면 원래 매출액 유지
    if pd.isna(row['수강신청 인원']) or row['수강신청 인원'] == 0:
        return row[year_col]
    
    # 실제 완료율 계산 (과정이 완료된 경우)
    if row['과정종료일'] <= current_date:
        actual_completion_rate = row['수료인원'] / row['수강신청 인원'] if row['수강신청 인원'] > 0 else 0
    else:
        # 과정이 진행 중인 경우 - 경과 비율에 따라 계산
        total_duration = (row['과정종료일'] - row['과정시작일']).days
        elapsed_duration = (current_date - row['과정시작일']).days
        progress_ratio = min(max(elapsed_duration / total_duration if total_duration > 0 else 0, 0), 1)
        
        # 진행 비율에 따른 예상 수료율 계산
        if pd.notna(row['수료인원']) and row['수료인원'] > 0:
            # 이미 수료자가 있는 경우 해당 수료율 사용
            actual_completion_rate = row['수료인원'] / row['수강신청 인원']
        else:
            # 수료자가 없는 경우 통합 수료율 기준으로 예상
            actual_completion_rate = overall_completion_rate * progress_ratio
    
    # 예상 수료율 기준으로 매출 조정
    # 기본 전제: 원래 매출은 수강신청인원의 80%를 기준으로 계산됨
    base_completion_rate = 0.8
    
    # 수료율 기반 조정 계수 계산
    adjustment_factor = actual_completion_rate / base_completion_rate
    
    # 수료율이 전체 평균보다 높은 경우 가중치 부여
    if actual_completion_rate > overall_completion_rate:
        # 초과 비율에 대한 추가 가중치 (최대 20% 추가)
        bonus_factor = 1 + min((actual_completion_rate - overall_completion_rate) / overall_completion_rate, 0.2)
        adjustment_factor *= bonus_factor
    
    # 조정 계수 범위 제한 (기존 매출의 90%~120%)
    adjustment_factor = min(max(adjustment_factor, 0.9), 1.2)
    
    # 조정된 매출액 계산
    adjusted_revenue = row[year_col] * adjustment_factor
    
    return adjusted_revenue

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
        url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/result_kdtdata_202504.csv?raw=true" # Define URL here
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
        analysis_type = st.sidebar.selectbox(
            "분석 유형 선택",
            ["훈련기관 분석", "과정 분석", "NCS 분석", "월별 매출 분석"]
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
            html(js_code, height=800)

            # 선도기업 비중 및 SSAFY 사업 분류 시각화
            calculate_and_visualize_revenue(df)

            visualize_by_institutions(df)

            analyze_top5_institutions(df, yearly_data)
            
            # 원래 df로 복구 (다른 분석 페이지를 위해)
            if use_adjusted_revenue:
                df = original_df.copy()

        elif analysis_type == "과정 분석":
            # 매출 계산 방식 안내
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
                original_df = df.copy()
                df['누적매출'] = adjusted_df['조정_누적매출']
                
                # 연도별 매출 컬럼도 업데이트
                year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}년$', col)]
                for year in year_columns:
                    if f'조정_{year}' in adjusted_df.columns:
                        df[year] = adjusted_df[f'조정_{year}']
                
                # 연도별 매출 재계산
                df, yearly_data = calculate_yearly_revenue(df)

            analyze_course(df, yearly_data)
            
            # 원래 df로 복구
            if use_adjusted_revenue:
                df = original_df.copy()

        elif analysis_type == "NCS 분석":
            # 매출 계산 방식 안내
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
            original_df = df.copy()
            df['누적매출'] = adjusted_df['조정_누적매출']
            
            # 연도별 매출 컬럼도 업데이트
            year_columns = [col for col in df.columns if isinstance(col, str) and re.match(r'20\d{2}년$', col)]
            for year in year_columns:
                if f'조정_{year}' in adjusted_df.columns:
                    df[year] = adjusted_df[f'조정_{year}']
            
            # 연도별 매출 재계산
            df, yearly_data = calculate_yearly_revenue(df)
            
            # NCS 랭킹 컴포넌트 생성 및 표시
            js_code = create_ncs_ranking_component(df)
            if js_code:
                html(js_code, height=800)
            # calculate_and_visualize_revenue(df)

            # NCS명 입력 받기
            ncs_name = st.text_input("NCS명 검색")

            analyze_ncs(df, yearly_data, ncs_name)  # ncs_name 전달
            
            # 원래 df로 복구
            if use_adjusted_revenue:
                df = original_df.copy()

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
                    monthly_adjusted_data['조정_매출(억)'] = monthly_adjusted_data['조정_누적매출'] * 10 / 100000000
                    
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
                        month_df = temp_df[pd.to_datetime(temp_df['과정시작일']).dt.to_period('M').astype(str) == month]
                        
                        if not month_df.empty:
                            adjusted_month_df = apply_adjusted_revenue(month_df, current_date)
                            adjusted_sum = adjusted_month_df['조정_누적매출'].sum() * 10 / 100000000
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
                                '매출(억)': row['매출(억)'] * 10,
                                '수강신청 인원': row['수강신청 인원'],
                                '수료인원': row['수료인원'],
                                '과정수': row['과정수']
                            })
                    
                    monthly_display = pd.DataFrame(monthly_adjusted)
                else:
                    # 기존 방식 - 단순 10배
                    monthly_data['매출(억)'] = monthly_data['매출(억)'] * 10
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
                            monthly_inst_data['조정_매출(억)'] = monthly_inst_data['조정_누적매출'] * 10 / 100000000
                            
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
                        adjusted_revenue = adjusted_inst_data['조정_누적매출'].sum() * 10 / 100000000
                    
                    # 기본 통계
                    col1, col2, col3, col4 = st.columns(4)
                    with col1:
                        st.metric("총 과정수", f"{len(inst_data)}개")
                    with col2:
                        if use_adjusted_revenue and adjusted_revenue is not None:
                            original_rev = orig_inst_data['누적매출'].sum() * 10 / 100000000
                            st.metric(
                                "총 매출액 (조정)", 
                                f"{adjusted_revenue:.1f}억원",
                                delta=f"{adjusted_revenue - original_rev:.1f}억원"
                            )
                        else:
                            st.metric("총 매출액", f"{inst_data['누적매출'].sum() * 10 / 100000000:.1f}억원")
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
                        display_df['매출(억)'] = display_df['누적매출'] * 10 / 100000000
                        display_df['조정_매출(억)'] = display_df['조정_누적매출'] * 10 / 100000000
                        
                        # 표시할 컬럼 선택
                        st.dataframe(
                            display_df[['과정명', '과정시작일', '과정종료일', '수강신청 인원', '수료인원', '매출(억)', '조정_매출(억)']].sort_values('과정시작일', ascending=False),
                            use_container_width=True
                        )
                    else:
                        # 기존 표시
                        display_df = inst_data[['과정명', '과정시작일', '과정종료일', '수강신청 인원', '수료인원', '누적매출']].copy()
                        display_df['매출(억)'] = display_df['누적매출'] * 10 / 100000000
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
                html(js_code, height=800)
            # calculate_and_visualize_revenue(df)

            # NCS명 입력 받기
            ncs_name = st.text_input("NCS명 검색")

            analyze_ncs(df, yearly_data, ncs_name)  # ncs_name 전달
    except Exception as e:
        st.error(f"애플리케이션 실행 중 오류가 발생했습니다: {e}")
        import traceback
        st.error(traceback.format_exc())

if __name__ == "__main__":
    main()