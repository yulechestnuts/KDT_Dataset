import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { YearlyStats } from '@/lib/data-utils';

interface YearlyAnalysisProps {
  data: YearlyStats[];
}

export function YearlyAnalysis({ data }: YearlyAnalysisProps) {
  // 매출액 포맷팅 함수
  const formatRevenue = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  };

  // 인원수 포맷팅 함수
  const formatCount = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  };

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>연도별 분석</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[600px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 100,
                right: 60,
                left: 60,
                bottom: 60,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="year" 
                label={{ value: '연도', position: 'insideBottom', offset: -40, style: { textAnchor: 'middle', fontSize: '14px' } }} 
                padding={{ left: 40, right: 40 }}
              />
              <YAxis 
                yAxisId="left"
                label={{ value: '매출액', angle: 0, position: 'top', offset: -80, style: { textAnchor: 'middle', fontSize: '14px' } }}
                tickFormatter={formatRevenue}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                label={{ value: '인원수', angle: 0, position: 'top', offset: -80, style: { textAnchor: 'middle', fontSize: '14px' } }}
                tickFormatter={formatCount}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const yearData = payload[0].payload;
                    return (
                      <div className="bg-white p-5 border border-gray-300 rounded shadow-lg">
                        <p className="font-bold text-lg mb-3">{`연도: ${label}년`}</p>
                        <div className="flex flex-row flex-wrap gap-x-4 gap-y-2 pt-2">
                          <p className="text-sm text-blue-600">
                            {`총 매출: ${formatRevenue(yearData.revenue)}`}
                          </p>
                          <p className="text-sm text-green-600">
                            {`총 수강인원: ${formatCount(yearData.totalStudents)}명`}
                          </p>
                          <p className="text-sm text-yellow-600">
                            {`총 수료인원: ${formatCount(yearData.completedStudents)}명`}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="총 매출"
                stroke="#8884d8"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalStudents"
                name="총 수강인원"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="completedStudents"
                name="총 수료인원"
                stroke="#ffc658"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
} 