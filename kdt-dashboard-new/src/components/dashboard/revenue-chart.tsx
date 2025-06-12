'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyStats } from "@/lib/data-utils";
import { formatCurrency } from "@/utils/data-utils";
import { formatNumber } from "@/utils/format-utils";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface RevenueChartProps {
  data: MonthlyStats[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  // 데이터 유효성 검사
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>월별 매출 및 수강인원 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            데이터가 없습니다.
          </div>
        </CardContent>
      </Card>
    );
  }

  // 데이터 정렬 및 처리 개선
  const sortedData = [...data]
    .filter(stat => stat.month && (stat.revenue !== undefined || stat.totalStudents !== undefined))
    .sort((a, b) => a.month.localeCompare(b.month));

  if (sortedData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>월별 매출 및 수강인원 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            유효한 데이터가 없습니다.
          </div>
        </CardContent>
      </Card>
    );
  }

  const months = sortedData.map(stat => stat.month);
  const revenueData = sortedData.map(stat => stat.revenue || 0);
  const studentData = sortedData.map(stat => stat.totalStudents);

  // 차트 색상 개선 (대시보드 스타일)
  const chartData = {
    labels: months,
    datasets: [
      {
        label: '매출',
        data: revenueData,
        borderColor: '#3b82f6', // Blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        tension: 0.4, // 부드러운 곡선
        fill: true,
        yAxisID: 'y',
      },
      {
        label: '수강인원',
        data: studentData,
        borderColor: '#ef4444', // Red-500
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: '#ef4444',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        tension: 0.4, // 부드러운 곡선
        fill: true,
        yAxisID: 'y1',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: false,
      },
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#374151',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: function(context: any) {
            return `${context[0].label}`;
          },
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.dataset.yAxisID === 'y') {
              label += formatCurrency(context.parsed.y);
            } else {
              label += formatNumber(context.parsed.y) + '명';
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#6b7280',
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
        },
        ticks: {
          color: '#6b7280',
          callback: function(value: any) {
            return formatCurrency(value);
          }
        },
        beginAtZero: true,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: '#6b7280',
          callback: function(value: any) {
            return formatNumber(value) + '명';
          }
        },
        beginAtZero: true,
      },
    },
  } as const;

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          월별 매출 및 수강인원 추이
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-80 w-full relative">
          <p style={{ position: 'absolute', top: '5%', transform: 'translateY(-50%)', left: '10px', whiteSpace: 'nowrap' }} className="text-sm text-gray-700 font-semibold">매출액</p>
          <p style={{ position: 'absolute', top: '5%', transform: 'translateY(-50%)', right: '10px', whiteSpace: 'nowrap' }} className="text-sm text-gray-700 font-semibold">수강인원</p>
          <Line data={chartData} options={options} />
        </div>
        
        {/* 간단한 통계 요약 */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-sm text-gray-600">총 매출</p>
            <p className="text-lg font-semibold text-blue-600">
              {formatCurrency(revenueData.reduce((sum, val) => sum + val, 0))}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">총 수강인원</p>
            <p className="text-lg font-semibold text-red-600">
              {formatNumber(studentData.reduce((sum, val) => sum + val, 0))}명
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}