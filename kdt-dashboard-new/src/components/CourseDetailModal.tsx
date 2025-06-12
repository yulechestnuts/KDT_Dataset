"use client";

import { XMarkIcon } from '@heroicons/react/24/outline';
import { CourseData } from "@/lib/data-utils";
import React from 'react';

interface CourseDetailModalProps {
  course: CourseData;
  onClose: () => void;
  onUpdate?: (updatedCourse: CourseData) => void;
}

// 날짜 포맷 함수
const formatDate = (date: Date | string): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

// 숫자 변환 함수
const getNumericValue = (value: unknown): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const strValue = String(value).replace(/,/g, '').trim();
  if (strValue === '' || strValue === 'undefined' || strValue.toLowerCase() === 'n/a') return 0;
  const parsed = parseFloat(strValue);
  return isNaN(parsed) ? 0 : parsed;
};

// 통화 포맷 함수
const formatCurrency = (value: unknown): string => {
  const numValue = getNumericValue(value);
  if (numValue === 0) return '-';
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0
  }).format(numValue);
};

// 숫자 포맷 함수 (일반 숫자용)
const formatNumber = (value: unknown): string => {
  const numValue = getNumericValue(value);
  if (numValue === 0) return '0';
  return new Intl.NumberFormat('ko-KR').format(numValue);
};

// 퍼센트 포맷 함수
const formatPercent = (value: unknown): string => {
  const numValue = getNumericValue(value);
  if (numValue === 0) return '0.0%';
  return `${numValue.toFixed(1)}%`;
};

