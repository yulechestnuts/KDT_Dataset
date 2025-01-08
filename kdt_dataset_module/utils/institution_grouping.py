from difflib import SequenceMatcher
import pandas as pd

def group_institutions_advanced(df, similarity_threshold=0.6):
    """훈련기관명을 분석하여 유사한 기관들을 그룹화"""
    print("group_institutions_advanced 함수 시작")
    try:
        if '훈련기관' not in df.columns:
            print("'훈련기관' 컬럼이 DataFrame에 존재하지 않습니다.")
            return df

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
                group_counts = df[df['group'] == group]['clean_name'].value_counts()
                group_repr[group] = group_counts.index[0] if not group_counts.empty else ""

            df['group_name'] = df['group'].map(group_repr)
            df['훈련기관'] = df['group_name']

        df.drop(columns=['clean_name', 'group'], inplace=True, errors='ignore')

        print("group_institutions_advanced 함수 종료")
        return df

    except Exception as error:
        print(f"Error in group_institutions_advanced: {error}")
        return df