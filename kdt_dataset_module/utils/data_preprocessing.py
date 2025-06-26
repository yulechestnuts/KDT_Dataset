import pandas as pd
# 올바른 파일에서 함수 직접 임포트
from utils.training_type_classification import classify_training_type
from utils.institution_grouping import group_institutions_advanced


def preprocess_data(df):
    """데이터 전처리 함수"""
    try:
        # 1. 숫자형 열 변환 (취업 관련 컬럼 추가)
        numeric_columns = ['총 훈련일수', '총 훈련시간', '훈련비', '정원', '수강신청 인원', '수료인원', '수료율', '만족도', '취업인원', '취업률']
        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col].astype(str), errors='coerce').fillna(0)

        # 2. 연도별 매출 관련 열 변환 및 누락된 컬럼 처리
        year_columns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년']
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

        # 4. 취업 관련 컬럼 처리 (새로 추가된 부분)
        if '취업인원' not in df.columns:
            df['취업인원'] = 0
        if '취업률' not in df.columns:
            df['취업률'] = 0.0

        # 5. 파트너기관 처리
        if '파트너기관' in df.columns:
            partner_mask = df['파트너기관'].notna()
            
            if partner_mask.sum() > 0:
                # 파트너기관이 없는 행은 그대로 유지
                non_partner_rows = df[~partner_mask].copy()
                
                # 파트너기관이 있는 원본 데이터 복사
                partner_rows = df[partner_mask].copy()
                
                # 원본 매출액 저장 (나중에 정확한 분배를 위해)
                original_sales = {}
                for year in year_columns:
                    if year in partner_rows.columns:
                        original_sales[year] = partner_rows[year].copy()
                
                # 원래 '훈련기관' 값을 임시로 저장
                original_training = partner_rows['훈련기관'].copy()
                
                # 1. 파트너기관 행 생성 (실제 훈련 주체로 전환)
                new_training_rows = partner_rows.copy()
                # 훈련기관명을 파트너기관명으로 변경
                new_training_rows['훈련기관'] = new_training_rows['파트너기관']
                # 파트너기관 칼럼에 원래 훈련기관명 설정
                new_training_rows['파트너기관'] = original_training
                
                # 2. 수수료 받는 행 생성 (원래 훈련기관이 파트너로서 10% 수수료만 받음)
                commission_rows = partner_rows.copy()
                
                # 매출액 정확히 분배 - 원본 매출액 기준으로 계산
                for year in year_columns:
                    if year in original_sales:
                        # 파트너기관(신규 훈련기관)에 90% 할당
                        new_training_rows[year] = (original_sales[year] * 0.9).fillna(0).astype(int).astype('Int64')
                        
                        # 원래 훈련기관(이제는 파트너역할)은 10% 수수료만 가져감
                        commission_rows[year] = (original_sales[year] * 0.1).fillna(0).astype(int).astype('Int64')
                
                # ===== 추가: '실 매출 대비' 컬럼도 분배 처리 =====
                if '실 매출 대비' in df.columns:
                    # 원본 실 매출 대비 저장
                    original_actual_sales = partner_rows['실 매출 대비'].copy()
                    
                    # 문자열을 숫자로 변환하여 계산
                    actual_sales_numeric = pd.to_numeric(original_actual_sales.astype(str).str.replace(',', '').str.strip(), 
                                                       errors='coerce').fillna(0)
                    
                    # 파트너기관(신규 훈련기관)에 90% 할당
                    new_training_rows['실 매출 대비'] = (actual_sales_numeric * 0.9).astype(int)
                    
                    # 원래 훈련기관(이제는 파트너역할)은 10% 수수료만 가져감
                    commission_rows['실 매출 대비'] = (actual_sales_numeric * 0.1).astype(int)
                # ==================================================
                
                # 수료/수강 인원은 실제 훈련 주체인 파트너기관(신규 훈련기관)에만 기록
                # 수수료만 받는 기존 훈련기관에는 인원수 0으로 설정
                people_columns = [col for col in df.columns if '인원' in col]
                for col in people_columns:
                    if col in commission_rows.columns:
                        commission_rows[col] = 0
                
                # 총 매출액 계산을 위한 '총매출' 컬럼이 있는지 확인
                if '총매출' in df.columns:
                    # 파트너기관(신규 훈련기관)의 총매출 계산 - 연도별 매출액의 합으로 갱신
                    new_training_rows['총매출'] = new_training_rows[year_columns].sum(axis=1, skipna=True)
                    
                    # 수수료 받는 기관의 총매출 계산
                    commission_rows['총매출'] = commission_rows[year_columns].sum(axis=1, skipna=True)
                
                # 최종 데이터프레임 구성
                df = pd.concat([non_partner_rows, new_training_rows, commission_rows], ignore_index=True)
        # 6. 회차 처리
        if '회차' in df.columns:
            # 수정된 부분: '\d'를 '\\d'로 변경
            df['회차'] = pd.to_numeric(df['회차'].astype(str).str.extract('(\\d+)', expand=False), errors='coerce').fillna(0).astype('Int64')

        # 7. 누적매출 계산 (수정: "실 매출 대비" 컬럼 사용)
        if '실 매출 대비' in df.columns:
            # 쉼표 제거, 공백 제거 후 숫자 변환
            df['누적매출'] = pd.to_numeric(df['실 매출 대비'].astype(str).str.replace(',', '').str.strip(), errors='coerce').fillna(0)
        else:
            df['누적매출'] = 0  # 컬럼이 없으면 0으로 설정
            
        # 8. 수강신청인원 컬럼 강제 생성 및 결측치 처리
        if '수강신청 인원' not in df.columns:
            df['수강신청 인원'] = 0

        # 9. 훈련기관 그룹화 (훈련 유형 분류 전에 수행)
        if '훈련기관' in df.columns:
            print("group_institutions_advanced 함수 시작")
            df = group_institutions_advanced(df)
            print("group_institutions_advanced 함수 종료")
            print("preprocess_data 후 group_institutions_advanced:")
            print(df.columns)

        else:
            print("Error: '훈련기관' 컬럼이 DataFrame에 없습니다.")
            return pd.DataFrame() # '훈련기관' 컬럼이 없으면 빈 DataFrame 반환
    
        # 10. 훈련유형 처리
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