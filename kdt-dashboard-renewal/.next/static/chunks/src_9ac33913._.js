(globalThis.TURBOPACK = globalThis.TURBOPACK || []).push([typeof document === "object" ? document.currentScript : undefined, {

"[project]/src/lib/data-utils.ts [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname, k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
// 데이터 파싱 및 변환 유틸리티
__turbopack_context__.s({
    "aggregateCoursesByCourseIdWithLatestInfo": (()=>aggregateCoursesByCourseIdWithLatestInfo),
    "aggregateCoursesByCourseName": (()=>aggregateCoursesByCourseName),
    "aggregateCoursesByCourseNameActualRevenue": (()=>aggregateCoursesByCourseNameActualRevenue),
    "aggregateCoursesByCourseNameForInstitution": (()=>aggregateCoursesByCourseNameForInstitution),
    "aggregateCoursesByCourseNameForLeadingCompany": (()=>aggregateCoursesByCourseNameForLeadingCompany),
    "aggregateCoursesByCourseNameForNcs": (()=>aggregateCoursesByCourseNameForNcs),
    "applyRevenueAdjustment": (()=>applyRevenueAdjustment),
    "calculateAdjustedRevenueForCourse": (()=>calculateAdjustedRevenueForCourse),
    "calculateCompletionRate": (()=>calculateCompletionRate),
    "calculateCompletionRateWithDetails": (()=>calculateCompletionRateWithDetails),
    "calculateInstitutionDetailedRevenue": (()=>calculateInstitutionDetailedRevenue),
    "calculateInstitutionStats": (()=>calculateInstitutionStats),
    "calculateLeadingCompanyStats": (()=>calculateLeadingCompanyStats),
    "calculateMonthlyStatistics": (()=>calculateMonthlyStatistics),
    "calculateNcsStats": (()=>calculateNcsStats),
    "calculateYearlyStats": (()=>calculateYearlyStats),
    "classifyTrainingType": (()=>classifyTrainingType),
    "computeCourseRevenue": (()=>computeCourseRevenue),
    "csvParseOptions": (()=>csvParseOptions),
    "default": (()=>__TURBOPACK__default__export__),
    "exampleUsage": (()=>exampleUsage),
    "getIndividualInstitutionsInGroup": (()=>getIndividualInstitutionsInGroup),
    "groupInstitutionsAdvanced": (()=>groupInstitutionsAdvanced),
    "institutionGroups": (()=>institutionGroups),
    "parseDate": (()=>parseDate),
    "parseNumber": (()=>parseNumber),
    "parsePercentage": (()=>parsePercentage),
    "preprocessData": (()=>preprocessData),
    "testCompletionRateCalculation": (()=>testCompletionRateCalculation),
    "transformRawDataArray": (()=>transformRawDataArray),
    "transformRawDataToCourseData": (()=>transformRawDataToCourseData),
    "validateCourseData": (()=>validateCourseData)
});
const parseNumber = (value)=>{
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    // 이미 숫자인 경우
    if (typeof value === 'number' && !isNaN(value)) {
        return value;
    }
    // 문자열인 경우 정리 후 변환
    if (typeof value === 'string') {
        // 쉼표, 공백, 특수문자 제거
        const cleaned = value.replace(/[,\s%원]/g, '');
        // 빈 문자열이거나 숫자가 아닌 특수 문자만 있는 경우
        if (cleaned === '' || cleaned === '-' || cleaned === 'N/A') {
            return 0;
        }
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};
const parsePercentage = (value)=>{
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
const parseDate = (value)=>{
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    return new Date();
};
const classifyTrainingType = (course)=>{
    const types = [];
    // 파트너기관이 존재하면 '선도기업형 훈련' 유형 추가 (훈련기관과 동일 여부 무관)
    const partnerInstitution = String(course.파트너기관 || '').trim();
    if (partnerInstitution !== '' && partnerInstitution !== '0') {
        types.push('선도기업형 훈련');
    }
    // 다른 유형 검사 (파트너기관 존재 여부와 관계없이)
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
    if (typeof str === 'number') return {
        value: str,
        display: String(str),
        paren: null
    };
    if (typeof str !== 'string') return {
        value: 0,
        display: '',
        paren: null
    };
    const match = str.match(/^(\d+)(?:\((\d+)\))?$/);
    if (match) {
        return {
            value: parseInt(match[1], 10),
            display: str,
            paren: match[2] ? parseInt(match[2], 10) : null
        };
    }
    return {
        value: parseNumber(str),
        display: str,
        paren: null
    };
}
const transformRawDataToCourseData = (rawData)=>{
    // 과정 시작일과 종료일로부터 훈련 일수와 시간 계산
    const startDate = parseDate(rawData.과정시작일 || rawData['과정시작일']);
    const endDate = parseDate(rawData.과정종료일 || rawData['과정종료일']);
    // 날짜 차이 계산 (일수)
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    const calculatedDays = daysDiff > 0 ? daysDiff : 0;
    // 총훈련일수: 원본 값이 null/undefined/빈 문자열이 아닐 때만 원본 사용, 아니면 계산값 사용
    let totalDays;
    if (rawData['총 훈련일수'] !== undefined && rawData['총 훈련일수'] !== null && String(rawData['총 훈련일수']).trim() !== '') {
        totalDays = parseNumber(rawData['총 훈련일수']);
    } else {
        totalDays = calculatedDays;
    }
    // 총훈련시간: 원본 값이 null/undefined/빈 문자열이 아닐 때만 원본 사용, 아니면 계산값 사용
    let totalHours;
    if (rawData['총 훈련시간'] !== undefined && rawData['총 훈련시간'] !== null && String(rawData['총 훈련시간']).trim() !== '') {
        totalHours = parseNumber(rawData['총 훈련시간']);
    } else {
        totalHours = totalDays * 8;
    }
    // 연도별 매출을 합산하여 누적매출 계산
    let totalCumulativeRevenue = 0;
    const yearColumns = [
        '2021년',
        '2022년',
        '2023년',
        '2024년',
        '2025년',
        '2026년'
    ];
    yearColumns.forEach((yearCol)=>{
        totalCumulativeRevenue += parseNumber(rawData[yearCol]);
    });
    // 선도기업 과정 여부 판단
    const isLeadingCompany = String(rawData.파트너기관 || '').trim() !== '' && String(rawData.파트너기관 || '').trim() !== '0' && String(rawData.선도기업 || '').trim() !== '' && String(rawData.선도기업 || '').trim() !== '0';
    // 조정된 연도별 매출 계산 (여기서는 원본 값을 복사, 최종 조정은 calculateInstitutionStats에서)
    const adjustedYearlyRevenues = {};
    yearColumns.forEach((yearCol)=>{
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
        leadingCompanyPartnerInstitution: isLeadingCompany ? rawData.파트너기관 || rawData['파트너기관'] || '' : undefined,
        '훈련과정 ID': rawData['훈련과정 ID'] || rawData.훈련과정ID || '',
        // 날짜 필드들
        과정시작일: startDate.toISOString().split('T')[0],
        과정종료일: endDate.toISOString().split('T')[0],
        // 숫자 필드들 파싱
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
        // 매출 관련 필드들
        누적매출: totalCumulativeRevenue,
        '실 매출 대비': parsePercentage(rawData.실매출대비 || rawData['실 매출 대비']),
        '매출 최대': parseNumber(rawData.매출최대 || rawData['매출 최대']),
        '매출 최소': parseNumber(rawData.매출최소 || rawData['매출 최소']),
        // 연도별 매출 데이터 및 조정된 연도별 매출
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
        과정페이지링크: String(rawData.과정페이지링크 || rawData['과정페이지링크'] || rawData['과정페이지 링크'] || rawData['과정 페이지 링크'] || '').trim()
    };
};
const transformRawDataArray = (rawDataArray)=>{
    let transformedData = rawDataArray.map(transformRawDataToCourseData);
    // 1. 훈련과정 ID가 같으면 최신 과정명으로 업데이트
    if (transformedData.length > 0 && '훈련과정 ID' in transformedData[0] && '과정시작일' in transformedData[0] && '과정명' in transformedData[0]) {
        // 훈련과정 ID별로 최신 과정명 찾기
        const latestCourseNames = new Map();
        // 훈련과정 ID별로 그룹화하여 최신 과정명 찾기
        const courseGroups = new Map();
        transformedData.forEach((course)=>{
            if (course['훈련과정 ID']) {
                if (!courseGroups.has(course['훈련과정 ID'])) {
                    courseGroups.set(course['훈련과정 ID'], []);
                }
                courseGroups.get(course['훈련과정 ID']).push(course);
            }
        });
        // 각 훈련과정 ID 그룹에서 훈련시작일이 가장 늦은 과정의 과정명을 최신 과정명으로 설정
        courseGroups.forEach((courses, courseId)=>{
            const latestCourse = courses.reduce((latest, current)=>{
                return new Date(current.과정시작일) > new Date(latest.과정시작일) ? current : latest;
            });
            latestCourseNames.set(courseId, latestCourse.과정명);
        });
        // 모든 과정에 최신 훈련명 적용 (중복 제거하지 않고 모든 과정 유지)
        transformedData = transformedData.map((course)=>{
            return {
                ...course,
                과정명: course['훈련과정 ID'] ? latestCourseNames.get(course['훈련과정 ID']) || course.과정명 : course.과정명
            };
        });
    }
    // 훈련기관 그룹화 적용 (원본 기관명 보존)
    transformedData = transformedData.map((course)=>{
        const originalInstitutionName = course.훈련기관; // 원본 기관명 보존
        const groupedInstitutionName = groupInstitutionsAdvanced(course); // 그룹화된 기관명
        return {
            ...course,
            훈련기관: groupedInstitutionName,
            원본훈련기관: originalInstitutionName // 원본 기관명 보존
        };
    });
    return transformedData;
};
const csvParseOptions = {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    delimitersToGuess: [
        ',',
        '\t',
        '|',
        ';'
    ],
    trimHeaders: true,
    transform: (value, header)=>{
        // 헤더에서 공백 제거
        if (typeof value === 'string') {
            return value.trim();
        }
        return value;
    }
};
const validateCourseData = (data)=>{
    const errors = [];
    if (!data.고유값) errors.push('고유값이 없습니다');
    if (!data.훈련기관) errors.push('훈련기관이 없습니다');
    if (data.훈련비 < 0) errors.push('훈련비가 음수입니다');
    if (data.정원 < 0) errors.push('정원이 음수입니다');
    if (data.과정종료일 < data.과정시작일) errors.push('과정 종료일이 시작일보다 빠릅니다');
    return {
        isValid: errors.length === 0,
        errors
    };
};
function calculateCompletionRate(data, year) {
    if (!data.length || !('훈련과정 ID' in data[0])) {
        console.warn("경고: '훈련과정 ID' 컬럼이 없어 과정별 평균 수료율을 계산할 수 없습니다.");
        return 0;
    }
    let filteredData = data;
    if (year) {
        // 해당 연도에 종료된 과정만 필터링
        filteredData = data.filter((course)=>{
            const endDate = new Date(course.과정종료일);
            return endDate.getFullYear() === year;
        });
    }
    // 수료인원이 0인 과정과 수강신청 인원이 0인 과정 제외
    const validData = filteredData.filter((course)=>course['수료인원'] > 0 && course['수강신청 인원'] > 0);
    if (validData.length === 0) {
        return 0;
    }
    // 전체 수료인원 합계를 전체 수강신청 인원 합계로 나눔
    const totalCompletion = validData.reduce((sum, course)=>sum + course['수료인원'], 0);
    const totalEnrollment = validData.reduce((sum, course)=>sum + course['수강신청 인원'], 0);
    if (totalEnrollment === 0) {
        return 0; // 수강신청 인원이 0인 경우 0 반환
    }
    const completionRate = totalCompletion / totalEnrollment * 100;
    return Number(completionRate.toFixed(1));
}
function calculateCompletionRateWithDetails(data, year) {
    let filteredData = data;
    if (year) {
        // 해당 연도에 종료된 과정만 필터링
        filteredData = data.filter((course)=>{
            const endDate = new Date(course.과정종료일);
            return endDate.getFullYear() === year;
        });
    }
    // 수료인원이 0인 과정과 수강신청 인원이 0인 과정 제외
    const validData = filteredData.filter((course)=>course['수료인원'] > 0 && course['수강신청 인원'] > 0);
    const totalCompletion = validData.reduce((sum, course)=>sum + course['수료인원'], 0);
    const totalEnrollment = validData.reduce((sum, course)=>sum + course['수강신청 인원'], 0);
    const completionRate = totalEnrollment > 0 ? totalCompletion / totalEnrollment * 100 : 0;
    return {
        completionRate: Number(completionRate.toFixed(1)),
        totalCourses: data.length,
        validCourses: validData.length,
        excludedByDate: 0,
        excludedByZeroCompletion: data.length - validData.length,
        totalEnrollment,
        totalCompletion,
        details: {
            currentDate: new Date().toISOString().split('T')[0],
            year
        }
    };
}
function calculateYearlyStats(data, year) {
    const yearData = data.filter((course)=>course.훈련연도 === year);
    const totalStudents = yearData.reduce((sum, course)=>sum + course['수강신청 인원'], 0);
    const completedStudents = yearData.reduce((sum, course)=>sum + course['수료인원'], 0);
    const revenue = yearData.reduce((sum, course)=>sum + (course[`${year}년`] || 0), 0);
    return {
        year,
        revenue,
        totalStudents,
        completedStudents,
        courses: yearData
    };
}
const calculateMonthlyStatistics = (data, year)=>{
    const monthlyMap = new Map();
    // 연도 범위 결정
    const startYear = year ?? 2021;
    const endYear = year ?? 2026; // 현재 날짜 대신 고정된 최대 연도 사용
    // 선택된 연도 범위의 모든 월 초기화
    for(let y = startYear; y <= endYear; y++){
        for(let i = 0; i < 12; i++){
            const monthName = `${y}-${String(i + 1).padStart(2, '0')}`;
            monthlyMap.set(monthName, {
                month: monthName,
                revenue: 0,
                totalStudents: 0,
                completedStudents: 0,
                courses: [],
                completionRate: 0
            });
        }
    }
    // 훈련과정 ID별 수료율 평균 계산
    const courseCompletionRates = new Map();
    data.forEach((course)=>{
        if ((course.수료인원 ?? 0) > 0 && course.훈련과정ID) {
            const courseId = course.훈련과정ID;
            const completionRate = (course.수료인원 ?? 0) / (course['수강신청 인원'] ?? 1) * 100;
            if (!courseCompletionRates.has(courseId)) {
                courseCompletionRates.set(courseId, completionRate);
            } else {
                const currentRate = courseCompletionRates.get(courseId);
                courseCompletionRates.set(courseId, (currentRate + completionRate) / 2);
            }
        }
    });
    // 과정 시작일 기준으로 정렬 (기존 로직 유지)
    const sortedData = [
        ...data
    ].sort((a, b)=>new Date(a.과정시작일).getTime() - new Date(b.과정시작일).getTime());
    sortedData.forEach((course)=>{
        const courseStartDate = new Date(course.과정시작일);
        const courseEndDate = new Date(course.과정종료일);
        // 선택된 연도에 해당하는 과정만 처리 (선택된 연도가 없으면 모든 연도 처리)
        for(let y = startYear; y <= endYear; y++){
            const yearColumn = `${y}년`;
            const adjustedRevenue = computeCourseRevenue(course, y); // 해당 연도의 조정된 매출을 가져옴
            if (adjustedRevenue > 0) {
                let monthsInThisCourseYear = 0;
                const currentYearMonths = [];
                const iterStartMonth = y === courseStartDate.getFullYear() ? courseStartDate.getMonth() : 0;
                const iterEndMonth = y === courseEndDate.getFullYear() ? courseEndDate.getMonth() : 11;
                for(let monthIndex = iterStartMonth; monthIndex <= iterEndMonth; monthIndex++){
                    const monthStart = new Date(y, monthIndex, 1);
                    const monthEnd = new Date(y, monthIndex + 1, 0);
                    // 현재 월이 과정의 전체 기간 내에 포함되는지 확인
                    if (monthStart <= courseEndDate && monthEnd >= courseStartDate) {
                        monthsInThisCourseYear++;
                        currentYearMonths.push(`${y}-${String(monthIndex + 1).padStart(2, '0')}`);
                    }
                }
                if (monthsInThisCourseYear > 0) {
                    const revenuePerMonth = adjustedRevenue / monthsInThisCourseYear;
                    currentYearMonths.forEach((monthName)=>{
                        if (monthlyMap.has(monthName)) {
                            monthlyMap.get(monthName).revenue += revenuePerMonth;
                        }
                    });
                }
            }
            // 학생 수 및 과정 정보는 과정 시작 월에만 추가 (기존 로직 유지)
            const courseStartMonthName = `${courseStartDate.getFullYear()}-${String(courseStartDate.getMonth() + 1).padStart(2, '0')}`;
            if (monthlyMap.has(courseStartMonthName) && courseStartDate.getFullYear() === y) {
                const stats = monthlyMap.get(courseStartMonthName);
                stats.totalStudents += course['수강신청 인원'] ?? 0;
                stats.completedStudents += course.수료인원 ?? 0;
                stats.courses.push(course);
            }
        }
    });
    // 각 월별 수료율 계산 (기존 로직 유지)
    monthlyMap.forEach((stats)=>{
        if (stats.courses.length > 0) {
            const validCourses = stats.courses.filter((course)=>(course.수료인원 ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0);
            if (validCourses.length > 0) {
                const totalCompletion = validCourses.reduce((sum, course)=>sum + (course.수료인원 ?? 0), 0);
                const totalEnrollment = validCourses.reduce((sum, course)=>sum + (course['수강신청 인원'] ?? 0), 0);
                stats.completionRate = totalEnrollment > 0 ? totalCompletion / totalEnrollment * 100 : 0;
            }
        }
    });
    return Array.from(monthlyMap.values()).sort((a, b)=>{
        const [aYear, aMonth] = a.month.split('-').map(Number);
        const [bYear, bMonth] = b.month.split('-').map(Number);
        return aYear === bYear ? aMonth - bMonth : aYear - bYear;
    });
};
// 수료율에 따른 매출액 보정 계수 계산 함수
function calculateRevenueAdjustmentFactor(completionRate) {
    let factor = 0;
    if (completionRate >= 100) {
        factor = 1.25; // 100% 이상일 때 1.25배
    } else if (completionRate >= 75) {
        // 75%에서 100% 사이는 선형적으로 1.0에서 1.25로 증가
        factor = 1.0 + 0.25 * (completionRate - 75) / 25;
    } else if (completionRate >= 50) {
        // 50%에서 75% 사이는 선형적으로 0.75에서 1.0으로 증가
        factor = 0.75 + 0.25 * (completionRate - 50) / 25;
    } else {
        // 50% 미만은 0.75배
        factor = 0.75;
    }
    return factor;
}
const calculateInstitutionStats = (data, year)=>{
    // 그룹명 기준으로 institutionNames 추출 (중복 제거)
    const institutionNames = Array.from(new Set(data.map((course)=>groupInstitutionsAdvanced(course))));
    const result = [];
    institutionNames.forEach((institutionName)=>{
        // 그룹명 기준으로 row를 모두 모음
        const groupedCourses = data.filter((course)=>groupInstitutionsAdvanced(course) === institutionName);
        // 상세보기와 동일하게 기관별 상세 매출 데이터 추출 (전체 데이터에서)
        const detailed = calculateInstitutionDetailedRevenue(data, institutionName, year);
        const aggregated = aggregateCoursesByCourseIdWithLatestInfo(detailed.courses, year, institutionName);
        const totalRevenue = aggregated.reduce((sum, course)=>sum + course.총누적매출, 0);
        // 파트너기관이 대체한 운영기관(선도기업 과정에서 훈련기관이지만 파트너기관이 존재하는 경우)은 훈련생수/수료인원/과정수 집계에서 제외
        const validForCount = detailed.courses.filter((course)=>{
            const isLeadingWithPartner = course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution;
            if (isLeadingWithPartner && (course.원본훈련기관 || course.훈련기관) === institutionName) return false;
            return true;
        });
        const totalStudents = validForCount.reduce((sum, course)=>sum + (course['수강신청 인원'] ?? 0), 0);
        const completedStudents = validForCount.reduce((sum, course)=>sum + (course['수료인원'] ?? 0), 0);
        const totalCourses = validForCount.length;
        // 수료인원이 0명인 과정은 제외하고 계산
        const validCompletion = detailed.courses.filter((course)=>{
            const isLeadingWithPartner = course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution;
            if (isLeadingWithPartner && (course.원본훈련기관 || course.훈련기관) === institutionName) return false;
            return course['수료인원'] > 0 && course['수강신청 인원'] > 0;
        });
        const totalValidStudents = validCompletion.reduce((sum, course)=>sum + (course['수강신청 인원'] ?? 0), 0);
        const totalValidGraduates = validCompletion.reduce((sum, course)=>sum + (course['수료인원'] ?? 0), 0);
        const completionRate = totalValidStudents > 0 ? totalValidGraduates / totalValidStudents * 100 : 0;
        // 평균 만족도: 0이 아닌 과정, 수료인원 1명 이상, 파트너기관이 대체한 운영기관은 제외
        const validSatisfaction = detailed.courses.filter((course)=>{
            const isLeadingWithPartner = course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution;
            if (isLeadingWithPartner && (course.원본훈련기관 || course.훈련기관) === institutionName) return false;
            return course.만족도 && course.만족도 > 0 && course['수료인원'] > 0;
        });
        const totalWeighted = validSatisfaction.reduce((sum, course)=>sum + (course.만족도 ?? 0) * (course['수료인원'] ?? 0), 0);
        const totalWeight = validSatisfaction.reduce((sum, course)=>sum + (course['수료인원'] ?? 0), 0);
        const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
        // 이전 연도 시작 과정 정보 계산 (기존 방식 유지)
        let prevYearStudents = 0;
        let prevYearCompletedStudents = 0;
        if (year !== undefined) {
            const prevYearCourses = groupedCourses.filter((course)=>{
                const courseInstitution = course.원본훈련기관 || course.훈련기관;
                const coursePartner = course.leadingCompanyPartnerInstitution;
                const isTrainingInstitution = courseInstitution === institutionName;
                const isPartnerInstitution = coursePartner === institutionName;
                return (isTrainingInstitution || isPartnerInstitution) && new Date(course.과정시작일).getFullYear() < year && new Date(course.과정종료일).getFullYear() === year;
            });
            prevYearCourses.forEach((course)=>{
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
    // 매출액 기준 내림차순 정렬
    return result.sort((a, b)=>b.totalRevenue - a.totalRevenue);
};
const computeCourseRevenue = (course, year)=>{
    // If a specific year is requested, use only that year's revenue columns; otherwise sum all.
    if (year) {
        const yearlyKey = `${year}년`;
        const adjKey = `조정_${year}년`;
        let baseRevenue = course[adjKey] ?? course[yearlyKey] ?? 0;
        // 수료율에 따른 추가 조정 (이미 조정된 경우 스킵)
        const alreadyAdjusted = typeof course[adjKey] === 'number';
        if (!alreadyAdjusted) {
            baseRevenue *= calculateRevenueAdjustmentFactor(course['수료율'] ?? 0);
        }
        return baseRevenue;
    }
    const yearColumns = [
        '2021년',
        '2022년',
        '2023년',
        '2024년',
        '2025년',
        '2026년'
    ];
    const adjustedCols = yearColumns.map((col)=>`조정_${col}`); // as keyof CourseData 제거
    // 1) 조정된 연도별 매출의 합계 (누적매출로 대체)
    let baseRevenue = adjustedCols.reduce((sum, key)=>{
        return sum + parseNumber(course[key]); // key를 CourseData의 유효한 키로 캐스팅
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
    // 3) 수료율에 따른 보정 (이미 조정된 경우 스킵)
    const alreadyAdjusted = Object.keys(course).some((k)=>k.startsWith('조정_'));
    if (!alreadyAdjusted) {
        baseRevenue *= calculateRevenueAdjustmentFactor(course['수료율'] ?? 0);
    }
    return baseRevenue;
};
const aggregateCoursesByCourseNameForInstitution = (courses, institutionName, year)=>{
    const map = new Map();
    // 훈련과정ID별로 최신 과정명 찾기
    const latestCourseNames = new Map();
    courses.forEach((course)=>{
        if (course['훈련과정 ID']) {
            const existing = latestCourseNames.get(course['훈련과정 ID']);
            if (!existing || new Date(course.과정시작일) > new Date(existing)) {
                latestCourseNames.set(course['훈련과정 ID'], course.과정명);
            }
        }
    });
    // === year가 지정된 경우 해당 연도 시작 과정만 합산 ===
    const filteredCourses = year !== undefined ? courses.filter((c)=>new Date(c.과정시작일).getFullYear() === year) : courses;
    filteredCourses.forEach((course)=>{
        let revenueShare = 1;
        let studentShare = 1;
        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
            if (institutionName === course.leadingCompanyPartnerInstitution) {
                revenueShare = 0.9;
                studentShare = 1;
            } else if (institutionName === course.훈련기관) {
                revenueShare = 0.1;
                studentShare = 0; // 선도기업은 훈련생 수 없음
            } else {
                revenueShare = 0;
                studentShare = 0;
            }
        }
        if (revenueShare === 0 && studentShare === 0) return;
        // 실제 매출 값
        const revenueBase = typeof course['조정_실매출대비'] === 'number' && course['조정_실매출대비'] > 0 ? course['조정_실매출대비'] : typeof course['실 매출 대비'] === 'number' ? course['실 매출 대비'] : 0;
        const revenue = revenueBase * revenueShare;
        const key = course.과정명;
        if (!map.has(key)) {
            map.set(key, {
                과정명: key,
                총수강신청인원: 0,
                총수료인원: 0,
                총누적매출: 0,
                최소과정시작일: course.과정시작일,
                최대과정종료일: course.과정종료일,
                훈련유형들: [],
                원천과정수: 0,
                총훈련생수: 0,
                평균만족도: 0,
                평균수료율: 0
            });
        }
        const agg = map.get(key);
        // 수료율 및 만족도 계산을 위한 임시 변수
        const internal = agg;
        if (internal._completionEnrollmentSum === undefined) {
            internal._completionEnrollmentSum = 0;
            internal._completionSum = 0;
            internal._completionWeight = 0; // 수료율 가중치 추가
            internal._satSum = 0;
            internal._satWeight = 0;
        }
        // 수료인원이 0이 아닌 경우에만 수료율 계산 모수에 포함
        if ((course['수료인원'] ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
            internal._completionEnrollmentSum += course['수강신청 인원'] ?? 0;
            internal._completionSum += course['수료인원'] ?? 0;
            internal._completionWeight += 1;
        }
        // 만족도 평균 (만족도가 0이 아닌 경우에만 모수에 포함)
        if (course.만족도 && course.만족도 > 0) {
            internal._satSum += course.만족도;
            internal._satWeight += 1;
        }
        // === year가 지정된 경우 해당 연도 시작 과정만 집계 ===
        agg.총수강신청인원 += course['수강신청 인원'];
        agg.총수료인원 += course['수료인원'];
        const revenueForSum = course.조정_실매출대비 ?? course.누적매출 ?? 0;
        agg.총누적매출 += revenueForSum;
        agg.총훈련생수 += course['수강신청 인원'];
        agg.원천과정수 += 1;
        // 최종 평균 계산
        agg.평균만족도 = internal._satWeight > 0 ? internal._satSum / internal._satWeight : 0;
        agg.평균수료율 = internal._completionWeight > 0 ? internal._completionSum / internal._completionEnrollmentSum * 100 : 0;
        // 훈련 유형
        if (course.훈련유형 && !agg.훈련유형들.includes(course.훈련유형)) {
            agg.훈련유형들.push(course.훈련유형);
        }
        // 날짜 업데이트
        if (new Date(course.과정시작일) < new Date(agg.최소과정시작일)) {
            agg.최소과정시작일 = course.과정시작일;
        }
        if (new Date(course.과정종료일) > new Date(agg.최대과정종료일)) {
            agg.최대과정종료일 = course.과정종료일;
        }
    });
    return Array.from(map.values()).sort((a, b)=>b.총누적매출 - a.총누적매출);
};
const calculateNcsStats = (data, year)=>{
    const map = new Map();
    data.forEach((course)=>{
        const key = course.NCS명 || '기타';
        if (!map.has(key)) {
            map.set(key, {
                totalRevenue: 0,
                totalCourses: 0,
                totalStudents: 0,
                completedStudents: 0,
                satisfactionSum: 0,
                satisfactionCoursesCount: 0,
                courses: [],
                prevYearStudents: 0,
                prevYearCompletedStudents: 0
            });
        }
        const stat = map.get(key);
        // 매출 계산
        let revenue = 0;
        if (year !== undefined) {
            const yearKey = `조정_${year}년`;
            revenue = course[yearKey] ?? 0;
        } else {
            revenue = course.조정_누적매출 ?? course.누적매출 ?? 0;
        }
        stat.totalRevenue += revenue;
        // === 통계는 '과정 시작 연도' 기준으로만 합산 ===
        const courseStartYear = new Date(course.과정시작일).getFullYear();
        const courseEndYear = new Date(course.과정종료일).getFullYear();
        if (year === undefined || courseStartYear === year) {
            stat.totalStudents += course['수강신청 인원'] ?? 0;
            stat.completedStudents += course['수료인원'] ?? 0;
            if ((course.만족도 ?? 0) > 0) {
                stat.satisfactionSum += course.만족도 ?? 0;
                stat.satisfactionCoursesCount += 1;
            }
            stat.totalCourses += 1;
        } else if (year !== undefined && courseStartYear < year && courseEndYear === year) {
            // 이전 연도에 시작해서 해당 연도에 종료된 과정
            stat.prevYearStudents += course['수강신청 인원'] ?? 0;
            stat.prevYearCompletedStudents += course['수료인원'] ?? 0;
        }
        stat.courses.push(course);
    });
    const result = Array.from(map.entries()).map(([name, stats])=>{
        const { totalRevenue, totalCourses, totalStudents, completedStudents, satisfactionSum, satisfactionCoursesCount, courses, prevYearStudents, prevYearCompletedStudents } = stats;
        // === 수료율 계산: 해당 연도 시작 과정 + 이전 연도 시작하여 해당 연도 종료된 과정 ===
        let validCompletedStudents = 0;
        let validTotalStudents = 0;
        if (year !== undefined) {
            courses.forEach((course)=>{
                const courseStartYear = new Date(course.과정시작일).getFullYear();
                const courseEndYear = new Date(course.과정종료일).getFullYear();
                // 해당 연도에 시작한 과정이거나 이전 연도에 시작해서 해당 연도에 종료된 과정
                if ((courseStartYear === year || courseStartYear < year && courseEndYear === year) && (course.수료인원 ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
                    validCompletedStudents += course.수료인원;
                    validTotalStudents += course['수강신청 인원'];
                }
            });
        } else {
            courses.forEach((course)=>{
                if ((course.수료인원 ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
                    validCompletedStudents += course.수료인원;
                    validTotalStudents += course['수강신청 인원'];
                }
            });
        }
        const completionRate = validTotalStudents > 0 ? validCompletedStudents / validTotalStudents * 100 : 0;
        return {
            ncsName: name,
            totalRevenue,
            totalCourses,
            totalStudents,
            completedStudents,
            completionRate,
            avgSatisfaction: satisfactionCoursesCount > 0 ? satisfactionSum / satisfactionCoursesCount : 0,
            courses,
            prevYearStudents,
            prevYearCompletedStudents
        };
    });
    return result.sort((a, b)=>b.totalRevenue - a.totalRevenue);
};
const aggregateCoursesByCourseNameForNcs = (courses, ncsName, year)=>{
    const filtered = courses.filter((c)=>(c.NCS명 || '기타') === ncsName && (year ? new Date(c.과정시작일).getFullYear() === year : true));
    return aggregateCoursesByCourseName(filtered);
};
const aggregateCoursesByCourseNameActualRevenue = (courses, institutionName)=>{
    const map = new Map();
    // 훈련과정ID별로 최신 과정명 찾기
    const latestCourseNames = new Map();
    courses.forEach((course)=>{
        if (course.훈련과정ID) {
            const existing = latestCourseNames.get(course.훈련과정ID);
            if (!existing || new Date(course.과정시작일) > new Date(existing)) {
                latestCourseNames.set(course.훈련과정ID, course.과정명);
            }
        }
    });
    courses.forEach((course)=>{
        // 지분 계산 (매출 90/10, 학생 100/0)
        let revenueShare = 1;
        let studentShare = 1;
        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
            if (institutionName === course.leadingCompanyPartnerInstitution) {
                revenueShare = 0.9;
                studentShare = 1;
            } else if (institutionName === course.훈련기관) {
                revenueShare = 0.1;
                studentShare = 0; // 선도기업은 학생 수 없음
            } else {
                revenueShare = 0;
                studentShare = 0;
            }
        }
        if (revenueShare === 0 && studentShare === 0) return;
        // 공통적으로 계산한 단일 매출값 (일할/수료율 보정 포함)
        const revenue = computeCourseRevenue(course) * revenueShare;
        const key = course.훈련과정ID || course.과정명; // 훈련과정ID를 우선 사용, 없으면 과정명 사용
        if (!map.has(key)) {
            // 훈련과정ID가 있는 경우 최신 과정명 사용, 없는 경우 원본 과정명 사용
            const displayName = course.훈련과정ID ? latestCourseNames.get(course.훈련과정ID) || course.과정명 : course.과정명;
            map.set(key, {
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
                평균수료율: 0
            });
        }
        const agg = map.get(key);
        // 수료율 및 만족도 계산을 위한 임시 변수
        const internal = agg;
        if (internal._completionEnrollmentSum === undefined) {
            internal._completionEnrollmentSum = 0;
            internal._completionSum = 0;
            internal._completionWeight = 0; // 수료율 가중치 추가
            internal._satSum = 0;
            internal._satWeight = 0;
        }
        // 수료인원이 0이 아닌 경우에만 수료율 계산 모수에 포함
        if ((course['수료인원'] ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
            internal._completionEnrollmentSum += course['수강신청 인원'] ?? 0;
            internal._completionSum += course['수료인원'] ?? 0;
            internal._completionWeight += 1;
        }
        // 만족도 평균 (만족도가 0이 아닌 경우에만 모수에 포함)
        if (course.만족도 && course.만족도 > 0) {
            internal._satSum += course.만족도;
            internal._satWeight += 1;
        }
        // 기존 로직 유지
        agg.총수강신청인원 += course['수강신청 인원'];
        agg.총수료인원 += course['수료인원'];
        const revenueForSum = course.조정_실매출대비 ?? course.누적매출 ?? 0;
        agg.총누적매출 += revenueForSum;
        agg.총훈련생수 += course['수강신청 인원'];
        agg.원천과정수 += 1;
        // 최종 평균 계산
        agg.평균만족도 = internal._satWeight > 0 ? internal._satSum / internal._satWeight : 0;
        agg.평균수료율 = internal._completionWeight > 0 ? internal._completionSum / internal._completionEnrollmentSum * 100 : 0;
        // 훈련 유형
        if (course.훈련유형 && !agg.훈련유형들.includes(course.훈련유형)) {
            agg.훈련유형들.push(course.훈련유형);
        }
        // 날짜 업데이트
        if (new Date(course.과정시작일) < new Date(agg.최소과정시작일)) {
            agg.최소과정시작일 = course.과정시작일;
        }
        if (new Date(course.과정종료일) > new Date(agg.최대과정종료일)) {
            agg.최대과정종료일 = course.과정종료일;
        }
    });
    // NOTE: _satSum / _satWeight 내부 키는 반환 이전에 굳이 제거할 필요가 없지만, 타입 안전을 위해 삭제.
    // map.forEach(agg => { delete (agg as any)._satSum; delete (agg as any)._satWeight; });
    return Array.from(map.values()).sort((a, b)=>b.총누적매출 - a.총누적매출);
};
const calculateLeadingCompanyStats = (data, year)=>{
    // 필터: 선도기업 과정만
    const filteredAll = data.filter((c)=>c.isLeadingCompanyCourse);
    const filtered = year ? filteredAll.filter((c)=>new Date(c.과정시작일).getFullYear() === year) : filteredAll;
    const map = new Map();
    filtered.forEach((course)=>{
        const key = course.선도기업 || '기타';
        if (!map.has(key)) {
            map.set(key, {
                leadingCompany: key,
                totalRevenue: 0,
                totalCourses: 0,
                totalStudents: 0,
                completedStudents: 0,
                completionRate: 0,
                avgSatisfaction: 0,
                courses: []
            });
        }
        const stat = map.get(key);
        stat.totalRevenue += course.조정_누적매출 ?? course.누적매출 ?? 0;
        stat.totalCourses += 1;
        stat.totalStudents += course['수강신청 인원'] ?? 0;
        stat.completedStudents += course['수료인원'] ?? 0;
        stat.courses.push(course);
        const idx = stat.courses.length;
        stat.avgSatisfaction = (stat.avgSatisfaction * (idx - 1) + (course.만족도 || 0)) / idx;
    });
    map.forEach((stat)=>{
        stat.completionRate = stat.totalStudents > 0 ? stat.completedStudents / stat.totalStudents * 100 : 0;
    });
    return Array.from(map.values()).sort((a, b)=>b.totalRevenue - a.totalRevenue);
};
const aggregateCoursesByCourseNameForLeadingCompany = (courses, leadingCompany, year)=>{
    const filtered = courses.filter((c)=>c.isLeadingCompanyCourse && (c.선도기업 || '기타') === leadingCompany && (year ? new Date(c.과정시작일).getFullYear() === year : true));
    return aggregateCoursesByCourseName(filtered);
};
function testCompletionRateCalculation() {
    const testData = [
        {
            고유값: "test1",
            훈련기관: "기관A",
            과정명: "과정1",
            과정시작일: "2024-01-01",
            과정종료일: "2024-03-01",
            '수강신청 인원': 20,
            '수료인원': 18,
            누적매출: 1000000,
            총훈련일수: 60,
            총훈련시간: 480,
            훈련비: 1000000,
            정원: 25,
            '수료율': 90,
            만족도: 85,
            취업인원: 15,
            취업률: 75,
            '취업인원 (3개월)': 12,
            '취업률 (3개월)': 60,
            '취업인원 (6개월)': 15,
            '취업률 (6개월)': 75,
            훈련연도: 2024,
            훈련유형: "일반",
            NCS명: "테스트"
        },
        {
            고유값: "test2",
            훈련기관: "기관B",
            과정명: "과정2",
            과정종료일: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            과정시작일: "2024-01-01",
            '수강신청 인원': 15,
            '수료인원': 12,
            누적매출: 500000,
            총훈련일수: 30,
            총훈련시간: 240,
            훈련비: 500000,
            정원: 20,
            '수료율': 80,
            만족도: 80,
            취업인원: 10,
            취업률: 67,
            '취업인원 (3개월)': 8,
            '취업률 (3개월)': 53,
            '취업인원 (6개월)': 10,
            '취업률 (6개월)': 67,
            훈련연도: 2024,
            훈련유형: "일반",
            NCS명: "테스트"
        },
        {
            고유값: "test3",
            훈련기관: "기관C",
            과정명: "과정3",
            과정종료일: "2024-02-01",
            과정시작일: "2024-01-01",
            '수강신청 인원': 10,
            '수료인원': 0,
            누적매출: 0,
            총훈련일수: 30,
            총훈련시간: 240,
            훈련비: 500000,
            정원: 15,
            '수료율': 0,
            만족도: 0,
            취업인원: 0,
            취업률: 0,
            '취업인원 (3개월)': 0,
            '취업률 (3개월)': 0,
            '취업인원 (6개월)': 0,
            '취업률 (6개월)': 0,
            훈련연도: 2024,
            훈련유형: "일반",
            NCS명: "테스트"
        }
    ];
    console.log('=== 수료율 계산 테스트 ===');
    const result = calculateCompletionRateWithDetails(testData, 2024);
    console.log('상세 결과:', result);
    const simpleResult = calculateCompletionRate(testData, 2024);
    console.log('간단 결과:', simpleResult);
    // 예상 결과: test1만 유효 (18/20 = 90%)
    console.log('예상 수료율: 90%');
    // 기관별 통계 테스트
    console.log('\n=== 기관별 통계 ===');
    const institutionStats = calculateInstitutionStats(testData);
    console.log('기관별 통계:', institutionStats);
}
const exampleUsage = ()=>{
    // 예시 원본 데이터 (CSV에서 읽어온 것처럼)
    const rawData = {
        고유값: "AIG202300004555885",
        과정명: "클라우드 기반 빅데이터 융합 자바(JAVA) 풀스택개발자 양성과정",
        총훈련일수: "180",
        총훈련시간: "1440",
        훈련비: "9,097,920",
        정원: "25",
        수료율: "85.5%",
        만족도: "88.1",
        과정시작일: "2025-04-30",
        과정종료일: "2025-10-28"
    };
    // 변환
    const transformedData = transformRawDataToCourseData(rawData);
    console.log('변환된 데이터:', transformedData);
    // 검증
    const validation = validateCourseData(transformedData);
    console.log('검증 결과:', validation);
};
const __TURBOPACK__default__export__ = {
    parseNumber,
    parsePercentage,
    parseDate,
    transformRawDataToCourseData,
    transformRawDataArray,
    calculateCompletionRate,
    calculateCompletionRateWithDetails,
    calculateYearlyStats,
    calculateMonthlyStatistics,
    calculateInstitutionStats,
    validateCourseData,
    csvParseOptions,
    testCompletionRateCalculation,
    exampleUsage
};
const aggregateCoursesByCourseName = (courses)=>{
    const aggregatedMap = new Map();
    // 훈련과정ID별로 최신 과정명 찾기
    const latestCourseNames = new Map();
    courses.forEach((course)=>{
        if (course.훈련과정ID) {
            const existing = latestCourseNames.get(course.훈련과정ID);
            if (!existing || new Date(course.과정시작일) > new Date(existing)) {
                latestCourseNames.set(course.훈련과정ID, course.과정명);
            }
        }
    });
    courses.forEach((course)=>{
        const key = course.훈련과정ID || course.과정명; // 훈련과정ID를 우선 사용, 없으면 과정명 사용
        if (!aggregatedMap.has(key)) {
            // 훈련과정ID가 있는 경우 최신 과정명 사용, 없는 경우 원본 과정명 사용
            const displayName = course.훈련과정ID ? latestCourseNames.get(course.훈련과정ID) || course.과정명 : course.과정명;
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
                평균수료율: 0
            });
        }
        const aggregatedCourse = aggregatedMap.get(key);
        // 수료율 및 만족도 계산을 위한 임시 변수
        const internal = aggregatedCourse;
        if (internal._completionEnrollmentSum === undefined) {
            internal._completionEnrollmentSum = 0;
            internal._completionSum = 0;
            internal._completionWeight = 0;
            internal._satSum = 0;
            internal._satWeight = 0;
        }
        // 수료인원이 0이 아닌 경우에만 수료율 계산 모수에 포함
        if ((course['수료인원'] ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
            internal._completionEnrollmentSum += course['수강신청 인원'] ?? 0;
            internal._completionSum += course['수료인원'] ?? 0;
            internal._completionWeight += 1;
        }
        // 만족도 평균 (만족도가 0이 아닌 경우에만 모수에 포함)
        if (course.만족도 && course.만족도 > 0) {
            internal._satSum += course.만족도;
            internal._satWeight += 1;
        }
        // 기존 로직 유지
        aggregatedCourse.총수강신청인원 += course['수강신청 인원'];
        aggregatedCourse.총수료인원 += course['수료인원'];
        const revenueForSum = course.조정_실매출대비 ?? course.누적매출 ?? 0;
        aggregatedCourse.총누적매출 += revenueForSum;
        aggregatedCourse.총훈련생수 += course['수강신청 인원'];
        aggregatedCourse.원천과정수 += 1;
        // 최종 평균 계산
        aggregatedCourse.평균만족도 = internal._satWeight > 0 ? internal._satSum / internal._satWeight : 0;
        aggregatedCourse.평균수료율 = internal._completionWeight > 0 ? internal._completionSum / internal._completionEnrollmentSum * 100 : 0;
        // 훈련 유형
        if (course.훈련유형 && !aggregatedCourse.훈련유형들.includes(course.훈련유형)) {
            aggregatedCourse.훈련유형들.push(course.훈련유형);
        }
        // 날짜 업데이트
        if (new Date(course.과정시작일) < new Date(aggregatedCourse.최소과정시작일)) {
            aggregatedCourse.최소과정시작일 = course.과정시작일;
        }
        if (new Date(course.과정종료일) > new Date(aggregatedCourse.최대과정종료일)) {
            aggregatedCourse.최대과정종료일 = course.과정종료일;
        }
    });
    return Array.from(aggregatedMap.values()).sort((a, b)=>b.총누적매출 - a.총누적매출);
};
const institutionGroups = {
    '이젠아카데미': [
        '이젠',
        '이젠컴퓨터학원',
        '이젠아이티아카데미'
    ],
    '그린컴퓨터아카데미': [
        '그린',
        '그린컴퓨터아카데미',
        '그린아카데미컴퓨터학원'
    ],
    '더조은아카데미': [
        '더조은',
        '더조은컴퓨터아카데미',
        '더조은아이티아카데미'
    ],
    '코리아IT아카데미': [
        '코리아IT',
        '코리아아이티',
        'KIT',
        '코리아IT아카데미'
    ],
    '비트교육센터': [
        '비트',
        '비트캠프',
        '비트교육센터'
    ],
    '하이미디어': [
        '하이미디어',
        '하이미디어아카데미',
        '하이미디어컴퓨터학원'
    ],
    '아이티윌': [
        '아이티윌',
        'IT WILL',
        '아이티윌부산교육센터'
    ],
    '메가스터디': [
        '메가스터디'
    ],
    '에이콘아카데미': [
        '에이콘',
        '에이콘아카데미',
        '에이콘아카데미(강남)'
    ],
    '한국ICT인재개발원': [
        'ICT'
    ],
    'MBC아카데미 컴퓨터 교육센터': [
        'MBC아카데미',
        '(MBC)'
    ],
    '쌍용아카데미': [
        '쌍용'
    ],
    'KH정보교육원': [
        'KH'
    ],
    '(주)솔데스크': [
        '솔데스크강남학원',
        '(주)솔데스크',
        '솔데스크'
    ]
};
function groupInstitutionsAdvanced(course) {
    if (!course.훈련기관) return '';
    const cleanName = course.훈련기관.replace(/[^가-힣A-Za-z0-9\s()]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
    for (const [groupName, keywords] of Object.entries(institutionGroups)){
        for (const keyword of keywords){
            if (cleanName.includes(keyword.toUpperCase())) {
                return groupName;
            }
        }
    }
    return course.훈련기관; // 매칭되는 그룹이 없으면 원래 기관명 반환
}
function aggregateCoursesByCourseIdWithLatestInfo(courses, year, institutionName) {
    const groupMap = new Map();
    courses.forEach((course)=>{
        const key = typeof course['훈련과정 ID'] === 'string' ? course['훈련과정 ID'].trim() : '';
        if (!key) return;
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key).push(course);
    });
    const result = [];
    groupMap.forEach((group, courseId)=>{
        const latest = group.reduce((a, b)=>new Date(a.과정시작일) > new Date(b.과정시작일) ? a : b);
        const totalRevenue = group.reduce((sum, c)=>{
            let revenue = 0;
            if (year !== undefined) {
                const yearKey = `조정_${year}년`;
                revenue = c[yearKey] ?? 0;
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
                    const isTrainingInstitutionInGroup = groupInstitutionsAdvanced({
                        ...c,
                        훈련기관: originalInstitutionName
                    }) === institutionName;
                    const isPartnerInstitutionInGroup = groupInstitutionsAdvanced({
                        ...c,
                        훈련기관: c.leadingCompanyPartnerInstitution
                    }) === institutionName;
                    if (isPartnerInstitution || isPartnerInstitutionInGroup) {
                        revenueShare = 0.9;
                    } else if (isTrainingInstitution || isTrainingInstitutionInGroup) {
                        revenueShare = 0.1;
                    } else {
                        revenueShare = 0;
                    }
                }
            }
            return sum + revenue * revenueShare;
        }, 0);
        const studentsInYear = year ? group.filter((c)=>new Date(c.과정시작일).getFullYear() === year).reduce((sum, c)=>sum + (c['수강신청 인원'] || 0), 0) : group.reduce((sum, c)=>sum + (c['수강신청 인원'] || 0), 0);
        const studentsFromPrev = year ? group.filter((c)=>new Date(c.과정시작일).getFullYear() < year && new Date(c.과정종료일).getFullYear() === year).reduce((sum, c)=>sum + (c['수강신청 인원'] || 0), 0) : 0;
        const totalStudents = studentsInYear + studentsFromPrev;
        const graduatesInYear = year ? group.filter((c)=>new Date(c.과정시작일).getFullYear() === year && new Date(c.과정종료일).getFullYear() === year).reduce((sum, c)=>sum + (c.수료인원 || 0), 0) : group.reduce((sum, c)=>sum + (c.수료인원 || 0), 0);
        const graduatesFromPrev = year ? group.filter((c)=>new Date(c.과정시작일).getFullYear() < year && new Date(c.과정종료일).getFullYear() === year).reduce((sum, c)=>sum + (c.수료인원 || 0), 0) : 0;
        const totalGraduates = graduatesInYear + graduatesFromPrev;
        let studentsStr = studentsFromPrev > 0 ? `${studentsInYear}(${studentsFromPrev})` : `${studentsInYear}`;
        let graduatesStr = graduatesFromPrev > 0 ? `${graduatesInYear}(${graduatesFromPrev})` : `${graduatesInYear}`; // Add graduatesStr
        let openCountStr = `${group.length}`;
        if (year) {
            const openInYear = group.filter((c)=>new Date(c.과정시작일).getFullYear() === year).length;
            const openFromPrev = group.filter((c)=>new Date(c.과정시작일).getFullYear() < year && new Date(c.과정종료일).getFullYear() === year).length;
            if (openFromPrev > 0) {
                openCountStr = `${openInYear}(${openFromPrev})`;
            } else {
                openCountStr = `${openInYear}`;
            }
        }
        // ① 표시용 분자/분모(수료율에 실제 사용한 값)
        let displayStudentsForCompletion = totalStudents;
        let displayGraduatesForCompletion = totalGraduates;
        let averageCompletionRate = 0;
        if (year) {
            const validCoursesForCompletion = group.filter((c)=>{
                const courseEndYear = new Date(c.과정종료일).getFullYear();
                return courseEndYear === year && // 해당 연도 종료
                (c.수료인원 ?? 0) > 0 && (c['수강신청 인원'] ?? 0) > 0;
            });
            if (validCoursesForCompletion.length > 0) {
                const validStudents = validCoursesForCompletion.reduce((sum, c)=>sum + (c['수강신청 인원'] || 0), 0);
                const validGraduates = validCoursesForCompletion.reduce((sum, c)=>sum + (c.수료인원 || 0), 0);
                averageCompletionRate = validStudents > 0 ? validGraduates / validStudents * 100 : 0;
                displayStudentsForCompletion = validStudents;
                displayGraduatesForCompletion = validGraduates;
            }
        } else {
            const validCourses = group.filter((c)=>(c.수료인원 ?? 0) > 0 && (c['수강신청 인원'] ?? 0) > 0);
            if (validCourses.length > 0) {
                const validStudents = validCourses.reduce((sum, c)=>sum + (c['수강신청 인원'] || 0), 0);
                const validGraduates = validCourses.reduce((sum, c)=>sum + (c.수료인원 || 0), 0);
                averageCompletionRate = validStudents > 0 ? validGraduates / validStudents * 100 : 0;
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
            최소과정시작일: group.reduce((min, c)=>new Date(c.과정시작일) < new Date(min) ? c.과정시작일 : min, group[0].과정시작일),
            최대과정종료일: group.reduce((max, c)=>new Date(c.과정종료일) > new Date(max) ? c.과정종료일 : max, group[0].과정종료일),
            훈련유형들: [
                latest.훈련유형
            ],
            원천과정수: group.length,
            총훈련생수: totalStudents,
            평균만족도: latest.만족도,
            평균수료율: averageCompletionRate,
            studentsStr,
            graduatesStr: graduatesFromPrev > 0 ? `${graduatesInYear}(${graduatesFromPrev})` : `${graduatesInYear}`,
            openCountStr
        });
    });
    return result.sort((a, b)=>b.총누적매출 - a.총누적매출);
}
function preprocessData(data) {
    return data.map((row)=>{
        const newRow = {};
        Object.keys(row).forEach((key)=>{
            // 공백 제거
            const newKey = key.replace(/\s/g, '');
            newRow[newKey] = row[key];
        });
        return newRow;
    });
}
const calculateAdjustedRevenueForCourse = (course, overallCompletionRate, courseCompletionRate, institutionCompletionRate, isFirstTimeCourse, courseIdAvgCompletionRateMap)=>{
    // 1) 실 매출 대비, 매출 최대
    const minRevenue = course['실 매출 대비'] ?? course.누적매출 ?? 0;
    const maxRevenue = typeof course['매출 최대'] === 'number' && !isNaN(course['매출 최대']) && course['매출 최대'] > 0 ? course['매출 최대'] : minRevenue;
    // 2) 매출이 없으면 보정 없이 반환
    if (minRevenue === 0) {
        return minRevenue;
    }
    // 3) 수강신청 인원이 0이면 보정 계산이 불가능하므로 그대로 반환
    if ((course['수강신청 인원'] ?? 0) === 0) {
        return minRevenue;
    }
    // 4) 실제 수료율 계산
    let actualCompletionRate = (course['수료인원'] ?? 0) / (course['수강신청 인원'] ?? 1);
    let usedCompletionRate = actualCompletionRate * 100;
    let usedType = '실제';
    // 수료인원이 0인 경우, 또는 초회차인 경우 예상 수료율 결정
    if ((course['수료인원'] ?? 0) === 0 || isFirstTimeCourse) {
        let estimatedCompletionRate = 0;
        // 1순위: 훈련과정ID별 평균 수료율
        if (courseIdAvgCompletionRateMap && course['훈련과정 ID'] && courseIdAvgCompletionRateMap.has(course['훈련과정 ID'])) {
            estimatedCompletionRate = courseIdAvgCompletionRateMap.get(course['훈련과정 ID']);
        } else if (courseCompletionRate !== undefined && courseCompletionRate > 0) {
            estimatedCompletionRate = courseCompletionRate;
        } else if (institutionCompletionRate !== undefined && institutionCompletionRate > 0) {
            estimatedCompletionRate = institutionCompletionRate;
        } else {
            estimatedCompletionRate = overallCompletionRate;
        }
        actualCompletionRate = estimatedCompletionRate / 100; // %를 비율로 변환
        usedCompletionRate = estimatedCompletionRate;
        usedType = '예상';
    }
    // 5) 지수함수형 보정 적용 (y = min + (max-min)*(1 - a^(-b*rate)))
    const a = 2;
    const b = 2; // p값을 2로 고정
    const rate = actualCompletionRate;
    const expFactor = 1 - Math.pow(a, -b * rate);
    const adjustedRevenue = minRevenue + (maxRevenue - minRevenue) * expFactor;
    // 디버깅 로그 추가 - 모든 과정에 대해 출력
    return adjustedRevenue;
};
const applyRevenueAdjustment = (courses, _overallCompletionRate // 기존 전체 평균은 무시
)=>{
    // 1. 전체 평균 수료율(0% 제외) 재계산
    const validForOverall = courses.filter((c)=>(c['수료인원'] ?? 0) > 0 && (c['수강신청 인원'] ?? 0) > 0);
    let overallCompletionRate = 0;
    if (validForOverall.length > 0) {
        const total = validForOverall.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
        const enroll = validForOverall.reduce((sum, c)=>sum + (c['수강신청 인원'] ?? 0), 0);
        overallCompletionRate = enroll > 0 ? total / enroll * 100 : 0;
    }
    // 2. 훈련과정ID별 평균 수료율 맵 생성 (0% 제외)
    const courseIdAvgCompletionRateMap = new Map();
    const courseIdGroups = new Map();
    courses.forEach((course)=>{
        const courseId = course['훈련과정 ID'];
        if (!courseId) return;
        if (!courseIdGroups.has(courseId)) courseIdGroups.set(courseId, []);
        courseIdGroups.get(courseId).push(course);
    });
    courseIdGroups.forEach((group, courseId)=>{
        const valid = group.filter((c)=>(c['수료인원'] ?? 0) > 0 && (c['수강신청 인원'] ?? 0) > 0);
        if (valid.length > 0) {
            const total = valid.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
            const enroll = valid.reduce((sum, c)=>sum + (c['수강신청 인원'] ?? 0), 0);
            const avg = enroll > 0 ? total / enroll * 100 : 0;
            courseIdAvgCompletionRateMap.set(courseId, avg);
        }
    });
    // 3. 기존 보정 로직 (2차 스케일링 포함, overallCompletionRate만 교체)
    const yearColumns = [
        '2021년',
        '2022년',
        '2023년',
        '2024년',
        '2025년',
        '2026년'
    ];
    const firstTimeCourses = new Set();
    const courseIdStartDateMap = new Map();
    courses.forEach((course)=>{
        if (course['훈련과정 ID']) {
            const startDate = new Date(course.과정시작일);
            if (!courseIdStartDateMap.has(course['훈련과정 ID']) || startDate < courseIdStartDateMap.get(course['훈련과정 ID'])) {
                courseIdStartDateMap.set(course['훈련과정 ID'], startDate);
            }
        }
    });
    courses.forEach((course)=>{
        if (course['훈련과정 ID'] && courseIdStartDateMap.has(course['훈련과정 ID'])) {
            if (new Date(course.과정시작일).getTime() === courseIdStartDateMap.get(course['훈련과정 ID']).getTime()) {
                firstTimeCourses.add(course.고유값);
            }
        }
    });
    const intermediate = courses.map((course)=>{
        const isFirstTime = firstTimeCourses.has(course.고유값);
        const currentCourseCompletionRate = course['훈련과정 ID'] ? courseIdAvgCompletionRateMap.get(course['훈련과정 ID']) : undefined;
        // 기존 institutionCompletionRates 등은 그대로 유지
        // calculateAdjustedRevenueForCourse에 courseIdAvgCompletionRateMap 전달
        const adjustedTotalRevenue = calculateAdjustedRevenueForCourse(course, overallCompletionRate, currentCourseCompletionRate, undefined, isFirstTime, courseIdAvgCompletionRateMap);
        const adjustedYearlyRevenues = {};
        yearColumns.forEach((yearCol)=>{
            const originalYearlyRevenue = course[yearCol];
            if (originalYearlyRevenue !== undefined) {
                adjustedYearlyRevenues[`조정_${yearCol}`] = calculateAdjustedRevenueForCourse({
                    ...course,
                    누적매출: originalYearlyRevenue,
                    '실 매출 대비': originalYearlyRevenue
                }, overallCompletionRate, currentCourseCompletionRate, undefined, isFirstTime, courseIdAvgCompletionRateMap);
            }
        });
        return {
            ...course,
            조정_실매출대비: adjustedTotalRevenue,
            조정_누적매출: adjustedTotalRevenue,
            ...adjustedYearlyRevenues
        };
    });
    return intermediate;
};
const getIndividualInstitutionsInGroup = (allCourses, groupName, year)=>{
    // 그룹화 기준에 따라 row를 분리
    const groupedCourses = allCourses.filter((course)=>groupInstitutionsAdvanced(course) === groupName);
    // 실제 원본 기관명 목록 추출 (파트너기관 포함)
    const individualInstitutions = [
        ...new Set([
            ...groupedCourses.map((c)=>c.원본훈련기관 || c.훈련기관),
            ...groupedCourses.map((c)=>c.leadingCompanyPartnerInstitution).filter((name)=>Boolean(name))
        ])
    ];
    const individualStats = [];
    individualInstitutions.forEach((originalInstitutionName)=>{
        // 그룹 내에서 해당 기관의 과정들만 필터링 (파트너기관으로 참여한 과정 포함)
        const institutionCourses = groupedCourses.filter((course)=>{
            const courseInstitution = course.원본훈련기관 || course.훈련기관;
            const coursePartner = course.leadingCompanyPartnerInstitution;
            return courseInstitution === originalInstitutionName || coursePartner === originalInstitutionName;
        });
        if (institutionCourses.length === 0) return;
        // 상세보기와 동일한 매출 계산 로직 적용
        // 선도기업 과정의 매출 분배를 위해 개별 기관명 기준으로 계산
        const aggregated = aggregateCoursesByCourseIdWithLatestInfo(institutionCourses, year, originalInstitutionName);
        const totalRevenue = aggregated.reduce((sum, course)=>sum + course.총누적매출, 0);
        // 학생수/수료인원/과정수 계산 (파트너기관이 대체한 경우 파트너기관이 100% 담당)
        let totalStudents = 0;
        let completedStudents = 0;
        let totalCourses = 0;
        institutionCourses.forEach((course)=>{
            const courseInstitution = course.원본훈련기관 || course.훈련기관;
            const coursePartner = course.leadingCompanyPartnerInstitution;
            const isTrainingInstitution = courseInstitution === originalInstitutionName;
            const isPartnerInstitution = coursePartner === originalInstitutionName;
            if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
                // 선도기업 과정: 파트너기관이 100% 담당
                if (isPartnerInstitution) {
                    totalStudents += course['수강신청 인원'] ?? 0;
                    completedStudents += course['수료인원'] ?? 0;
                    totalCourses += 1;
                }
            // 훈련기관은 학생수/수료인원/과정수 0
            } else {
                // 일반 과정: 훈련기관이 100% 담당
                if (isTrainingInstitution) {
                    totalStudents += course['수강신청 인원'] ?? 0;
                    completedStudents += course['수료인원'] ?? 0;
                    totalCourses += 1;
                }
            }
        });
        // 수료율 계산 (파트너기관이 대체한 경우 파트너기관 기준으로 계산)
        let totalValidStudents = 0;
        let totalValidGraduates = 0;
        institutionCourses.forEach((course)=>{
            const courseInstitution = course.원본훈련기관 || course.훈련기관;
            const coursePartner = course.leadingCompanyPartnerInstitution;
            const isTrainingInstitution = courseInstitution === originalInstitutionName;
            const isPartnerInstitution = coursePartner === originalInstitutionName;
            if (course['수료인원'] > 0 && course['수강신청 인원'] > 0) {
                if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
                    // 선도기업 과정: 파트너기관만 계산
                    if (isPartnerInstitution) {
                        totalValidStudents += course['수강신청 인원'] ?? 0;
                        totalValidGraduates += course['수료인원'] ?? 0;
                    }
                } else {
                    // 일반 과정: 훈련기관만 계산
                    if (isTrainingInstitution) {
                        totalValidStudents += course['수강신청 인원'] ?? 0;
                        totalValidGraduates += course['수료인원'] ?? 0;
                    }
                }
            }
        });
        const completionRate = totalValidStudents > 0 ? totalValidGraduates / totalValidStudents * 100 : 0;
        // 평균 만족도 계산 (파트너기관이 대체한 경우 파트너기관 기준으로 계산)
        let totalWeighted = 0;
        let totalWeight = 0;
        institutionCourses.forEach((course)=>{
            const courseInstitution = course.원본훈련기관 || course.훈련기관;
            const coursePartner = course.leadingCompanyPartnerInstitution;
            const isTrainingInstitution = courseInstitution === originalInstitutionName;
            const isPartnerInstitution = coursePartner === originalInstitutionName;
            if (course.만족도 && course.만족도 > 0 && course['수료인원'] > 0) {
                if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
                    // 선도기업 과정: 파트너기관만 계산
                    if (isPartnerInstitution) {
                        totalWeighted += (course.만족도 ?? 0) * (course['수료인원'] ?? 0);
                        totalWeight += course['수료인원'] ?? 0;
                    }
                } else {
                    // 일반 과정: 훈련기관만 계산
                    if (isTrainingInstitution) {
                        totalWeighted += (course.만족도 ?? 0) * (course['수료인원'] ?? 0);
                        totalWeight += course['수료인원'] ?? 0;
                    }
                }
            }
        });
        const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
        // 이전 연도 시작 과정 정보 계산 (파트너기관이 대체한 경우 파트너기관 기준으로 계산)
        let prevYearStudents = 0;
        let prevYearCompletedStudents = 0;
        if (year !== undefined) {
            institutionCourses.forEach((course)=>{
                const courseInstitution = course.원본훈련기관 || course.훈련기관;
                const coursePartner = course.leadingCompanyPartnerInstitution;
                const isTrainingInstitution = courseInstitution === originalInstitutionName;
                const isPartnerInstitution = coursePartner === originalInstitutionName;
                const isPrevYearCourse = new Date(course.과정시작일).getFullYear() < year && new Date(course.과정종료일).getFullYear() === year;
                if (isPrevYearCourse) {
                    if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
                        // 선도기업 과정: 파트너기관만 계산
                        if (isPartnerInstitution) {
                            prevYearStudents += course['수강신청 인원'] ?? 0;
                            prevYearCompletedStudents += course['수료인원'] ?? 0;
                        }
                    // 훈련기관은 0
                    } else {
                        // 일반 과정: 훈련기관만 계산
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
    // 매출액 기준 내림차순 정렬
    return individualStats.sort((a, b)=>b.totalRevenue - a.totalRevenue);
};
const calculateInstitutionDetailedRevenue = (allCourses, institutionName, year)=>{
    let totalRevenue = 0;
    let totalCourses = 0;
    let totalStudents = 0;
    let completedStudents = 0;
    const courses = [];
    allCourses.forEach((course)=>{
        const courseInstitution = course.원본훈련기관 || course.훈련기관;
        const coursePartner = course.leadingCompanyPartnerInstitution;
        // 그룹명(프랜차이즈) 기준으로도 포함되도록 보완
        const isInstitutionInGroup = groupInstitutionsAdvanced({
            ...course,
            훈련기관: courseInstitution
        }) === institutionName;
        const isPartnerInGroup = coursePartner && groupInstitutionsAdvanced({
            ...course,
            훈련기관: coursePartner
        }) === institutionName;
        // 해당 그룹(기관)이 훈련기관이거나 파트너기관으로 참여한 과정인지 확인
        const isTrainingInstitution = isInstitutionInGroup;
        const isPartnerInstitution = isPartnerInGroup;
        if (!isTrainingInstitution && !isPartnerInstitution) return;
        // 연도 필터링: 선택된 연도에 시작했거나, 이전에 시작해서 선택된 연도에 끝나는 과정만 포함
        if (year !== undefined) {
            const startYear = new Date(course.과정시작일).getFullYear();
            const endYear = new Date(course.과정종료일).getFullYear();
            if (!(startYear === year || startYear < year && endYear === year)) {
                return;
            }
        }
        // 매출 계산
        let revenue = 0;
        if (year !== undefined) {
            const yearKey = `조정_${year}년`;
            revenue = course[yearKey] ?? 0;
        } else {
            revenue = course.조정_누적매출 ?? 0;
        }
        // 선도기업 훈련인 경우 매출 분배 적용
        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
            if (courseInstitution === course.leadingCompanyPartnerInstitution && isTrainingInstitution && isPartnerInstitution) {
            // 동일 기관: 100% 집계
            // 아무런 분배 없이 그대로 둠 (revenue = revenue * 1)
            } else if (isPartnerInstitution) {
                // 파트너기관: 90%
                revenue = revenue * 0.9;
            } else if (isTrainingInstitution) {
                // 훈련기관: 10%
                revenue = revenue * 0.1;
            }
        }
        // 학생 수 계산 (선도기업 훈련에서는 파트너기관이 100% 담당)
        let studentCount = course['수강신청 인원'] ?? 0;
        let completedCount = course.수료인원 ?? 0;
        if (course.isLeadingCompanyCourse && course.leadingCompanyPartnerInstitution) {
            if (courseInstitution === course.leadingCompanyPartnerInstitution && isTrainingInstitution && isPartnerInstitution) {
            // 동일 기관: 100% 집계 (변경 없음)
            } else if (isTrainingInstitution) {
                // 훈련기관은 학생 수 0
                studentCount = 0;
                completedCount = 0;
            }
        // 파트너기관은 학생 수 100% (기본값)
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/src/utils/formatters.ts [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname, k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
// 숫자 포맷팅 함수
__turbopack_context__.s({
    "formatCurrency": (()=>formatCurrency),
    "formatEok": (()=>formatEok),
    "formatNumber": (()=>formatNumber),
    "formatRevenue": (()=>formatRevenue)
});
const formatNumber = (value)=>{
    if (value === undefined || value === null) return '0';
    return new Intl.NumberFormat('ko-KR', {
        maximumFractionDigits: 0
    }).format(value);
};
const formatCurrency = (value)=>{
    if (value === undefined || value === null || isNaN(value)) return '0억';
    const num = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    const TRILLION = 1_000_000_000_000; // 1조
    const EOK = 100_000_000; // 1억
    // 소수점 1자리(불필요하면 제거)
    const oneDecimal = (v)=>{
        const str = v.toFixed(1);
        return str.endsWith('.0') ? str.slice(0, -2) : str;
    };
    if (num >= TRILLION) {
        const tril = Math.floor(num / TRILLION); // 조 단위
        const remainEok = Math.floor(num % TRILLION / EOK); // 억 단위 정수
        if (remainEok > 0) {
            return `${sign}${tril}조 ${remainEok}억`;
        }
        return `${sign}${tril}조`;
    }
    // 1억 미만도 모두 억 단위로 표기
    const eokVal = num / EOK;
    return `${sign}${oneDecimal(eokVal)}억`;
};
const formatEok = (eokValue)=>{
    return `${formatNumber(eokValue)}억`;
};
const formatRevenue = (value)=>{
    if (value === undefined || value === null || isNaN(value)) return '0억';
    return `${(value / 100000000).toFixed(1)}억`;
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/src/lib/utils.ts [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname, k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "cn": (()=>cn),
    "formatCurrency": (()=>formatCurrency),
    "formatNumber": (()=>formatNumber)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-client] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
const formatCurrency = (value)=>{
    return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0
    }).format(value);
};
const formatNumber = (value)=>{
    return new Intl.NumberFormat('ko-KR').format(value);
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/src/components/ui/select.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname, k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "Select": (()=>Select),
    "SelectContent": (()=>SelectContent),
    "SelectGroup": (()=>SelectGroup),
    "SelectItem": (()=>SelectItem),
    "SelectTrigger": (()=>SelectTrigger),
    "SelectValue": (()=>SelectValue)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-select/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-down.js [app-client] (ecmascript) <export default as ChevronDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
;
;
const Select = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"];
const SelectGroup = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"];
const SelectValue = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Value"];
const SelectTrigger = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"])(_c = ({ className, children, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Trigger"], {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className),
        ...props,
        children: [
            children,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                asChild: true,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__["ChevronDown"], {
                    className: "h-4 w-4 opacity-50"
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/select.tsx",
                    lineNumber: 29,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ui/select.tsx",
                lineNumber: 28,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/select.tsx",
        lineNumber: 19,
        columnNumber: 3
    }, this));
_c1 = SelectTrigger;
SelectTrigger.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Trigger"].displayName;
const SelectContent = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"])(_c2 = ({ className, children, position = "popper", ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Portal"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"], {
            ref: ref,
            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1", className),
            position: position,
            ...props,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Viewport"], {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("p-1", position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"),
                children: children
            }, void 0, false, {
                fileName: "[project]/src/components/ui/select.tsx",
                lineNumber: 51,
                columnNumber: 7
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/ui/select.tsx",
            lineNumber: 40,
            columnNumber: 5
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/select.tsx",
        lineNumber: 39,
        columnNumber: 3
    }, this));
_c3 = SelectContent;
SelectContent.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"].displayName;
const SelectItem = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"])(_c4 = ({ className, children, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Item"], {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className),
        ...props,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ItemIndicator"], {
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                        className: "h-4 w-4"
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/select.tsx",
                        lineNumber: 79,
                        columnNumber: 9
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/select.tsx",
                    lineNumber: 78,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ui/select.tsx",
                lineNumber: 77,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ItemText"], {
                children: children
            }, void 0, false, {
                fileName: "[project]/src/components/ui/select.tsx",
                lineNumber: 83,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/select.tsx",
        lineNumber: 69,
        columnNumber: 3
    }, this));
_c5 = SelectItem;
SelectItem.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$select$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Item"].displayName;
;
var _c, _c1, _c2, _c3, _c4, _c5;
__turbopack_context__.k.register(_c, "SelectTrigger$React.forwardRef");
__turbopack_context__.k.register(_c1, "SelectTrigger");
__turbopack_context__.k.register(_c2, "SelectContent$React.forwardRef");
__turbopack_context__.k.register(_c3, "SelectContent");
__turbopack_context__.k.register(_c4, "SelectItem$React.forwardRef");
__turbopack_context__.k.register(_c5, "SelectItem");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/src/components/ui/dialog.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname, k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "Dialog": (()=>Dialog),
    "DialogClose": (()=>DialogClose),
    "DialogContent": (()=>DialogContent),
    "DialogDescription": (()=>DialogDescription),
    "DialogFooter": (()=>DialogFooter),
    "DialogHeader": (()=>DialogHeader),
    "DialogOverlay": (()=>DialogOverlay),
    "DialogPortal": (()=>DialogPortal),
    "DialogTitle": (()=>DialogTitle),
    "DialogTrigger": (()=>DialogTrigger)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-dialog/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
;
;
const Dialog = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"];
const DialogTrigger = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Trigger"];
const DialogPortal = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Portal"];
const DialogClose = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Close"];
const DialogOverlay = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"])(({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 21,
        columnNumber: 3
    }, this));
_c = DialogOverlay;
DialogOverlay.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"].displayName;
const DialogContent = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"])(_c1 = ({ className, children, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogPortal, {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogOverlay, {}, void 0, false, {
                fileName: "[project]/src/components/ui/dialog.tsx",
                lineNumber: 37,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"], {
                ref: ref,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg", className),
                ...props,
                children: [
                    children,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Close"], {
                        className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                className: "h-4 w-4"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/dialog.tsx",
                                lineNumber: 48,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "sr-only",
                                children: "Close"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/dialog.tsx",
                                lineNumber: 49,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/ui/dialog.tsx",
                        lineNumber: 47,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/dialog.tsx",
                lineNumber: 38,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 36,
        columnNumber: 3
    }, this));
_c2 = DialogContent;
DialogContent.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"].displayName;
const DialogHeader = ({ className, ...props })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex flex-col space-y-1.5 text-center sm:text-left", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 60,
        columnNumber: 3
    }, this);
_c3 = DialogHeader;
DialogHeader.displayName = "DialogHeader";
const DialogFooter = ({ className, ...props })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 74,
        columnNumber: 3
    }, this);
_c4 = DialogFooter;
DialogFooter.displayName = "DialogFooter";
const DialogTitle = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"])(_c5 = ({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Title"], {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-lg font-semibold leading-none tracking-tight", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 88,
        columnNumber: 3
    }, this));
