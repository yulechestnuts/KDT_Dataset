// 데이터 파싱 및 변환 유틸리티 (Node.js 환경용)

// 숫자 변환 유틸리티 함수들
export const parseNumber = (value) => {
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
export const parsePercentage = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[%\s]/g, '');
        if (cleaned === '' || cleaned === '-' || cleaned === 'N/A') return 0;
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};


// 날짜 파싱
export const parseDate = (value) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  return new Date();
};

// 훈련 유형 분류 함수
export const classifyTrainingType = (course) => {
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

// 메인 데이터 변환 함수
export const transformRawDataToCourseData = (rawData) => {
  const startDate = parseDate(rawData.과정시작일 || rawData['과정시작일']);
  const endDate = parseDate(rawData.과정종료일 || rawData['과정종료일']);
  
  const timeDiff = endDate.getTime() - startDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  const calculatedDays = daysDiff > 0 ? daysDiff : 0;

  let totalDays = (rawData['총 훈련일수'] !== undefined && rawData['총 훈련일수'] !== null && String(rawData['총 훈련일수']).trim() !== '')
    ? parseNumber(rawData['총 훈련일수'])
    : calculatedDays;

  let totalHours = (rawData['총 훈련시간'] !== undefined && rawData['총 훈련시간'] !== null && String(rawData['총 훈련시간']).trim() !== '')
    ? parseNumber(rawData['총 훈련시간'])
    : totalDays * 8;
  
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

  return {
    고유값: rawData.고유값 || rawData['고유값'] || '',
    과정명: rawData.과정명 || rawData['과정명'] || '',
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
    '수강신청 인원': parseNumber(rawData.수강신청인원 || rawData['수강신청인원'] || rawData['수강신청 인원']),
    '수료인원': parseNumber(rawData.수료인원 || rawData['수료인원']),
    수료율: parsePercentage(rawData.수료율 || rawData['수료율']),
    만족도: parsePercentage(rawData.만족도 || rawData['만족도']),
    훈련연도: parseNumber(rawData.훈련연도 || rawData['훈련연도'] || new Date(rawData.과정시작일).getFullYear()),
    훈련유형: classifyTrainingType(rawData),
    NCS명: String(rawData.NCS명 || rawData['NCS명'] || '').trim(),
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
  };
};

export const transformRawDataArray = (rawDataArray) => {
  let transformedData = rawDataArray.map(transformRawDataToCourseData);

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

export const institutionGroups = {
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

export function groupInstitutionsAdvanced(course) {
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

export function calculateCompletionRate(data, year) {
  if (!data.length) return 0;
  let filteredData = data;

  if (year) {
    filteredData = data.filter(course => new Date(course.과정종료일).getFullYear() === year);
  }

  const validData = filteredData.filter(course => 
    course['수료인원'] > 0 && course['수강신청 인원'] > 0
  );

  if (validData.length === 0) return 0;

  const totalCompletion = validData.reduce((sum, course) => sum + course['수료인원'], 0);
  const totalEnrollment = validData.reduce((sum, course) => sum + course['수강신청 인원'], 0);

  if (totalEnrollment === 0) return 0;

  const completionRate = (totalCompletion / totalEnrollment) * 100;
  return Number(completionRate.toFixed(1));
}

export const applyRevenueAdjustment = (courses, _overallCompletionRate) => {
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

export const calculateAdjustedRevenueForCourse = (
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

  if (minRevenue === 0) return minRevenue;
  if ((course['수강신청 인원'] ?? 0) === 0) return minRevenue;

  let actualCompletionRate = (course['수료인원'] ?? 0) / (course['수강신청 인원'] ?? 1);
  
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
  }

  const a = 2;
  const b = 2;
  const rate = actualCompletionRate;
  const expFactor = 1 - Math.pow(a, -b * rate);
  const adjustedRevenue = minRevenue + (maxRevenue - minRevenue) * expFactor;

  return adjustedRevenue;
};

export const calculateInstitutionStats = (data, year) => {
  const institutionMap = new Map();

  data.forEach(course => {
    const institutionName = course.훈련기관;
    
    // 연도 필터링
    if (year !== undefined) {
      const courseStartYear = new Date(course.과정시작일).getFullYear();
      const courseEndYear = new Date(course.과정종료일).getFullYear();
      
      // 해당 연도에 시작하거나 종료되는 과정만 포함
      if (courseStartYear !== year && courseEndYear !== year) {
        return;
      }
    }

    if (!institutionMap.has(institutionName)) {
      institutionMap.set(institutionName, {
        institutionName,
        totalRevenue: 0,
        totalCourses: 0,
        totalStudents: 0,
        completedStudents: 0,
        completionRate: 0,
        avgSatisfaction: 0,
        courses: [],
        prevYearStudents: 0,
        prevYearCompletedStudents: 0
      });
    }

    const stats = institutionMap.get(institutionName);
    
    // 매출 계산 (조정된 매출 우선, 없으면 원본)
    let revenue = 0;
    if (year !== undefined) {
      const yearKey = `${year}년`;
      const adjustedYearKey = `조정_${year}년`;
      revenue = course[adjustedYearKey] || course[yearKey] || 0;
    } else {
      revenue = course.조정_누적매출 || course.누적매출 || 0;
    }
    
    stats.totalRevenue += revenue;
    stats.totalCourses += 1;
    stats.totalStudents += course['수강신청 인원'] || 0;
    stats.completedStudents += course['수료인원'] || 0;
    stats.courses.push(course);
    
    // 만족도 누적
    if (course.만족도 && course.만족도 > 0) {
      stats.avgSatisfaction += course.만족도;
    }
  });

  // 통계 계산
  const results = Array.from(institutionMap.values()).map(stats => {
    const completionRate = stats.totalStudents > 0 ? (stats.completedStudents / stats.totalStudents) * 100 : 0;
    const avgSatisfaction = stats.courses.filter(c => c.만족도 && c.만족도 > 0).length > 0 
      ? stats.avgSatisfaction / stats.courses.filter(c => c.만족도 && c.만족도 > 0).length 
      : 0;

    return {
      ...stats,
      completionRate,
      avgSatisfaction
    };
  });

  return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
};

export function preprocessData(data) {
  return data.map(row => {
    const newRow = {};
    Object.keys(row).forEach(key => {
      const newKey = key.replace(/\s/g, '');
      newRow[newKey] = row[key];
    });
    return newRow;
  });
}