export default function CourseDetailModal({ course, onClose, onUpdate }: CourseDetailModalProps) {
  if (!course) return null;

  const [isEditing, setIsEditing] = React.useState(false);
  const [editedCourse, setEditedCourse] = React.useState<CourseData>(course);

  // 입력값 변경 핸들러
  const handleInputChange = (field: keyof CourseData, value: string) => {
    const numericValue = getNumericValue(value);
    setEditedCourse(prev => ({
      ...prev,
      [field]: numericValue
    }));
  };

  // 저장 핸들러
  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedCourse);
    }
    setIsEditing(false);
  };

  // 취소 핸들러
  const handleCancel = () => {
    setEditedCourse(course);
    setIsEditing(false);
  };

  // 백드롭 클릭 시 모달 닫기
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // ESC 키로 모달 닫기
  React.useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg p-8 w-[98vw] h-[98vh] max-w-[1600px] max-h-[900px] overflow-y-auto">
        <div className="flex justify-between items-start mb-8">
          <h2 className="text-3xl font-bold text-gray-900 pr-4">{course.과정명 || '과정명 없음'}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors duration-200 flex-shrink-0"
            aria-label="모달 닫기"
          >
            <XMarkIcon className="h-8 w-8" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* 기본 정보 */}
          <div className="space-y-6">
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">기본 정보</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-base text-gray-500 mb-2">훈련기관</p>
                <p className="text-lg font-medium">{course.훈련기관 || '-'}</p>
              </div>
              <div>
                <p className="text-base text-gray-500 mb-2">훈련연도</p>
                <p className="text-lg font-medium">{course.훈련연도 ? `${course.훈련연도}년` : '-'}</p>
              </div>
              <div>
                <p className="text-base text-gray-500 mb-2">과정기간</p>
                <p className="text-lg font-medium">
                  {formatDate(course.과정시작일)} ~ {formatDate(course.과정종료일)}
                </p>
              </div>
              <div>
                <p className="text-base text-gray-500 mb-2">총 훈련일수</p>
                <p className="text-lg font-medium">{formatNumber(course.총훈련일수)}일</p>
              </div>
              <div>
                <p className="text-base text-gray-500 mb-2">총 훈련시간</p>
                <p className="text-lg font-medium">{formatNumber(course.총훈련시간)}시간</p>
              </div>
              <div>
                <p className="text-base text-gray-500 mb-2">정원</p>
                <p className="text-lg font-medium">{formatNumber(course.정원)}명</p>
              </div>
            </div>
          </div>

          {/* 수강생 정보 */}
          <div className="space-y-6">
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">수강생 정보</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-base text-gray-500 mb-2">수강신청 인원</p>
                <p className="text-lg font-medium">{formatNumber(course.수강신청인원)}명</p>
              </div>
              <div>
                <p className="text-base text-gray-500 mb-2">수료 인원</p>
                <p className="text-lg font-medium">{formatNumber(course.수료인원)}명</p>
              </div>
              <div>
                <p className="text-base text-gray-500 mb-2">수료율</p>
                <p className="text-lg font-medium">{formatPercent(course.수료율)}</p>
              </div>
              <div>
                <p className="text-base text-gray-500 mb-2">만족도</p>
                <p className="text-lg font-medium">{course.만족도 ? `${getNumericValue(course.만족도).toFixed(1)}점` : '-'}</p>
              </div>
            </div>
          </div>

          {/* 매출 정보 */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-semibold text-gray-900">매출 정보</h3>
              <div className="space-x-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    수정
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                    >
                      저장
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      취소
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-base text-gray-500 mb-2">실 매출 대비</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedCourse['실 매출 대비'] || ''}
                    onChange={(e) => handleInputChange('실 매출 대비', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-lg font-medium">{formatCurrency(course['실 매출 대비'])}</p>
                )}
              </div>
              <div>
                <p className="text-base text-gray-500 mb-2">훈련비</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedCourse.훈련비 || ''}
                    onChange={(e) => handleInputChange('훈련비', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-lg font-medium">{formatCurrency(course.훈련비)}</p>
                )}
              </div>
              <div>
                <p className="text-base text-gray-500 mb-2">누적매출</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedCourse.누적매출 || ''}
                    onChange={(e) => handleInputChange('누적매출', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-lg font-medium">{formatCurrency(course.누적매출)}</p>
                )}
              </div>
              {course['매출 최소'] && (
                <div>
                  <p className="text-base text-gray-500 mb-2">매출 최소</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCourse['매출 최소'] || ''}
                      onChange={(e) => handleInputChange('매출 최소', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-lg font-medium">{formatCurrency(course['매출 최소'])}</p>
                  )}
                </div>
              )}
              {course['매출 최대'] && (
                <div>
                  <p className="text-base text-gray-500 mb-2">매출 최대</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCourse['매출 최대'] || ''}
                      onChange={(e) => handleInputChange('매출 최대', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-lg font-medium">{formatCurrency(course['매출 최대'])}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 연도별 매출 */}
          <div className="space-y-6">
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">연도별 매출</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[2021, 2022, 2023, 2024, 2025, 2026].map(year => {
                const yearKey = `${year}년` as keyof CourseData;
                const yearRevenue = isEditing ? editedCourse[yearKey] : course[yearKey];
                const yearCumulative = isEditing ? editedCourse[`${year}년_누적` as keyof CourseData] : course[`${year}년_누적` as keyof CourseData];
                const hasData = getNumericValue(yearRevenue) > 0 || getNumericValue(yearCumulative) > 0;
                
                if (!hasData) return null;
                
                return (
                  <div key={year} className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-base text-gray-500 mb-2">{year}년</p>
                    {isEditing ? (
                      <input
                        type="text"
                        value={yearRevenue || ''}
                        onChange={(e) => handleInputChange(yearKey, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                      />
                    ) : (
                      <p className="text-lg font-medium mb-1">
                        {formatCurrency(yearRevenue)}
                      </p>
                    )}
                    {yearCumulative && (
                      isEditing ? (
                        <input
                          type="text"
                          value={yearCumulative || ''}
                          onChange={(e) => handleInputChange(`${year}년_누적` as keyof CourseData, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="누적"
                        />
                      ) : (
                        <p className="text-sm text-gray-500">
                          누적: {formatCurrency(yearCumulative)}
                        </p>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}