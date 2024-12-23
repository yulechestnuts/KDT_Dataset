import React, { useState } from 'react';

const RankingDisplay = ({ rankingData }) => {
  const [selectedYear, setSelectedYear] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const years = Object.keys(rankingData[0].yearlyRevenue).sort();

  const getRevenueForDisplay = (item) => {
    if (selectedYear === 'all') {
      return item.revenue;
    }
    return item.yearlyRevenue[selectedYear] || 0;
  };

  const filteredAndSortedData = [...rankingData]
    .filter(item =>
      item.institution.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => getRevenueForDisplay(b) - getRevenueForDisplay(a));

  const maxRevenue = Math.max(...filteredAndSortedData.map(getRevenueForDisplay));

  const formatRevenue = (revenue) => {
    return (revenue / 100000000).toLocaleString('ko-KR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + '억원';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'black', color: 'white', padding: '20px' }}>
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '16px' }}>KDT 훈련현황</h1>
        <p style={{ fontSize: '20px', color: '#888' }}>첨단산업 디지털 핵심 실무인재 양성 훈련 과정 개괄표</p>

        <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="기관명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 16px',
              background: '#333',
              border: '1px solid #666',
              borderRadius: '4px',
              color: 'white',
              marginRight: '10px'
            }}
          />
          <button
            onClick={() => setSelectedYear('all')}
            style={{
              padding: '8px 16px',
              background: selectedYear === 'all' ? '#4299e1' : '#333',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            전체
          </button>
          {years.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              style={{
                padding: '8px 16px',
                background: selectedYear === year ? '#4299e1' : '#333',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {filteredAndSortedData.map((item, index) => {
          const revenue = getRevenueForDisplay(item);
          const width = (revenue / maxRevenue * 100) + '%';
          return (
            <div key={item.institution} style={{ background: '#222', borderRadius: '8px', padding: '16px', marginBottom: '8px', position: 'relative', animation: `slideIn 0.5s ease-out ${index * 0.1}s both` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                <div>
                  <span style={{ color: '#4299e1', marginRight: '16px' }}>#{index + 1}</span>
                  <span style={{ marginRight: '16px' }}>{item.institution}</span>
                  <span style={{ color: '#888', fontSize: '14px' }}>({item.courses}개 과정)</span>
                </div>
                <div>
                  <span style={{ marginRight: '16px', color: '#4299e1' }}>{formatRevenue(revenue)}</span>
                  <span style={{ color: '#888', fontSize: '14px' }}>{item.startDate} ~ {item.endDate}</span>
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, height: '4px', width: width, background: '#4299e1', transition: 'width 1s ease-out', opacity: 0.5 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RankingDisplay;