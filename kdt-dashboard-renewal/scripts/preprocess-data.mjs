import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Node.js 환경에서 사용할 타입 정의 (런타임에 영향을 주지 않도록)
// 실제 런타임에서는 타입 체크가 되지 않으므로 주의
/**
 * @typedef {object} RawCourseData
 * @property {string} 고유값
 * @property {string} 과정명
 * @property {string} 훈련과정ID
 * @property {string} 회차
 * @property {string} 훈련기관
 * @property {string} 총훈련일수
 * @property {string} 총훈련시간
 * @property {Date} 과정시작일
 * @property {Date} 과정종료일
 * @property {string} NCS명
 * @property {string} NCS코드
 * @property {number} 훈련비
 * @property {string} 정원
 * @property {number} 수강신청인원
 * @property {number} 수료인원
 * @property {string} 수료율
 * @property {string} 만족도
 * @property {string} 취업인원
 * @property {string} 취업률
 * @property {string} 지역
 * @property {string} 주소
 * * @property {string} 과정페이지링크
 * @property {string} 선도기업
 * @property {string} 파트너기관
 * @property {number} 매출최대
 * @property {number} 매출최소
 * @property {string} 실매출대비
 * @property {number} '2021년'
 * @property {number} '2022년'
 * @property {number} '2023년'
 * @property {number} '2024년'
 * @property {number} '2025년'
 * @property {number} '2026년'
 */

/**
 * @typedef {object} CourseData
 * @property {string} 고유값
 * @property {string} 훈련기관
 * @property {string} [원본훈련기관]
 * @property {string} ['훈련과정 ID']
 * @property {string} 과정명
 * @property {string} 과정시작일
 * @property {string} 과정종료일
 * @property {number} ['수강신청 인원']
 * @property {number} 수료인원
 * @property {number} [누적매출]
 * @property {number} 총훈련일수
 * @property {number} 총훈련시간
 * @property {number} 훈련비
 * @property {number} 정원
 * @property {number} 수료율
 * @property {number} 만족도
 * @property {number} 취업인원
 * @property {number} 취업률
 * @property {number} ['취업인원 (3개월)']
 * @property {number} ['취업률 (3개월)']
 * @property {number} ['취업인원 (6개월)']
 * @property {number} ['취업률 (6개월)']
 * @property {number} 훈련연도
 * @property {string} 훈련유형
 * @property {string} NCS명
 * @property {string} [NCS코드]
 * @property {string} [파트너기관]
 * @property {string} [선도기업]
 * @property {boolean} [isLeadingCompanyCourse]
 * @property {string} [leadingCompanyPartnerInstitution]
 * @property {number} ['실 매출 대비']
 * @property {number} ['매출 최대']
 * @property {number} ['매출 최소']
 * @property {number} [조정_실매출대비]
 * @property {number} [조정_누적매출]
 * @property {number} ['2021년']
 * @property {number} ['2022년']
 * @property {number} ['2023년']
 * @property {number} ['2024년']
 * @property {number} ['2025년']
 * @property {number} ['2026년']
 * @property {number} [조정_2021년]
 * @property {number} [조정_2022년]
 * @property {number} [조정_2023년]
 * @property {number} [조정_2024년]
 * @property {number} [조정_2025년]
 * @property {number} [조정_2026년]
 * @property {object} [월별매출]
 * @property {object} [월별수강인원]
 * @property {object} [월별수료인원]
 * @property {string} [과정상세]
 * @property {string} [회차]
 * @property {string} [과정페이지링크]
 */

/**
 * @typedef {object} AggregatedCourseData
 * @property {string} 과정명
 * @property {string} ['훈련과정 ID']
 * @property {number} 총수강신청인원
 * @property {number} 총수료인원
 * @property {number} 총누적매출
 * @property {string} 최소과정시작일
 * @property {string} 최대과정종료일
 * @property {string[]} 훈련유형들
 * @property {number} 원천과정수
 * @property {number} 총훈련생수
 * @property {number} 평균만족도
 * @property {number} 평균수료율
 * @property {string} [graduatesStr]
 */

/**
 * @typedef {object} YearlyStats
 * @property {number} year
 * @property {number} revenue
 * @property {number} totalStudents
 * @property {number} completedStudents
 * @property {CourseData[]} courses
 */

/**
 * @typedef {object} MonthlyStats
 * @property {string} month
 * @property {number} revenue
 * @property {number} totalStudents
 * @property {number} completedStudents
 * @property {CourseData[]} courses
 * @property {number} completionRate
 */

/**
 * @typedef {object} InstitutionStat
 * @property {string} institutionName
 * @property {number} totalRevenue
 * @property {number} totalCourses
 * @property {number} totalStudents
 * @property {number} completedStudents
 * @property {number} completionRate
 * @property {number} avgSatisfaction
 * @property {CourseData[]} courses
 * @property {number} prevYearStudents
 * @property {number} prevYearCompletedStudents
 */

// 2. 유틸리티 함수 정의 (kdt-dashboard-new/src/lib/data-utils.ts 에서 복사 및 Node.js 환경에 맞게 수정)

