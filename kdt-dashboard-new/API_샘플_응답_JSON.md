# KDT 통계 엔진 API 샘플 응답 JSON

이 문서는 모든 통계 로직이 반영된 API의 샘플 응답 데이터입니다.

---

## 1. CSV 업로드 및 처리 응답

### POST /api/v1/upload-csv

```json
{
  "status": "success",
  "message": "CSV 파일이 성공적으로 처리되었습니다.",
  "data": {
    "processed_courses": 1250,
    "processing_time_ms": 3420,
    "institution_count": 45,
    "year_range": {
      "start": 2021,
      "end": 2026
    }
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

---

## 2. 기관별 통계 조회 응답

### GET /api/v1/institution-stats?year=2024&revenue_mode=current

```json
{
  "status": "success",
  "data": [
    {
      "institution_name": "이젠아카데미",
      "total_revenue": 1250000000.50,
      "total_courses_display": "15(3)",
      "total_students_display": "200(50)",
      "completed_students_display": "180(45)",
      "total_employed": 162,
      "completion_rate": 90.0,
      "employment_rate": 90.0,
      "avg_satisfaction": 4.5,
      "completion_rate_detail": "90.0% (180/200)",
      "employment_rate_detail": "90.0% (162/180)",
      "recruitment_rate_detail": "85.2% (200/235)",
      "courses": [
        {
          "고유값": "KDT-2024-001",
          "과정명": "풀스택 웹개발자 양성과정",
          "훈련과정 ID": "COURSE-001",
          "과정시작일": "2024-01-15",
          "과정종료일": "2024-06-15",
          "훈련기관": "이젠아카데미",
          "원본훈련기관": "이젠컴퓨터아카데미 강남",
          "수강신청 인원": 30,
          "수료인원": 27,
          "취업인원": 24,
          "취업인원 (3개월)": 22,
          "취업인원 (6개월)": 24,
          "수료율": 90.0,
          "취업률": 88.9,
          "만족도": 4.6,
          "훈련비": 5000000,
          "정원": 30,
          "총누적매출": 135000000.0,
          "2024년": 135000000.0,
          "조정_2024년": 135000000.0,
          "훈련유형": "신기술 훈련",
          "NCS명": "정보처리",
          "NCS코드": "09010101",
          "선도기업": "",
          "파트너기관": "",
          "is_leading_company_course": false
        }
      ],
      "year": 2024,
      "revenue_mode": "current"
    },
    {
      "institution_name": "그린컴퓨터아카데미",
      "total_revenue": 980000000.25,
      "total_courses_display": "12(2)",
      "total_students_display": "150(30)",
      "completed_students_display": "135(27)",
      "total_employed": 121,
      "completion_rate": 90.0,
      "employment_rate": 89.6,
      "avg_satisfaction": 4.4,
      "completion_rate_detail": "90.0% (135/150)",
      "employment_rate_detail": "89.6% (121/135)",
      "recruitment_rate_detail": "83.3% (150/180)",
      "courses": [],
      "year": 2024,
      "revenue_mode": "current"
    },
    {
      "institution_name": "더조은아카데미",
      "total_revenue": 850000000.75,
      "total_courses_display": "10(1)",
      "total_students_display": "120(20)",
      "completed_students_display": "108(18)",
      "total_employed": 97,
      "completion_rate": 90.0,
      "employment_rate": 89.8,
      "avg_satisfaction": 4.3,
      "completion_rate_detail": "90.0% (108/120)",
      "employment_rate_detail": "89.8% (97/108)",
      "recruitment_rate_detail": "85.7% (120/140)",
      "courses": [],
      "year": 2024,
      "revenue_mode": "current"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "page_size": 10,
    "total_pages": 5
  }
}
```

### 선도기업 과정이 포함된 기관 통계 예시

```json
{
  "institution_name": "코리아IT아카데미",
  "total_revenue": 750000000.0,
  "total_courses_display": "8(2)",
  "total_students_display": "100(25)",
  "completed_students_display": "90(22)",
  "total_employed": 81,
  "completion_rate": 90.0,
  "employment_rate": 90.0,
  "avg_satisfaction": 4.5,
  "courses": [
    {
      "고유값": "KDT-2024-050",
      "과정명": "AI 빅데이터 분석가 양성과정",
      "훈련과정 ID": "COURSE-050",
      "과정시작일": "2024-03-01",
      "과정종료일": "2024-08-31",
      "훈련기관": "코리아IT아카데미",
      "원본훈련기관": "코리아IT아카데미",
      "파트너기관": "삼성SDS",
      "선도기업": "삼성SDS",
      "is_leading_company_course": true,
      "수강신청 인원": 25,
      "수료인원": 23,
      "취업인원": 21,
      "취업인원 (6개월)": 21,
      "수료율": 92.0,
      "취업률": 91.3,
      "만족도": 4.7,
      "총누적매출": 67500000.0,
      "2024년": 75000000.0,
      "조정_2024년": 86250000.0,
      "훈련유형": "선도기업형 훈련",
      "revenue_share_for_institution": 0.9,
      "student_share_for_institution": 1.0
    }
  ]
}
```

---

## 3. 연도별 통계 조회 응답

### GET /api/v1/yearly-stats?year=2024

```json
{
  "status": "success",
  "data": {
    "year": 2024,
    "total_revenue": 15000000000.0,
    "total_students": 5000,
    "completed_students": 4500,
    "total_employed": 4050,
    "overall_completion_rate": 90.0,
    "overall_employment_rate": 90.0,
    "avg_satisfaction": 4.4,
    "course_count": 250,
    "institution_count": 45,
    "monthly_breakdown": [
      {
        "month": "2024-01",
        "revenue": 1250000000.0,
        "total_students": 420,
        "completed_students": 380,
        "completion_rate": 90.5
      },
      {
        "month": "2024-02",
        "revenue": 1180000000.0,
        "total_students": 395,
        "completed_students": 355,
        "completion_rate": 89.9
      }
    ],
    "top_courses": [
      {
        "course_name": "풀스택 웹개발자 양성과정",
        "course_id": "COURSE-001",
        "total_revenue": 135000000.0,
        "total_students": 300,
        "total_completed": 270,
        "completion_rate": 90.0
      }
    ],
    "top_institutions": [
      {
        "institution_name": "이젠아카데미",
        "total_revenue": 1250000000.50,
        "total_students": 200,
        "completion_rate": 90.0
      }
    ]
  }
}
```

---

## 4. 월별 통계 조회 응답

### GET /api/v1/monthly-stats?year=2024

```json
{
  "status": "success",
  "data": [
    {
      "month": "2024-01",
      "revenue": 1250000000.0,
      "total_students": 420,
      "completed_students": 380,
      "completion_rate": 90.5,
      "employment_rate": 89.2,
      "course_count": 35,
      "courses": [
        {
          "course_name": "풀스택 웹개발자 양성과정",
          "course_id": "COURSE-001",
          "institution_name": "이젠아카데미",
          "start_date": "2024-01-15",
          "enrollment": 30,
          "completed": 27
        }
      ]
    },
    {
      "month": "2024-02",
      "revenue": 1180000000.0,
      "total_students": 395,
      "completed_students": 355,
      "completion_rate": 89.9,
      "employment_rate": 88.7,
      "course_count": 32,
      "courses": []
    },
    {
      "month": "2024-03",
      "revenue": 1320000000.0,
      "total_students": 450,
      "completed_students": 405,
      "completion_rate": 90.0,
      "employment_rate": 89.6,
      "course_count": 38,
      "courses": []
    }
  ],
  "year": 2024,
  "summary": {
    "total_revenue": 15000000000.0,
    "total_students": 5000,
    "total_completed": 4500,
    "avg_completion_rate": 90.0,
    "avg_employment_rate": 90.0
  }
}
```

---

## 5. 과정 상세 조회 응답

### GET /api/v1/courses?institution_name=이젠아카데미&year=2024

```json
{
  "status": "success",
  "data": [
    {
      "course_name": "풀스택 웹개발자 양성과정",
      "course_id": "COURSE-001",
      "total_revenue": 135000000.0,
      "total_enrollment": 300,
      "total_completed": 270,
      "total_employed": 243,
      "source_course_count": 10,
      "avg_completion_rate": 90.0,
      "avg_employment_rate": 90.0,
      "avg_satisfaction": 4.5,
      "students_display": "250(50)",
      "graduates_display": "225(45)",
      "open_count_display": "8(2)",
      "training_type": "신기술 훈련",
      "ncs_name": "정보처리",
      "ncs_code": "09010101",
      "year_range": {
        "start": "2024-01-15",
        "end": "2024-12-15"
      },
      "monthly_revenue": {
        "2024-01": 11250000.0,
        "2024-02": 11250000.0,
        "2024-03": 11250000.0,
        "2024-04": 11250000.0,
        "2024-05": 11250000.0,
        "2024-06": 11250000.0
      },
      "completion_rate_detail": "90.0% (270/300)",
      "employment_rate_detail": "90.0% (243/270)",
      "recruitment_rate_detail": "88.2% (300/340)"
    },
    {
      "course_name": "AI 빅데이터 분석가 양성과정",
      "course_id": "COURSE-002",
      "total_revenue": 120000000.0,
      "total_enrollment": 250,
      "total_completed": 225,
      "total_employed": 202,
      "source_course_count": 8,
      "avg_completion_rate": 90.0,
      "avg_employment_rate": 89.8,
      "avg_satisfaction": 4.4,
      "students_display": "200(50)",
      "graduates_display": "180(45)",
      "open_count_display": "6(2)",
      "training_type": "선도기업형 훈련&재직자 훈련",
      "ncs_name": "빅데이터 분석",
      "ncs_code": "09010201",
      "year_range": {
        "start": "2024-02-01",
        "end": "2024-11-30"
      },
      "monthly_revenue": {
        "2024-02": 12000000.0,
        "2024-03": 12000000.0,
        "2024-04": 12000000.0,
        "2024-05": 12000000.0,
        "2024-06": 12000000.0,
        "2024-07": 12000000.0,
        "2024-08": 12000000.0,
        "2024-09": 12000000.0,
        "2024-10": 12000000.0,
        "2024-11": 12000000.0
      },
      "completion_rate_detail": "90.0% (225/250)",
      "employment_rate_detail": "89.8% (202/225)",
      "recruitment_rate_detail": "86.2% (250/290)"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "page_size": 10,
    "total_pages": 2
  }
}
```

---

## 6. 과정 단건 상세 조회 응답

### GET /api/v1/courses/{course_id}

```json
{
  "status": "success",
  "data": {
    "고유값": "KDT-2024-001",
    "과정명": "풀스택 웹개발자 양성과정",
    "훈련과정 ID": "COURSE-001",
    "회차": "1",
    "과정시작일": "2024-01-15",
    "과정종료일": "2024-06-15",
    "총훈련일수": 150,
    "총훈련시간": 1200,
    "훈련기관": "이젠아카데미",
    "원본훈련기관": "이젠컴퓨터아카데미 강남",
    "정원": 30,
    "수강신청 인원": 30,
    "수료인원": 27,
    "수료율": 90.0,
    "취업인원": 24,
    "취업인원 (3개월)": 22,
    "취업인원 (6개월)": 24,
    "취업률": 88.9,
    "취업률 (3개월)": 81.5,
    "취업률 (6개월)": 88.9,
    "만족도": 4.6,
    "훈련비": 5000000,
    "누적매출": 135000000.0,
    "실 매출 대비": 135000000.0,
    "매출 최대": 150000000.0,
    "매출 최소": 120000000.0,
    "2021년": 0.0,
    "2022년": 0.0,
    "2023년": 0.0,
    "2024년": 135000000.0,
    "2025년": 0.0,
    "2026년": 0.0,
    "조정_2021년": 0.0,
    "조정_2022년": 0.0,
    "조정_2023년": 0.0,
    "조정_2024년": 135000000.0,
    "조정_2025년": 0.0,
    "조정_2026년": 0.0,
    "훈련유형": "신기술 훈련",
    "NCS명": "정보처리",
    "NCS코드": "09010101",
    "선도기업": "",
    "파트너기관": "",
    "is_leading_company_course": false,
    "과정페이지링크": "https://example.com/course/001",
    "revenue_adjustment_factor": 1.125,
    "is_old_enough_for_completion_rate": true,
    "days_since_completion": 45,
    "preferred_employment_count": 24,
    "monthly_revenue_distribution": {
      "2024-01": 22500000.0,
      "2024-02": 22500000.0,
      "2024-03": 22500000.0,
      "2024-04": 22500000.0,
      "2024-05": 22500000.0,
      "2024-06": 22500000.0
    }
  }
}
```

---

## 7. 통계 요약 조회 응답

### GET /api/v1/stats/summary?year=2024

```json
{
  "status": "success",
  "data": {
    "year": 2024,
    "overall_stats": {
      "total_revenue": 15000000000.0,
      "total_courses": 250,
      "total_students": 5000,
      "total_completed": 4500,
      "total_employed": 4050,
      "overall_completion_rate": 90.0,
      "overall_employment_rate": 90.0,
      "avg_satisfaction": 4.4,
      "total_institutions": 45
    },
    "completion_rate_breakdown": {
      ">=100%": {
        "count": 50,
        "revenue_adjustment_factor": 1.25
      },
      "75-99%": {
        "count": 150,
        "avg_factor": 1.1
      },
      "50-74%": {
        "count": 40,
        "avg_factor": 0.9
      },
      "<50%": {
        "count": 10,
        "revenue_adjustment_factor": 0.75
      }
    },
    "training_type_distribution": {
      "신기술 훈련": 180,
      "선도기업형 훈련": 40,
      "재직자 훈련": 20,
      "대학주도형 훈련": 10
    },
    "top_performers": {
      "institutions": [
        {
          "institution_name": "이젠아카데미",
          "total_revenue": 1250000000.50,
          "completion_rate": 90.0,
          "employment_rate": 90.0
        }
      ],
      "courses": [
        {
          "course_name": "풀스택 웹개발자 양성과정",
          "total_revenue": 135000000.0,
          "completion_rate": 90.0,
          "employment_rate": 90.0
        }
      ]
    },
    "monthly_trends": {
      "revenue": [
        {"month": "2024-01", "value": 1250000000.0},
        {"month": "2024-02", "value": 1180000000.0},
        {"month": "2024-03", "value": 1320000000.0}
      ],
      "completion_rate": [
        {"month": "2024-01", "value": 90.5},
        {"month": "2024-02", "value": 89.9},
        {"month": "2024-03", "value": 90.0}
      ]
    }
  }
}
```

---

## 8. 에러 응답 예시

### CSV 파싱 오류

```json
{
  "status": "error",
  "error_code": "CSV_PARSE_ERROR",
  "message": "CSV 파일 파싱 중 오류가 발생했습니다.",
  "details": {
    "row": 125,
    "column": "수강신청 인원",
    "value": "invalid",
    "expected_type": "number"
  }
}
```

### 필수 컬럼 누락

```json
{
  "status": "error",
  "error_code": "MISSING_REQUIRED_COLUMN",
  "message": "필수 컬럼이 누락되었습니다.",
  "details": {
    "missing_columns": ["과정명", "훈련기관", "과정시작일"]
  }
}
```

### 데이터 검증 실패

```json
{
  "status": "error",
  "error_code": "DATA_VALIDATION_ERROR",
  "message": "데이터 검증에 실패했습니다.",
  "details": {
    "row": 50,
    "field": "과정종료일",
    "issue": "과정 종료일이 시작일보다 빠릅니다.",
    "start_date": "2024-06-15",
    "end_date": "2024-01-15"
  }
}
```

---

## 9. 특수 케이스 응답 예시

### 3주 규칙 적용된 과정 (수료율 계산에서 제외)

```json
{
  "course_id": "COURSE-999",
  "과정명": "최근 종료된 과정",
  "과정종료일": "2024-12-20",
  "days_since_completion": 5,
  "is_old_enough_for_completion_rate": false,
  "excluded_from_completion_rate": true,
  "exclusion_reason": "과정 종료일이 오늘 기준 21일 이내입니다."
}
```

### 선도기업 과정 매출 분배 상세

```json
{
  "course_id": "COURSE-050",
  "과정명": "AI 빅데이터 분석가 양성과정",
  "훈련기관": "코리아IT아카데미",
  "파트너기관": "삼성SDS",
  "is_leading_company_course": true,
  "total_revenue": 75000000.0,
  "revenue_distribution": {
    "training_institution": {
      "institution_name": "코리아IT아카데미",
      "revenue_share": 0.1,
      "revenue_amount": 7500000.0,
      "student_share": 0.0,
      "student_count": 0
    },
    "partner_institution": {
      "institution_name": "삼성SDS",
      "revenue_share": 0.9,
      "revenue_amount": 67500000.0,
      "student_share": 1.0,
      "student_count": 25
    }
  }
}
```

### 매출 보정 계수 적용 상세

```json
{
  "course_id": "COURSE-001",
  "과정명": "풀스택 웹개발자 양성과정",
  "수료율": 90.0,
  "revenue_calculation": {
    "original_revenue": 120000000.0,
    "completion_rate": 90.0,
    "revenue_adjustment_factor": 1.1,
    "adjusted_revenue": 132000000.0,
    "calculation_formula": "120000000 × (1.0 + (0.25 × (90 - 75) / 25))"
  }
}
```

### X(Y) 표기법 상세

```json
{
  "institution_name": "이젠아카데미",
  "year": 2024,
  "display_fields": {
    "total_courses": {
      "current_year": 15,
      "prev_year": 3,
      "display": "15(3)",
      "explanation": "현재 연도에 시작한 과정 15개, 과거 연도에 시작하여 현재 연도에 진행 중인 과정 3개"
    },
    "total_students": {
      "current_year": 200,
      "prev_year": 50,
      "display": "200(50)",
      "explanation": "현재 연도에 시작한 과정의 수강신청 인원 200명, 과거 연도에 시작한 과정의 수강신청 인원 50명"
    },
    "completed_students": {
      "current_year": 180,
      "prev_year": 45,
      "display": "180(45)",
      "explanation": "현재 연도에 시작하여 현재 연도에 종료된 과정의 수료인원 180명, 과거 연도에 시작하여 현재 연도에 종료된 과정의 수료인원 45명"
    }
  }
}
```

---

## 10. 월별 매출 분배 상세 예시

```json
{
  "course_id": "COURSE-001",
  "과정명": "풀스택 웹개발자 양성과정",
  "과정시작일": "2024-01-15",
  "과정종료일": "2024-06-15",
  "2024년_매출": 135000000.0,
  "monthly_revenue_distribution": {
    "calculation": {
      "months_in_year": 6,
      "revenue_per_month": 22500000.0,
      "formula": "135000000 / 6 = 22500000"
    },
    "breakdown": [
      {
        "month": "2024-01",
        "revenue": 22500000.0,
        "days_in_course": 17,
        "is_start_month": true
      },
      {
        "month": "2024-02",
        "revenue": 22500000.0,
        "days_in_course": 29,
        "is_start_month": false
      },
      {
        "month": "2024-03",
        "revenue": 22500000.0,
        "days_in_course": 31,
        "is_start_month": false
      },
      {
        "month": "2024-04",
        "revenue": 22500000.0,
        "days_in_course": 30,
        "is_start_month": false
      },
      {
        "month": "2024-05",
        "revenue": 22500000.0,
        "days_in_course": 31,
        "is_start_month": false
      },
      {
        "month": "2024-06",
        "revenue": 22500000.0,
        "days_in_course": 15,
        "is_start_month": false
      }
    ]
  }
}
```

---

## 11. 취업 인원 선택 우선순위 예시

```json
{
  "course_id": "COURSE-001",
  "과정명": "풀스택 웹개발자 양성과정",
  "employment_data": {
    "취업인원 (6개월)": 24,
    "취업인원 (3개월)": 22,
    "취업인원 (전체)": 20,
    "preferred_employment_count": 24,
    "selection_priority": "6개월 > 3개월 > 전체",
    "selected_source": "취업인원 (6개월)"
  }
}
```

---

## 12. 훈련 유형 분류 예시

```json
{
  "course_id": "COURSE-050",
  "과정명": "재직자_AI 빅데이터 분석가 양성과정",
  "훈련기관": "서울대학교",
  "파트너기관": "삼성SDS",
  "training_type_classification": {
    "detected_types": [
      "선도기업형 훈련",
      "재직자 훈련",
      "대학주도형 훈련"
    ],
    "final_type": "선도기업형 훈련&재직자 훈련&대학주도형 훈련",
    "classification_rules": {
      "선도기업형 훈련": "파트너기관 존재",
      "재직자 훈련": "과정명에 '재직자_' 포함",
      "대학주도형 훈련": "훈련기관에 '학교' 포함"
    }
  }
}
```

---

## 13. 골든 테스트 케이스 검증 응답

### GET /api/v1/test/golden-cases

```json
{
  "status": "success",
  "test_results": [
    {
      "test_case_id": "GOLDEN-001",
      "institution_name": "이젠아카데미",
      "year": 2024,
      "passed": true,
      "expected": {
        "total_revenue": 1250000000.50,
        "total_courses_display": "15(3)",
        "total_students_display": "200(50)",
        "completed_students_display": "180(45)",
        "completion_rate": 90.0,
        "employment_rate": 90.0
      },
      "actual": {
        "total_revenue": 1250000000.50,
        "total_courses_display": "15(3)",
        "total_students_display": "200(50)",
        "completed_students_display": "180(45)",
        "completion_rate": 90.0,
        "employment_rate": 90.0
      },
      "differences": []
    },
    {
      "test_case_id": "GOLDEN-002",
      "institution_name": "그린컴퓨터아카데미",
      "year": 2024,
      "passed": false,
      "expected": {
        "total_revenue": 980000000.25,
        "total_courses_display": "12(2)",
        "total_students_display": "150(30)",
        "completed_students_display": "135(27)",
        "completion_rate": 90.0,
        "employment_rate": 89.6
      },
      "actual": {
        "total_revenue": 950000000.0,
        "total_courses_display": "12(2)",
        "total_students_display": "150(30)",
        "completed_students_display": "135(27)",
        "completion_rate": 90.0,
        "employment_rate": 89.6
      },
      "differences": [
        {
          "field": "total_revenue",
          "expected": 980000000.25,
          "actual": 950000000.0,
          "difference": -30000000.25,
          "percentage_diff": -3.06
        }
      ]
    },
    {
      "test_case_id": "GOLDEN-003",
      "institution_name": "코리아IT아카데미",
      "year": 2024,
      "passed": true,
      "expected": {
        "total_revenue": 750000000.0,
        "total_courses_display": "8(2)",
        "total_students_display": "100(25)",
        "completed_students_display": "90(22)",
        "completion_rate": 90.0,
        "employment_rate": 90.0,
        "leading_company_course_count": 3
      },
      "actual": {
        "total_revenue": 750000000.0,
        "total_courses_display": "8(2)",
        "total_students_display": "100(25)",
        "completed_students_display": "90(22)",
        "completion_rate": 90.0,
        "employment_rate": 90.0,
        "leading_company_course_count": 3
      },
      "differences": []
    }
  ],
  "summary": {
    "total": 3,
    "passed": 2,
    "failed": 1,
    "pass_rate": 66.67
  },
  "recommendation": "GOLDEN-002 테스트 케이스가 실패했습니다. 매출 계산 로직을 재검토해주세요."
}
```

---

## 14. 기관 그룹화 마스터 리스트 조회 응답

### GET /api/v1/institution-grouping-master

```json
{
  "status": "success",
  "data": {
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
    },
    "last_updated": "2025-01-XX",
    "version": "1.0"
  }
}
```

---

## 참고사항

1. **모든 금액은 원화 단위이며 소수점 2자리까지 표시**
2. **모든 비율은 소수점 1자리까지 표시**
3. **날짜는 ISO 8601 형식 (YYYY-MM-DD) 사용**
4. **X(Y) 표기법에서 Y가 0이면 X만 표시**
5. **3주 규칙: 과정 종료일이 오늘 기준 21일 이내인 과정은 수료율 계산에서 제외**
6. **매출 보정 계수는 수료율에 따라 0.75 ~ 1.25 범위**
7. **선도기업 과정의 매출 분배: 파트너기관 90%, 훈련기관 10%**
8. **선도기업 과정의 학생 수 분배: 파트너기관 100%, 훈련기관 0%**

---

**문서 버전**: 2.0  
**최종 수정일**: 2025-01-XX

---

## 부록: 마이그레이션 가이드

### 프론트엔드 마이그레이션 예시

#### Before (기존 클라이언트 사이드 계산)
```typescript
// ❌ 기존 코드
import { calculateInstitutionStats } from "@/lib/data-utils";

const stats = calculateInstitutionStats(processedData, selectedYear);
const completionRate = (totalCompleted / totalStudents) * 100;
```

#### After (새 API 사용)
```typescript
// ✅ 새 코드
import { KDTStatsAPI } from "@/lib/api-client";

const api = new KDTStatsAPI(process.env.NEXT_PUBLIC_API_URL);
const response = await api.getInstitutionStats(selectedYear);
const stats = response.data;

// API에서 이미 계산된 display 필드 사용
const completionRate = stats.completion_rate;
const completionRateDetail = stats.completion_rate_detail; // "90.0% (180/200)"
```

### 제거해야 할 파일 및 함수 목록

1. **kdt-dashboard-new/src/lib/data-utils.ts**
   - `calculateInstitutionStats` 함수 전체
   - `computeCourseRevenue` 함수 전체
   - `calculateCompletionRate` 함수 전체
   - `calculateMonthlyStatistics` 함수 전체
   - `aggregateCoursesByCourseIdWithLatestInfo` 함수 전체
   - `calculateInstitutionDetailedRevenue` 함수 전체
   - `getPreferredEmploymentCount` 함수 전체
   - `calculateRevenueAdjustmentFactor` 함수 전체
   - `groupInstitutionsAdvanced` 함수 전체 (백엔드로 이동)
   - `transformRawDataToCourseData` 함수 전체 (백엔드로 이동)
   - `transformRawDataArray` 함수 전체 (백엔드로 이동)

2. **kdt-dashboard-new/src/app/institution-analysis/InstitutionAnalysisClient.tsx**
   - 모든 클라이언트 사이드 계산 로직
   - `calculateInstitutionStats` 호출
   - `aggregateCoursesByCourseIdWithLatestInfo` 호출

3. **kdt-dashboard-new/src/app/monthly-analysis/page.tsx**
   - `calculateMonthlyStatistics` 호출
   - `computeCourseRevenue` 호출

4. **kdt-dashboard-new/src/app/yearly-analysis/page.tsx**
   - 모든 통계 계산 로직

5. **kdt-dashboard-new/src/app/employment-analysis/page.tsx**
   - `calculateInstitutionStats` 호출

### 새로 생성해야 할 파일

1. **kdt-dashboard-new/src/lib/api-client.ts**
   - KDTStatsAPI 클래스
   - 모든 API 호출 메서드

2. **kdt-dashboard-new/src/lib/types/api.ts**
   - API 응답 타입 정의
   - InstitutionStatsResponse
   - YearlyStatsResponse
   - MonthlyStatsResponse
   - HealthCheckResponse
