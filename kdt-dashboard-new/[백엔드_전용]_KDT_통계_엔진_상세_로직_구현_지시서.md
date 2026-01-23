# 📑 [백엔드 전용] KDT 통계 엔진 상세 로직 구현 지시서

## 문서 개요
이 문서는 PM이 CSV 파일을 업로드했을 때, 시스템 내부에서 어떤 계산이 벌어져야 하는지를 정의한 **시스템 설계도**입니다. 모든 if/else 조건과 계산 로직이 API 내부 코드에 그대로 반영되어야 합니다.

---

## 1. 데이터 수신 및 전처리 (Ingestion & Parsing)

### 1.1 CSV 파일 수신
```python
# 엔드포인트: POST /api/v1/upload-csv
# Content-Type: multipart/form-data
# 파일 필드명: csv_file

# 처리 순서:
# 1. CSV 파일 검증 (확장자, MIME 타입)
# 2. 파일 크기 제한 (예: 100MB)
# 3. 임시 저장 또는 메모리 로드
```

### 1.2 숫자 정규화 함수 (`parseNumber`)
```python
def parse_number(value: Any) -> float:
    """
    CSV에서 읽은 값을 숫자로 변환
    
    규칙:
    1. null, None, 빈 문자열(''), 공백만 있는 문자열 → 0 반환
    2. 이미 숫자 타입이고 NaN이 아니면 → 그대로 반환
    3. 문자열인 경우:
       - 쉼표(,), 공백, %, 원(원), 특수문자 제거
       - 빈 문자열, '-', 'N/A' → 0 반환
       - parseFloat 후 NaN이면 0 반환
    
    예시:
    - "1,234,567원" → 1234567.0
    - "88.5%" → 88.5
    - "-" → 0
    - "N/A" → 0
    - "" → 0
    - None → 0
    """
    if value is None:
        return 0.0
    
    if isinstance(value, str):
        value = value.strip()
        if value == '' or value == '-' or value.upper() == 'N/A':
            return 0.0
        # 쉼표, 공백, %, 원 제거
        cleaned = value.replace(',', '').replace(' ', '').replace('%', '').replace('원', '')
        if cleaned == '' or cleaned == '-':
            return 0.0
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
    
    if isinstance(value, (int, float)):
        if math.isnan(value):
            return 0.0
        return float(value)
    
    return 0.0
```

### 1.3 퍼센트 파싱 함수 (`parsePercentage`)
```python
def parse_percentage(value: Any) -> float:
    """
    퍼센트 문자열을 숫자로 변환
    
    규칙:
    1. null, None, 빈 문자열 → 0 반환
    2. 숫자 타입이면 그대로 반환
    3. 문자열인 경우:
       - % 기호와 공백 제거
       - 빈 문자열, '-', 'N/A' → 0 반환
       - parseFloat 후 NaN이면 0 반환
    
    예시:
    - "88.1%" → 88.1
    - "100%" → 100.0
    - "-" → 0
    """
    if value is None:
        return 0.0
    
    if isinstance(value, (int, float)):
        if math.isnan(value):
            return 0.0
        return float(value)
    
    if isinstance(value, str):
        cleaned = value.replace('%', '').replace(' ', '').strip()
        if cleaned == '' or cleaned == '-' or cleaned.upper() == 'N/A':
            return 0.0
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
    
    return 0.0
```

### 1.4 괄호 포함 숫자 파싱 함수 (`parseNumberWithParen`)
```python
def parse_number_with_paren(value: Any) -> dict:
    """
    "x(y)" 형식의 숫자 파싱
    
    규칙:
    1. 숫자 타입이면 → {value: 숫자, display: 문자열, paren: None}
    2. 문자열인 경우:
       - "x(y)" 형식 매칭 → {value: x, display: "x(y)", paren: y}
       - 일반 숫자 문자열 → {value: 파싱값, display: 문자열, paren: None}
       - 빈 문자열 → {value: 0, display: "", paren: None}
    
    예시:
    - "100(50)" → {value: 100, display: "100(50)", paren: 50}
    - "100" → {value: 100, display: "100", paren: None}
    - 100 → {value: 100, display: "100", paren: None}
    """
    import re
    
    if isinstance(value, (int, float)):
        if math.isnan(value):
            return {"value": 0, "display": "", "paren": None}
        return {"value": int(value), "display": str(int(value)), "paren": None}
    
    if not isinstance(value, str):
        return {"value": 0, "display": "", "paren": None}
    
    value = value.strip()
    if value == '':
        return {"value": 0, "display": "", "paren": None}
    
    # "x(y)" 형식 매칭
    match = re.match(r'^(\d+)(?:\((\d+)\))?$', value)
    if match:
        main_value = int(match.group(1))
        paren_value = int(match.group(2)) if match.group(2) else None
        return {
            "value": main_value,
            "display": value,
            "paren": paren_value
        }
    
    # 일반 숫자 문자열 처리
    parsed = parse_number(value)
    return {
        "value": int(parsed) if parsed == int(parsed) else parsed,
        "display": str(int(parsed)) if parsed > 0 and parsed == int(parsed) else "",
        "paren": None
    }
```

### 1.5 날짜 정규화 함수
```python
from datetime import datetime
from typing import Optional

def parse_date(value: Any) -> datetime:
    """
    날짜 문자열을 표준 Date 객체로 변환
    
    규칙:
    1. 이미 datetime 객체면 그대로 반환
    2. 문자열인 경우:
       - ISO 8601 형식 (YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS 등) 파싱
       - 파싱 실패 시 오늘 날짜 반환
    3. None이면 오늘 날짜 반환
    """
    if isinstance(value, datetime):
        return value
    
    if value is None:
        return datetime.now()
    
    if isinstance(value, str):
        value = value.strip()
        if value == '':
            return datetime.now()
        
        # 다양한 날짜 형식 시도
        formats = [
            '%Y-%m-%d',
            '%Y-%m-%d %H:%M:%S',
            '%Y/%m/%d',
            '%Y.%m.%d',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%S.%f',
            '%Y-%m-%dT%H:%M:%S.%fZ'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        
        # 모든 형식 실패 시 오늘 날짜 반환
        return datetime.now()
    
    return datetime.now()
```

### 1.6 기관 그룹화 함수 (`groupInstitutionsAdvanced`)
```python
def group_institutions_advanced(institution_name: str) -> str:
    """
    훈련기관 명칭을 마스터 매핑 테이블에 따라 그룹화 기관명으로 치환
    
    매핑 규칙:
    - 대소문자 구분 없음
    - 공백, 특수문자 제거 후 비교
    - 키워드 포함 여부로 매칭
    
    매핑 테이블:
    {
        '이젠아카데미': ['이젠', '이젠컴퓨터학원', '이젠아이티아카데미'],
        '그린컴퓨터아카데미': ['그린', '그린컴퓨터아카데미', '그린아카데미컴퓨터학원'],
        '더조은아카데미': ['더조은', '더조은컴퓨터아카데미', '더조은아이티아카데미'],
        '코리아IT아카데미': ['코리아IT', '코리아아이티', 'KIT', '코리아IT아카데미'],
        '비트교육센터': ['비트', '비트캠프', '비트교육센터'],
        '하이미디어': ['하이미디어', '하이미디어아카데미', '하이미디어컴퓨터학원'],
        '아이티윌': ['아이티윌', 'IT WILL', '아이티윌부산교육센터'],
        '메가스터디': ['메가스터디'],
        '에이콘아카데미': ['에이콘'],
        '한국ICT인재개발원': ['ICT'],
        'MBC아카데미 컴퓨터 교육센터': ['MBC아카데미', '(MBC)'],
        '쌍용아카데미': ['쌍용'],
        '이스트소프트': ['이스트소프트', '(주)이스트소프트'],
        'KH정보교육원': ['KH']
    }
    
    매칭되지 않으면 원본 기관명 반환
    """
    if not institution_name:
        return '알 수 없는 기관'
    
    # 특수문자 제거, 공백 정리, 대문자 변환
    clean_name = re.sub(r'[^가-힣A-Za-z0-9\s()]', '', institution_name)
    clean_name = re.sub(r'\s+', ' ', clean_name).strip().upper()
    
    # 매핑 테이블
    institution_groups = {
        '이젠아카데미': ['이젠', '이젠컴퓨터학원', '이젠아이티아카데미'],
        '그린컴퓨터아카데미': ['그린', '그린컴퓨터아카데미', '그린아카데미컴퓨터학원'],
        '더조은아카데미': ['더조은', '더조은컴퓨터아카데미', '더조은아이티아카데미'],
        '코리아IT아카데미': ['코리아IT', '코리아아이티', 'KIT', '코리아IT아카데미'],
        '비트교육센터': ['비트', '비트캠프', '비트교육센터'],
        '하이미디어': ['하이미디어', '하이미디어아카데미', '하이미디어컴퓨터학원'],
        '아이티윌': ['아이티윌', 'IT WILL', '아이티윌부산교육센터'],
        '메가스터디': ['메가스터디'],
        '에이콘아카데미': ['에이콘'],
        '한국ICT인재개발원': ['ICT'],
        'MBC아카데미 컴퓨터 교육센터': ['MBC아카데미', '(MBC)'],
        '쌍용아카데미': ['쌍용'],
        '이스트소프트': ['이스트소프트', '(주)이스트소프트'],
        'KH정보교육원': ['KH']
    }
    
    # 키워드 매칭
    for group_name, keywords in institution_groups.items():
        for keyword in keywords:
            if keyword.upper() in clean_name:
                return group_name
    
    # 매칭되지 않으면 원본 반환
    return institution_name
```

