import pandas as pd
# 올바른 파일에서 함수 직접 임포트
from utils.training_type_classification import classify_training_type
from utils.institution_grouping import group_institutions_advanced


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
                # 먼저 소수점 제거 및 정수형으로 변환
                df[year] = pd.to_numeric(df[year].astype(str).str.replace(',', ''), errors='coerce').fillna(0).astype(int)
                # 그 후 Int64로 변환
                df[year] = df[year].astype('Int64')
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
            
            # 파트너 기관이 있는 경우 훈련기관을 파트너기관으로 변경
            partner_rows['훈련기관'] = partner_rows['파트너기관']
            
            for year in year_columns:
               if year in partner_rows.columns:
                  # 파트너 기관이 있는 경우 원본 데이터에서 매출액을 10%로 조정
                    df.loc[partner_mask, year] = (df.loc[partner_mask, year] * 0.1).fillna(0).astype(int).astype('Int64')
                    # 파트너 기관의 매출액을 90%로 조정
                    partner_rows[year] = (partner_rows[year] * 0.9).fillna(0).astype(int).astype('Int64')
            
            df = pd.concat([non_partner_rows, partner_rows], ignore_index=True)

        # 5. 회차 처리
        if '회차' in df.columns:
            # 수정된 부분: '\d'를 '\\d'로 변경
            df['회차'] = pd.to_numeric(df['회차'].astype(str).str.extract('(\\d+)', expand=False), errors='coerce').fillna(0).astype('Int64')

        # 6. 누적매출 계산 (수정: "실 매출 대비" 컬럼 사용)
        if '실 매출 대비' in df.columns:
            # 쉼표 제거, 공백 제거 후 숫자 변환
            df['누적매출'] = pd.to_numeric(df['실 매출 대비'].astype(str).str.replace(',', '').str.strip(), errors='coerce').fillna(0)
        else:
            df['누적매출'] = 0  # 컬럼이 없으면 0으로 설정
            
        # 7. 수강신청인원 컬럼 강제 생성 및 결측치 처리
        if '수강신청 인원' not in df.columns:
            df['수강신청 인원'] = 0

        # 8. 훈련기관 그룹화 (훈련 유형 분류 전에 수행)
        if '훈련기관' in df.columns:
            print("group_institutions_advanced 함수 시작")
            df = group_institutions_advanced(df)
            print("group_institutions_advanced 함수 종료")
            print("preprocess_data 후 group_institutions_advanced:")
            print(df.columns)

        else:
            print("Error: '훈련기관' 컬럼이 DataFrame에 없습니다.")
            return pd.DataFrame() # '훈련기관' 컬럼이 없으면 빈 DataFrame 반환
    
        # 9. 훈련유형 처리
        print("preprocess_data - before classify_training_type, 파트너기관 (head):")
        if '파트너기관' in df.columns:
            print(df['파트너기관'].head())

        df['훈련유형'] = df.apply(classify_training_type, axis=1)

        print("preprocess_data 후 데이터샘플: ")
        print(f"데이터 타입:\n{df.dtypes}")
        print(df.head())

        df = df.fillna(0)

        return df

    except Exception as error:
        print(f"데이터 전처리 중 오류 발생: {str(error)}")
        return pd.DataFrame()