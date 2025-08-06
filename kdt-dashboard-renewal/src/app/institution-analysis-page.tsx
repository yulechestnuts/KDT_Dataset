
'use client';

import { useState, useEffect } from 'react';

// 데이터 타입을 정의합니다. (실제 프로젝트에서는 별도 types.ts 파일로 분리하는 것이 좋습니다)
interface InstitutionStat {
  institutionName: string;
  totalRevenue: number;
  totalCourses: number;
  totalStudents: number;
  completedStudents: number;
  averageCompletionRate: number;
  averageSatisfaction: number;
}

// 로딩 상태를 표시할 간단한 컴포넌트
const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

// 데이터를 표시할 테이블 컴포넌트 (기존 InstitutionAnalysisClient와 유사한 역할)
const InstitutionTable = ({ data }: { data: InstitutionStat[] }) => {
  if (!data || data.length === 0) {
    return <p>데이터가 없습니다.</p>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">훈련기관별 분석</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-200">
            <tr>
              <th className="py-2 px-4 border-b">훈련기관</th>
              <th className="py-2 px-4 border-b">총 매출 (보정)</th>
              <th className="py-2 px-4 border-b">과정 수</th>
              <th className="py-2 px-4 border-b">총 학생 수</th>
              <th className="py-2 px-4 border-b">수료율 (%)</th>
              <th className="py-2 px-4 border-b">만족도</th>
            </tr>
          </thead>
          <tbody>
            {data.map((stat, index) => (
              <tr key={index} className="hover:bg-gray-100">
                <td className="py-2 px-4 border-b">{stat.institutionName}</td>
                <td className="py-2 px-4 border-b text-right">{stat.totalRevenue.toLocaleString()}원</td>
                <td className="py-2 px-4 border-b text-right">{stat.totalCourses}</td>
                <td className="py-2 px-4 border-b text-right">{stat.totalStudents}</td>
                <td className="py-2 px-4 border-b text-right">{stat.averageCompletionRate.toFixed(1)}%</td>
                <td className="py-2 px-4 border-b text-right">{stat.averageSatisfaction.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 메인 페이지 컴포넌트
export default function InstitutionAnalysisPage() {
  const [institutionData, setInstitutionData] = useState<InstitutionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // public 폴더에 미리 가공된 JSON 데이터를 fetch 합니다.
        const response = await fetch('/processed-data/institution-stats.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setInstitutionData(data);
      } catch (e) {
        if (e instanceof Error) {
            setError(e.message);
        } else {
            setError('An unknown error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // 컴포넌트 마운트 시 1회만 실행

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <p className="text-red-500">데이터 로딩 중 오류가 발생했습니다: {error}</p>;
  }

  return <InstitutionTable data={institutionData} />;
}