### 1.7 누적 매출 계산
```python
def calculate_cumulative_revenue(raw_data: dict) -> float:
    """
    연도별 매출 합산
    
    규칙:
    - '2021년', '2022년', '2023년', '2024년', '2025년', '2026년' 컬럼 합산
    - '2021'처럼 '년'이 없는 헤더도 인식
    """
    year_columns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년']
    total = 0.0
    
    for year_col in year_columns:
        year_digits = year_col.replace('년', '')
        # '2021년' 또는 '2021' 둘 다 시도
        value = raw_data.get(year_col) or raw_data.get(year_digits)
        total += parse_number(value)
    
    return total
```

### 1.8 총 훈련 시간 계산
```python
def calculate_total_training_hours(raw_data: dict) -> float:
    """
    총 훈련 시간 계산
    
    규칙:
    - '총 훈련시간' 컬럼이 있고 값이 있으면 그 값 사용
    - 없으면 '총 훈련일수' × 8 계산
    """
    total_hours = raw_data.get('총 훈련시간') or raw_data.get('총훈련시간')
    
    if total_hours and str(total_hours).strip() != '':
        return parse_number(total_hours)
    
    # 총 훈련일수 × 8
    total_days = raw_data.get('총 훈련일수') or raw_data.get('총훈련일수')
    days = parse_number(total_days)
    return days * 8.0
```

---

## 2. 핵심 계산 엔진 로직 (Core Engine Logic)

### 2.1 매출 조정 계수 계산 (`calculateRevenueAdjustmentFactor`)
```python
def calculate_revenue_adjustment_factor(completion_rate: float) -> float:
    """
    수료율(R)을 기준으로 매출 보정 계수(F) 산출
    
    수식:
    - R >= 100: F = 1.25
    - 75 <= R < 100: F = 1.0 + (0.25 × (R - 75) / 25)
    - 50 <= R < 75: F = 0.75 + (0.25 × (R - 50) / 25)
    - R < 50: F = 0.75
    
    예시:
    - completion_rate = 100.0 → 1.25
    - completion_rate = 87.5 → 1.0 + (0.25 × (87.5 - 75) / 25) = 1.0 + 0.125 = 1.125
    - completion_rate = 62.5 → 0.75 + (0.25 × (62.5 - 50) / 25) = 0.75 + 0.125 = 0.875
    - completion_rate = 25.0 → 0.75
    """
    if completion_rate >= 100.0:
        return 1.25
    elif completion_rate >= 75.0:
        # 선형 보간: 75%에서 1.0, 100%에서 1.25
        return 1.0 + (0.25 * (completion_rate - 75.0) / 25.0)
    elif completion_rate >= 50.0:
        # 선형 보간: 50%에서 0.75, 75%에서 1.0
        return 0.75 + (0.25 * (completion_rate - 50.0) / 25.0)
    else:
        return 0.75
```

### 2.2 과정별 매출 계산 (`computeCourseRevenue`)
```python
def compute_course_revenue(
    course: dict,
    year: Optional[int] = None,
    already_adjusted: bool = False
) -> float:
    """
    과정별 매출 산출
    
    규칙:
    1. year가 지정된 경우:
       - baseRevenue = 조정_YYYY년 ?? YYYY년 ?? 0
       - 이미 조정되지 않았으면 baseRevenue × F 적용
       - 이미 조정되었으면 F = 1.0 (보정 없음)
    
    2. year가 없는 경우 (전체 연도 합산):
       - baseRevenue = Σ(조정_2021년 + 조정_2022년 + ... + 조정_2026년)
       - baseRevenue가 0이면:
         - 조정_실매출대비 ?? 실매출대비 ?? 누적매출 순으로 시도
       - 이미 조정되지 않았으면 baseRevenue × F 적용
    
    파라미터:
    - course: 과정 데이터 딕셔너리
    - year: 특정 연도 (None이면 전체)
    - already_adjusted: 이미 조정된 데이터인지 여부
    """
    completion_rate = parse_percentage(course.get('수료율', 0))
    
    if year is not None:
        # 특정 연도 지정
        year_key = f'{year}년'
        adj_year_key = f'조정_{year}년'
        
        base_revenue = parse_number(
            course.get(adj_year_key) or 
            course.get(year_key) or 
            0
        )
        
        if not already_adjusted and base_revenue > 0:
            factor = calculate_revenue_adjustment_factor(completion_rate)
            return base_revenue * factor
        
        return base_revenue
    
    # 전체 연도 합산
    year_columns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년']
    base_revenue = 0.0
    
    for year_col in year_columns:
        adj_col = f'조정_{year_col}'
        value = parse_number(course.get(adj_col) or course.get(year_col) or 0)
        base_revenue += value
    
    # baseRevenue가 0이면 대체 값 시도
    if base_revenue == 0:
        base_revenue = parse_number(
            course.get('조정_실매출대비') or
            course.get('실 매출 대비') or
            course.get('실매출대비') or
            course.get('누적매출') or
            0
        )
    
    # 이미 조정되지 않았으면 보정 적용
    if not already_adjusted and base_revenue > 0:
        factor = calculate_revenue_adjustment_factor(completion_rate)
        return base_revenue * factor
    
    return base_revenue
```

### 2.3 최대 매출 모드 계산
```python
def compute_course_revenue_by_mode(
    course: dict,
    year: Optional[int] = None,
    revenue_mode: str = 'current'  # 'current' or 'max'
) -> float:
    """
    매출 모드에 따른 과정별 매출 계산
    
    revenue_mode = 'current': 일반 매출 계산 (compute_course_revenue 사용)
    revenue_mode = 'max': 최대 매출 모드
    
    최대 매출 모드 규칙:
    1. year가 없는 경우: 매출최대 값 반환
    2. year가 있는 경우:
       - maxRevenue = 매출최대
       - yearRevenue = 조정_YYYY년 ?? YYYY년 ?? 0
       - totalRevenueBase = Σ(조정_2021년 + ... + 조정_2026년)
       - totalRevenueBase가 0이면:
         - 조정_실매출대비 ?? 실매출대비 ?? 누적매출 순으로 시도
       - return maxRevenue × (yearRevenue / totalRevenueBase)
    """
    if revenue_mode == 'current':
        return compute_course_revenue(course, year)
    
    # 'max' 모드
    max_revenue = parse_number(course.get('매출 최대') or course.get('매출최대') or 0)
    
    if year is None:
        return max_revenue
    
    # 연도별 매출 계산
    year_key = f'{year}년'
    adj_year_key = f'조정_{year}년'
    year_revenue = parse_number(
        course.get(adj_year_key) or 
        course.get(year_key) or 
        0
    )
    
    # 전체 매출 기준 계산
    year_columns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년']
    total_revenue_base = 0.0
    
    for year_col in year_columns:
        adj_col = f'조정_{year_col}'
        value = parse_number(course.get(adj_col) or course.get(year_col) or 0)
        total_revenue_base += value
    
    if total_revenue_base == 0:
        total_revenue_base = parse_number(
            course.get('조정_실매출대비') or
            course.get('실 매출 대비') or
            course.get('실매출대비') or
            course.get('누적매출') or
            0
        )
    
    if total_revenue_base <= 0:
        return 0.0
    
    return max_revenue * (year_revenue / total_revenue_base)
```

### 2.4 선도기업 과정 판단
```python
def is_leading_company_course(course: dict) -> bool:
    """
    선도기업 과정 판단
    
    규칙:
    - 파트너기관이 존재하고 빈 문자열이 아니고 '0'이 아니면 True
    """
    partner = str(course.get('파트너기관', '')).strip()
    return partner != '' and partner != '0'
```

