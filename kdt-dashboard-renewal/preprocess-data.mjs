
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { groupInstitutions, applyRevenueAdjustment, calculateInstitutionStats, calculateYearlyStats, calculateMonthlyStats } from './src/data-utils-node.js';

// Node.js 환경에 맞게 일부 함수 재정의 또는 수정
const parseNumber = (str) => {
    if (str === null || str === undefined || str === '') return 0;
    const num = parseFloat(String(str).replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
};

const transformRawDataToCourseData = (raw) => {
    const yearColumns = ['2021년', '2022년', '2023년', '2024년', '2025년', '2026년'];
    const course = { ...raw }; // 원본 데이터 복사

    // 숫자여야 하는 주요 컬럼들을 명시적으로 변환합니다.
    course['수강신청 인원'] = parseNumber(raw['수강신청 인원']);
    course['수료인원'] = parseNumber(raw['수료인원']);
    course['누적매출'] = parseNumber(raw['누적매출']);
    course['실 매출 대비'] = parseNumber(raw['실 매출 대비']);
    course['만족도'] = parseNumber(raw['만족도']);

    // 연도별 매출 컬럼들도 숫자로 변환합니다.
    yearColumns.forEach(yearCol => {
        if (raw[yearCol]) {
            course[yearCol] = parseNumber(raw[yearCol]);
        }
    });

    // 날짜 형식의 데이터도 Date 객체로 변환하면 좋지만, 우선순위는 숫자 변환입니다.
    // course.과정시작일 = new Date(raw.과정시작일);
    // course.과정종료일 = new Date(raw.과정종료일);

    return course;
};


const main = async () => {
  console.log('Starting data preprocessing...');

  try {
    // 1. 원본 데이터 로드 (로컬 CSV 파일)
    const csvFilePath = path.join(process.cwd(), '..', 'result_kdtdata_202506.csv');
    console.log(`Reading data from: ${csvFilePath}`);
    const csvFile = fs.readFileSync(csvFilePath, 'utf8');
    const rawData = Papa.parse(csvFile, { header: true, skipEmptyLines: true }).data;
    console.log(`Loaded ${rawData.length} rows of data.`);

    // 2. 데이터 전처리 및 가공 (기존 로직 활용)
    // CourseData 형태로 변환 (필요시 상세 구현)
    const processedData = rawData.map(transformRawDataToCourseData);

    // 기관 그룹화
    const groupedData = groupInstitutions(processedData);
    console.log('Finished grouping institutions.');

    // 전체 평균 수료율 계산
    const overallCompletionRate = 50; // 임시 값, 실제 계산 로직 필요
    
    // 매출 보정
    const adjustedData = applyRevenueAdjustment(groupedData, overallCompletionRate);
    console.log('Finished applying revenue adjustments.');

    // 3. 각 페이지에 필요한 최종 데이터 생성
    const institutionStats = calculateInstitutionStats(adjustedData);
    console.log('Calculated institution stats.');

    const yearlyStats = calculateYearlyStats(adjustedData);
    console.log('Calculated yearly stats.');

    const monthlyStats = calculateMonthlyStats(adjustedData);
    console.log('Calculated monthly stats.');

    // 4. 결과를 JSON 파일로 저장
    const outputDir = path.join(process.cwd(), 'public', 'processed-data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(path.join(outputDir, 'institution-stats.json'), JSON.stringify(institutionStats, null, 2));
    fs.writeFileSync(path.join(outputDir, 'yearly-stats.json'), JSON.stringify(yearlyStats, null, 2));
    fs.writeFileSync(path.join(outputDir, 'monthly-stats.json'), JSON.stringify(monthlyStats, null, 2));
    fs.writeFileSync(path.join(outputDir, 'all-courses.json'), JSON.stringify(adjustedData, null, 2)); // 전체 과정 데이터 추가

    console.log(`✅ Data preprocessing complete! Files saved in ${outputDir}`);

  } catch (error) {
    console.error('Error during data preprocessing:', error);
    process.exit(1);
  }
};

main();
