const fs = require('fs');
const Papa = require('papaparse');

// 실제 CSV 파일 경로
const csvFilePath = '../result_kdtdata_202505.csv';

try {
  // CSV 파일 읽기
  const csvData = fs.readFileSync(csvFilePath, 'utf8');
  const parsed = Papa.parse(csvData, { header: true });
  const data = parsed.data;

  console.log('=== CSV 파일 컬럼명 확인 ===');
  if (data.length > 0) {
    console.log('첫 번째 row의 컬럼명들:', Object.keys(data[0]));
  }

  // 솔데스크 관련 기관들 필터링
  const solDesk = data.filter(row => row.훈련기관 && row.훈련기관.includes('솔데스크'));

  console.log('\n=== 솔데스크 관련 기관명들 ===');
  const uniqueInstitutions = [...new Set(solDesk.map(row => row.훈련기관))];

  uniqueInstitutions.forEach(name => {
    const institutionData = solDesk.filter(row => row.훈련기관 === name);
    
    // 매출 관련 필드들 확인
    const revenueFields = Object.keys(institutionData[0] || {}).filter(key => 
      key.includes('매출') || key.includes('수익') || key.includes('Revenue') || key.includes('revenue')
    );
    console.log(`\n${name}의 매출 관련 필드들:`, revenueFields);
    
    // 첫 번째 row의 매출 관련 값들 출력
    if (institutionData.length > 0) {
      revenueFields.forEach(field => {
        console.log(`${field}: ${institutionData[0][field]}`);
      });
    }
    
    const totalStudents = institutionData.reduce((sum, row) => sum + (parseFloat(row.수강신청인원) || 0), 0);
    const totalCompleted = institutionData.reduce((sum, row) => sum + (parseFloat(row.수료인원) || 0), 0);
    
    console.log(`${name}: 훈련생 ${totalStudents}명, 수료생 ${totalCompleted}명, 과정수 ${institutionData.length}`);
  });

  console.log('\n=== 솔데스크 관련 모든 기관명 (중복 제거) ===');
  uniqueInstitutions.forEach(name => console.log(name));

} catch (error) {
  console.error('파일 읽기 오류:', error);
  console.log('현재 디렉토리:', process.cwd());
  console.log('파일 경로:', csvFilePath);
} 