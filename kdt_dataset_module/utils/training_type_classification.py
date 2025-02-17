import pandas as pd

def classify_training_type(row):
    """훈련 유형을 분류 (파트너기관 존재 여부만 확인)"""
    types = []

    # 파트너기관이 존재하면 '선도기업형 훈련' 유형 추가 (훈련기관과 동일 여부 무관)
    if pd.notna(row.get('파트너기관')) and str(row.get('파트너기관')).strip() != '':
        types.append('선도기업형 훈련')

    # 다른 유형 검사 (파트너기관 존재 여부와 관계없이)
    if '재직자_' in row.get('과정명', ''):
        types.append('재직자 훈련')
    if pd.notna(row.get('훈련기관')) and '학교' in str(row['훈련기관']):
        types.append('대학주도형 훈련')
    if '심화_' in row.get('과정명', ''):
        types.append('심화 훈련')
    if '융합' in row.get('과정명', ''):
        types.append('융합 훈련')

    # types 리스트가 비어있으면 '신기술 훈련', 아니면 '&'로 연결
    return '&'.join(types) if types else '신기술 훈련'