// 숫자 변환 유틸리티 함수들
function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s%원]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === 'N/A') {
      return 0;
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// 퍼센트 값 파싱 (문자열 "88.1%" -> 88.1)
function parsePercentage(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[%\s]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === 'N/A') {
      return 0;
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// 날짜 파싱
function parseDate(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  return new Date();
};

// 훈련 유형 분류 함수 (Python의 classify_training_type 번역)
function classifyTrainingType(course) {
  const types = [];

  const partnerInstitution = String(course.파트너기관 || '').trim();
  if (partnerInstitution !== '' && partnerInstitution !== '0') {
    types.push('선도기업형 훈련');
  }
  const courseName = String(course.과정명 || '').trim();
  if (courseName.includes('재직자_')) {
    types.push('재직자 훈련');
  }
  const trainingInstitution = String(course.훈련기관 || '').trim();
  if (trainingInstitution.includes('학교')) {
    types.push('대학주도형 훈련');
  }
  if (courseName.includes('심화_')) {
    types.push('심화 훈련');
  }
  if (courseName.includes('융합')) {
    types.push('융합 훈련');
  }
  return types.length > 0 ? types.join('&') : '신기술 훈련';
};

// 숫자와 괄호 안 숫자 분리 유틸
function parseNumberWithParen(str) {
  if (typeof str === 'number') return { value: str, display: String(str), paren: null };
  if (typeof str !== 'string') return { value: 0, display: '', paren: null };
  const match = str.match(/^(\d+)(?:\((\d+)\))?$/);
  if (match) {
    return {
      value: parseInt(match[1], 10),
      display: str,
      paren: match[2] ? parseInt(match[2], 10) : null
    };
  }
  return { value: parseNumber(str), display: str, paren: null };
}

// 메인 데이터 변환 함수
function transformRawDataToCourseData(rawData) {
  const startDate = parseDate(rawData.과정시작일 || rawData['과정시작일']);
  const endDate = parseDate(rawData.과정종료일 || rawData['과정종료일']);
  
  const timeDiff = endDate.getTime() - startDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  const calculatedDays = daysDiff > 0 ? daysDiff : 0;

  let totalDays;
  if (
    rawData['총 훈련일수'] !== undefined &&
    rawData['총 훈련일수'] !== null &&
    String(rawData['총 훈련일수']).trim() !== ''
  ) {
    totalDays = parseNumber(rawData['총 훈련일수']);
  } else {
    totalDays = calculatedDays;
  }

  let totalHours;
  if (
    rawData['총 훈련시간'] !== undefined &&
    rawData['총 훈련시간'] !== null &&
    String(rawData['총 훈련시간']).trim() !== ''
  ) {
    totalHours = parseNumber(rawData['총 훈련시간']);
  } else {
    totalHours = totalDays * 8;
  }
  
  let totalCumulativeRevenue = 0;
  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'];
  yearColumns.forEach(yearCol => {
    totalCumulativeRevenue += parseNumber(rawData[yearCol]);
  });

  const isLeadingCompany = (String(rawData.파트너기관 || '').trim() !== '' && String(rawData.파트너기관 || '').trim() !== '0') &&
                           (String(rawData.선도기업 || '').trim() !== '' && String(rawData.선도기업 || '').trim() !== '0');

  const adjustedYearlyRevenues = {};
  yearColumns.forEach(yearCol => {
    const originalRevenue = parseNumber(rawData[yearCol]);
    adjustedYearlyRevenues[`조정_${yearCol}`] = originalRevenue; 
  });

  const parsedEnrollment = parseNumberWithParen(rawData.수강신청인원 || rawData['수강신청인원'] || rawData['수강신청 인원']);
  const parsedCompletion = parseNumberWithParen(rawData.수료인원 || rawData['수료인원']);

  return {
    고유값: rawData.고유값 || rawData['고유값'] || '',
    과정명: rawData.과정명 || rawData['과정명'] || '',
    과정상세: rawData.과정상세 || rawData['과정상세'] || '',
    회차: rawData.회차 || rawData['회차'] || '',
    훈련기관: rawData.훈련기관 || rawData['훈련기관'] || '',
    파트너기관: rawData.파트너기관 || rawData['파트너기관'] || '',
    선도기업: rawData.선도기업 || rawData['선도기업'] || '',
    isLeadingCompanyCourse: isLeadingCompany,
    leadingCompanyPartnerInstitution: isLeadingCompany ? (rawData.파트너기관 || rawData['파트너기관'] || '') : undefined,
    '훈련과정 ID': rawData['훈련과정 ID'] || rawData.훈련과정ID || '',
    
    과정시작일: startDate.toISOString().split('T')[0],
    과정종료일: endDate.toISOString().split('T')[0],

    총훈련일수: totalDays,
    총훈련시간: totalHours,
    훈련비: parseNumber(rawData.훈련비 || rawData['훈련비']),
    정원: parseNumber(rawData.정원 || rawData['정원']),
    '수강신청 인원': parsedEnrollment.value,
    수강신청_표시: parsedEnrollment.display,
    수강신청_괄호: parsedEnrollment.paren,
    '수료인원': parsedCompletion.value,
    수료인원_표시: parsedCompletion.display,
    수료인원_괄호: parsedCompletion.paren,
    수료율: parsePercentage(rawData.수료율 || rawData['수료율']),
    만족도: parsePercentage(rawData.만족도 || rawData['만족도']),
    취업인원: parseNumber(rawData.취업인원 || rawData['취업인원']),
    취업률: parsePercentage(rawData.취업률 || rawData['취업률']),
    '취업인원 (3개월)': parseNumber(rawData['취업인원 (3개월)'] || rawData['취업인원(3개월)'] || 0),
    '취업률 (3개월)': parsePercentage(rawData['취업률 (3개월)'] || rawData['취업률(3개월)'] || 0),
    '취업인원 (6개월)': parseNumber(rawData['취업인원 (6개월)'] || rawData['취업인원(6개월)'] || 0),
    '취업률 (6개월)': parsePercentage(rawData['취업률 (6개월)'] || rawData['취업률(6개월)'] || 0),
    훈련연도: parseNumber(rawData.훈련연도 || rawData['훈련연도'] || new Date(rawData.과정시작일).getFullYear()),
    훈련유형: classifyTrainingType(rawData),
    NCS명: String(rawData.NCS명 || rawData['NCS명'] || '').trim(),
    NCS코드: String(rawData.NCS코드 || rawData['NCS코드'] || '').trim(),
    
    누적매출: totalCumulativeRevenue,
    '실 매출 대비': parsePercentage(rawData.실매출대비 || rawData['실 매출 대비']),
    '매출 최대': parseNumber(rawData.매출최대 || rawData['매출 최대']),
    '매출 최소': parseNumber(rawData.매출최소 || rawData['매출 최소']),
    
    '2021년': parseNumber(rawData['2021년']),
    '2022년': parseNumber(rawData['2022년']),
    '2023년': parseNumber(rawData['2023년']),
    '2024년': parseNumber(rawData['2024년']),
    '2025년': parseNumber(rawData['2025년']),
    '2026년': parseNumber(rawData['2026년']),
    ...adjustedYearlyRevenues,

    월별매출: rawData.월별매출 && typeof rawData.월별매출 === 'object' ? rawData.월별매출 : {},
    월별수강인원: rawData.월별수강인원 && typeof rawData.월별수강인원 === 'object' ? rawData.월별수강인원 : {},
    월별수료인원: rawData.월별수료인원 && typeof rawData.월별수료인원 === 'object' ? rawData.월별수료인원 : {},

    과정페이지링크: String(
      rawData.과정페이지링크 ||
      rawData['과정페이지링크'] ||
      rawData['과정페이지 링크'] ||
      rawData['과정 페이지 링크'] ||
      ''
    ).trim(),
  };
};

const institutionGroups = {
  '이젠아카데미': ['이젠', '이젠컴퓨터학원', '이젠아이티아카데미'],
  '그린컴퓨터아카데미': ['그린', '그린컴퓨터아카데미', '그린아카데미컴퓨터학원'],
  '더조은아카데미': ['더조은', '더조은컴퓨터아카데미', '더조은아이티아카데미'],
  '코리아IT아카데미': ['코리아IT', '코리아아이티', 'KIT', '코리아IT아카데미'],
  '비트교육센터': ['비트', '비트캠프', '비트교육센터'],
  '하이미디어': ['하이미디어', '하이미디어아카데미', '하이미디어컴퓨터학원'],
  '아이티윌': ['아이티윌', 'IT WILL', '아이티윌부산교육센터'],
  '메가스터디': ['메가스터디'],
  '에이콘아카데미': ['에이콘', '에이콘아카데미', '에이콘아카데미(강남)'],
  '한국ICT인재개발원': ['ICT'],
  'MBC아카데미 컴퓨터 교육센터': ['MBC아카데미', '(MBC)'],
  '쌍용아카데미': ['쌍용'],
  'KH정보교육원': ['KH'],
  '(주)솔데스크': ['솔데스크강남학원', '(주)솔데스크', '솔데스크']
};

function groupInstitutionsAdvanced(course) {
  if (!course.훈련기관) return '';
  const cleanName = course.훈련기관
    .replace(/[^가-힣A-Za-z0-9\s()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  for (const [groupName, keywords] of Object.entries(institutionGroups)) {
    for (const keyword of keywords) {
      if (cleanName.includes(keyword.toUpperCase())) {
        return groupName;
      }
    }
  }
  return course.훈련기관;
}

function transformRawDataArray(rawDataArray) {
  let transformedData = rawDataArray.map(transformRawDataToCourseData);

  if (transformedData.length > 0 && '훈련과정 ID' in transformedData[0] && '과정시작일' in transformedData[0] && '과정명' in transformedData[0]) {
    const latestCourseNames = new Map();
    
    const courseGroups = new Map();
    transformedData.forEach(course => {
      if (course['훈련과정 ID']) {
        if (!courseGroups.has(course['훈련과정 ID'])) {
          courseGroups.set(course['훈련과정 ID'], []);
        }
        courseGroups.get(course['훈련과정 ID']).push(course);
      }
    });

    courseGroups.forEach((courses, courseId) => {
      const latestCourse = courses.reduce((latest, current) => {
        return new Date(current.과정시작일) > new Date(latest.과정시작일) ? current : latest;
      });
      latestCourseNames.set(courseId, latestCourse.과정명);
    });
    
    transformedData = transformedData.map(course => {
      return {
        ...course,
        과정명: course['훈련과정 ID'] ? latestCourseNames.get(course['훈련과정 ID']) || course.과정명 : course.과정명
      };
    });
  }

  transformedData = transformedData.map(course => {
    const originalInstitutionName = course.훈련기관;
    const groupedInstitutionName = groupInstitutionsAdvanced(course);
    
    return {
      ...course,
      훈련기관: groupedInstitutionName,
      원본훈련기관: originalInstitutionName
    };
  });
  
  return transformedData;
};

function calculateRevenueAdjustmentFactor(completionRate) {
  let factor = 0;
  if (completionRate >= 100) {
    factor = 1.25;
  } else if (completionRate >= 75) {
    factor = 1.0 + (0.25 * (completionRate - 75) / 25);
  } else if (completionRate >= 50) {
    factor = 0.75 + (0.25 * (completionRate - 50) / 25);
  } else {
    factor = 0.75;
  }
  return factor;
}

const calculateAdjustedRevenueForCourse = (
  course,
  overallCompletionRate,
  courseCompletionRate,
  institutionCompletionRate,
  isFirstTimeCourse,
  courseIdAvgCompletionRateMap
) => {
  const minRevenue = course['실 매출 대비'] ?? course.누적매출 ?? 0;
  const maxRevenue = (typeof course['매출 최대'] === 'number' && !isNaN(course['매출 최대']) && course['매출 최대'] > 0)
    ? course['매출 최대']
    : minRevenue;

  if (minRevenue === 0) {
    return minRevenue;
  }

  if ((course['수강신청 인원'] ?? 0) === 0) {
    return minRevenue;
  }

  let actualCompletionRate = (course['수료인원'] ?? 0) / (course['수강신청 인원'] ?? 1);
  let usedCompletionRate = actualCompletionRate * 100;
  let usedType = '실제';

  if ((course['수료인원'] ?? 0) === 0 || isFirstTimeCourse) {
    let estimatedCompletionRate = 0;
    if (courseIdAvgCompletionRateMap && course['훈련과정 ID'] && courseIdAvgCompletionRateMap.has(course['훈련과정 ID'])) {
      estimatedCompletionRate = courseIdAvgCompletionRateMap.get(course['훈련과정 ID']);
    } else if (courseCompletionRate !== undefined && courseCompletionRate > 0) {
      estimatedCompletionRate = courseCompletionRate;
    } else if (institutionCompletionRate !== undefined && institutionCompletionRate > 0) {
      estimatedCompletionRate = institutionCompletionRate;
    } else {
      estimatedCompletionRate = overallCompletionRate;
    }
    actualCompletionRate = estimatedCompletionRate / 100;
    usedCompletionRate = estimatedCompletionRate;
    usedType = '예상';
  }

  const a = 2;
  const b = 2;
  const rate = actualCompletionRate;
  const expFactor = 1 - Math.pow(a, -b * rate);
  const adjustedRevenue = minRevenue + (maxRevenue - minRevenue) * expFactor;

  return adjustedRevenue;
};

const applyRevenueAdjustment = (
  courses,
  _overallCompletionRate
) => {
  
  const validForOverall = courses.filter(c => (c['수료인원'] ?? 0) > 0 && (c['수강신청 인원'] ?? 0) > 0);
  let overallCompletionRate = 0;
  if (validForOverall.length > 0) {
    const total = validForOverall.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
    const enroll = validForOverall.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
    overallCompletionRate = enroll > 0 ? (total / enroll) * 100 : 0;
  }

  const courseIdAvgCompletionRateMap = new Map();
  const courseIdGroups = new Map();
  courses.forEach(course => {
    const courseId = course['훈련과정 ID'];
    if (!courseId) return;
    if (!courseIdGroups.has(courseId)) courseIdGroups.set(courseId, []);
    courseIdGroups.get(courseId).push(course);
  });
  courseIdGroups.forEach((group, courseId) => {
    const valid = group.filter(c => (c['수료인원'] ?? 0) > 0 && (c['수강신청 인원'] ?? 0) > 0);
    if (valid.length > 0) {
      const total = valid.reduce((sum, c) => sum + (c['수료인원'] ?? 0), 0);
      const enroll = valid.reduce((sum, c) => sum + (c['수강신청 인원'] ?? 0), 0);
      const avg = enroll > 0 ? (total / enroll) * 100 : 0;
      courseIdAvgCompletionRateMap.set(courseId, avg);
    }
  });

  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'];
  const firstTimeCourses = new Set();
  const courseIdStartDateMap = new Map();
  courses.forEach(course => {
    if (course['훈련과정 ID']) {
      const startDate = new Date(course.과정시작일);
      if (!courseIdStartDateMap.has(course['훈련과정 ID']) || startDate < courseIdStartDateMap.get(course['훈련과정 ID'])) {
        courseIdStartDateMap.set(course['훈련과정 ID'], startDate);
      }
    }
  });
  courses.forEach(course => {
    if (course['훈련과정 ID'] && courseIdStartDateMap.has(course['훈련과정 ID'])) {
      if (new Date(course.과정시작일).getTime() === courseIdStartDateMap.get(course['훈련과정 ID']).getTime()) {
        firstTimeCourses.add(course.고유값);
      }
    }
  });
  const intermediate = courses.map(course => {
    const isFirstTime = firstTimeCourses.has(course.고유값);
    const currentCourseCompletionRate = course['훈련과정 ID'] ? courseIdAvgCompletionRateMap.get(course['훈련과정 ID']) : undefined;
    const adjustedTotalRevenue = calculateAdjustedRevenueForCourse(
      course,
      overallCompletionRate,
      currentCourseCompletionRate,
      undefined,
      isFirstTime,
      courseIdAvgCompletionRateMap
    );
    const adjustedYearlyRevenues = {};
    yearColumns.forEach(yearCol => {
      const originalYearlyRevenue = course[yearCol];
      if (originalYearlyRevenue !== undefined) {
        adjustedYearlyRevenues[`조정_${yearCol}`] = calculateAdjustedRevenueForCourse(
          { ...course, 누적매출: originalYearlyRevenue, '실 매출 대비': originalYearlyRevenue },
          overallCompletionRate,
          currentCourseCompletionRate,
          undefined,
          isFirstTime,
          courseIdAvgCompletionRateMap
        );
      }
    });
    return {
      ...course,
      조정_실매출대비: adjustedTotalRevenue,
      조정_누적매출: adjustedTotalRevenue,
      ...adjustedYearlyRevenues,
    };
  });
  return intermediate;
};

const computeCourseRevenue = (
  course,
  year,
) => {
  if (year) {
    const yearlyKey = `${year}년`;
    const adjKey = `조정_${year}년`;
    let baseRevenue = (course[adjKey]) ?? (course[yearlyKey]) ?? 0;

    const alreadyAdjusted = typeof course[adjKey] === 'number';
    if (!alreadyAdjusted) {
      baseRevenue *= calculateRevenueAdjustmentFactor(course['수료율'] ?? 0);
    }
    return baseRevenue;
  }

  const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'];
  const adjustedCols = yearColumns.map(col => `조정_${col}`);

  let baseRevenue = adjustedCols.reduce((sum, key) => {
    return sum + parseNumber(course[key]);
  }, 0);
  if (baseRevenue === 0) {
    if (typeof course.조정_실매출대비 === 'number') {
      baseRevenue = course.조정_실매출대비;
    } else if (typeof course['실 매출 대비'] === 'number') {
      baseRevenue = course['실 매출 대비'];
    } else if (course.누적매출 !== undefined) {
      baseRevenue = course.누적매출;
    }
  }

  const alreadyAdjusted = Object.keys(course).some(k => k.startsWith('조정_'));
  if (!alreadyAdjusted) {
    baseRevenue *= calculateRevenueAdjustmentFactor(course['수료율'] ?? 0);
  }
  return baseRevenue;
};

function aggregateCoursesByCourseName(courses) {
  const aggregatedMap = new Map();

  const latestCourseNames = new Map();
  courses.forEach(course => {
    if (course.훈련과정ID) {
      const existing = latestCourseNames.get(course.훈련과정ID);
      if (!existing || new Date(course.과정시작일) > new Date(existing)) {
        latestCourseNames.set(course.훈련과정ID, course.과정명);
      }
    }
  });

  courses.forEach(course => {
    const key = course.훈련과정ID || course.과정명;
    if (!aggregatedMap.has(key)) {
      const displayName = course.훈련과정ID ? (latestCourseNames.get(course.훈련과정ID) || course.과정명) : course.과정명;
      
      aggregatedMap.set(key, {
        과정명: displayName,
        '훈련과정 ID': course['훈련과정 ID'],
        총수강신청인원: 0,
        총수료인원: 0,
        총누적매출: 0,
        최소과정시작일: course.과정시작일,
        최대과정종료일: course.과정종료일,
        훈련유형들: [],
        원천과정수: 0,
        총훈련생수: 0,
        평균만족도: 0,
        평균수료율: 0,
      });
    }
    const aggregatedCourse = aggregatedMap.get(key);

    const internal = aggregatedCourse;
    if (internal._completionEnrollmentSum === undefined) {
      internal._completionEnrollmentSum = 0;
      internal._completionSum = 0;
      internal._completionWeight = 0;
      internal._satSum = 0;
      internal._satWeight = 0;
    }

    if ((course['수료인원'] ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
      internal._completionEnrollmentSum += course['수강신청 인원'] ?? 0;
      internal._completionSum += course['수료인원'] ?? 0;
      internal._completionWeight += 1;
    }

    if (course.만족도 && course.만족도 > 0) {
      internal._satSum += course.만족도;
      internal._satWeight += 1;
    }

    aggregatedCourse.총수강신청인원 += course['수강신청 인원'];
    aggregatedCourse.총수료인원 += course['수료인원'];
    const revenueForSum =
      course.조정_실매출대비 ??
      (course.누적매출 ?? 0);
    aggregatedCourse.총누적매출 += revenueForSum;
    aggregatedCourse.총훈련생수 += course['수강신청 인원'];
    aggregatedCourse.원천과정수 += 1;

    aggregatedCourse.평균만족도 = internal._satWeight > 0 ? internal._satSum / internal._satWeight : 0;
    aggregatedCourse.평균수료율 = internal._completionWeight > 0 ? (internal._completionSum / internal._completionEnrollmentSum) * 100 : 0;

    if (course.훈련유형 && !aggregatedCourse.훈련유형들.includes(course.훈련유형)) {
      aggregatedCourse.훈련유형들.push(course.훈련유형);
    }

    if (new Date(course.과정시작일) < new Date(aggregatedCourse.최소과정시작일)) {
      aggregatedCourse.최소과정시작일 = course.과정시작일;
    }
    if (new Date(course.과정종료일) > new Date(aggregatedCourse.최대과정종료일)) {
      aggregatedCourse.최대과정종료일 = course.과정종료일;
    }
  });

  return Array.from(aggregatedMap.values()).sort((a, b) => b.총누적매출 - a.총누적매출);
};

function aggregateCoursesByCourseIdWithLatestInfo(courses, year, institutionName) {
  const groupMap = new Map();
  courses.forEach(course => {
    const key = typeof course['훈련과정 ID'] === 'string' ? course['훈련과정 ID'].trim() : '';
    if (!key) return;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(course);
  });

  const result = [];
  groupMap.forEach((group, courseId) => {
    const latest = group.reduce((a, b) => new Date(a.과정시작일) > new Date(b.과정시작일) ? a : b);
    
    const totalRevenue = group.reduce((sum, c) => {
      let revenue = 0;
      if (year !== undefined) {
        const yearKey = `${year}년`;
        revenue = (c[`조정_${yearKey}`]) ?? (c[yearKey]) ?? 0;
      } else {
        revenue = c.조정_누적매출 ?? 0;
      }
      
      let revenueShare = 1;
      if (c.isLeadingCompanyCourse && c.leadingCompanyPartnerInstitution && institutionName) {
        const originalInstitutionName = c.원본훈련기관 || c.훈련기관;
        if (originalInstitutionName === c.leadingCompanyPartnerInstitution && institutionName === originalInstitutionName) {
          revenueShare = 1.0;
        } else {
          const isTrainingInstitution = originalInstitutionName === institutionName;
          const isPartnerInstitution = c.leadingCompanyPartnerInstitution === institutionName;
          const isTrainingInstitutionInGroup = groupInstitutionsAdvanced({ ...c, 훈련기관: originalInstitutionName }) === institutionName;
          const isPartnerInstitutionInGroup = groupInstitutionsAdvanced({ ...c, 훈련기관: c.leadingCompanyPartnerInstitution }) === institutionName;
          if (isPartnerInstitution || isPartnerInstitutionInGroup) {
            revenueShare = 0.9;
          } else if (isTrainingInstitution || isTrainingInstitutionInGroup) {
            revenueShare = 0.1;
          } else {
            revenueShare = 0;
          }
        }
      }
      
      return sum + (revenue * revenueShare);
    }, 0);
    
    const studentsInYear = year ? group.filter(c => new Date(c.과정시작일).getFullYear() === year).reduce((sum, c) => sum + (c['수강신청 인원'] || 0), 0) : group.reduce((sum, c) => sum + (c['수강신청 인원'] || 0), 0);
    const studentsFromPrev = year ? group.filter(c => new Date(c.과정시작일).getFullYear() < year && new Date(c.과정종료일).getFullYear() === year).reduce((sum, c) => sum + (c['수강신청 인원'] || 0), 0) : 0;
    const totalStudents = studentsInYear + studentsFromPrev;

    const graduatesInYear = year ? group.filter(c => new Date(c.과정시작일).getFullYear() === year && new Date(c.과정종료일).getFullYear() === year).reduce((sum, c) => sum + (c.수료인원 || 0), 0) : group.reduce((sum, c) => sum + (c.수료인원 || 0), 0);
    const graduatesFromPrev = year ? group.filter(c => new Date(c.과정시작일).getFullYear() < year && new Date(c.과정종료일).getFullYear() === year).reduce((sum, c) => sum + (c.수료인원 || 0), 0) : 0;
    const totalGraduates = graduatesInYear + graduatesFromPrev;
    
    let studentsStr = studentsFromPrev > 0 ? `${studentsInYear}(${studentsFromPrev})` : `${studentsInYear}`;
    let graduatesStr = graduatesFromPrev > 0 ? `${graduatesInYear}(${graduatesFromPrev})` : `${graduatesInYear}`;
    let openCountStr = `${group.length}`;

    if (year) {
      const openInYear = group.filter(c => new Date(c.과정시작일).getFullYear() === year).length;
      const openFromPrev = group.filter(c => new Date(c.과정시작일).getFullYear() < year && new Date(c.과정종료일).getFullYear() === year).length;

      if (openFromPrev > 0) {
        openCountStr = `${openInYear}(${openFromPrev})`;
      } else {
        openCountStr = `${openInYear}`;
      }
    }
    let displayStudentsForCompletion = totalStudents;
    let displayGraduatesForCompletion = totalGraduates;

    let averageCompletionRate = 0;
    if (year) {
      const validCoursesForCompletion = group.filter(c => {
        const courseEndYear = new Date(c.과정종료일).getFullYear();
        return courseEndYear === year &&
               (c.수료인원 ?? 0) > 0 &&
               (c['수강신청 인원'] ?? 0) > 0;
      });
      if (validCoursesForCompletion.length > 0) {
        const validStudents = validCoursesForCompletion.reduce((sum, c) => sum + (c['수강신청 인원'] || 0), 0);
        const validGraduates = validCoursesForCompletion.reduce((sum, c) => sum + (c.수료인원 || 0), 0);
        averageCompletionRate = validStudents > 0 ? (validGraduates / validStudents) * 100 : 0;
        displayStudentsForCompletion = validStudents;
        displayGraduatesForCompletion = validGraduates;
      }
    } else {
      const validCourses = group.filter(c => (c.수료인원 ?? 0) > 0 && (c['수강신청 인원'] ?? 0) > 0);
      if (validCourses.length > 0) {
        const validStudents = validCourses.reduce((sum, c) => sum + (c['수강신청 인원'] || 0), 0);
        const validGraduates = validCourses.reduce((sum, c) => sum + (c.수료인원 || 0), 0);
        averageCompletionRate = validStudents > 0 ? (validGraduates / validStudents) * 100 : 0;
        displayStudentsForCompletion = validStudents;
        displayGraduatesForCompletion = validGraduates;
      }
    }
    
    result.push({
      과정명: latest.과정명,
      '훈련과정 ID': courseId,
      총수강신청인원: displayStudentsForCompletion,
      총수료인원: displayGraduatesForCompletion,
      총누적매출: totalRevenue,
      최소과정시작일: group.reduce((min, c) => new Date(c.과정시작일) < new Date(min) ? c.과정시작일 : min, group[0].과정시작일),
      최대과정종료일: group.reduce((max, c) => new Date(c.과정종료일) > new Date(max) ? c.과정종료일 : max, group[0].과정종료일),
      훈련유형들: [latest.훈련유형],
      원천과정수: group.length,
      총훈련생수: totalStudents,
      평균만족도: latest.만족도,
      평균수료율: averageCompletionRate,
      studentsStr,
      graduatesStr: graduatesFromPrev > 0 ? `${graduatesInYear}(${graduatesFromPrev})` : `${graduatesInYear}`,
      openCountStr,
    });
  });
  return result.sort((a, b) => b.총누적매출 - a.총누적매출);
}

function calculateInstitutionStats(data, year) {
  const institutionNames = Array.from(new Set(data.map(course => groupInstitutionsAdvanced(course))));
  const result = [];

  institutionNames.forEach(institutionName => {
    const groupedCourses = data.filter(course => groupInstitutionsAdvanced(course) === institutionName);
    const detailed = calculateInstitutionDetailedRevenue(data, institutionName, year);
    const aggregated = aggregateCoursesByCourseIdWithLatestInfo(detailed.courses, year, institutionName);
    const totalRevenue = aggregated.reduce((sum, course) => sum + course.총누적매출, 0);
    const validForCount = detailed.courses.filter(course => {
      const isLeadingWithPartner = course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution;
      if (isLeadingWithPartner && (course.원본훈련기관 || course.훈련기관) === institutionName) return false;
      return true;
    });
    const totalStudents = validForCount.reduce((sum, course) => sum + (course['수강신청 인원'] ?? 0), 0);
    const completedStudents = validForCount.reduce((sum, course) => sum + (course['수료인원'] ?? 0), 0);
    const totalCourses = validForCount.length;
    const validCompletion = detailed.courses.filter(course => {
      const isLeadingWithPartner = course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution;
      if (isLeadingWithPartner && (course.원본훈련기관 || course.훈련기관) === institutionName) return false;
      return course['수료인원'] > 0 && course['수강신청 인원'] > 0;
    });
    const totalValidStudents = validCompletion.reduce((sum, course) => sum + (course['수강신청 인원'] ?? 0), 0);
    const totalValidGraduates = validCompletion.reduce((sum, course) => sum + (course['수료인원'] ?? 0), 0);
    const completionRate = totalValidStudents > 0 ? (totalValidGraduates / totalValidStudents) * 100 : 0;
    const validSatisfaction = detailed.courses.filter(course => {
      const isLeadingWithPartner = course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution;
      if (isLeadingWithPartner && (course.원본훈련기관 || course.훈련기관) === institutionName) return false;
      return course.만족도 && course.만족도 > 0 && course['수료인원'] > 0;
    });
    const totalWeighted = validSatisfaction.reduce((sum, course) => sum + (course.만족도 ?? 0) * (course['수료인원'] ?? 0), 0);
    const totalWeight = validSatisfaction.reduce((sum, course) => sum + (course['수료인원'] ?? 0), 0);
    const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
    let prevYearStudents = 0;
    let prevYearCompletedStudents = 0;
    if (year !== undefined) {
      const prevYearCourses = groupedCourses.filter(course => {
        const courseInstitution = course.원본훈련기관 || course.훈련기관;
        const coursePartner = course.leadingCompanyPartnerInstitution;
        const isTrainingInstitution = courseInstitution === institutionName;
        const isPartnerInstitution = coursePartner === institutionName;
        return (isTrainingInstitution || isPartnerInstitution) &&
               new Date(course.과정시작일).getFullYear() < year &&
               new Date(course.과정종료일).getFullYear() === year;
      });
      prevYearCourses.forEach(course => {
        let studentCount = course['수강신청 인원'] ?? 0;
        let completedCount = course.수료인원 ?? 0;
        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
          const courseInstitution = course.원본훈련기관 || course.훈련기관;
          if (courseInstitution === institutionName) {
            studentCount = 0;
            completedCount = 0;
          }
        }
        prevYearStudents += studentCount;
        prevYearCompletedStudents += completedCount;
      });
    }
    result.push({
      institutionName,
      totalRevenue: totalRevenue ?? 0,
      totalCourses: typeof totalCourses === 'number' && !isNaN(totalCourses) ? totalCourses : 0,
      totalStudents: typeof totalStudents === 'number' && !isNaN(totalStudents) ? totalStudents : 0,
      completedStudents: typeof completedStudents === 'number' && !isNaN(completedStudents) ? completedStudents : 0,
      completionRate: typeof completionRate === 'number' && !isNaN(completionRate) ? completionRate : 0,
      avgSatisfaction: typeof avgSatisfaction === 'number' && !isNaN(avgSatisfaction) ? avgSatisfaction : 0,
      courses: detailed.courses,
      prevYearStudents: typeof prevYearStudents === 'number' && !isNaN(prevYearStudents) ? prevYearStudents : 0,
      prevYearCompletedStudents: typeof prevYearCompletedStudents === 'number' && !isNaN(prevYearCompletedStudents) ? prevYearCompletedStudents : 0
    });
  });

  return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

function calculateInstitutionDetailedRevenue(
  allCourses,
  institutionName,
  year
) => {
  let totalRevenue = 0;
  let totalCourses = 0;
  let totalStudents = 0;
  let completedStudents = 0;
  const courses = [];

  allCourses.forEach(course => {
    const courseInstitution = course.원본훈련기관 || course.훈련기관;
    const coursePartner = course.leadingCompanyPartnerInstitution;
    
    const isInstitutionInGroup = groupInstitutionsAdvanced({ ...course, 훈련기관: courseInstitution }) === institutionName;
    const isPartnerInGroup = coursePartner && groupInstitutionsAdvanced({ ...course, 훈련기관: coursePartner }) === institutionName;

    const isTrainingInstitution = isInstitutionInGroup;
    const isPartnerInstitution = isPartnerInGroup;

    if (!isTrainingInstitution && !isPartnerInstitution) return;

    if (year !== undefined) {
      const startYear = new Date(course.과정시작일).getFullYear();
      const endYear = new Date(course.과정종료일).getFullYear();
      if (!(startYear === year || (startYear < year && endYear === year))) {
        return;
      }
    }

    let revenue = 0;
    if (year !== undefined) {
      const yearKey = `${year}년`;
      revenue = (course[yearKey]) ?? 0;
    } else {
      revenue = course.조정_누적매출 ?? 0;
    }

    if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
      if (courseInstitution === course.leadingCompanyPartnerInstitution && isTrainingInstitution && isPartnerInstitution) {
      } else if (isPartnerInstitution) {
        revenue = revenue * 0.9;
      } else if (isTrainingInstitution) {
        revenue = revenue * 0.1;
      }
    }

    let studentCount = course['수강신청 인원'] ?? 0;
    let completedCount = course.수료인원 ?? 0;
    if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
      if (courseInstitution === course.leadingCompanyPartnerInstitution && isTrainingInstitution && isPartnerInstitution) {
      } else if (isTrainingInstitution) {
        studentCount = 0;
        completedCount = 0;
      }
    }

    totalRevenue += revenue;
    totalStudents += studentCount;
    completedStudents += completedCount;
    courses.push(course);
  });

  totalCourses = courses.length;

  return {
    totalRevenue,
    totalCourses,
    totalStudents,
    completedStudents,
    courses
  };
};

function getIndividualInstitutionsInGroup(
  allCourses,
  groupName,
  year
) => {
  const groupedCourses = allCourses.filter(course => groupInstitutionsAdvanced(course) === groupName);

  const individualInstitutions = [...new Set([
    ...groupedCourses.map(c => c.원본훈련기관 || c.훈련기관),
    ...groupedCourses.map(c => c.leadingCompanyPartnerInstitution).filter(name => Boolean(name))
  ])];

  const individualStats = [];
  individualInstitutions.forEach(originalInstitutionName => {
    const institutionCourses = groupedCourses.filter(course => {
      const courseInstitution = course.원본훈련기관 || course.훈련기관;
      const coursePartner = course.leadingCompanyPartnerInstitution;
      return courseInstitution === originalInstitutionName || coursePartner === originalInstitutionName;
    });
    
    if (institutionCourses.length === 0) return;
    
    const aggregated = aggregateCoursesByCourseIdWithLatestInfo(institutionCourses, year, originalInstitutionName);
    const totalRevenue = aggregated.reduce((sum, course) => sum + course.총누적매출, 0);
    
    let totalStudents = 0;
    let completedStudents = 0;
    let totalCourses = 0;
    
    institutionCourses.forEach(course => {
      const courseInstitution = course.원본훈련기관 || course.훈련기관;
      const coursePartner = course.leadingCompanyPartnerInstitution;
      const isTrainingInstitution = courseInstitution === originalInstitutionName;
      const isPartnerInstitution = coursePartner === originalInstitutionName;
      
      if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
        if (isPartnerInstitution) {
          totalStudents += course['수강신청 인원'] ?? 0;
          completedStudents += course['수료인원'] ?? 0;
          totalCourses += 1;
        }
      } else {
        if (isTrainingInstitution) {
          totalStudents += course['수강신청 인원'] ?? 0;
          completedStudents += course['수료인원'] ?? 0;
          totalCourses += 1;
        }
      }
    });
    
    let totalValidStudents = 0;
    let totalValidGraduates = 0;
    
    institutionCourses.forEach(course => {
      const courseInstitution = course.원본훈련기관 || course.훈련기관;
      const coursePartner = course.leadingCompanyPartnerInstitution;
      const isTrainingInstitution = courseInstitution === originalInstitutionName;
      const isPartnerInstitution = coursePartner === originalInstitutionName;
      
      if (course['수료인원'] > 0 && course['수강신청 인원'] > 0) {
        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
          if (isPartnerInstitution) {
            totalValidStudents += course['수강신청 인원'] ?? 0;
            totalValidGraduates += course['수료인원'] ?? 0;
          }
        } else {
          if (isTrainingInstitution) {
            totalValidStudents += course['수강신청 인원'] ?? 0;
            totalValidGraduates += course['수료인원'] ?? 0;
          }
        }
      }
    });
    
    const completionRate = totalValidStudents > 0 ? (totalValidGraduates / totalValidStudents) * 100 : 0;
    
    let totalWeighted = 0;
    let totalWeight = 0;
    
    institutionCourses.forEach(course => {
      const courseInstitution = course.원본훈련기관 || course.훈련기관;
      const coursePartner = course.leadingCompanyPartnerInstitution;
      const isTrainingInstitution = courseInstitution === originalInstitutionName;
      const isPartnerInstitution = coursePartner === originalInstitutionName;
      
      if (course.만족도 && course.만족도 > 0 && course['수료인원'] > 0) {
        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
          if (isPartnerInstitution) {
            totalWeighted += (course.만족도 ?? 0) * (course['수료인원'] ?? 0);
            totalWeight += course['수료인원'] ?? 0;
          }
        } else {
          if (isTrainingInstitution) {
            totalWeighted += (course.만족도 ?? 0) * (course['수료인원'] ?? 0);
            totalWeight += course['수료인원'] ?? 0;
          }
        }
      }
    });
    
    const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
    
    let prevYearStudents = 0;
    let prevYearCompletedStudents = 0;
    if (year !== undefined) {
      institutionCourses.forEach(course => {
        const courseInstitution = course.원본훈련기관 || course.훈련기관;
        const coursePartner = course.leadingCompanyPartnerInstitution;
        const isTrainingInstitution = courseInstitution === originalInstitutionName;
        const isPartnerInstitution = coursePartner === originalInstitutionName;
        
        const isPrevYearCourse = new Date(course.과정시작일).getFullYear() < year &&
                                new Date(course.과정종료일).getFullYear() === year;
        
        if (isPrevYearCourse) {
          if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
            if (isPartnerInstitution) {
              prevYearStudents += course['수강신청 인원'] ?? 0;
              prevYearCompletedStudents += course['수료인원'] ?? 0;
            }
          } else {
            if (isTrainingInstitution) {
              prevYearStudents += course['수강신청 인원'] ?? 0;
              prevYearCompletedStudents += course['수료인원'] ?? 0;
            }
          }
        }
      });
    }
    
    individualStats.push({
      institutionName: originalInstitutionName,
      totalRevenue: totalRevenue ?? 0,
      totalCourses: typeof totalCourses === 'number' && !isNaN(totalCourses) ? totalCourses : 0,
      totalStudents: typeof totalStudents === 'number' && !isNaN(totalStudents) ? totalStudents : 0,
      completedStudents: typeof completedStudents === 'number' && !isNaN(completedStudents) ? completedStudents : 0,
      completionRate: typeof completionRate === 'number' && !isNaN(completionRate) ? completionRate : 0,
      avgSatisfaction: typeof avgSatisfaction === 'number' && !isNaN(avgSatisfaction) ? avgSatisfaction : 0,
      courses: institutionCourses,
      prevYearStudents: typeof prevYearStudents === 'number' && !isNaN(prevYearStudents) ? prevYearStudents : 0,
      prevYearCompletedStudents: typeof prevYearCompletedStudents === 'number' && !isNaN(prevYearCompletedStudents) ? prevYearCompletedStudents : 0
    });
  });
  return individualStats.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