### 2.5 선도기업 과정 매출 분배
```python
def calculate_revenue_share(
    course: dict,
    institution_name: str
) -> float:
    """
    기관별 매출 분배 비율 계산
    
    규칙:
    1. 선도기업 과정이고 파트너기관이 존재하는 경우:
       - 훈련기관 그룹명 == 파트너기관 그룹명:
         → 훈련기관: 100% (1.0)
       - 파트너기관 그룹명 == institution_name:
         → 파트너기관: 90% (0.9)
       - 훈련기관 그룹명 == institution_name:
         → 훈련기관: 10% (0.1)
       - 그 외: 0% (0.0)
    
    2. 일반 과정:
       - 훈련기관 그룹명 == institution_name:
         → 훈련기관: 100% (1.0)
       - 그 외: 0% (0.0)
    """
    training_institution = group_institutions_advanced(
        course.get('훈련기관', '')
    )
    
    if is_leading_company_course(course):
        partner_institution = group_institutions_advanced(
            course.get('파트너기관', '')
        )
        
        # 훈련기관과 파트너기관이 같으면 훈련기관이 100% 흡수
        if training_institution == partner_institution:
            if training_institution == institution_name:
                return 1.0
            return 0.0
        
        # 파트너기관 90%
        if partner_institution == institution_name:
            return 0.9
        
        # 훈련기관 10%
        if training_institution == institution_name:
            return 0.1
        
        return 0.0
    else:
        # 일반 과정: 훈련기관 100%
        if training_institution == institution_name:
            return 1.0
        return 0.0
```

### 2.6 학생 수 분배 비율 (`studentShare`)
```python
def calculate_student_share(
    course: dict,
    institution_name: str
) -> float:
    """
    학생 수 분배 비율 계산 (선도기업 과정 처리)
    
    규칙:
    1. 선도기업 과정:
       - 파트너기관 그룹명 == institution_name: 1.0 (100%)
       - 훈련기관 그룹명 == institution_name: 0.0 (0%)
    
    2. 일반 과정:
       - 훈련기관 그룹명 == institution_name: 1.0 (100%)
       - 그 외: 0.0
    """
    training_institution = group_institutions_advanced(
        course.get('훈련기관', '')
    )
    
    if is_leading_company_course(course):
        partner_institution = group_institutions_advanced(
            course.get('파트너기관', '')
        )
        
        # 파트너기관이 학생 수 100% 담당
        if partner_institution == institution_name:
            return 1.0
        
        # 훈련기관은 학생 수 0
        if training_institution == institution_name:
            return 0.0
        
        return 0.0
    else:
        # 일반 과정: 훈련기관 100%
        if training_institution == institution_name:
            return 1.0
        return 0.0
```

---

## 3. 성과 지표 산출 (Performance Engine)

### 3.1 3주 규칙 필터링
```python
from datetime import timedelta

def is_course_old_enough_for_completion_rate(course: dict) -> bool:
    """
    3주 규칙: 과정 종료일이 오늘 기준 21일 이상 지난 과정만 수료율 계산에 포함
    
    규칙:
    - 오늘 날짜 - 과정종료일 >= 21일 → True
    - 오늘 날짜 - 과정종료일 < 21일 → False
    """
    end_date_str = course.get('과정종료일')
    if not end_date_str:
        return False
    
    end_date = parse_date(end_date_str)
    today = datetime.now()
    three_weeks_ago = today - timedelta(days=21)
    
    return end_date <= three_weeks_ago
```

### 3.2 수료율 계산 (`calculateCompletionRate`)
```python
def calculate_completion_rate(
    courses: list[dict],
    year: Optional[int] = None
) -> float:
    """
    수료율 계산
    
    필터링 조건:
    1. year가 지정된 경우: 해당 연도에 종료된 과정만
    2. 수료인원 > 0
    3. 수강신청 인원 > 0
    4. 과정 종료일이 오늘 기준 21일 이상 지난 과정만 (3주 규칙)
    
    수식:
    수료율(%) = (전체 수료인원 합계 / 전체 수강신청 인원 합계) × 100
    
    제외 조건:
    - 수료인원이 0인 과정
    - 수강신청 인원이 0인 과정
    - 과정 종료일이 오늘 기준 21일 이내인 과정
    """
    filtered_courses = courses
    
    # 연도 필터링
    if year is not None:
        filtered_courses = [
            c for c in filtered_courses
            if parse_date(c.get('과정종료일')).year == year
        ]
    
    # 유효한 과정만 필터링
    valid_courses = [
        c for c in filtered_courses
        if (parse_number(c.get('수료인원', 0)) > 0 and
            parse_number(c.get('수강신청 인원', 0)) > 0 and
            is_course_old_enough_for_completion_rate(c))
    ]
    
    if len(valid_courses) == 0:
        return 0.0
    
    total_completion = sum(
        parse_number(c.get('수료인원', 0)) for c in valid_courses
    )
    total_enrollment = sum(
        parse_number(c.get('수강신청 인원', 0)) for c in valid_courses
    )
    
    if total_enrollment == 0:
        return 0.0
    
    completion_rate = (total_completion / total_enrollment) * 100
    return round(completion_rate, 1)
```

### 3.3 취업 인원 선택 (`getPreferredEmploymentCount`)
```python
def get_preferred_employment_count(course: dict) -> int:
    """
    취업 인원 선택 규칙
    
    우선순위:
    1. 취업인원(6개월) > 0 → 취업인원(6개월) 반환
    2. 취업인원(3개월) > 0 → 취업인원(3개월) 반환
    3. 그 외 → 취업인원(전체) 반환
    """
    six_month = parse_number(course.get('취업인원 (6개월)', 0))
    if six_month > 0:
        return int(six_month)
    
    three_month = parse_number(course.get('취업인원 (3개월)', 0))
    if three_month > 0:
        return int(three_month)
    
    overall = parse_number(course.get('취업인원', 0))
    return int(overall)
```

### 3.4 취업율 계산
```python
def calculate_employment_rate(courses: list[dict]) -> float:
    """
    취업율 계산
    
    수식:
    취업율(%) = (총 취업인원 / 총 수료인원) × 100
    
    조건:
    - 수료인원 > 0인 경우만 계산
    - 취업인원은 get_preferred_employment_count로 선택된 값 사용
    """
    total_employed = sum(
        get_preferred_employment_count(c) for c in courses
    )
    total_completed = sum(
        parse_number(c.get('수료인원', 0)) for c in courses
    )
    
    if total_completed == 0:
        return 0.0
    
    employment_rate = (total_employed / total_completed) * 100
    return round(employment_rate, 1)
```

### 3.5 가중 만족도 계산
```python
def calculate_weighted_satisfaction(courses: list[dict]) -> float:
    """
    가중 평균 만족도 계산
    
    수식:
    평균만족도 = Σ(만족도 × 수료인원) / Σ(수료인원)
    
    조건:
    - 만족도 > 0
    - 수료인원 > 0
    """
    total_weighted_satisfaction = 0.0
    total_weight = 0.0
    
    for course in courses:
        satisfaction = parse_percentage(course.get('만족도', 0))
        completed = parse_number(course.get('수료인원', 0))
        
        if satisfaction > 0 and completed > 0:
            total_weighted_satisfaction += satisfaction * completed
            total_weight += completed
    
    if total_weight == 0:
        return 0.0
    
    avg_satisfaction = total_weighted_satisfaction / total_weight
    return round(avg_satisfaction, 1)
```

---

## 4. 집계 및 UI 표시 필드 (Aggregation & UI Fields)

### 4.1 X(Y) 데이터 생성 함수
```python
def format_xy_display(
    current_value: int,
    prev_value: int
) -> str:
    """
    X(Y) 형식 문자열 생성
    
    규칙:
    - Y가 0이면 "X"만 반환
    - Y가 0보다 크면 "X(Y)" 반환
    
    예시:
    - current_value=15, prev_value=3 → "15(3)"
    - current_value=20, prev_value=0 → "20"
    """
    if prev_value > 0:
        return f"{current_value}({prev_value})"
    return str(current_value)
```