_c6 = DialogTitle;
DialogTitle.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Title"].displayName;
const DialogDescription = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"])(_c7 = ({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Description"], {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-sm text-muted-foreground", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/dialog.tsx",
        lineNumber: 103,
        columnNumber: 3
    }, this));
_c8 = DialogDescription;
DialogDescription.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Description"].displayName;
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8;
__turbopack_context__.k.register(_c, "DialogOverlay");
__turbopack_context__.k.register(_c1, "DialogContent$React.forwardRef");
__turbopack_context__.k.register(_c2, "DialogContent");
__turbopack_context__.k.register(_c3, "DialogHeader");
__turbopack_context__.k.register(_c4, "DialogFooter");
__turbopack_context__.k.register(_c5, "DialogTitle$React.forwardRef");
__turbopack_context__.k.register(_c6, "DialogTitle");
__turbopack_context__.k.register(_c7, "DialogDescription$React.forwardRef");
__turbopack_context__.k.register(_c8, "DialogDescription");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname, k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "default": (()=>InstitutionAnalysisClient)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$data$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/data-utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/utils/formatters.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$BarChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/chart/BarChart.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Bar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/cartesian/Bar.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/cartesian/XAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/cartesian/YAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/component/Tooltip.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/component/ResponsiveContainer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/select.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/dialog.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
// 공통 집계 함수: 기관명, 연도, 원본 row를 받아 x, y, x(y) 표기, 수료율, 과정수 등 반환
function getInstitutionYearlyStats({ rows, institutionName, year, month// 월 파라미터 추가
 }) {
    const filtered = rows.filter((c)=>{
        const isLeadingWithPartner = c.isLeadingCompanyCourse && c.leadingCompanyPartnerInstitution;
        if (isLeadingWithPartner && c.훈련기관 === institutionName && c.훈련기관 !== c.leadingCompanyPartnerInstitution) return false;
        return c.훈련기관 === institutionName || c.파트너기관 === institutionName;
    });
    let finalFilteredRows = filtered;
    // 연도와 월이 모두 선택된 경우 해당 연도/월에 시작된 과정만 필터링
    if (year !== undefined && month !== 'all') {
        finalFilteredRows = filtered.filter((c)=>{
            const startDate = new Date(c.과정시작일);
            return startDate.getFullYear() === year && startDate.getMonth() + 1 === month;
        });
    } else if (year !== undefined) {
        // 연도만 선택된 경우 해당 연도에 시작된 과정과 이전 연도에 시작하여 해당 연도에 종료된 과정 포함
        finalFilteredRows = filtered.filter((c)=>{
            const startDate = new Date(c.과정시작일);
            const endDate = new Date(c.과정종료일);
            return startDate.getFullYear() === year || startDate.getFullYear() < year && endDate.getFullYear() === year;
        });
        // === 수료율 계산 방식 변경 ===
        // 1. 해당 연도에 종료된 과정만 필터링
        const endedThisYear = filtered.filter((c)=>new Date(c.과정종료일).getFullYear() === year);
        // 1-1. 수료인원이 1명 이상인 과정만 필터링
        const endedThisYearWithGraduates = endedThisYear.filter((c)=>(c['수료인원'] ?? 0) > 0);
        // 2. 분모: 해당 연도에 종료된 과정(수료인원 1명 이상)의 입과생
        const entryForEndedThisYear = endedThisYearWithGraduates.reduce((sum, c)=>sum + (c['수강신청 인원'] ?? 0), 0);
        // 3. 분자: 해당 연도에 종료된 과정(수료인원 1명 이상)의 수료인원
        const graduatedThisYear = endedThisYearWithGraduates.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
        // 4. 수료율
        const completionRate = entryForEndedThisYear > 0 ? graduatedThisYear / entryForEndedThisYear * 100 : 0;
        const completionRateStr = `${completionRate.toFixed(1)}% (${graduatedThisYear}/${entryForEndedThisYear})`;
        // 훈련생 수 표기: 올해 입과생 + (작년 입과, 올해 종료 과정의 입과생)
        const startedThisYear = filtered.filter((c)=>new Date(c.과정시작일).getFullYear() === year);
        const entryThisYear = startedThisYear.reduce((sum, c)=>sum + (c['수강신청 인원'] ?? 0), 0);
        const prevYearEntryEndedThisYear = endedThisYear.filter((c)=>new Date(c.과정시작일).getFullYear() < year).reduce((sum, c)=>sum + (c['수강신청 인원'] ?? 0), 0);
        const entryStr = prevYearEntryEndedThisYear > 0 ? `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(entryThisYear)}(${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(prevYearEntryEndedThisYear)})` : `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(entryThisYear)}`;
        // 수료인원 표기: 올해 시작, 올해 종료 과정의 수료인원 + (작년 입과, 올해 종료 과정의 수료인원)
        const gradThisYear = startedThisYear.filter((c)=>new Date(c.과정종료일).getFullYear() === year).reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
        const gradPrevYearEndedThisYear = endedThisYear.filter((c)=>new Date(c.과정시작일).getFullYear() < year).reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
        const gradStr = gradPrevYearEndedThisYear > 0 ? `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(gradThisYear)}(${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(gradPrevYearEndedThisYear)})` : `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(gradThisYear)}`;
        // 개강 회차수 표기: 올해 시작 + (작년 시작, 올해 종료)
        const openStartSum = startedThisYear.length;
        const openEndSum = endedThisYear.filter((c)=>new Date(c.과정시작일).getFullYear() < year).length;
        const openCountStr = openEndSum > 0 ? `${openStartSum}(${openEndSum})` : `${openStartSum}`;
        // 운영중인 과정 수: 해당 연도에 운영된 고유한 과정명 수
        const uniqueCourseNamesForYear = new Set([
            ...startedThisYear,
            ...endedThisYear
        ].map((c)=>c.과정명));
        const operatedCourseCount = uniqueCourseNamesForYear.size;
        const openedCourseCount = openStartSum + openEndSum;
        // 평균 만족도 계산 (올해 종료 과정 기준)
        const validSatisfaction = endedThisYear.filter((c)=>c.만족도 && c.만족도 > 0);
        const totalWeighted = validSatisfaction.reduce((sum, c)=>sum + (c.만족도 ?? 0) * (c['수료인원'] ?? 0), 0);
        const totalWeight = validSatisfaction.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
        const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
        return {
            studentStr: entryStr,
            graduateStr: gradStr,
            openCountStr: openCountStr,
            operatedCourseCount,
            openedCourseCount: openedCourseCount,
            avgSatisfaction: parseFloat(avgSatisfaction.toFixed(1)),
            completionRate: completionRateStr,
            x: entryThisYear,
            y: prevYearEntryEndedThisYear,
            xg: gradThisYear,
            yg: gradPrevYearEndedThisYear,
            xc: openStartSum,
            yc: openEndSum
        };
    }
    // 전체 연도 + 전체 월일 때는 전체 합계만 표기 (x(y) 표기 대신)
    if (year === undefined && month === 'all') {
        const totalStudents = finalFilteredRows.reduce((sum, c)=>sum + (c['수강신청 인원'] ?? 0), 0);
        const totalGraduates = finalFilteredRows.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
        const totalCourses = finalFilteredRows.length;
        const uniqueCourseNames = new Set(finalFilteredRows.map((c)=>c.과정명));
        const validRows = finalFilteredRows.filter((c)=>(c['수강신청 인원'] ?? 0) > 0 && (c['수료인원'] ?? 0) > 0);
        const validStudents = validRows.reduce((sum, c)=>sum + (c['수강신청 인원'] ?? 0), 0);
        const validGraduates = validRows.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
        const completionRate = validStudents > 0 ? validGraduates / validStudents * 100 : 0;
        // 평균 만족도 계산
        const validSatisfaction = validRows.filter((c)=>c.만족도 && c.만족도 > 0);
        const totalWeighted = validSatisfaction.reduce((sum, c)=>sum + (c.만족도 ?? 0) * (c['수료인원'] ?? 0), 0);
        const totalWeight = validSatisfaction.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
        const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
        return {
            studentStr: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(totalStudents),
            graduateStr: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(totalGraduates),
            openCountStr: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(totalCourses),
            operatedCourseCount: uniqueCourseNames.size,
            openedCourseCount: totalCourses,
            completionRate: completionRate === 0 ? '-' : `${completionRate.toFixed(1)}%`,
            avgSatisfaction: 0,
            x: totalStudents,
            y: 0,
            xg: totalGraduates,
            yg: 0,
            xc: totalCourses,
            yc: 0
        };
    }
    const totalStudents = finalFilteredRows.reduce((sum, c)=>sum + (c['수강신청 인원'] ?? 0), 0);
    const totalGraduates = finalFilteredRows.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
    const totalCourses = finalFilteredRows.length;
    const uniqueCourseNames = new Set(finalFilteredRows.map((c)=>c.과정명));
    const validRows = finalFilteredRows.filter((c)=>(c['수강신청 인원'] ?? 0) > 0 && (c['수료인원'] ?? 0) > 0);
    const validStudents = validRows.reduce((sum, c)=>sum + (c['수강신청 인원'] ?? 0), 0);
    const validGraduates = validRows.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
    const completionRate = validStudents > 0 ? validGraduates / validStudents * 100 : 0;
    // x(y) 표기법을 따르지 않는 경우 (연도+월 선택 시)
    if (year !== undefined && month !== 'all') {
        return {
            studentStr: `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(totalStudents)}`,
            graduateStr: `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(totalGraduates)}`,
            openCountStr: `${totalCourses}`,
            operatedCourseCount: uniqueCourseNames.size,
            openedCourseCount: totalCourses,
            completionRate: completionRate === 0 ? '-' : `${completionRate.toFixed(1)}%`,
            avgSatisfaction: 0,
            x: totalStudents,
            y: 0,
            xg: totalGraduates,
            yg: 0,
            xc: totalCourses,
            yc: 0
        };
    }
    // 기존 x(y) 표기법 로직 (연도만 선택되거나 전체 기간일 때)
    const startRows = filtered.filter((c)=>new Date(c.과정시작일).getFullYear() === year);
    const endRows = filtered.filter((c)=>new Date(c.과정시작일).getFullYear() !== year && new Date(c.과정종료일).getFullYear() === year);
    const startSum = startRows.reduce((sum, c)=>sum + (c['수강신청 인원'] ?? 0), 0);
    const endSum = endRows.reduce((sum, c)=>sum + (c['수강신청 인원'] ?? 0), 0);
    const gradStartSum = startRows.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
    const gradEndSum = endRows.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
    const openStartSum = startRows.length;
    const openEndSum = endRows.length;
    const studentStr = startSum > 0 && endSum > 0 ? `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(startSum)}(${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(endSum)})` : startSum > 0 ? `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(startSum)}` : endSum > 0 ? `(${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(endSum)})` : '';
    const graduateStr = gradStartSum > 0 && gradEndSum > 0 ? `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(gradStartSum)}(${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(gradEndSum)})` : gradStartSum > 0 ? `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(gradStartSum)}` : gradEndSum > 0 ? `(${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(gradEndSum)})` : '';
    const openCountStr = openStartSum > 0 && openEndSum > 0 ? `${openStartSum}(${openEndSum})` : openStartSum > 0 ? `${openStartSum}` : openEndSum > 0 ? `(${openEndSum})` : '';
    // 운영중인 과정 수: 해당 연도에 운영된 고유한 과정명 수
    const uniqueCourseNamesForYear = new Set([
        ...startRows,
        ...endRows
    ].map((c)=>c.과정명));
    const operatedCourseCount = uniqueCourseNamesForYear.size;
    const openedCourseCount = openStartSum + openEndSum; // 개강 과정 수: 올해 개강 + 작년 개강/올해 종료 (회차 수)
    const validRowsForCompletion = [
        ...startRows,
        ...endRows
    ].filter((c)=>(c['수강신청 인원'] ?? 0) > 0 && (c['수료인원'] ?? 0) > 0);
    const validStudentsForCompletion = validRowsForCompletion.reduce((sum, c)=>sum + (c['수강신청 인원'] ?? 0), 0);
    const validGraduatesForCompletion = validRowsForCompletion.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
    const completionRateForYear = validStudentsForCompletion > 0 ? validGraduatesForCompletion / validStudentsForCompletion * 100 : 0;
    // 평균 만족도 계산
    const validSatisfaction = [
        ...startRows,
        ...endRows
    ].filter((c)=>c.만족도 && c.만족도 > 0);
    const totalWeighted = validSatisfaction.reduce((sum, c)=>sum + (c.만족도 ?? 0) * (c['수료인원'] ?? 0), 0);
    const totalWeight = validSatisfaction.reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
    const avgSatisfaction = totalWeight > 0 ? totalWeighted / totalWeight : 0;
    return {
        studentStr,
        graduateStr,
        openCountStr,
        operatedCourseCount,
        openedCourseCount: openedCourseCount,
        avgSatisfaction: parseFloat(avgSatisfaction.toFixed(1)),
        completionRate: completionRateForYear === 0 ? '-' : `${completionRateForYear.toFixed(1)}%`,
        x: startSum,
        y: endSum,
        xg: gradStartSum,
        yg: gradEndSum,
        xc: openStartSum,
        yc: openEndSum
    };
}
function InstitutionAnalysisClient({ initialInstitutionStats, availableYears, originalData }) {
    _s();
    const [institutionStats, setInstitutionStats] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialInstitutionStats);
    const [filteredInstitutionStats, setFilteredInstitutionStats] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialInstitutionStats);
    const [selectedYear, setSelectedYear] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('all');
    const [isModalOpen, setIsModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [selectedInstitutionCourses, setSelectedInstitutionCourses] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [selectedInstitutionName, setSelectedInstitutionName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [filterType, setFilterType] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('all');
    const [selectedMonth, setSelectedMonth] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('all');
    const [searchTerm, setSearchTerm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [selectedInstitutionRawCourses, setSelectedInstitutionRawCourses] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isGroupModalOpen, setIsGroupModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [selectedGroupName, setSelectedGroupName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [individualInstitutions, setIndividualInstitutions] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const isNewTechCourse = (course)=>!course.isLeadingCompanyCourse;
    // 필터링 로직을 useMemo로 감싸 성능 최적화
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "InstitutionAnalysisClient.useEffect": ()=>{
            let currentFilteredStats = initialInstitutionStats;
            // 유형 필터링
            if (filterType === 'leading') {
                currentFilteredStats = currentFilteredStats.filter({
                    "InstitutionAnalysisClient.useEffect": (stat)=>stat.courses.some({
                            "InstitutionAnalysisClient.useEffect": (c)=>c.isLeadingCompanyCourse
                        }["InstitutionAnalysisClient.useEffect"])
                }["InstitutionAnalysisClient.useEffect"]);
            } else if (filterType === 'tech') {
                currentFilteredStats = currentFilteredStats.filter({
                    "InstitutionAnalysisClient.useEffect": (stat)=>stat.courses.some({
                            "InstitutionAnalysisClient.useEffect": (c)=>isNewTechCourse(c)
                        }["InstitutionAnalysisClient.useEffect"])
                }["InstitutionAnalysisClient.useEffect"]);
            }
            // 연도 및 월 필터링 (서버에서 이미 연도별로 계산된 통계를 사용)
            // 클라이언트에서는 selectedYear와 selectedMonth에 따라 initialInstitutionStats를 다시 필터링
            if (selectedYear !== 'all' || selectedMonth !== 'all') {
                currentFilteredStats = initialInstitutionStats.filter({
                    "InstitutionAnalysisClient.useEffect": (stat)=>{
                        // stat.courses는 해당 기관의 모든 과정 데이터를 포함하고 있음
                        // 이 과정들을 다시 필터링하여 선택된 연도와 월에 해당하는 통계를 계산해야 함
                        const filteredCoursesForStat = stat.courses.filter({
                            "InstitutionAnalysisClient.useEffect.filteredCoursesForStat": (course)=>{
                                const courseStartDate = new Date(course.과정시작일);
                                const courseEndDate = new Date(course.과정종료일);
                                let yearMatch = true;
                                if (selectedYear !== 'all') {
                                    yearMatch = courseStartDate.getFullYear() === selectedYear || courseStartDate.getFullYear() < selectedYear && courseEndDate.getFullYear() === selectedYear;
                                }
                                let monthMatch = true;
                                if (selectedMonth !== 'all') {
                                    monthMatch = courseStartDate.getMonth() + 1 === selectedMonth;
                                }
                                return yearMatch && monthMatch;
                            }
                        }["InstitutionAnalysisClient.useEffect.filteredCoursesForStat"]);
                        // 필터링된 과정이 없으면 해당 기관은 제외
                        if (filteredCoursesForStat.length === 0) return false;
                        // 필터링된 과정으로 해당 기관의 통계를 다시 계산
                        const reCalculatedStats = getInstitutionYearlyStats({
                            rows: filteredCoursesForStat,
                            institutionName: stat.institutionName,
                            year: selectedYear === 'all' ? undefined : selectedYear,
                            month: selectedMonth
                        });
                        // 기존 stat 객체를 업데이트 (매출액은 서버에서 계산된 값을 유지)
                        stat.totalCourses = reCalculatedStats.operatedCourseCount;
                        stat.totalStudents = reCalculatedStats.x + reCalculatedStats.y;
                        stat.completedStudents = reCalculatedStats.xg + reCalculatedStats.yg;
                        stat.completionRate = parseFloat(reCalculatedStats.completionRate.replace('%', ''));
                        stat.avgSatisfaction = reCalculatedStats.avgSatisfaction;
                        return true; // 필터링된 과정이 있으면 포함
                    }
                }["InstitutionAnalysisClient.useEffect"]);
            }
            // 검색어 필터링
            const finalFiltered = currentFilteredStats.filter({
                "InstitutionAnalysisClient.useEffect.finalFiltered": (stat)=>stat.institutionName.toLowerCase().includes(searchTerm.toLowerCase())
            }["InstitutionAnalysisClient.useEffect.finalFiltered"]);
            // 매출액 기준으로 다시 정렬
            finalFiltered.sort({
                "InstitutionAnalysisClient.useEffect": (a, b)=>b.totalRevenue - a.totalRevenue
            }["InstitutionAnalysisClient.useEffect"]);
            setFilteredInstitutionStats(finalFiltered);
        }
    }["InstitutionAnalysisClient.useEffect"], [
        selectedYear,
        filterType,
        selectedMonth,
        searchTerm,
        initialInstitutionStats
    ]);
    const handleViewDetails = (institutionName)=>{
        setSelectedInstitutionName(institutionName);
        let filteredOriginalData = originalData;
        if (filterType === 'leading') {
            filteredOriginalData = filteredOriginalData.filter((c)=>c.isLeadingCompanyCourse);
        } else if (filterType === 'tech') {
            filteredOriginalData = filteredOriginalData.filter(isNewTechCourse);
        }
        if (selectedMonth !== 'all') {
            filteredOriginalData = filteredOriginalData.filter((course)=>{
                const courseStartDate = new Date(course.과정시작일);
                return courseStartDate.getMonth() + 1 === selectedMonth;
            });
        }
        const yearForCalculation = selectedYear === 'all' ? undefined : selectedYear;
        const detailedStats = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$data$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateInstitutionDetailedRevenue"])(originalData, institutionName, yearForCalculation);
        const aggregated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$data$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["aggregateCoursesByCourseIdWithLatestInfo"])(detailedStats.courses, yearForCalculation, institutionName);
        setSelectedInstitutionCourses(aggregated);
        setSelectedInstitutionRawCourses(detailedStats.courses);
        setIsModalOpen(true);
    };
    const handleViewGroupDetails = (groupName)=>{
        setSelectedGroupName(groupName);
        let filteredOriginalData = originalData;
        if (filterType === 'leading') {
            filteredOriginalData = filteredOriginalData.filter((c)=>c.isLeadingCompanyCourse);
        } else if (filterType === 'tech') {
            filteredOriginalData = filteredOriginalData.filter(isNewTechCourse);
        }
        if (selectedMonth !== 'all') {
            filteredOriginalData = filteredOriginalData.filter((course)=>{
                const courseStartDate = new Date(course.과정시작일);
                return courseStartDate.getMonth() + 1 === selectedMonth;
            });
        }
        const individualStats = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$data$2d$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getIndividualInstitutionsInGroup"])(filteredOriginalData, groupName, selectedYear === 'all' ? undefined : selectedYear);
        setIndividualInstitutions(individualStats);
        setIsGroupModalOpen(true);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                className: "text-2xl font-bold mb-6",
                children: "훈련기관별 분석"
            }, void 0, false, {
                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                lineNumber: 422,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-10 relative z-10 flex gap-6 items-end",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "block text-sm font-medium text-gray-700 mb-2",
                                children: "연도 선택"
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 427,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                value: selectedYear.toString(),
                                onValueChange: (value)=>setSelectedYear(value === 'all' ? 'all' : parseInt(value)),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectTrigger"], {
                                        className: "w-[180px] bg-white",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectValue"], {
                                            placeholder: "연도 선택"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 433,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 432,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectContent"], {
                                        className: "bg-white z-20",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                value: "all",
                                                children: "전체 연도"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 436,
                                                columnNumber: 15
                                            }, this),
                                            availableYears.map((year)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                    value: year.toString(),
                                                    children: [
                                                        year,
                                                        "년"
                                                    ]
                                                }, year, true, {
                                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                    lineNumber: 438,
                                                    columnNumber: 17
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 435,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 428,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                        lineNumber: 426,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "block text-sm font-medium text-gray-700 mb-2",
                                children: "월 선택"
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 446,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                value: selectedMonth.toString(),
                                onValueChange: (value)=>setSelectedMonth(value === 'all' ? 'all' : parseInt(value)),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectTrigger"], {
                                        className: "w-[180px] bg-white",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectValue"], {
                                            placeholder: "월 선택"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 452,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 451,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectContent"], {
                                        className: "bg-white z-20",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                value: "all",
                                                children: "전체 월"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 455,
                                                columnNumber: 15
                                            }, this),
                                            [
                                                ...Array(12)
                                            ].map((_, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                    value: (i + 1).toString(),
                                                    children: [
                                                        i + 1,
                                                        "월"
                                                    ]
                                                }, i + 1, true, {
                                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                    lineNumber: 457,
                                                    columnNumber: 17
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 454,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 447,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                        lineNumber: 445,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "block text-sm font-medium text-gray-700 mb-2",
                                children: "유형 필터"
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 465,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Select"], {
                                value: filterType,
                                onValueChange: (v)=>setFilterType(v),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectTrigger"], {
                                        className: "w-[200px] bg-white",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectValue"], {
                                            placeholder: "유형 선택"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 468,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 467,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectContent"], {
                                        className: "bg-white z-20",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                value: "all",
                                                children: "전체"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 471,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                value: "leading",
                                                children: "선도기업 과정만"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 472,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$select$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SelectItem"], {
                                                value: "tech",
                                                children: "신기술 과정만"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 473,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 470,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 466,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                        lineNumber: 464,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                htmlFor: "search",
                                className: "block text-sm font-medium text-gray-700 mb-2",
                                children: "훈련기관 검색"
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 480,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                id: "search",
                                type: "text",
                                placeholder: "기관명 검색...",
                                value: searchTerm,
                                onChange: (e)=>setSearchTerm(e.target.value),
                                className: "w-[200px] bg-white p-2 border border-gray-300 rounded-md"
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 481,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                        lineNumber: 479,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                lineNumber: 425,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-4 py-2",
                children: "※ 과정이 2개년도에 걸쳐있는 경우, 각 년도에 차지하는 비율에 맞추어 매출이 분배됩니다."
            }, void 0, false, {
                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                lineNumber: 493,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-white rounded-lg shadow p-6 mt-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "text-lg font-semibold text-gray-900 mb-4",
                        children: "훈련기관별 매출액 (억원)"
                    }, void 0, false, {
                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                        lineNumber: 499,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "h-[400px]",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResponsiveContainer"], {
                            width: "100%",
                            height: "100%",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$BarChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BarChart"], {
                                data: filteredInstitutionStats.slice(0, 10),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["XAxis"], {
                                        dataKey: "institutionName",
                                        angle: 0,
                                        textAnchor: "middle",
                                        height: 100,
                                        tick: {
                                            fontSize: 14
                                        },
                                        interval: 0,
                                        tickFormatter: (value, index)=>{
                                            const rank = index + 1;
                                            let displayValue = `${value}`;
                                            if (value === '주식회사 코드스테이츠') {
                                                displayValue += ' (2023년 감사를 통해 훈련비 전액 반환)';
                                            }
                                            if (displayValue.length > 15) {
                                                displayValue = displayValue.substring(0, 12) + '...';
                                            }
                                            return `🏅 ${rank}위\n${displayValue}`;
                                        },
                                        dy: 20
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 503,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["YAxis"], {
                                        tickFormatter: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatRevenue"],
                                        tick: {
                                            fontSize: 12
                                        }
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 523,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                                        formatter: (value)=>[
                                                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatRevenue"])(value),
                                                '매출액'
                                            ],
                                        labelFormatter: (label)=>{
                                            let institutionName = label.replace(/\d+\. /, '').replace(/ \(2023년 감사를 통해 훈련비 전액 반환\)/, '');
                                            if (institutionName === '주식회사 코드스테이츠') {
                                                return `기관명: ${institutionName} (2023년 감사를 통해 훈련비 전액 반환)`;
                                            }
                                            return `기관명: ${institutionName}`;
                                        }
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 527,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Bar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Bar"], {
                                        dataKey: "totalRevenue",
                                        fill: "#4F46E5",
                                        name: "매출액"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 537,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 502,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                            lineNumber: 501,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                        lineNumber: 500,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                lineNumber: 498,
                columnNumber: 7
            }, this),
            selectedYear !== 'all' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded px-4 py-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            "* 수료율은 과정 종료일 기준으로 계산하였으며, 분자는 ",
                            selectedYear,
                            "년 기준 ",
                            selectedYear,
                            "년의 수료생, 분모는 ",
                            selectedYear,
                            "년 기준 ",
                            selectedYear,
                            "년에 끝나는 과정이 있는 모든 과정의 입과생입니다."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                        lineNumber: 546,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: "* ()는 전 해년 입과, 당 해년 수료 인원을 표기하였습니다."
                    }, void 0, false, {
                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                        lineNumber: 547,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                lineNumber: 545,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-white rounded-lg shadow overflow-hidden",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "overflow-x-auto",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                        className: "min-w-full divide-y divide-gray-200",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                className: "bg-gray-50",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "순위 및 훈련기관"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 557,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "매출액"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 558,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "훈련과정 수"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 559,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "훈련생 수"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 560,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "수료인원"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 561,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "수료율"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 562,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "평균 만족도"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 563,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "상세"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 564,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                    lineNumber: 556,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 555,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                className: "bg-white divide-y divide-gray-200",
                                children: filteredInstitutionStats.map((stat, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "px-6 py-4 whitespace-nowrap",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "ml-4",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-sm font-medium text-gray-900",
                                                            children: [
                                                                index + 1,
                                                                ". ",
                                                                stat.institutionName,
                                                                stat.institutionName === '주식회사 코드스테이츠' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "ml-2 text-xs text-red-600",
                                                                    children: "(2023년 감사를 통해 훈련비 전액 반환)"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                    lineNumber: 576,
                                                                    columnNumber: 29
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 573,
                                                            columnNumber: 25
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 572,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                    lineNumber: 571,
                                                    columnNumber: 21
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 570,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "px-6 py-4 whitespace-nowrap",
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatRevenue"])(stat.totalRevenue)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 582,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "px-6 py-4 whitespace-nowrap",
                                                children: (()=>{
                                                    const filteredRows = originalData.filter((c)=>{
                                                        if (filterType === 'leading') return c.isLeadingCompanyCourse;
                                                        if (filterType === 'tech') return !c.isLeadingCompanyCourse;
                                                        return true;
                                                    });
                                                    const stats = getInstitutionYearlyStats({
                                                        rows: filteredRows,
                                                        institutionName: stat.institutionName,
                                                        year: selectedYear === 'all' ? undefined : selectedYear,
                                                        month: selectedMonth
                                                    });
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        dangerouslySetInnerHTML: {
                                                            __html: stats.openCountStr
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 596,
                                                        columnNumber: 30
                                                    }, this);
                                                })()
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 583,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "px-6 py-4 whitespace-nowrap",
                                                children: (()=>{
                                                    const filteredRows = originalData.filter((c)=>{
                                                        if (filterType === 'leading') return c.isLeadingCompanyCourse;
                                                        if (filterType === 'tech') return !c.isLeadingCompanyCourse;
                                                        return true;
                                                    });
                                                    const stats = getInstitutionYearlyStats({
                                                        rows: filteredRows,
                                                        institutionName: stat.institutionName,
                                                        year: selectedYear === 'all' ? undefined : selectedYear,
                                                        month: selectedMonth
                                                    });
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        dangerouslySetInnerHTML: {
                                                            __html: stats.studentStr
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 612,
                                                        columnNumber: 30
                                                    }, this);
                                                })()
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 599,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "px-6 py-4 whitespace-nowrap",
                                                children: (()=>{
                                                    const filteredRows = originalData.filter((c)=>{
                                                        if (filterType === 'leading') return c.isLeadingCompanyCourse;
                                                        if (filterType === 'tech') return !c.isLeadingCompanyCourse;
                                                        return true;
                                                    });
                                                    const stats = getInstitutionYearlyStats({
                                                        rows: filteredRows,
                                                        institutionName: stat.institutionName,
                                                        year: selectedYear === 'all' ? undefined : selectedYear,
                                                        month: selectedMonth
                                                    });
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        dangerouslySetInnerHTML: {
                                                            __html: stats.graduateStr
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 628,
                                                        columnNumber: 30
                                                    }, this);
                                                })()
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 615,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "px-6 py-4 whitespace-nowrap",
                                                children: (()=>{
                                                    const filteredRows = originalData.filter((c)=>{
                                                        if (filterType === 'leading') return c.isLeadingCompanyCourse;
                                                        if (filterType === 'tech') return !c.isLeadingCompanyCourse;
                                                        return true;
                                                    });
                                                    const stats = getInstitutionYearlyStats({
                                                        rows: filteredRows,
                                                        institutionName: stat.institutionName,
                                                        year: selectedYear === 'all' ? undefined : selectedYear,
                                                        month: selectedMonth
                                                    });
                                                    return stats.completionRate;
                                                })()
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 631,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "px-6 py-4 whitespace-nowrap",
                                                children: (()=>{
                                                    const filteredRows = originalData.filter((c)=>{
                                                        if (filterType === 'leading') return c.isLeadingCompanyCourse;
                                                        if (filterType === 'tech') return !c.isLeadingCompanyCourse;
                                                        return true;
                                                    });
                                                    const stats = getInstitutionYearlyStats({
                                                        rows: filteredRows,
                                                        institutionName: stat.institutionName,
                                                        year: selectedYear === 'all' ? undefined : selectedYear,
                                                        month: selectedMonth
                                                    });
                                                    return typeof stats.avgSatisfaction === 'number' && !isNaN(stats.avgSatisfaction) ? stats.avgSatisfaction.toFixed(1) : '-';
                                                })()
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 645,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "px-6 py-4 whitespace-nowrap text-sm font-medium",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center space-x-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            onClick: ()=>handleViewDetails(stat.institutionName),
                                                            className: "text-indigo-600 hover:text-indigo-900",
                                                            style: {
                                                                backgroundColor: '#E0E7FF',
                                                                color: '#4338CA',
                                                                fontWeight: '500',
                                                                padding: '0.25rem 0.5rem',
                                                                borderRadius: '0.375rem',
                                                                border: '1px solid #C7D2FE'
                                                            },
                                                            children: "상세 보기"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 661,
                                                            columnNumber: 25
                                                        }, this),
                                                        [
                                                            '이젠아카데미',
                                                            '그린컴퓨터아카데미',
                                                            '더조은아카데미',
                                                            '코리아IT아카데미',
                                                            '비트교육센터',
                                                            '하이미디어',
                                                            '아이티윌',
                                                            '메가스터디',
                                                            '에이콘아카데미',
                                                            '한국ICT인재개발원',
                                                            'MBC아카데미 컴퓨터 교육센터',
                                                            '쌍용아카데미',
                                                            'KH정보교육원',
                                                            '(주)솔데스크'
                                                        ].includes(stat.institutionName) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            onClick: ()=>handleViewGroupDetails(stat.institutionName),
                                                            className: "text-green-600 hover:text-green-900",
                                                            style: {
                                                                backgroundColor: '#D1FAE5',
                                                                color: '#065F46',
                                                                fontWeight: '500',
                                                                padding: '0.25rem 0.5rem',
                                                                borderRadius: '0.375rem',
                                                                border: '1px solid #A7F3D0',
                                                                fontSize: '0.75rem'
                                                            },
                                                            children: "▽ 개별기관"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 676,
                                                            columnNumber: 27
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                    lineNumber: 660,
                                                    columnNumber: 23
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 659,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, stat.institutionName, true, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 569,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 567,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                        lineNumber: 554,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                    lineNumber: 553,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                lineNumber: 552,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                open: isModalOpen,
                onOpenChange: setIsModalOpen,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "mx-auto max-w-[80vw] max-h-[85vh] w-full bg-white rounded-xl shadow-lg p-0 overflow-y-auto",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            className: "p-6 border-b",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                    className: "text-lg font-medium leading-6 text-gray-900",
                                    children: [
                                        selectedInstitutionName,
                                        " - 훈련과정 상세",
                                        selectedYear !== 'all' && ` (${selectedYear}년)`
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                    lineNumber: 708,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                                    children: [
                                        "선택된 훈련기관의 ",
                                        selectedYear === 'all' ? '모든' : `${selectedYear}년`,
                                        " 훈련과정 목록입니다. (매출액 기준 내림차순 정렬)"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                    lineNumber: 712,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                            lineNumber: 707,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-6",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid grid-cols-5 gap-4 mb-6",
                                    children: (()=>{
                                        const filteredRows = originalData.filter((c)=>{
                                            if (filterType === 'leading') return c.isLeadingCompanyCourse;
                                            if (filterType === 'tech') return !c.isLeadingCompanyCourse;
                                            return true;
                                        });
                                        const stats = getInstitutionYearlyStats({
                                            rows: filteredRows,
                                            institutionName: selectedInstitutionName,
                                            year: selectedYear === 'all' ? undefined : selectedYear,
                                            month: selectedMonth
                                        });
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-gray-50 p-4 rounded-lg",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-sm text-gray-500",
                                                            children: "운영 중인 과정 수"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 734,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-lg font-semibold",
                                                            children: stats.operatedCourseCount
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 735,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                    lineNumber: 733,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-gray-50 p-4 rounded-lg",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-sm text-gray-500",
                                                            children: selectedYear === 'all' ? '전체 개강 회차수' : `${selectedYear}년 개강 회차수`
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 738,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-lg font-semibold",
                                                            children: stats.openedCourseCount
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 739,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                    lineNumber: 737,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-gray-50 p-4 rounded-lg",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-sm text-gray-500",
                                                            children: "훈련생 수"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 742,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-lg font-semibold",
                                                            children: stats.studentStr
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 743,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                    lineNumber: 741,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-gray-50 p-4 rounded-lg",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-sm text-gray-500",
                                                            children: "수료인원"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 746,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-lg font-semibold",
                                                            children: stats.graduateStr
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 747,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                    lineNumber: 745,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-gray-50 p-4 rounded-lg",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-sm text-gray-500",
                                                            children: "평균 수료율"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 750,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-lg font-semibold",
                                                            children: stats.completionRate
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 751,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                    lineNumber: 749,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true);
                                    })()
                                }, void 0, false, {
                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                    lineNumber: 718,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "overflow-x-auto max-h-[65vh]",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                        className: "min-w-full divide-y divide-gray-200",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                                className: "bg-gray-50 sticky top-0",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]",
                                                            children: "과정명"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 761,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "훈련유형"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 762,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "훈련생 수"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 763,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "수료인원"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 764,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "수료율"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 765,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "매출액"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 766,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "만족도"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 767,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "개강 회차수"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 768,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                    lineNumber: 760,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 759,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                                className: "bg-white divide-y divide-gray-200",
                                                children: selectedInstitutionCourses.map((course)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                        className: "hover:bg-gray-50",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-900",
                                                                children: course.과정명
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 774,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                                children: course.훈련유형들?.join(', ') || '-'
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 775,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                                children: course.studentsStr
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 776,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                                children: course.graduatesStr
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 777,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                                children: [
                                                                    course.평균수료율.toFixed(1),
                                                                    "% (",
                                                                    course.총수료인원,
                                                                    "/",
                                                                    course.총수강신청인원,
                                                                    ")"
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 778,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatRevenue"])(course.총누적매출)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 779,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                                children: course.평균만족도.toFixed(1)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 780,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                                children: course.openCountStr
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 781,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, course['훈련과정 ID'], true, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 773,
                                                        columnNumber: 21
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 771,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 758,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                    lineNumber: 757,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                            lineNumber: 716,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gray-50 px-6 py-3 flex justify-end",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: "bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50",
                                onClick: ()=>setIsModalOpen(false),
                                children: "닫기"
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 789,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                            lineNumber: 788,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                    lineNumber: 706,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                lineNumber: 702,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                open: isGroupModalOpen,
                onOpenChange: setIsGroupModalOpen,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "mx-auto max-w-[80vw] max-h-[85vh] w-full bg-white rounded-xl shadow-lg p-0 overflow-y-auto",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            className: "p-6 border-b",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                    className: "text-lg font-medium leading-6 text-gray-900",
                                    children: [
                                        selectedGroupName,
                                        " - 개별 기관 상세",
                                        selectedYear !== 'all' && ` (${selectedYear}년)`
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                    lineNumber: 807,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                                    children: [
                                        selectedGroupName,
                                        " 그룹에 속하는 개별 기관들의 상세 정보입니다. (매출액 기준 내림차순 정렬)"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                    lineNumber: 811,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                            lineNumber: 806,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-6",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "overflow-x-auto max-h-[65vh]",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                    className: "min-w-full divide-y divide-gray-200",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                            className: "bg-gray-50 sticky top-0",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "순위"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 820,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "기관명"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 821,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "매출액"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 822,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "훈련과정 수"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 823,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "훈련생 수"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 824,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "수료인원"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 825,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "수료율"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 826,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "평균 만족도"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 827,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 819,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 818,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                            className: "bg-white divide-y divide-gray-200",
                                            children: individualInstitutions.map((institution, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                    className: "hover:bg-gray-50",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-medium",
                                                            children: index + 1
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 833,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-900",
                                                            children: institution.institutionName
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 836,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatRevenue"])(institution.totalRevenue)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 839,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(institution.totalCourses)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 840,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                            children: selectedYear !== 'all' && selectedMonth === 'all' && institution.prevYearStudents > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(institution.totalStudents)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                        lineNumber: 845,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "text-xs text-gray-500",
                                                                        children: [
                                                                            "(",
                                                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(institution.prevYearStudents),
                                                                            ")"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                        lineNumber: 846,
                                                                        columnNumber: 31
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 844,
                                                                columnNumber: 29
                                                            }, this) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(institution.totalStudents)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 841,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                            children: selectedYear !== 'all' && selectedMonth === 'all' && institution.prevYearCompletedStudents > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(institution.completedStudents)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                        lineNumber: 856,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "text-xs text-gray-500",
                                                                        children: [
                                                                            "(",
                                                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(institution.prevYearCompletedStudents),
                                                                            ")"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                        lineNumber: 857,
                                                                        columnNumber: 31
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 855,
                                                                columnNumber: 29
                                                            }, this) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$utils$2f$formatters$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatNumber"])(institution.completedStudents)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 852,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                            children: [
                                                                institution.completionRate.toFixed(1),
                                                                "%"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 863,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                            children: institution.avgSatisfaction.toFixed(1)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 864,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, institution.institutionName, true, {
                                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                    lineNumber: 832,
                                                    columnNumber: 21
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 830,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                    lineNumber: 817,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 816,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                            lineNumber: 815,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gray-50 px-6 py-3 flex justify-end",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: "bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50",
                                onClick: ()=>setIsGroupModalOpen(false),
                                children: "닫기"
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 872,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                            lineNumber: 871,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                    lineNumber: 805,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                lineNumber: 801,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
        lineNumber: 421,
        columnNumber: 5
    }, this);
}
_s(InstitutionAnalysisClient, "kcCOAax//HR8xkiJ3KUGN8kOvus=");
_c = InstitutionAnalysisClient;
// Custom Tick 컴포넌트 (필요시 사용)
const CustomTick = (props)=>{
    const { x, y, payload, index } = props;
    const value = payload.value;
    const rank = index + 1;
    let displayValue = `${value}`;
    if (value === '주식회사 코드스테이츠') {
        displayValue += ' (2023년 감사를 통해 훈련비 전액 반환)';
    }
    if (displayValue.length > 15) {
        displayValue = displayValue.substring(0, 12) + '...';
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
        transform: `translate(${x},${y})`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
            x: 0,
            y: 0,
            dy: 16,
            textAnchor: "middle",
            fill: "#666",
            fontSize: 10,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tspan", {
                    x: 0,
                    dy: "-1.2em",
                    children: [
                        "🥇 $",
                        rank,
                        "위"
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                    lineNumber: 902,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tspan", {
                    x: 0,
                    dy: "1.2em",
                    children: displayValue
                }, void 0, false, {
                    fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                    lineNumber: 903,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
            lineNumber: 901,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
        lineNumber: 900,
        columnNumber: 5
    }, this);
};
_c1 = CustomTick;
var _c, _c1;
__turbopack_context__.k.register(_c, "InstitutionAnalysisClient");
__turbopack_context__.k.register(_c1, "CustomTick");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
}]);

//# sourceMappingURL=src_9ac33913._.js.map