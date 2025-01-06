import pandas as pd
from difflib import SequenceMatcher

def calculate_yearly_revenue(df):
    year_columns = [col for col in df.columns if isinstance(col, str) and col.endswith('년')]
    df['누적매출'] = df[year_columns].sum(axis=1)
    yearly_data = df[year_columns].copy()
    return df, yearly_data

def group_institutions_advanced(df, similarity_threshold=0.6):
    try:
        df = df.copy()
        df['훈련기관'] = df['훈련기관'].fillna("").astype(str)
        df['clean_name'] = df['훈련기관'].str.replace(r'[^가-힣A-Za-z0-9()]', '', regex=True).fillna("")
        df['clean_name'] = df['clean_name'].str.replace(r'\s+', '', regex=True).fillna("")
        df['clean_name'] = df['clean_name'].str.replace(r'주식회사', '', regex=True).fillna("")
        df['clean_name'] = df['clean_name'].str.upper().fillna("")
        groups = {}
        group_id = 0
        for idx, row in df.iterrows():
            name = row['clean_name']
            if not name:
                continue
            found_group = False
            for group_name, members in groups.items():
                for member in members:
                    if name and member and SequenceMatcher(None, name, member).ratio() >= similarity_threshold:
                        groups[group_name].append(name)
                        found_group = True
                        break
                if found_group:
                    break
            if not found_group:
                group_id += 1
                groups[f'기관_{group_id}'] = [name]
        name_to_group = {}
        for group_name, members in groups.items():
            for member in members:
                name_to_group[member] = group_name
        df['group'] = df['clean_name'].map(name_to_group)
        if 'clean_name' in df.columns and 'group' in df.columns:
            group_repr = {}
            for group in df['group'].unique():
                if df[df['group'] == group]['clean_name'].size > 0 :
                    try:
                        group_repr[group] = df[df['group'] == group]['clean_name'].value_counts().index[0]
                    except:
                        group_repr[group] = ""
            df['group_name'] = df['group'].map(group_repr)
            df['훈련기관'] = df['group_name']
        df.drop(columns=['clean_name', 'group'], inplace=True)
        return df
    except Exception as error:
        print(f"Error in group_institutions_advanced: {error}")
        return pd.DataFrame()


def classify_training_type(row):
    types = []
    # Overwrite logic: If '파트너기관' is not null, change the training type to "선도기업형 훈련"
    if not pd.isna(row.get('파트너기관')) and str(row.get('파트너기관')).strip() != '':
        types = ['선도기업형 훈련']
    else:
        if row['과정명'].startswith('재직자_'):
             types.append('재직자 훈련')
        if pd.notna(row.get('훈련기관')) and '학교' in str(row['훈련기관']):
             types.append('대학주도형 훈련')
        if row['과정명'].startswith('심화_'):
            types.append('심화 훈련')
        if row['과정명'].startswith('융합_'):
            types.append('융합 훈련')
        if not types:
            types.append('신기술 훈련')
    print(f"classify_training_type - 과정명: {row['과정명']}, 파트너기관: {row.get('파트너기관')}, types before return: {types}")    
    return '&'.join(types)