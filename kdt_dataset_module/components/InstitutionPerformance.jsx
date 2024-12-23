import React, { useState } from 'react';

const InstitutionPerformance = ({ institution, yearlyRevenueData, yearlyCourses, monthlyCourses, courseDetails }) => {
  const years = Object.keys(yearlyRevenueData).sort();
  const totalRevenue = Object.values(yearlyRevenueData).reduce((sum, data) => sum + data.amount, 0);

  const formatRevenue = (revenue) => {
    return (revenue / 100000000).toLocaleString('ko-KR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + '억원';
  };

  const [showDetails, setShowDetails] = useState(false);
  const toggleDetails = () => setShowDetails(!showDetails);

  return (
    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
      <h3 style={{ color: '#007bff', marginBottom: '10px' }}>{institution} 상세 분석</h3>
      <button onClick={toggleDetails} style={{ background: '#007bff', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', marginBottom: '10px' }}>
        {showDetails ? '상세 정보 숨기기' : '상세 정보 보기'}
      </button>

      {/* 연도별 과정 및 수강신청 인원 현황 */}
      {showDetails && (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ color: '#007bff', marginTop: '20px' }}>연도별 과정 및 수강신청 인원 현황</h4>
          <div style={{ display: 'flex', gap: '20px' }}>
            {/* ... (연도별, 월별 데이터 테이블 코드 유지) */}
          </div>
        </div>
      )}

      {/* 기관별 과정 상세 정보 */}
      {showDetails && (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ color: '#007bff', marginTop: '20px' }}>과정별 세부 정보</h4>
          {/* ... (과정별 상세 정보 테이블 코드 유지) */}
        </div>
      )}
    </div>
  );
};

export default InstitutionPerformance;