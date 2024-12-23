import React, { useState } from 'react';

const formatRevenue = (revenue) => {
  return (revenue / 100000000).toLocaleString('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + '억원';
};

const MarketOverview = ({ yearlyRevenueData }) => {
  const years = Object.keys(yearlyRevenueData).sort();

  return (
    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
      <h2 style={{ color: '#007bff', marginBottom: '10px' }}>시장 개요</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {years.map(year => (
          <div key={year} style={{ background: '#e9ecef', padding: '15px', borderRadius: '8px' }}>
            <h4 style={{ color: '#007bff', marginBottom: '5px' }}>{year}</h4>
            <p style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#343a40' }}>
              {formatRevenue(yearlyRevenueData[year].amount)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ... (YearlyRevenueChart, InstitutionPerformance 컴포넌트도 동일한 파일에 작성)

const InstitutionAnalysis = ({ reportData, totalMarket, avgRevenue }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReportData = reportData.filter(item =>
    item.institution.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        margin: '20px 0',
        display: 'flex',
        justifyContent: 'center',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        <input
          type="text"
          placeholder="기관명 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '8px 16px',
            background: '#f8f9fa',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            color: 'black',
            marginRight: '10px'
          }}
        />
      </div>
      {/* 시장 개요는 항상 상단에 표시 */}
      {filteredReportData.length > 0 && (
          <MarketOverview yearlyRevenueData={filteredReportData[0].yearlyRevenueData} />
      )}

      {/* 검색 결과 표시 */}
      {filteredReportData.map(data => (
        <InstitutionPerformance
          key={data.institution}
          institution={data.institution}
          yearlyRevenueData={data.yearlyRevenueData}
          yearlyCourses={data.yearlyCourses}
          monthlyCourses={data.monthlyCourses}
          courseDetails={data.courseDetails}
        />
      ))}
    </div>
  );
};

export default InstitutionAnalysis;