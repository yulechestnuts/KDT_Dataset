import pandas as pd

def classify_training_type(row):
    """훈련 유형을 분류"""
    if not pd.isna(row.get('파트너기관')) and str(row.get('파트너기관')).strip() != '':
        return '선도기업형 훈련'

    types = []
    if row.get('과정명', '').startswith('재직자_'):
        types.append('재직자 훈련')
    if pd.notna(row.get('훈련기관')) and '학교' in str(row['훈련기관']):
        types.append('대학주도형 훈련')
    if row.get('과정명', '').startswith('심화_'):
        types.append('심화 훈련')
    if row.get('과정명', '').startswith('융합_'):
        types.append('융합 훈련')

    return '&'.join(types) if types else '신기술 훈련'