### 4.2 연도별 값 분류
```python
def classify_year_values(
    course: dict,
    target_year: int
) -> dict:
    """
    연도별 값 분류 (X, Y 구분)
    
    규칙:
    - X (현재년도 값): 과정시작연도 === target_year
    - Y (이월 값): 과정시작연도 < target_year AND 과정종료연도 >= target_year
    
    반환:
    {
        'is_current_year_start': bool,
        'is_prev_year_start_ongoing': bool,
        'is_current_year_end': bool
    }
    """
    start_date = parse_date(course.get('과정시작일'))
    end_date = parse_date(course.get('과정종료일'))
    
    start_year = start_date.year
    end_year = end_date.year
    
    is_current_year_start = (start_year == target_year)
    is_prev_year_start_ongoing = (
        start_year < target_year and end_year >= target_year
    )
    is_current_year_end = (end_year == target_year)
    
    return {
        'is_current_year_start': is_current_year_start,
        'is_prev_year_start_ongoing': is_prev_year_start_ongoing,
        'is_current_year_end': is_current_year_end
    }
```

### 4.3 상세 비율 텍스트 생성
```python
def format_rate_detail(
    numerator: int,
    denominator: int,
    rate: float
) -> str:
    """
    상세 비율 텍스트 생성
    
    형식: "XX.X% (분자/분모)"
    
    예시:
    - numerator=18, denominator=20, rate=90.0 → "90.0% (18/20)"
    """
    return f"{rate:.1f}% ({numerator}/{denominator})"
```

---

## 5. 월별/연도별 시계열 로직 (Time-series)

### 5.1 월별 매출 분배
```python
def calculate_monthly_revenue_distribution(
    course: dict,
    target_year: int
) -> dict[str, float]:
    """
    월별 매출 분배
    
    규칙:
    1. 해당 연도에 매출이 있는지 확인
    2. 과정이 해당 연도에 진행된 월 수(N) 계산
       - iterStartMonth = (연도 === 과정시작연도) ? 과정시작월 : 0
       - iterEndMonth = (연도 === 과정종료연도) ? 과정종료월 : 11
       - monthsInThisCourseYear = iterStartMonth부터 iterEndMonth까지의 월 수
    3. revenuePerMonth = 해당연도_매출 / monthsInThisCourseYear
    4. 각 월에 revenuePerMonth 추가
    
    반환:
    {
        '2024-01': 100000.0,
        '2024-02': 100000.0,
        ...
    }
    """
    year_key = f'{target_year}년'
    adj_year_key = f'조정_{target_year}년'
    
    year_revenue = parse_number(
        course.get(adj_year_key) or course.get(year_key) or 0
    )
    
    if year_revenue == 0:
        return {}
    
    start_date = parse_date(course.get('과정시작일'))
    end_date = parse_date(course.get('과정종료일'))
    
    monthly_revenue = {}
    
    # 해당 연도에 진행된 월 수 계산
    if start_date.year <= target_year <= end_date.year:
        iter_start_month = start_date.month - 1 if start_date.year == target_year else 0
        iter_end_month = end_date.month - 1 if end_date.year == target_year else 11
        
        months_in_year = 0
        months_list = []
        
        for month_index in range(iter_start_month, iter_end_month + 1):
            month_start = datetime(target_year, month_index + 1, 1)
            month_end = datetime(
                target_year, month_index + 1 + 1, 1
            ) - timedelta(days=1)
            
            # 현재 월이 과정의 전체 기간 내에 포함되는지 확인
            if month_start <= end_date and month_end >= start_date:
                months_in_year += 1
                months_list.append(f"{target_year}-{str(month_index + 1).zfill(2)}")
        
        if months_in_year > 0:
            revenue_per_month = year_revenue / months_in_year
            for month_name in months_list:
                monthly_revenue[month_name] = revenue_per_month
    
    return monthly_revenue
```

### 5.2 월별 인원 집계
```python
def calculate_monthly_students(
    course: dict
) -> dict[str, int]:
    """
    월별 수강신청 인원 및 수료인원 집계
    
    규칙:
    - 수강신청인원 및 수료인원은 과정 '시작 월'에 전체 인원을 귀속
    
    반환:
    {
        '2024-03': {
            'total_students': 20,
            'completed_students': 18
        }
    }
    """
    start_date = parse_date(course.get('과정시작일'))
    month_key = f"{start_date.year}-{str(start_date.month).zfill(2)}"
    
    return {
        month_key: {
            'total_students': int(parse_number(course.get('수강신청 인원', 0))),
            'completed_students': int(parse_number(course.get('수료인원', 0)))
        }
    }
```

---

## 6. 훈련 유형 분류 (Classifier)

### 6.1 훈련 유형 분류 함수
```python
def classify_training_type(course: dict) -> str:
    """
    과정명과 기관 속성을 분석하여 자동으로 유형을 라벨링
    
    규칙 (우선순위 순):
    1. 파트너기관 존재 → '선도기업형 훈련' 추가
    2. 과정명에 '재직자_' 포함 → '재직자 훈련' 추가
    3. 훈련기관에 '학교' 포함 → '대학주도형 훈련' 추가
    4. 과정명에 '심화_' 포함 → '심화 훈련' 추가
    5. 과정명에 '융합' 포함 → '융합 훈련' 추가
    6. 위 조건에 해당하지 않으면 → '신기술 훈련'
    
    여러 조건에 해당하면 '&'로 연결
    예: '선도기업형 훈련&재직자 훈련'
    """
    types = []
    
    # 파트너기관 존재 여부
    partner = str(course.get('파트너기관', '')).strip()
    if partner != '' and partner != '0':
        types.append('선도기업형 훈련')
    
    # 과정명 검사
    course_name = str(course.get('과정명', '')).strip()
    if '재직자_' in course_name:
        types.append('재직자 훈련')
    if '심화_' in course_name:
        types.append('심화 훈련')
    if '융합' in course_name:
        types.append('융합 훈련')
    
    # 훈련기관 검사
    institution = str(course.get('훈련기관', '')).strip()
    if '학교' in institution:
        types.append('대학주도형 훈련')
    
    if len(types) > 0:
        return '&'.join(types)
    
    return '신기술 훈련'
```

---

## 7. 기관별 통계 계산

### 7.1 기관별 상세 매출 계산
```python
def calculate_institution_detailed_revenue(
    all_courses: list[dict],
    institution_name: str,
    year: Optional[int] = None,
    revenue_mode: str = 'current'
) -> dict:
    """
    기관별 상세 매출 계산
    
    반환:
    {
        'courses': list[dict],  # 해당 기관의 과정 목록 (매출 분배 적용)
        'total_revenue': float  # 총 매출
    }
    """
    total_revenue = 0.0
    courses_for_institution = []
    
    for course in all_courses:
        revenue_share = calculate_revenue_share(course, institution_name)
        
        if revenue_share > 0:
            course_revenue = (
                compute_course_revenue_by_mode(course, year, revenue_mode) *
                revenue_share
            )
            total_revenue += course_revenue
            
            # 매출을 할당하여 과정 복사
            course_copy = course.copy()
            course_copy['총누적매출'] = course_revenue
            courses_for_institution.append(course_copy)
    
    return {
        'courses': courses_for_institution,
        'total_revenue': total_revenue
    }
```

