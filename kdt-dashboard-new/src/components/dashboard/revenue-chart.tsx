'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyStats } from "@/lib/data-utils";
import { formatCurrency, formatNumber, formatEok } from "@/utils/formatters";
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
  ChartOptions,
  Plugin
} from 'chart.js';

// 커스텀 플러그인: y축 제목을 가로로 그리고 상단에 배치
const horizontalYAxisTitlePlugin: Plugin<'line'> = {
  id: 'horizontalYAxisTitle',
  afterDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const { top, left, right } = chartArea;
    ctx.save();
    ctx.font = '12px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#374151';
    ctx.textBaseline = 'bottom';

    // 왼쪽 y축 제목
    const yTitle = scales.y?.options?.title?.text as string | undefined;
    if (yTitle) {
      ctx.textAlign = 'left';
      ctx.fillText(yTitle, left + 4, top - 4);
    }

    // 오른쪽 y1축 제목
    const y1Title = scales.y1?.options?.title?.text as string | undefined;
    if (y1Title) {
      ctx.textAlign = 'right';
      ctx.fillText(y1Title, right - 4, top - 4);
    }

    ctx.restore();
  }
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  horizontalYAxisTitlePlugin
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
  const revenueDataWon = sortedData.map(stat => stat.revenue || 0);
  const EOK = 100_000_000;
  const revenueData = revenueDataWon.map(val => val / EOK); // 억 단위 변환
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
              const wonVal = context.parsed.y * EOK;
              label += formatCurrency(wonVal);
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
          maxRotation: 0,
          minRotation: 0,
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: false,
          text: '매출 (억원)'
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
        },
        ticks: {
          color: '#6b7280',
          callback: function(value: any) {
            return formatEok(value as number);
          }
        },
        beginAtZero: true,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: false,
          text: '수강인원 (명)'
        },
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
        <div className="h-80 w-full">
          <Line data={chartData} options={options} />
        </div>
        
        {/* 간단한 통계 요약 */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-sm text-gray-600">총 매출</p>
            <p className="text-lg font-semibold text-blue-600">
              {formatCurrency(revenueDataWon.reduce((sum, val) => sum + val, 0))}
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