// 3. 메인 실행 로직
const main = async () => {
  const dataUrl = 'https://raw.githubusercontent.com/yulechestnuts/KDT_Dataset/main/result_kdtdata_202506.csv';
  let rawData = [];

  try {
    const response = await fetch(dataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch data from ${dataUrl}: ${response.statusText}`);
    }
    const csvText = await response.text();
    const parsedCsv = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    rawData = parsedCsv.data;
  } catch (error) {
    console.error(`Error reading or parsing data from URL ${dataUrl}:`, error);
    process.exit(1);
  }

  // 데이터 전처리 및 조정
  const transformedData = transformRawDataArray(rawData);
  const processedData = applyRevenueAdjustment(transformedData, 0);

  // 각 페이지에 필요한 최종 데이터 생성
  const institutionStats = calculateInstitutionStats(processedData);
  const yearlyStats = [2021, 2022, 2023, 2024, 2025, 2026].map(year => calculateYearlyStats(processedData, year));
  const monthlyStats = calculateMonthlyStatistics(processedData);

  // 결과를 JSON 파일로 저장
  const outputDir = path.join(process.cwd(), 'kdt-dashboard-renewal', 'public', 'processed-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outputDir, 'institution-stats.json'), JSON.stringify(institutionStats, null, 2));
  fs.writeFileSync(path.join(outputDir, 'yearly-stats.json'), JSON.stringify(yearlyStats, null, 2));
  fs.writeFileSync(path.join(outputDir, 'monthly-stats.json'), JSON.stringify(monthlyStats, null, 2));
  
  console.log('✅ Data preprocessing complete!');
};

main();