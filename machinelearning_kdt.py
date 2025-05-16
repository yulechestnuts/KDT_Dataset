import pandas as pd
import plotly.express as px
from datetime import datetime

# 데이터 로딩 및 전처리 (2025년까지만 고려)
def load_and_preprocess_data(filepath):

    try:
        df = pd.read_csv(filepath, encoding='utf-8')
    except UnicodeDecodeError:  # 만약 utf-8이 아닌 다른 인코딩으로 되어 있다면
        df = pd.read_csv(filepath, encoding='cp949')  # 또는 'euc-kr' 등 적절한 인코딩


    # 2025년 매출 3배 처리 (2026년은 제외)
    if '2025년' in df.columns:
        if df["2025년"].dtype == object: # object 타입인 경우 숫자로 변환
            df["2025년"] = pd.to_numeric(df["2025년"].astype(str).str.replace(",",""), errors='coerce')
            df["2025년"] = df["2025년"].fillna(0)  # 혹시 모를 누락값 0으로 처리
        df["2025년"] = df["2025년"] * 3

    # '과정시작일' 컬럼을 datetime 객체로 변환 (오류 처리 포함)
    try:
        df['과정시작일'] = pd.to_datetime(df['과정시작일'], errors='coerce')
    except Exception as e:
        print(f"Error converting '과정시작일' to datetime: {e}")
        return None

    # 수강신청 인원, 수료인원 숫자형 변환 (오류 처리 포함)
    if df['수강신청 인원'].dtype == object:
        df['수강신청 인원'] = pd.to_numeric(df['수강신청 인원'].astype(str).str.replace(",",""), errors='coerce')
    if df['수료인원'].dtype == object:
        df['수료인원'] = pd.to_numeric(df['수료인원'].astype(str).str.replace(",",""), errors='coerce')
    
    if df['누적매출'].dtype == object:
        df['누적매출'] = pd.to_numeric(df['누적매출'].astype(str).str.replace(",",""), errors='coerce')
    # 누락값 0으로 처리 (다른 값으로 채워도 됩니다)
    df.fillna(0, inplace=True)
    
    df['수강신청 인원'] = df['수강신청 인원'].astype(int)
    df['수료인원'] = df['수료인원'].astype(int)
    df['누적매출'] = df['누적매출'].astype(int)

    return df


# --- 시각화 함수 ---
def visualize_data(df):
    # 연도와 월 추출
    df['연도'] = df['과정시작일'].dt.year
    df['월'] = df['과정시작일'].dt.month
    
    # 그룹핑 및 집계
    # 2025년 매출은 3배를 했기 때문에 원래 값으로 다시 나눠줍니다.
    grouped = df.groupby(['훈련기관', '연도', '월']).agg({'수강신청 인원': 'sum', '누적매출': 'sum', "수료인원": 'sum'}).reset_index()
    grouped.loc[grouped['연도']==2025, "누적매출"] = grouped.loc[grouped['연도']==2025, "누적매출"] / 3  # 원래 매출 값으로 표시

    # --- Plotly를 사용한 시각화 ---

    # 훈련기관별 연도별 월별 수강생 추이
    fig_students = px.line(grouped, x='월', y='수강신청 인원', color='훈련기관', 
                         facet_col='연도', title='훈련기관별 연도별 월별 수강생 추이')
    fig_students.update_xaxes(type='category', tickvals=list(range(1, 13))) # 월 레이블 표시
    fig_students.show()

    # 훈련기관별 연도별 월별 매출 추이
    fig_revenue = px.line(grouped, x='월', y='누적매출', color='훈련기관',
                           facet_col='연도', title='훈련기관별 연도별 월별 매출 추이')
    fig_revenue.update_xaxes(type='category', tickvals=list(range(1, 13)))
    fig_revenue.show()


    # 훈련기관별 연도별 수료인원 추이
    fig_revenue = px.line(grouped, x='월', y='수료인원', color='훈련기관',
                           facet_col='연도', title='훈련기관별 연도별 월별 수료인원 추이')
    fig_revenue.update_xaxes(type='category', tickvals=list(range(1, 13)))
    fig_revenue.show()

# --- 메인 실행 ---
if __name__ == "__main__":
    filepath = 'C:\\Users\\User\\Documents\\GitHub\\KDT_Dataset\\result_kdtdata_202504.csv' # 파일 경로
    df = load_and_preprocess_data(filepath)

    if df is not None:
        visualize_data(df)