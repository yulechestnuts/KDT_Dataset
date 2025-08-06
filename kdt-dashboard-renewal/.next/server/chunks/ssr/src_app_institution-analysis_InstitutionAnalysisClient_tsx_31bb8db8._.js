module.exports = {

"[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx [app-ssr] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "default": (()=>InstitutionAnalysisClient)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
(()=>{
    const e = new Error("Cannot find module '@/lib/data-utils'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
(()=>{
    const e = new Error("Cannot find module '@/utils/formatters'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$BarChart$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/chart/BarChart.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Bar$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/cartesian/Bar.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/cartesian/XAxis.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/cartesian/YAxis.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/component/Tooltip.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/recharts/es6/component/ResponsiveContainer.js [app-ssr] (ecmascript)");
(()=>{
    const e = new Error("Cannot find module '@/components/ui/select'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
(()=>{
    const e = new Error("Cannot find module '@/components/ui/dialog'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
'use client';
;
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
        const entryStr = prevYearEntryEndedThisYear > 0 ? `${formatNumber(entryThisYear)}(${formatNumber(prevYearEntryEndedThisYear)})` : `${formatNumber(entryThisYear)}`;
        // 수료인원 표기: 올해 시작, 올해 종료 과정의 수료인원 + (작년 입과, 올해 종료 과정의 수료인원)
        const gradThisYear = startedThisYear.filter((c)=>new Date(c.과정종료일).getFullYear() === year).reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
        const gradPrevYearEndedThisYear = endedThisYear.filter((c)=>new Date(c.과정시작일).getFullYear() < year).reduce((sum, c)=>sum + (c['수료인원'] ?? 0), 0);
        const gradStr = gradPrevYearEndedThisYear > 0 ? `${formatNumber(gradThisYear)}(${formatNumber(gradPrevYearEndedThisYear)})` : `${formatNumber(gradThisYear)}`;
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
            studentStr: formatNumber(totalStudents),
            graduateStr: formatNumber(totalGraduates),
            openCountStr: formatNumber(totalCourses),
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
            studentStr: `${formatNumber(totalStudents)}`,
            graduateStr: `${formatNumber(totalGraduates)}`,
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
    const studentStr = startSum > 0 && endSum > 0 ? `${formatNumber(startSum)}(${formatNumber(endSum)})` : startSum > 0 ? `${formatNumber(startSum)}` : endSum > 0 ? `(${formatNumber(endSum)})` : '';
    const graduateStr = gradStartSum > 0 && gradEndSum > 0 ? `${formatNumber(gradStartSum)}(${formatNumber(gradEndSum)})` : gradStartSum > 0 ? `${formatNumber(gradStartSum)}` : gradEndSum > 0 ? `(${formatNumber(gradEndSum)})` : '';
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
    const [institutionStats, setInstitutionStats] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(initialInstitutionStats);
    const [filteredInstitutionStats, setFilteredInstitutionStats] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(initialInstitutionStats);
    const [selectedYear, setSelectedYear] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('all');
    const [isModalOpen, setIsModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [selectedInstitutionCourses, setSelectedInstitutionCourses] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [selectedInstitutionName, setSelectedInstitutionName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [filterType, setFilterType] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('all');
    const [selectedMonth, setSelectedMonth] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('all');
    const [searchTerm, setSearchTerm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [selectedInstitutionRawCourses, setSelectedInstitutionRawCourses] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isGroupModalOpen, setIsGroupModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [selectedGroupName, setSelectedGroupName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('');
    const [individualInstitutions, setIndividualInstitutions] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const isNewTechCourse = (course)=>!course.isLeadingCompanyCourse;
    // 필터링 로직을 useMemo로 감싸 성능 최적화
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let currentFilteredStats = initialInstitutionStats;
        // 유형 필터링
        if (filterType === 'leading') {
            currentFilteredStats = currentFilteredStats.filter((stat)=>stat.courses.some((c)=>c.isLeadingCompanyCourse));
        } else if (filterType === 'tech') {
            currentFilteredStats = currentFilteredStats.filter((stat)=>stat.courses.some((c)=>isNewTechCourse(c)));
        }
        // 연도 및 월 필터링 (서버에서 이미 연도별로 계산된 통계를 사용)
        // 클라이언트에서는 selectedYear와 selectedMonth에 따라 initialInstitutionStats를 다시 필터링
        if (selectedYear !== 'all' || selectedMonth !== 'all') {
            currentFilteredStats = initialInstitutionStats.filter((stat)=>{
                // stat.courses는 해당 기관의 모든 과정 데이터를 포함하고 있음
                // 이 과정들을 다시 필터링하여 선택된 연도와 월에 해당하는 통계를 계산해야 함
                const filteredCoursesForStat = stat.courses.filter((course)=>{
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
                });
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
            });
        }
        // 검색어 필터링
        const finalFiltered = currentFilteredStats.filter((stat)=>stat.institutionName.toLowerCase().includes(searchTerm.toLowerCase()));
        // 매출액 기준으로 다시 정렬
        finalFiltered.sort((a, b)=>b.totalRevenue - a.totalRevenue);
        setFilteredInstitutionStats(finalFiltered);
    }, [
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
        const detailedStats = calculateInstitutionDetailedRevenue(originalData, institutionName, yearForCalculation);
        const aggregated = aggregateCoursesByCourseIdWithLatestInfo(detailedStats.courses, yearForCalculation, institutionName);
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
        const individualStats = getIndividualInstitutionsInGroup(filteredOriginalData, groupName, selectedYear === 'all' ? undefined : selectedYear);
        setIndividualInstitutions(individualStats);
        setIsGroupModalOpen(true);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                className: "text-2xl font-bold mb-6",
                children: "훈련기관별 분석"
            }, void 0, false, {
                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                lineNumber: 422,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-10 relative z-10 flex gap-6 items-end",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "block text-sm font-medium text-gray-700 mb-2",
                                children: "연도 선택"
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 427,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Select, {
                                value: selectedYear.toString(),
                                onValueChange: (value)=>setSelectedYear(value === 'all' ? 'all' : parseInt(value)),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectTrigger, {
                                        className: "w-[180px] bg-white",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectValue, {
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
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectContent, {
                                        className: "bg-white z-20",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectItem, {
                                                value: "all",
                                                children: "전체 연도"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 436,
                                                columnNumber: 15
                                            }, this),
                                            availableYears.map((year)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectItem, {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "block text-sm font-medium text-gray-700 mb-2",
                                children: "월 선택"
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 446,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Select, {
                                value: selectedMonth.toString(),
                                onValueChange: (value)=>setSelectedMonth(value === 'all' ? 'all' : parseInt(value)),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectTrigger, {
                                        className: "w-[180px] bg-white",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectValue, {
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
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectContent, {
                                        className: "bg-white z-20",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectItem, {
                                                value: "all",
                                                children: "전체 월"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 455,
                                                columnNumber: 15
                                            }, this),
                                            [
                                                ...Array(12)
                                            ].map((_, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectItem, {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "block text-sm font-medium text-gray-700 mb-2",
                                children: "유형 필터"
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 465,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Select, {
                                value: filterType,
                                onValueChange: (v)=>setFilterType(v),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectTrigger, {
                                        className: "w-[200px] bg-white",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectValue, {
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
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectContent, {
                                        className: "bg-white z-20",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectItem, {
                                                value: "all",
                                                children: "전체"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 471,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectItem, {
                                                value: "leading",
                                                children: "선도기업 과정만"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 472,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectItem, {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                htmlFor: "search",
                                className: "block text-sm font-medium text-gray-700 mb-2",
                                children: "훈련기관 검색"
                            }, void 0, false, {
                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                lineNumber: 480,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-4 py-2",
                children: "※ 과정이 2개년도에 걸쳐있는 경우, 각 년도에 차지하는 비율에 맞추어 매출이 분배됩니다."
            }, void 0, false, {
                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                lineNumber: 493,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-white rounded-lg shadow p-6 mt-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "text-lg font-semibold text-gray-900 mb-4",
                        children: "훈련기관별 매출액 (억원)"
                    }, void 0, false, {
                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                        lineNumber: 499,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "h-[400px]",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ResponsiveContainer"], {
                            width: "100%",
                            height: "100%",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$BarChart$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["BarChart"], {
                                data: filteredInstitutionStats.slice(0, 10),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["XAxis"], {
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
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["YAxis"], {
                                        tickFormatter: formatRevenue,
                                        tick: {
                                            fontSize: 12
                                        }
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                        lineNumber: 523,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Tooltip"], {
                                        formatter: (value)=>[
                                                formatRevenue(value),
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
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Bar$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Bar"], {
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
            selectedYear !== 'all' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded px-4 py-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-white rounded-lg shadow overflow-hidden",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "overflow-x-auto",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                        className: "min-w-full divide-y divide-gray-200",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                className: "bg-gray-50",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "순위 및 훈련기관"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 557,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "매출액"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 558,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "훈련과정 수"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 559,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "훈련생 수"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 560,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "수료인원"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 561,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "수료율"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 562,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                            children: "평균 만족도"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                            lineNumber: 563,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
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
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                className: "bg-white divide-y divide-gray-200",
                                children: filteredInstitutionStats.map((stat, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "px-6 py-4 whitespace-nowrap",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "ml-4",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-sm font-medium text-gray-900",
                                                            children: [
                                                                index + 1,
                                                                ". ",
                                                                stat.institutionName,
                                                                stat.institutionName === '주식회사 코드스테이츠' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "px-6 py-4 whitespace-nowrap",
                                                children: formatRevenue(stat.totalRevenue)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                lineNumber: 582,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
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
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
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
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
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
                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
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
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
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
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
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
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "px-6 py-4 whitespace-nowrap text-sm font-medium",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center space-x-2",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
                                                        ].includes(stat.institutionName) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Dialog, {
                open: isModalOpen,
                onOpenChange: setIsModalOpen,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogContent, {
                    className: "mx-auto max-w-[80vw] max-h-[85vh] w-full bg-white rounded-xl shadow-lg p-0 overflow-y-auto",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogHeader, {
                            className: "p-6 border-b",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogTitle, {
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
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogDescription, {
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
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-6",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-gray-50 p-4 rounded-lg",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-sm text-gray-500",
                                                            children: "운영 중인 과정 수"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 734,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-gray-50 p-4 rounded-lg",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-sm text-gray-500",
                                                            children: selectedYear === 'all' ? '전체 개강 회차수' : `${selectedYear}년 개강 회차수`
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 738,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-gray-50 p-4 rounded-lg",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-sm text-gray-500",
                                                            children: "훈련생 수"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 742,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-gray-50 p-4 rounded-lg",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-sm text-gray-500",
                                                            children: "수료인원"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 746,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "bg-gray-50 p-4 rounded-lg",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-sm text-gray-500",
                                                            children: "평균 수료율"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 750,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "overflow-x-auto max-h-[65vh]",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                        className: "min-w-full divide-y divide-gray-200",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                                className: "bg-gray-50 sticky top-0",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[25%]",
                                                            children: "과정명"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 761,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "훈련유형"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 762,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "훈련생 수"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 763,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "수료인원"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 764,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "수료율"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 765,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "매출액"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 766,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                            className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]",
                                                            children: "만족도"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 767,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
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
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                                className: "bg-white divide-y divide-gray-200",
                                                children: selectedInstitutionCourses.map((course)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                        className: "hover:bg-gray-50",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-900",
                                                                children: course.과정명
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 774,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                                children: course.훈련유형들?.join(', ') || '-'
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 775,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                                children: course.studentsStr
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 776,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                                children: course.graduatesStr
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 777,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
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
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                                children: formatRevenue(course.총누적매출)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 779,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                                children: course.평균만족도.toFixed(1)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                lineNumber: 780,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
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
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gray-50 px-6 py-3 flex justify-end",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Dialog, {
                open: isGroupModalOpen,
                onOpenChange: setIsGroupModalOpen,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogContent, {
                    className: "mx-auto max-w-[80vw] max-h-[85vh] w-full bg-white rounded-xl shadow-lg p-0 overflow-y-auto",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogHeader, {
                            className: "p-6 border-b",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogTitle, {
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
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogDescription, {
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
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-6",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "overflow-x-auto max-h-[65vh]",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                    className: "min-w-full divide-y divide-gray-200",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                            className: "bg-gray-50 sticky top-0",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "순위"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 820,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "기관명"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 821,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "매출액"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 822,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "훈련과정 수"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 823,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "훈련생 수"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 824,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "수료인원"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 825,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                        className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                                                        children: "수료율"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                        lineNumber: 826,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
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
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                            className: "bg-white divide-y divide-gray-200",
                                            children: individualInstitutions.map((institution, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                    className: "hover:bg-gray-50",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-medium",
                                                            children: index + 1
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 833,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-900",
                                                            children: institution.institutionName
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 836,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                            children: formatRevenue(institution.totalRevenue)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 839,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                            children: formatNumber(institution.totalCourses)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 840,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                            children: selectedYear !== 'all' && selectedMonth === 'all' && institution.prevYearStudents > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        children: formatNumber(institution.totalStudents)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                        lineNumber: 845,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "text-xs text-gray-500",
                                                                        children: [
                                                                            "(",
                                                                            formatNumber(institution.prevYearStudents),
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
                                                            }, this) : formatNumber(institution.totalStudents)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 841,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                            className: "px-4 py-2 whitespace-nowrap text-sm text-gray-500",
                                                            children: selectedYear !== 'all' && selectedMonth === 'all' && institution.prevYearCompletedStudents > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        children: formatNumber(institution.completedStudents)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                                        lineNumber: 856,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "text-xs text-gray-500",
                                                                        children: [
                                                                            "(",
                                                                            formatNumber(institution.prevYearCompletedStudents),
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
                                                            }, this) : formatNumber(institution.completedStudents)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/institution-analysis/InstitutionAnalysisClient.tsx",
                                                            lineNumber: 852,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
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
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
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
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gray-50 px-6 py-3 flex justify-end",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
        transform: `translate(${x},${y})`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
            x: 0,
            y: 0,
            dy: 16,
            textAnchor: "middle",
            fill: "#666",
            fontSize: 10,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tspan", {
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
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("tspan", {
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
}}),

};

//# sourceMappingURL=src_app_institution-analysis_InstitutionAnalysisClient_tsx_31bb8db8._.js.map