### 7.2 기관별 통계 계산
```python
def calculate_institution_stats(
    all_courses: list[dict],
    year: Optional[int] = None,
    revenue_mode: str = 'current'
) -> list[dict]:
    """
    기관별 통계 계산
    
    각 기관에 대해 다음 통계 계산:
    1. 총 매출
    2. 과정 수 (X(Y) 형식)
    3. 수강신청 인원 (X(Y) 형식)
    4. 수료인원 (X(Y) 형식)
    5. 취업인원
    6. 수료율 (3주 규칙 적용)
    7. 취업율
    8. 평균 만족도 (가중 평균)
    
    반환:
    [
        {
            'institution_name': str,
            'total_revenue': float,
            'total_courses_display': str,  # "15(3)"
            'total_students_display': str,  # "200(50)"
            'completed_students_display': str,  # "180(45)"
            'total_employed': int,
            'completion_rate': float,
            'employment_rate': float,
            'avg_satisfaction': float,
            'courses': list[dict]
        },
        ...
    ]
    """
    # 모든 기관명 추출 (그룹화된 기관명 기준)
    all_institution_names = set()
    
    for course in all_courses:
        training_institution = group_institutions_advanced(
            course.get('훈련기관', '')
        )
        all_institution_names.add(training_institution)
        
        if is_leading_company_course(course):
            partner_institution = group_institutions_advanced(
                course.get('파트너기관', '')
            )
            all_institution_names.add(partner_institution)
    
    result = []
    target_year = year or datetime.now().year
    
    for institution_name in all_institution_names:
        # 상세 매출 계산
        detailed = calculate_institution_detailed_revenue(
            all_courses, institution_name, year, revenue_mode
        )
        
        courses = detailed['courses']
        total_revenue = detailed['total_revenue']
        
        if len(courses) == 0:
            continue
        
        # 학생수/수료인원/과정수 계산
        current_year_courses_count = 0
        prev_year_courses_count = 0
        current_year_students = 0
        prev_year_students = 0
        current_year_completed_students = 0
        prev_year_completed_students = 0
        total_employed = 0
        
        for course in courses:
            year_classification = classify_year_values(course, target_year)
            student_share = calculate_student_share(course, institution_name)
            
            enrollment = int(parse_number(course.get('수강신청 인원', 0)))
            completed = int(parse_number(course.get('수료인원', 0)))
            employed = get_preferred_employment_count(course)
            
            if year_classification['is_current_year_start']:
                current_year_courses_count += 1 if student_share > 0 else 0
                current_year_students += int(enrollment * student_share)
                if year_classification['is_current_year_end']:
                    current_year_completed_students += int(completed * student_share)
                    total_employed += int(employed * student_share)
            elif year_classification['is_prev_year_start_ongoing']:
                prev_year_courses_count += 1 if student_share > 0 else 0
                prev_year_students += int(enrollment * student_share)
                if year_classification['is_current_year_end']:
                    prev_year_completed_students += int(completed * student_share)
                    total_employed += int(employed * student_share)
        
        # 수료율 계산 (3주 규칙 적용)
        valid_courses_for_completion = [
            c for c in courses
            if (parse_number(c.get('수료인원', 0)) > 0 and
                parse_number(c.get('수강신청 인원', 0)) > 0 and
                is_course_old_enough_for_completion_rate(c))
        ]
        
        total_valid_students = sum(
            int(parse_number(c.get('수강신청 인원', 0)) *
                calculate_student_share(c, institution_name))
            for c in valid_courses_for_completion
        )
        total_valid_graduates = sum(
            int(parse_number(c.get('수료인원', 0)) *
                calculate_student_share(c, institution_name))
            for c in valid_courses_for_completion
        )
        
        completion_rate = (
            (total_valid_graduates / total_valid_students * 100)
            if total_valid_students > 0 else 0.0
        )
        
        # 취업율 계산
        total_completed_for_employment = (
            current_year_completed_students + prev_year_completed_students
        )
        employment_rate = (
            (total_employed / total_completed_for_employment * 100)
            if total_completed_for_employment > 0 else 0.0
        )
        
        # 평균 만족도 계산
        avg_satisfaction = calculate_weighted_satisfaction(courses)
        
        result.append({
            'institution_name': institution_name,
            'total_revenue': round(total_revenue, 2),
            'total_courses_display': format_xy_display(
                current_year_courses_count, prev_year_courses_count
            ),
            'total_students_display': format_xy_display(
                current_year_students, prev_year_students
            ),
            'completed_students_display': format_xy_display(
                current_year_completed_students, prev_year_completed_students
            ),
            'total_employed': total_employed,
            'completion_rate': round(completion_rate, 1),
            'employment_rate': round(employment_rate, 1),
            'avg_satisfaction': avg_satisfaction,
            'courses': courses
        })
    
    # 매출액 기준 내림차순 정렬
    result.sort(key=lambda x: x['total_revenue'], reverse=True)
    
    return result
```

---

## 8. 과정 집계 계산

### 8.1 훈련과정 ID별 집계
```python
def aggregate_courses_by_course_id(
    courses: list[dict],
    year: Optional[int] = None,
    institution_name: Optional[str] = None,
    revenue_mode: str = 'current'
) -> list[dict]:
    """
    같은 훈련과정 ID를 가진 과정들을 하나로 집계
    
    집계 항목:
    1. 총 누적 매출
    2. 총 수강신청 인원 (studentShare 적용)
    3. 총 수료인원 (studentShare 적용)
    4. 총 취업인원 (studentShare 적용)
    5. 원천 과정 수
    6. 평균 수료율 (3주 규칙 적용)
    7. 평균 취업율
    8. 평균 만족도
    9. 연도별 인원 표시 (X(Y) 형식)
    
    반환:
    [
        {
            'course_name': str,
            'course_id': str,
            'total_revenue': float,
            'total_enrollment': int,
            'total_completed': int,
            'total_employed': int,
            'source_course_count': int,
            'avg_completion_rate': float,
            'avg_employment_rate': float,
            'avg_satisfaction': float,
            'students_display': str,  # "200(50)"
            'graduates_display': str,  # "180(45)"
            'open_count_display': str  # "15(3)"
        },
        ...
    ]
    """
    # 훈련과정 ID별로 그룹화
    course_groups = {}
    latest_course_names = {}
    
    # 최신 과정명 찾기
    for course in courses:
        course_id = course.get('훈련과정 ID') or course.get('과정명')
        if not course_id:
            continue
        
        existing_date = latest_course_names.get(course_id)
        course_start_date = parse_date(course.get('과정시작일'))
        
        if existing_date is None or course_start_date > existing_date:
            latest_course_names[course_id] = course_start_date
    
    # 집계
    target_year = year or datetime.now().year
    
    for course in courses:
        course_id = course.get('훈련과정 ID') or course.get('과정명')
        if not course_id:
            continue
        
        if course_id not in course_groups:
            course_groups[course_id] = {
                'course_name': latest_course_names.get(course_id, course.get('과정명')),
                'course_id': course_id,
                'total_revenue': 0.0,
                'total_enrollment': 0,
                'total_completed': 0,
                'total_employed': 0,
                'source_course_count': 0,
                'current_year_enrollment': 0,
                'prev_year_enrollment': 0,
                'current_year_completed': 0,
                'prev_year_completed': 0,
                'current_year_course_count': 0,
                'prev_year_course_count': 0,
                '_completion_enrollment_sum': 0,
                '_completion_sum': 0,
                '_satisfaction_sum': 0,
                '_satisfaction_weight': 0
            }
        
        agg = course_groups[course_id]
        
        # 매출 분배
        if institution_name:
            revenue_share = calculate_revenue_share(course, institution_name)
        else:
            revenue_share = 1.0
        
        course_revenue = (
            compute_course_revenue_by_mode(course, year, revenue_mode) *
            revenue_share
        )
        agg['total_revenue'] += course_revenue
        
        # 학생 수 분배
        if institution_name:
            student_share = calculate_student_share(course, institution_name)
        else:
            student_share = 1.0
        
        enrollment = int(parse_number(course.get('수강신청 인원', 0)))
        completed = int(parse_number(course.get('수료인원', 0)))
        employed = get_preferred_employment_count(course)
        
        agg['total_enrollment'] += int(enrollment * student_share)
        agg['total_completed'] += int(completed * student_share)
        agg['total_employed'] += int(employed * student_share)
        agg['source_course_count'] += 1 if student_share > 0 else 0
        
        # 연도별 분류
        year_classification = classify_year_values(course, target_year)
        
        if year_classification['is_current_year_start']:
            agg['current_year_course_count'] += 1 if student_share > 0 else 0
            agg['current_year_enrollment'] += int(enrollment * student_share)
            if year_classification['is_current_year_end']:
                agg['current_year_completed'] += int(completed * student_share)
        elif year_classification['is_prev_year_start_ongoing']:
            agg['prev_year_course_count'] += 1 if student_share > 0 else 0
            agg['prev_year_enrollment'] += int(enrollment * student_share)
            if year_classification['is_current_year_end']:
                agg['prev_year_completed'] += int(completed * student_share)
        
        # 수료율 계산용 (3주 규칙 적용)
        if (year_classification['is_current_year_end'] and
            completed > 0 and enrollment > 0 and
            is_course_old_enough_for_completion_rate(course)):
            agg['_completion_enrollment_sum'] += int(enrollment * student_share)
            agg['_completion_sum'] += int(completed * student_share)
        
        # 만족도 계산용
        if (year_classification['is_current_year_end'] and
            parse_percentage(course.get('만족도', 0)) > 0):
            satisfaction = parse_percentage(course.get('만족도', 0))
            agg['_satisfaction_sum'] += satisfaction
            agg['_satisfaction_weight'] += 1 if student_share > 0 else 0
    
    # 최종 계산
    result = []
    for course_id, agg in course_groups.items():
        # 평균 수료율
        avg_completion_rate = (
            (agg['_completion_sum'] / agg['_completion_enrollment_sum'] * 100)
            if agg['_completion_enrollment_sum'] > 0 else 0.0
        )
        
        # 평균 취업율
        avg_employment_rate = (
            (agg['total_employed'] / agg['total_completed'] * 100)
            if agg['total_completed'] > 0 else 0.0
        )
        
        # 평균 만족도
        avg_satisfaction = (
            (agg['_satisfaction_sum'] / agg['_satisfaction_weight'])
            if agg['_satisfaction_weight'] > 0 else 0.0
        )
        
        result.append({
            'course_name': agg['course_name'],
            'course_id': course_id,
            'total_revenue': round(agg['total_revenue'], 2),
            'total_enrollment': agg['total_enrollment'],
            'total_completed': agg['total_completed'],
            'total_employed': agg['total_employed'],
            'source_course_count': agg['source_course_count'],
            'avg_completion_rate': round(avg_completion_rate, 1),
            'avg_employment_rate': round(avg_employment_rate, 1),
            'avg_satisfaction': round(avg_satisfaction, 1),
            'students_display': format_xy_display(
                agg['current_year_enrollment'],
                agg['prev_year_enrollment']
            ),
            'graduates_display': format_xy_display(
                agg['current_year_completed'],
                agg['prev_year_completed']
            ),
            'open_count_display': format_xy_display(
                agg['current_year_course_count'],
                agg['prev_year_course_count']
            )
        })
    
    # 매출 기준 내림차순 정렬
    result.sort(key=lambda x: x['total_revenue'], reverse=True)
    
    return result
```

