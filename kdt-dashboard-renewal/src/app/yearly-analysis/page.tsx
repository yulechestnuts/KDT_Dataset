import fs from 'fs';
import path from 'path';
import { YearlyStats } from '@/lib/types';

async function getYearlyStatsData(): Promise<YearlyStats[]> {
  const filePath = path.join(process.cwd(), 'public', 'processed-data', 'yearly-stats.json');

  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const yearlyStats: YearlyStats[] = JSON.parse(fileContents);
    return yearlyStats;
  } catch (error) {
    console.error('Error loading yearly stats data:', error);
    return [];
  }
}

export default async function YearlyAnalysisPage() {
  const yearlyStats = await getYearlyStatsData();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">연도별 분석</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">연도별 통계</h3>
        
        {yearlyStats.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 text-lg">데이터를 불러오는 중...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">연도</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">매출액</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">훈련생 수</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수료인원</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">과정 수</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {yearlyStats.map((stat) => (
                  <tr key={stat.year}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {stat.year}년
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Intl.NumberFormat('ko-KR').format(stat.revenue)}원
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Intl.NumberFormat('ko-KR').format(stat.totalStudents)}명
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Intl.NumberFormat('ko-KR').format(stat.completedStudents)}명
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stat.courses.length}개
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 