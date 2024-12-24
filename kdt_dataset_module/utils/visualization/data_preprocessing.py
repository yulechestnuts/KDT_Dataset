import pandas as pd
from kdt_dataset_module.utils import classify_training_type

def preprocess_data(df):
    """데이터 전처리 함수"""
    try:
         # 1. 불필요한 공백 및 특수 문자 제거
        df.columns = [str(col).replace(' ', '').strip() for col in df.columns]
        
        # 2. 숫자형 열 변환 (먼저 문자열로 변환 후 숫자형으로 변환)
        numeric_columns = ['총훈련일수', '총훈련시간', '훈련비', '정원', '수강신청인원', '수료인원', '수료율', '만족도']
        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col].astype(str), errors='coerce').fillna(0)
        
        # 3. 연도별 매출 관련 열 변환
        year_columns = ['2021년', '2022년', '2023년', '2024년', '2025년']
        for year in year_columns:
            if year in df.columns:
               df[year] = pd.to_numeric(df[year].astype(str).str.replace(',', ''), errors='coerce').fillna(0)
        
        # 4. 날짜 관련 열 처리
        date_columns = ['과정시작일', '과정종료일']
        for col in date_columns:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')

        # 5. 파트너기관 처리 (기존 로직 유지)
        if '파트너기관' in df.columns:
            # 파트너기관이 있는 행
            partner_rows = df[df['파트너기관'].notna()].copy()

            # 파트너기관이 없는 행
            non_partner_rows = df[df['파트너기관'].isna()].copy()

            # 파트너기관이 있는 행에 대해서만 훈련기관을 파트너기관으로 변경하고 매출 조정
            partner_rows['훈련기관'] = partner_rows['파트너기관']
        
            for year in year_columns:
                if year in df.columns:
                    # 원본 데이터의 매출 조정 (10%)
                    df.loc[df['파트너기관'].notna(), year] *= 0.1
                    # 파트너 기관이 있는 행에 대해서만 매출 90% 조정
                    partner_rows[year] = partner_rows[year] * 0.9

        # 데이터 합치기
        df = pd.concat([non_partner_rows, partner_rows], ignore_index=True)

        # 6. 회차 처리
        df['회차'] = pd.to_numeric(df['회차'].astype(str).str.extract('(\d+)', expand=False), errors='coerce').fillna(0).astype('Int64')
        
        # 7. 누적매출 계산
        if all(year in df.columns for year in year_columns):
            df['누적매출'] = df[year_columns].fillna(0).sum(axis=1)

        # 8. 수강신청인원 컬럼 강제 생성 및 결측치 처리
        if '수강신청인원' not in df.columns:
           df['수강신청인원'] = 0  # 컬럼이 없는 경우 0으로 채움
        
        if '훈련기관' not in df.columns:
            df['훈련기관'] = ''  # 컬럼이 없는 경우 빈 문자열로 채움
            print("Error: 데이터프레임에 '훈련기관' 컬럼이 없습니다.")

        # 9. 훈련유형 처리
        if '훈련과정분류' in df.columns:
            df['훈련유형'] = df.apply(classify_training_type, axis=1)

        df = df.fillna(0)

        return df
    
    except Exception as error:
        print(f"데이터 전처리 중 오류 발생: {str(error)}")
        return pd.DataFrame()