---

## 9. API 엔드포인트 설계

### 9.1 CSV 업로드 및 처리
```python
# POST /api/v1/upload-csv
# Content-Type: multipart/form-data
# 
# Request:
# - csv_file: File (CSV 파일)
# 
# Response:
# {
#     "status": "success",
#     "message": "CSV 파일이 성공적으로 처리되었습니다.",
#     "data": {
#         "processed_courses": int,  # 처리된 과정 수
#         "institution_stats": [...],  # 기관별 통계
#         "yearly_stats": [...],  # 연도별 통계
#         "monthly_stats": [...]  # 월별 통계
#     }
# }
```

### 9.2 기관별 통계 조회
```python
# GET /api/v1/institution-stats
# Query Parameters:
# - year: int (optional) - 특정 연도 필터
# - revenue_mode: str (optional) - 'current' or 'max' (default: 'current')
# 
# Response: 기관별 통계 리스트 (calculate_institution_stats 결과)
```

### 9.3 연도별 통계 조회
```python
# GET /api/v1/yearly-stats
# Query Parameters:
# - year: int (optional) - 특정 연도
# 
# Response: 연도별 통계 리스트
```

### 9.4 월별 통계 조회
```python
# GET /api/v1/monthly-stats
# Query Parameters:
# - year: int (optional) - 특정 연도 필터
# 
# Response: 월별 통계 리스트
```

### 9.5 과정 상세 조회
```python
# GET /api/v1/courses
# Query Parameters:
# - course_id: str (optional) - 훈련과정 ID
# - institution_name: str (optional) - 기관명
# - year: int (optional) - 연도 필터
# 
# Response: 과정 목록 (집계된 데이터)
```

---

## 10. 구현 체크리스트

### 필수 구현 항목
- [ ] 숫자 정규화 함수 (parseNumber)
- [ ] 퍼센트 파싱 함수 (parsePercentage)
- [ ] 괄호 포함 숫자 파싱 함수 (parseNumberWithParen)
- [ ] 날짜 정규화 함수 (parseDate)
- [ ] 기관 그룹화 함수 (groupInstitutionsAdvanced)
- [ ] 매출 조정 계수 계산 (calculateRevenueAdjustmentFactor)
- [ ] 과정별 매출 계산 (computeCourseRevenue)
- [ ] 최대 매출 모드 계산 (computeCourseRevenueByMode)
- [ ] 선도기업 과정 판단 (isLeadingCompanyCourse)
- [ ] 매출 분배 비율 계산 (calculateRevenueShare)
- [ ] 학생 수 분배 비율 계산 (calculateStudentShare)
- [ ] 3주 규칙 필터링 (isCourseOldEnoughForCompletionRate)
- [ ] 수료율 계산 (calculateCompletionRate)
- [ ] 취업 인원 선택 (getPreferredEmploymentCount)
- [ ] 취업율 계산 (calculateEmploymentRate)
- [ ] 가중 만족도 계산 (calculateWeightedSatisfaction)
- [ ] X(Y) 형식 문자열 생성 (formatXyDisplay)
- [ ] 연도별 값 분류 (classifyYearValues)
- [ ] 상세 비율 텍스트 생성 (formatRateDetail)
- [ ] 월별 매출 분배 (calculateMonthlyRevenueDistribution)
- [ ] 월별 인원 집계 (calculateMonthlyStudents)
- [ ] 훈련 유형 분류 (classifyTrainingType)
- [ ] 기관별 통계 계산 (calculateInstitutionStats)
- [ ] 과정 집계 계산 (aggregateCoursesByCourseId)

### 테스트 필수 시나리오
- [ ] 수료율 100% 이상인 과정의 매출 보정 계수 = 1.25
- [ ] 수료율 75-100% 구간의 선형 보간 검증
- [ ] 수료율 50-75% 구간의 선형 보간 검증
- [ ] 수료율 50% 미만인 과정의 매출 보정 계수 = 0.75
- [ ] 선도기업 과정의 매출 분배 (파트너기관 90%, 훈련기관 10%)
- [ ] 선도기업 과정의 학생 수 분배 (파트너기관 100%, 훈련기관 0%)
- [ ] 3주 규칙 적용 (과정 종료일이 21일 이내인 과정 제외)
- [ ] 취업 인원 선택 우선순위 (6개월 > 3개월 > 전체)
- [ ] X(Y) 표기법 생성 (Y가 0이면 X만 표시)
- [ ] 월별 매출 균등 분배 검증
- [ ] 기관 그룹화 매칭 검증

---

## 11. 주의사항

1. **부동소수점 오차**: 모든 금액 계산은 반올림하여 소수점 2자리까지 표시
2. **날짜 비교**: 시간대를 고려하여 날짜 비교 시 시간 부분 제거
3. **null 처리**: 모든 null/None 값은 0 또는 빈 문자열로 처리
4. **성능**: 대량 데이터 처리 시 배치 처리 및 인덱싱 고려
5. **에러 핸들링**: CSV 파싱 오류 시 상세한 에러 메시지 제공
6. **데이터 검증**: 필수 컬럼 누락 시 명확한 에러 반환

---

## 11. 골든 테스트 케이스 (Golden Test Cases)

### 11.1 목적
개발자가 수식을 코드로 옮긴 후, 그 구현이 정확한지 검증하기 위한 **기준점(Reference Point)**입니다. 특정 기관의 특정 연도 데이터에 대해 **반드시 나와야 하는 정확한 숫자**를 제공합니다.

### 11.2 검증 절차
1. CSV 파일을 업로드하고 처리
2. 아래 골든 테스트 케이스의 기관명과 연도로 통계 조회
3. 응답된 숫자가 골든 테스트 케이스와 **정확히 일치**하는지 확인
4. 일치하지 않으면 로직 재검토 필요

### 11.3 골든 테스트 케이스 목록

#### 테스트 케이스 #1: 이젠아카데미 2024년 매출
```json
{
  "test_case_id": "GOLDEN-001",
  "institution_name": "이젠아카데미",
  "year": 2024,
  "expected_values": {
    "total_revenue": 1250000000.50,
    "total_courses_display": "15(3)",
    "total_students_display": "200(50)",
    "completed_students_display": "180(45)",
    "completion_rate": 90.0,
    "employment_rate": 90.0
  },
  "description": "이젠아카데미의 2024년 통계는 엑셀에서 계산한 값과 정확히 일치해야 합니다.",
  "validation_query": "GET /api/v1/institution-stats?institution_name=이젠아카데미&year=2024"
}
```

#### 테스트 케이스 #2: 그린컴퓨터아카데미 2024년 매출
```json
{
  "test_case_id": "GOLDEN-002",
  "institution_name": "그린컴퓨터아카데미",
  "year": 2024,
  "expected_values": {
    "total_revenue": 980000000.25,
    "total_courses_display": "12(2)",
    "total_students_display": "150(30)",
    "completed_students_display": "135(27)",
    "completion_rate": 90.0,
    "employment_rate": 89.6
  },
  "description": "그린컴퓨터아카데미의 2024년 통계는 엑셀에서 계산한 값과 정확히 일치해야 합니다.",
  "validation_query": "GET /api/v1/institution-stats?institution_name=그린컴퓨터아카데미&year=2024"
}
```

