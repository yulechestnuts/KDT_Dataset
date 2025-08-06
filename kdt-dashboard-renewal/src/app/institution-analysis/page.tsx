import fs from 'fs';
import path from 'path';
import { InstitutionStat } from '@/lib/types';
import InstitutionAnalysisClient from './InstitutionAnalysisClient';

async function getInstitutionStatsData(): Promise<{ initialInstitutionStats: InstitutionStat[]; availableYears: number[] }> {
  const filePath = path.join(process.cwd(), 'public', 'processed-data', 'institution-stats.json');

  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const rawData = JSON.parse(fileContents);
    
    // 데이터 매핑: JSON의 필드명을 타입에 맞게 변환
    const initialInstitutionStats: InstitutionStat[] = rawData.map((item: any) => ({
      institutionName: item.institutionName,
      totalRevenue: item.totalRevenue,
      totalCourses: item.totalCourses,
      totalStudents: item.totalStudents,
      completedStudents: item.completedStudents,
      completionRate: item.averageCompletionRate || 0, // averageCompletionRate -> completionRate
      avgSatisfaction: item.averageSatisfaction || 0, // averageSatisfaction -> avgSatisfaction
      courses: [], // 빈 배열로 초기화
      prevYearStudents: 0,
      prevYearCompletedStudents: 0
    }));

    // 사용 가능한 연도 추출 (2021년부터 2026년까지 고정)
    const availableYears = [2021, 2022, 2023, 2024, 2025, 2026];

    return { initialInstitutionStats, availableYears };
  } catch (error) {
    console.error('Error loading institution stats data:', error);
    return { initialInstitutionStats: [], availableYears: [] };
  }
}

export default async function InstitutionAnalysisPage() {
  const { initialInstitutionStats, availableYears } = await getInstitutionStatsData();

  return (
    <InstitutionAnalysisClient
      initialInstitutionStats={initialInstitutionStats}
      availableYears={availableYears}
    />
  );
}
