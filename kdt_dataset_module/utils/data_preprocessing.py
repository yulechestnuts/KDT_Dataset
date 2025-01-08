import pandas as pd
from utils.data import classify_training_type, group_institutions_advanced

def preprocess_data(df):
    """데이터 전처리 함수"""
    try:
        # 1. 숫자형 열 변환
        numeric_columns = ['총 훈련일수', '총 훈련시간', '훈련비', '정원', '수강신청 인원', '수료인원', '수료율', '만족도']
        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col].astype(str), errors='coerce').fillna(0)

        # 2. 연도별 매출 관련 열 변환 및 누락된 컬럼 처리
        year_columns = ['2021년', '2022년', '2023년', '2024년', '2025년']
        for year in year_columns:
            if year in df.columns:
                df[year] = pd.to_numeric(df[year].astype(str).str.replace(',', ''), errors='coerce').fillna(0).astype('Int64')
            else:
                df[year] = pd.Series([0] * len(df), dtype='Int64') # 누락된 컬럼 생성 및 0으로 채우기

        # 3. 날짜 관련 열 처리 및 '훈련연도' 컬럼 생성
        date_columns = ['과정시작일', '과정종료일']
        for col in date_columns:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')
        if '과정시작일' in df.columns:
            df['훈련연도'] = df['과정시작일'].dt.year.fillna(0).astype(int)

        # 4. 파트너기관 처리
        if '파트너기관' in df.columns:
            partner_mask = df['파트너기관'].notna()
            non_partner_rows = df[~partner_mask].copy()
            partner_rows = df[partner_mask].copy()

            partner_rows['훈련기관'] = partner_rows['파트너기관']
            for year in year_columns:
                if year in partner_rows.columns:
                    df.loc[partner_mask, year] = (df.loc[partner_mask, year] * 0.1).astype('Int64')
                    partner_rows[year] = (partner_rows[year] * 0.9).astype('Int64')

            df = pd.concat([non_partner_rows, partner_rows], ignore_index=True)

        # 5. 회차 처리
        if '회차' in df.columns:
            df['회차'] = pd.to_numeric(df['회차'].astype(str).str.extract('(\d+)', expand=False), errors='coerce').fillna(0).astype('Int64')

        # 6. 누적매출 계산
        df['누적매출'] = df[year_columns].sum(axis=1)

        # 7. 수강신청인원 컬럼 강제 생성 및 결측치 처리
        if '수강신청 인원' not in df.columns:
            df['수강신청 인원'] = 0

        # 8. 훈련유형 처리
        print("preprocess_data - before group_institutions_advanced, 컬럼:")
        print(df.columns)
        print("preprocess_data - before classify_training_type, 파트너기관 (head):")
        if '파트너기관' in df.columns:
            print(df['파트너기관'].head())

        df['훈련유형'] = df.apply(classify_training_type, axis=1)

        print("preprocess_data 후 데이터샘플: ")
        print(f"데이터 타입:\n{df.dtypes}")
        print(df.head())

        # 훈련기관 그룹화
        if '훈련기관' in df.columns:
            print("group_institutions_advanced 함수 시작")
            df = group_institutions_advanced(df)
            print("group_institutions_advanced 함수 종료")
            print("preprocess_data 후 group_institutions_advanced:")
            print(df.columns)
        else:
            print("Error: '훈련기관' 컬럼이 DataFrame에 없습니다.")

        df = df.fillna(0)

        return df

    except Exception as error:
        print(f"데이터 전처리 중 오류 발생: {str(error)}")
        return pd.DataFrame()