#### 테스트 케이스 #3: 선도기업 과정 포함 기관 (코리아IT아카데미)
```json
{
  "test_case_id": "GOLDEN-003",
  "institution_name": "코리아IT아카데미",
  "year": 2024,
  "expected_values": {
    "total_revenue": 750000000.0,
    "total_courses_display": "8(2)",
    "total_students_display": "100(25)",
    "completed_students_display": "90(22)",
    "completion_rate": 90.0,
    "employment_rate": 90.0,
    "leading_company_course_count": 3
  },
  "description": "선도기업 과정이 포함된 기관의 매출 분배(파트너기관 90%, 훈련기관 10%)가 정확히 적용되어야 합니다.",
  "validation_query": "GET /api/v1/institution-stats?institution_name=코리아IT아카데미&year=2024"
}
```

### 11.4 골든 테스트 케이스 업데이트 방법
1. PM이 엑셀에서 특정 기관의 특정 연도 통계를 계산
2. 계산된 값을 골든 테스트 케이스에 추가
3. 개발자는 해당 케이스가 통과할 때까지 로직 수정
4. **중요**: 골든 테스트 케이스는 CSV 데이터가 업데이트될 때마다 재검증 필요

### 11.5 자동화된 검증 API
```python
# GET /api/v1/test/golden-cases
# 골든 테스트 케이스 자동 검증

# Response:
{
  "status": "success",
  "test_results": [
    {
      "test_case_id": "GOLDEN-001",
      "passed": true,
      "expected": {
        "total_revenue": 1250000000.50
      },
      "actual": {
        "total_revenue": 1250000000.50
      },
      "differences": []
    },
    {
      "test_case_id": "GOLDEN-002",
      "passed": false,
      "expected": {
        "total_revenue": 980000000.25
      },
      "actual": {
        "total_revenue": 950000000.0
      },
      "differences": [
        {
          "field": "total_revenue",
          "expected": 980000000.25,
          "actual": 950000000.0,
          "difference": -30000000.25
        }
      ]
    }
  ],
  "summary": {
    "total": 3,
    "passed": 2,
    "failed": 1
  }
}
```

---

## 12. 기관 그룹화 마스터 리스트

### 12.1 목적
**"어떤 이름들을 하나로 묶을 것인가"**에 대한 정확한 매핑 규칙을 제공합니다. 개발자가 임의로 이름을 묶으면 PM이 생각한 통계와 숫자가 달라질 수 있으므로, 이 리스트를 **엄격히 준수**해야 합니다.

### 12.2 마스터 매핑 테이블 (JSON)

```json
{
  "institution_grouping_master": {
    "이젠아카데미": {
      "keywords": [
        "이젠",
        "이젠컴퓨터학원",
        "이젠아이티아카데미",
        "이젠컴퓨터아카데미",
        "이젠아카데미"
      ],
      "examples": [
        "이젠컴퓨터학원 강남",
        "이젠아이티아카데미 부산",
        "이젠컴퓨터아카데미 서울"
      ]
    },
    "그린컴퓨터아카데미": {
      "keywords": [
        "그린",
        "그린컴퓨터아카데미",
        "그린아카데미컴퓨터학원",
        "그린컴퓨터학원"
      ],
      "examples": [
        "그린컴퓨터아카데미 강남",
        "그린아카데미컴퓨터학원",
        "그린컴퓨터학원"
      ]
    },
    "더조은아카데미": {
      "keywords": [
        "더조은",
        "더조은컴퓨터아카데미",
        "더조은아이티아카데미",
        "더조은컴퓨터학원"
      ],
      "examples": [
        "더조은컴퓨터아카데미",
        "더조은아이티아카데미",
        "더조은컴퓨터학원"
      ]
    },
    "코리아IT아카데미": {
      "keywords": [
        "코리아IT",
        "코리아아이티",
        "KIT",
        "코리아IT아카데미",
        "코리아IT학원"
      ],
      "examples": [
        "코리아IT아카데미",
        "코리아아이티아카데미",
        "KIT아카데미"
      ]
    },
    "비트교육센터": {
      "keywords": [
        "비트",
        "비트캠프",
        "비트교육센터",
        "비트컴퓨터학원"
      ],
      "examples": [
        "비트교육센터",
        "비트캠프",
        "비트컴퓨터학원"
      ]
    },
    "하이미디어": {
      "keywords": [
        "하이미디어",
        "하이미디어아카데미",
        "하이미디어컴퓨터학원"
      ],
      "examples": [
        "하이미디어아카데미",
        "하이미디어컴퓨터학원"
      ]
    },
    "아이티윌": {
      "keywords": [
        "아이티윌",
        "IT WILL",
        "아이티윌부산교육센터",
        "아이티윌아카데미"
      ],
      "examples": [
        "아이티윌",
        "IT WILL",
        "아이티윌부산교육센터"
      ]
    },
    "메가스터디": {
      "keywords": [
        "메가스터디"
      ],
      "examples": [
        "메가스터디",
        "메가스터디아카데미"
      ]
    },
    "에이콘아카데미": {
      "keywords": [
        "에이콘",
        "에이콘아카데미",
        "에이콘아카데미(강남)"
      ],
      "examples": [
        "에이콘아카데미",
        "에이콘아카데미(강남)",
        "에이콘"
      ]
    },
    "한국ICT인재개발원": {
      "keywords": [
        "ICT",
        "한국ICT인재개발원"
      ],
      "examples": [
        "한국ICT인재개발원",
        "ICT인재개발원"
      ]
    },
    "MBC아카데미 컴퓨터 교육센터": {
      "keywords": [
        "MBC아카데미",
        "(MBC)",
        "MBC아카데미 컴퓨터 교육센터"
      ],
      "examples": [
        "MBC아카데미 컴퓨터 교육센터",
        "(MBC)아카데미"
      ]
    },
    "쌍용아카데미": {
      "keywords": [
        "쌍용",
        "쌍용아카데미"
      ],
      "examples": [
        "쌍용아카데미",
        "쌍용컴퓨터학원"
      ]
    },
    "이스트소프트": {
      "keywords": [
        "이스트소프트",
        "(주)이스트소프트"
      ],
      "examples": [
        "이스트소프트",
        "(주)이스트소프트"
      ]
    },
    "KH정보교육원": {
      "keywords": [
        "KH",
        "KH정보교육원"
      ],
      "examples": [
        "KH정보교육원",
        "KH아카데미"
      ]
    },
    "(주)솔데스크": {
      "keywords": [
        "솔데스크강남학원",
        "(주)솔데스크",
        "솔데스크"
      ],
      "examples": [
        "(주)솔데스크",
        "솔데스크강남학원",
        "솔데스크"
      ]
    }
  },
  "grouping_rules": {
    "matching_method": "keyword_inclusion",
    "case_sensitive": false,
    "special_characters_removed": true,
    "whitespace_normalized": true,
    "fallback": "original_name"
  }
}
```

### 12.3 매핑 규칙
1. **키워드 포함 방식**: 기관명에 키워드가 포함되어 있으면 해당 그룹으로 매핑
2. **대소문자 무시**: 모든 비교는 대문자로 변환 후 수행
3. **특수문자 제거**: 비교 전 특수문자 제거
4. **공백 정규화**: 여러 공백을 하나로 통일
5. **폴백**: 매칭되지 않으면 원본 기관명 유지

### 12.4 매핑 테이블 업데이트
- 새로운 기관이 추가되면 이 JSON 파일을 업데이트
- PM의 승인 없이 임의로 매핑 규칙 변경 금지
- 변경 시 모든 통계 재계산 필요

---

## 13. 데이터 정합성 리포트 (Health Check)

### 13.1 목적
CSV 파일을 업로드할 때마다, 데이터가 제대로 들어갔는지 PM이 직접 확인할 수 있는 **관리자용 정보**를 제공합니다. 비전공자 PM으로서 데이터가 꼬였을 때 "어디가 잘못되었는지" 개발자에게 구체적으로 따질 수 있는 근거가 됩니다.

### 13.2 CSV 업로드 응답에 포함할 정합성 리포트

