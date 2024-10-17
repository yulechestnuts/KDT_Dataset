import os
import pandas as pd
import streamlit as st
import matplotlib.pyplot as plt
import requests
import matplotlib.font_manager as fm

# 페이지 설정 - 더 좁은 레이아웃
st.set_page_config(
    page_title='KDT 매출분석',
    layout='centered',  # 'wide' 대신 'centered' 사용
    initial_sidebar_state='expanded'
)

# 한글 폰트 설정
plt.rcParams['font.family'] = 'Malgun Gothic'
plt.rcParams['axes.unicode_minus'] = False

# CSS로 전체적인 너비 조정
st.markdown("""
    <style>
        .main > div {
            max-width: 1000px;
            padding: 1rem 2rem;
        }
        .stPlot {
            width: 100%;
            max-width: 800px;
        }
        .st-emotion-cache-1r6slb0 {
            max-width: 800px;
        }
    </style>
""", unsafe_allow_html=True)

st.title('KDT 매출분석')

# 데이터 로드
@st.cache_data
def load_data():
    try:
        url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/DATASET_PASTE.xlsx?raw=true"
        response = requests.get(url)
        
        if response.status_code == 200:
            with open("temp.xlsx", "wb") as f:
                f.write(response.content)
            
            df = pd.read_excel("temp.xlsx", engine="openpyxl")
            os.remove("temp.xlsx")  # 임시 파일 삭제
            return df
    except Exception as e:
        st.error(f"데이터 로드 중 오류가 발생했습니다: {str(e)}")
        return pd.DataFrame()

df = load_data()

if df.empty:
    st.error("데이터를 불러올 수 없습니다.")
    st.stop()

# 데이터 전처리
df.columns = df.columns.str.strip()
df = df[df['기관명'] != '합계']

# 사이드바 설정
with st.sidebar:
    st.header("기업 선택")
    selected_company = st.selectbox("회사를 선택하세요", df['기관명'].unique())

# 메인 컨텐츠
filtered_data = df[df['기관명'] == selected_company]

if filtered_data.empty:
    st.error(f"{selected_company}에 해당하는 데이터가 없습니다.")
else:
    company_data = filtered_data.iloc[0]
    years = ['2021년', '2022년', '2023년', '2024년']
    sales = {year: company_data[year] // 100000000 for year in years}

    total_sales = df[years].sum()
    market_share = {year: (company_data[year] / total_sales[year]) * 100 if total_sales[year] != 0 else 0 for year in years}
    ranks = {year: df[year].rank(ascending=False, method='min') for year in years}
    company_ranks = {year: int(ranks[year][company_data.name]) for year in years}

    # 매출 추이 그래프
    fig, ax = plt.subplots(figsize=(8, 5))  # 그래프 크기 축소
    plt.rcParams['figure.dpi'] = 200  # DPI 조정
    
    ax.plot(list(sales.keys()), list(sales.values()), marker='o', linestyle='-', color='royalblue')
    ax.set_xlabel('연도')
    ax.set_ylabel('매출 (억 원)')
    ax.set_title(f"{selected_company} 연도별 매출")
    ax.grid(True, linestyle='--', alpha=0.7)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    
    # 컨테이너를 사용하여 그래프 크기 제한
    with st.container():
        st.subheader(f"{selected_company}의 매출 추이")
        st.pyplot(fig)
    plt.close()

    # 상세 정보를 컴팩트하게 표시
    st.subheader("상세 정보")
    cols = st.columns(2)
    for i, year in enumerate(years):
        with cols[i % 2]:
            st.write(f"**{year}**")
            st.write(f"매출: {sales[year]:,}억 원")
            st.write(f"시장점유율: {market_share[year]:.2f}%")
            st.write(f"순위: {company_ranks[year]}위")
            st.write("---")

    # 누적 데이터 계산
    total_company_sales = sum(company_data[years])
    total_market_sales = sum(total_sales)
    cumulative_market_share = (total_company_sales / total_market_sales) * 100 if total_market_sales != 0 else 0
    df['누적매출'] = df[years].sum(axis=1)
    cumulative_rank = df['누적매출'].rank(ascending=False, method='min')[company_data.name]

    # 순위 변화 그래프
    fig2, ax2 = plt.subplots(figsize=(8, 5))  # 그래프 크기 축소
    
    ax2.plot(years, [company_ranks[year] for year in years], marker='o', linestyle='-', color='green')
    ax2.set_xlabel('연도')
    ax2.set_ylabel('순위')
    ax2.set_title(f"{selected_company} 연도별 순위 변화")
    ax2.invert_yaxis()
    ax2.grid(True, linestyle='--', alpha=0.7)
    ax2.spines['top'].set_visible(False)
    ax2.spines['right'].set_visible(False)

    max_rank = max(company_ranks.values())
    min_rank = min(company_ranks.values())
    ax2.set_ylim(max_rank + 1, max(0, min_rank - 1))
    ax2.set_yticks(range(max(1, min_rank - 1), max_rank + 2))
    
    with st.container():
        st.subheader("연도별 순위 변화")
        st.pyplot(fig2)
    plt.close()

    # 누적 정보 표시
    st.write("---")
    st.write(f"**누적 통계 (2021-2024)**")
    st.write(f"• 누적 시장 점유율: {cumulative_market_share:.2f}%")
    st.write(f"• 누적 매출 기준 순위: {int(cumulative_rank)}위")