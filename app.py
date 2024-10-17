import os
import pandas as pd  # Pandas를 최상단에 import
import streamlit as st
import matplotlib.pyplot as plt
import requests

# 필요 패키지 설치 (로컬 환경에서만 사용)
os.system('pip install matplotlib')

# Streamlit 앱 제목
st.title('KDT 매출분석')

# 데이터 로드 (GitHub의 raw 파일 URL 사용)
@st.cache_data
def load_data():
    url = "https://github.com/yulechestnuts/KDT_Dataset/blob/main/DATASET_PASTE.xlsx?raw=true"
    response = requests.get(url)

    if response.status_code == 200:
        with open("temp.xlsx", "wb") as f:
            f.write(response.content)

        df = pd.read_excel("temp.xlsx", engine="openpyxl")
        return df
    else:
        st.error(f"파일을 불러올 수 없습니다. 상태 코드: {response.status_code}")
        return pd.DataFrame()  # 빈 데이터프레임 반환

df = load_data()

# 컬럼명 공백 제거 및 '합계' 행 제거
df.columns = df.columns.str.strip()
df = df[df['기관명'] != '합계']

# 사이드바에 기업 선택 옵션 추가
st.sidebar.header("기업 선택")
selected_company = st.sidebar.selectbox("회사를 선택하세요", df['기관명'].unique())

# 선택된 기업의 데이터 필터링
filtered_data = df[df['기관명'] == selected_company]

if filtered_data.empty:
    st.error(f"{selected_company}에 해당하는 데이터가 없습니다.")
else:
    company_data = filtered_data.iloc[0]
    years = ['2021년', '2022년', '2023년', '2024년']
    sales = {year: company_data[year] // 100000000 for year in years}  # 억 원 단위로 변환

    total_sales = df[years].sum()
    market_share = {year: (company_data[year] / total_sales[year]) * 100 if total_sales[year] != 0 else 0 for year in years}
    ranks = {year: df[year].rank(ascending=False, method='min') for year in years}
    company_ranks = {year: int(ranks[year][company_data.name]) for year in years}

    # 매출 추이 시각화
    st.subheader(f"{selected_company}의 매출 추이")
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(list(sales.keys()), list(sales.values()), marker='o', linestyle='-', color='royalblue')
    ax.set_xlabel('연도')
    ax.set_ylabel('매출 (억 원)')
    ax.set_title(f"{selected_company} 연도별 매출")
    st.pyplot(fig)

    # 상세 정보 출력
    st.subheader("상세 정보")
    for year in years:
        st.write(f"{year}의 매출은 {sales[year]}억 원, 시장 점유율 {market_share[year]:.2f}%, 순위 {company_ranks[year]}위")

    # 누적 시장 점유율 및 순위 계산
    total_company_sales = sum(company_data[years])
    total_market_sales = sum(total_sales)
    cumulative_market_share = (total_company_sales / total_market_sales) * 100 if total_market_sales != 0 else 0

    df['누적매출'] = df[years].sum(axis=1)
    cumulative_rank = df['누적매출'].rank(ascending=False, method='min')[company_data.name]

    st.write(f"2021년부터 2024년까지의 누적 시장 점유율은 {cumulative_market_share:.2f}%이며, 누적 매출 기준 순위는 {int(cumulative_rank)}위입니다.")

    # 연도별 순위 변화 시각화
    st.subheader("연도별 순위 변화")
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(years, [company_ranks[year] for year in years], marker='o', linestyle='-', color='green')
    ax.set_xlabel('연도')
    ax.set_ylabel('순위')
    ax.set_title(f"{selected_company} 연도별 순위 변화")
    ax.invert_yaxis()

    max_rank = max(company_ranks.values())
    min_rank = min(company_ranks.values())
    ax.set_ylim(max_rank + 1, max(0, min_rank - 1))
    ax.set_yticks(range(max(1, min_rank - 1), max_rank + 2))
    ax.yaxis.set_major_locator(plt.MaxNLocator(integer=True))
    st.pyplot(fig)