```python
def generate_health_check_report(processed_data: list[dict]) -> dict:
    """
    데이터 정합성 리포트 생성
    
    반환:
    {
        "row_count": int,  # 전체 행 수
        "valid_rows": int,  # 유효한 행 수
        "invalid_rows": int,  # 무효한 행 수
        "revenue_zero_count": int,  # 금액이 0인 행 수
        "date_format_errors": int,  # 날짜 형식이 잘못된 행 수
        "missing_required_fields": int,  # 필수 필드가 누락된 행 수
        "institution_grouping_applied": int,  # 기관 그룹화가 적용된 행 수
        "leading_company_courses": int,  # 선도기업 과정 수
        "revenue_adjustment_applied": int,  # 매출 보정이 적용된 과정 수
        "three_week_rule_excluded": int,  # 3주 규칙으로 제외된 과정 수
        "year_range": {
            "start": int,
            "end": int
        },
        "institution_count": int,  # 고유 기관 수 (그룹화 후)
        "course_count": int,  # 고유 과정 수
        "total_revenue": float,  # 총 매출
        "warnings": [
            {
                "type": str,  # "missing_field", "date_error", "revenue_zero", etc.
                "count": int,
                "description": str
            }
        ],
        "errors": [
            {
                "row": int,
                "field": str,
                "issue": str,
                "value": Any
            }
        ]
    }
    """
    # 구현 로직...
    pass
```

### 13.3 정합성 리포트 응답 예시

```json
{
  "status": "success",
  "message": "CSV 파일이 성공적으로 처리되었습니다.",
  "data": {
    "processed_courses": 1250,
    "processing_time_ms": 3420
  },
  "health_check": {
    "row_count": 1250,
    "valid_rows": 1245,
    "invalid_rows": 5,
    "revenue_zero_count": 12,
    "date_format_errors": 3,
    "missing_required_fields": 2,
    "institution_grouping_applied": 450,
    "leading_company_courses": 85,
    "revenue_adjustment_applied": 1150,
    "three_week_rule_excluded": 25,
    "year_range": {
      "start": 2021,
      "end": 2026
    },
    "institution_count": 45,
    "course_count": 320,
    "total_revenue": 15000000000.0,
    "warnings": [
      {
        "type": "revenue_zero",
        "count": 12,
        "description": "매출이 0인 과정이 12개 있습니다."
      },
      {
        "type": "date_format_error",
        "count": 3,
        "description": "날짜 형식이 잘못된 행이 3개 있습니다."
      },
      {
        "type": "missing_required_field",
        "count": 2,
        "description": "필수 필드가 누락된 행이 2개 있습니다."
      }
    ],
    "errors": [
      {
        "row": 125,
        "field": "과정종료일",
        "issue": "과정 종료일이 시작일보다 빠릅니다.",
        "value": "2024-01-15",
        "start_date": "2024-06-15"
      },
      {
        "row": 250,
        "field": "수강신청 인원",
        "issue": "필수 필드가 누락되었습니다.",
        "value": null
      }
    ]
  }
}
```

### 13.4 정합성 리포트 활용 방법
1. **PM이 CSV 업로드 후 즉시 확인**
   - `health_check.warnings`를 확인하여 데이터 품질 문제 파악
   - `health_check.errors`를 확인하여 수정이 필요한 행 식별

2. **개발자에게 구체적인 문제 제기**
   - "125번째 행의 과정종료일이 잘못되었습니다. 확인 부탁드립니다."
   - "매출이 0인 과정이 12개나 있습니다. 이게 정상인가요?"

3. **데이터 품질 모니터링**
   - 주기적으로 정합성 리포트를 확인하여 데이터 품질 추이 파악
   - 경고가 지속적으로 발생하는 필드에 대한 개선 방안 수립

---

## 14. 기존 클라이언트 로직 제거 전략 (Migration Strategy)

### 14.1 목적
백엔드가 아무리 잘 짜도 프론트엔드에서 예전 코드를 안 지우면 소용없습니다. 두 로직이 섞여 있으면 속도는 여전히 느리고 값은 계속 충돌합니다. 따라서 **기존 브라우저 기반 계산 로직을 모두 제거**하고, **오직 새 API의 display 필드만 사용**하도록 프론트엔드 작업을 병행해야 합니다.

### 14.2 제거 대상 파일 및 함수

#### 14.2.1 제거 대상 파일 목록
```
kdt-dashboard-new/src/lib/data-utils.ts
  - calculateInstitutionStats (전체 함수)
  - computeCourseRevenue (전체 함수)
  - calculateCompletionRate (전체 함수)
  - calculateMonthlyStatistics (전체 함수)
  - aggregateCoursesByCourseIdWithLatestInfo (전체 함수)
  - calculateInstitutionDetailedRevenue (전체 함수)
  - getPreferredEmploymentCount (전체 함수)
  - calculateRevenueAdjustmentFactor (전체 함수)
  - groupInstitutionsAdvanced (전체 함수)
  - transformRawDataToCourseData (전체 함수)
  - transformRawDataArray (전체 함수)

kdt-dashboard-new/src/app/institution-analysis/InstitutionAnalysisClient.tsx
  - 모든 클라이언트 사이드 계산 로직
  - calculateInstitutionStats 호출
  - aggregateCoursesByCourseIdWithLatestInfo 호출

kdt-dashboard-new/src/app/monthly-analysis/page.tsx
  - calculateMonthlyStatistics 호출
  - computeCourseRevenue 호출

kdt-dashboard-new/src/app/yearly-analysis/page.tsx
  - 모든 통계 계산 로직

kdt-dashboard-new/src/app/employment-analysis/page.tsx
  - calculateInstitutionStats 호출
```

#### 14.2.2 마이그레이션 단계

**1단계: API 연동 준비**
```typescript
// 새 API 클라이언트 생성
// kdt-dashboard-new/src/lib/api-client.ts

export class KDTStatsAPI {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async getInstitutionStats(year?: number, revenueMode?: string) {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (revenueMode) params.append('revenue_mode', revenueMode);
    
    const response = await fetch(`${this.baseUrl}/api/v1/institution-stats?${params}`);
    return response.json();
  }
  
  async getYearlyStats(year?: number) {
    // ...
  }
  
  async getMonthlyStats(year?: number) {
    // ...
  }
  
  async uploadCSV(file: File) {
    const formData = new FormData();
    formData.append('csv_file', file);
    
    const response = await fetch(`${this.baseUrl}/api/v1/upload-csv`, {
      method: 'POST',
      body: formData
    });
    return response.json();
  }
}
```

**2단계: 기존 로직 주석 처리 (백업)**
```typescript
// kdt-dashboard-new/src/app/institution-analysis/InstitutionAnalysisClient.tsx

// ❌ 기존 코드 (주석 처리)
// const stats = calculateInstitutionStats(processedData, selectedYear);

// ✅ 새 코드 (API 사용)
const statsResponse = await kdtAPI.getInstitutionStats(selectedYear);
const stats = statsResponse.data;
```

**3단계: Display 필드만 사용**
```typescript
// ❌ 기존 코드 (계산)
const completionRate = (totalCompleted / totalStudents) * 100;

// ✅ 새 코드 (API 응답의 display 필드 사용)
const completionRate = institution.completion_rate;
const completionRateDetail = institution.completion_rate_detail; // "90.0% (180/200)"
```

**4단계: 완전 제거**
- 모든 주석 처리된 코드 삭제
- 사용하지 않는 import 제거
- 사용하지 않는 함수 파일 삭제

### 14.3 마이그레이션 체크리스트

#### 프론트엔드 작업
- [ ] 새 API 클라이언트 생성 (`src/lib/api-client.ts`)
- [ ] `InstitutionAnalysisClient.tsx`에서 모든 계산 로직 제거
- [ ] `monthly-analysis/page.tsx`에서 모든 계산 로직 제거
- [ ] `yearly-analysis/page.tsx`에서 모든 계산 로직 제거
- [ ] `employment-analysis/page.tsx`에서 모든 계산 로직 제거
- [ ] 모든 페이지에서 API의 `display` 필드만 사용
- [ ] 사용하지 않는 import 제거
- [ ] `data-utils.ts`의 계산 함수들 삭제 (파싱 함수만 유지)

#### 백엔드 작업
- [ ] 모든 통계 계산 API 구현
- [ ] 골든 테스트 케이스 통과 확인
- [ ] 데이터 정합성 리포트 구현
- [ ] API 문서 작성

#### 테스트
- [ ] 기존 프론트엔드와 새 API 결과 비교
- [ ] 골든 테스트 케이스 검증
- [ ] 성능 테스트 (기존 vs 새)

### 14.4 롤백 계획
마이그레이션 중 문제가 발생하면:
1. 기존 코드는 주석 처리만 하고 삭제하지 않음
2. 환경 변수로 새/구 API 전환 가능하도록 구현
3. 문제 발생 시 즉시 구 API로 롤백

---

**문서 버전**: 2.0  
**최종 수정일**: 2025-01-XX  
**작성자**: 시스템 설계팀
