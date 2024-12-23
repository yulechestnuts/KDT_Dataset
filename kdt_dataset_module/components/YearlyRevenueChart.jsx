import React, { useState } from 'react';

const YearlyRevenueChart = ({ yearlyRevenueData }) => {
  const years = Object.keys(yearlyRevenueData).sort();

  const chartData = years.map(year => ({
    연도: year,
    매출: yearlyRevenueData[year].amount / 100000000,
    비중: yearlyRevenueData[year].percentage
  }));

  const maxRevenue = Math.max(...chartData.map(data => data.매출));

  const formatRevenue = (revenue) => {
    return revenue.toLocaleString('ko-KR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + '억원';
  };

  // ... (팝업 관련 로직 유지)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
      {/* ... (차트 바 코드 유지) */}
    </div>
  );
};

export default YearlyRevenueChart;