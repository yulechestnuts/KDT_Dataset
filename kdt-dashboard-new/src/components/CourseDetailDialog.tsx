"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CourseData } from "@/lib/data-utils";
import { CompletionRateModal } from "@/components/CompletionRateModal";
import { LeadingCompanyRevenueModal } from "@/components/LeadingCompanyRevenueModal";

// 포맷팅 함수들
const formatNumber = (value: number | string | null | undefined): string => {
  if (value === undefined || value === null) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 1
  }).format(num);
};

const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === undefined || value === null) return '₩0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '₩0';
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(num);
};

interface CourseDetailDialogProps {
  course: CourseData | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updatedCourse: CourseData) => void;
}

export function CourseDetailDialog({ course, isOpen, onClose, onUpdate }: CourseDetailDialogProps) {
  if (!course) return null;

  const [isEditing, setIsEditing] = React.useState(false);
  const [editedCourse, setEditedCourse] = React.useState<CourseData>(course);
  const [isCompletionRateModalOpen, setIsCompletionRateModalOpen] = React.useState(false);
  const [isLeadingCompanyModalOpen, setIsLeadingCompanyModalOpen] = React.useState(false);

  // 입력값 변경 핸들러
  const handleInputChange = (field: keyof CourseData, value: string) => {
    const numericValue = Number(value.replace(/[^0-9.-]+/g, ''));
    setEditedCourse(prev => ({
      ...prev,
      [field]: isNaN(numericValue) ? 0 : numericValue
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

  // 날짜 포맷팅 함수 (null 처리 포함)
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return '미정';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('ko-KR');
    } catch (error) {
      return '날짜 오류';
    }
  };

  // 안전한 숫자 포맷팅 함수
  const safeFormatNumber = (value: any): string => {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return '0';
    }
    return formatNumber(Number(value));
  };

  // 안전한 통화 포맷팅 함수
  const safeFormatCurrency = (value: any): string => {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return formatCurrency(0);
    }
    return formatCurrency(Number(value));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {course.과정명 || '과정명 미정'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="space-y-6">
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
              <h3 className="font-semibold mb-3 text-lg text-gray-800">기본 정보</h3>
              <div className="space-y-3">
                <p className="flex justify-between">
                  <span className="font-medium text-gray-600">훈련기관:</span> 
                  <span className="text-gray-900">{course.훈련기관 || '미정'}</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-gray-600">과정기간:</span> 
                  <span className="text-gray-900">
                    {formatDate(course.과정시작일)} ~ {formatDate(course.과정종료일)}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-gray-600">훈련일수:</span> 
                  <span className="text-gray-900">{safeFormatNumber(course.총훈련일수)}일</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-gray-600">훈련시간:</span> 
                  <span className="text-gray-900">{safeFormatNumber(course.총훈련시간)}시간</span>
                </p>
              </div>
            </div>

            <div className="bg-blue-50 p-5 rounded-lg border border-blue-200">
              <h3 className="font-semibold mb-3 text-lg text-blue-800">수강 정보</h3>
              <div className="space-y-3">
                <p className="flex justify-between">
                  <span className="font-medium text-blue-600">정원:</span> 
                  <span className="text-blue-900">{safeFormatNumber(course.정원)}명</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-blue-600">수강신청인원:</span> 
                  <span className="text-blue-900">{safeFormatNumber(course.수강신청인원)}명</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-blue-600">수료인원:</span> 
                  <span className="text-blue-900">{safeFormatNumber(course.수료인원)}명</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-blue-600">수료율:</span> 
                  <span className="text-blue-900">
                    {safeFormatNumber(course.수료율)}%
                    <button 
                      onClick={() => setIsCompletionRateModalOpen(true)}
                      className="ml-2 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
                    >
                      상세보기
                    </button>
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-blue-600">만족도:</span> 
                  <span className="text-blue-900">{safeFormatNumber(course.만족도)}%</span>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-green-50 p-5 rounded-lg border border-green-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-lg text-green-800">매출 정보</h3>
                <div className="space-x-2">
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                    >
                      수정
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleSave}
                        className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                      >
                        저장
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      >
                        취소
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {course.과정유형 === '선도기업형' && (
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => setIsLeadingCompanyModalOpen(true)}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      선도기업 매출 상세보기
                    </button>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-medium text-green-600">실 매출 대비:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCourse['실 매출 대비'] || ''}
                      onChange={(e) => handleInputChange('실 매출 대비', e.target.value)}
                      className="w-48 px-2 py-1 text-right border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  ) : (
                    <span className="text-green-900">{safeFormatCurrency(course['실 매출 대비'])}</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-green-600">매출 최소:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCourse['매출 최소'] || ''}
                      onChange={(e) => handleInputChange('매출 최소', e.target.value)}
                      className="w-48 px-2 py-1 text-right border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  ) : (
                    <span className="text-green-900">{safeFormatCurrency(course['매출 최소'])}</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-green-600">매출 최대:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCourse['매출 최대'] || ''}
                      onChange={(e) => handleInputChange('매출 최대', e.target.value)}
                      className="w-48 px-2 py-1 text-right border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  ) : (
                    <span className="text-green-900">{safeFormatCurrency(course['매출 최대'])}</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-green-600">누적매출:</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCourse.누적매출 || ''}
                      onChange={(e) => handleInputChange('누적매출', e.target.value)}
                      className="w-48 px-2 py-1 text-right border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 font-bold"
                    />
                  ) : (
                    <span className="text-green-900 font-bold">{safeFormatCurrency(course.누적매출)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-5 rounded-lg border border-purple-200">
              <h3 className="font-semibold mb-3 text-lg text-purple-800">연도별 매출</h3>
              <div className="space-y-3">
                {[2021, 2022, 2023, 2024, 2025, 2026].map(year => {
                  const yearCol = `${year}년` as keyof CourseData;
                  const revenue = isEditing ? editedCourse[yearCol] : course[yearCol];
                  
                  // 매출이 있는 연도만 표시
                  if (revenue && Number(revenue) > 0) {
                    return (
                      <div key={year} className="flex justify-between items-center">
                        <span className="font-medium text-purple-600">{year}년:</span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={revenue || ''}
                            onChange={(e) => handleInputChange(yearCol, e.target.value)}
                            className="w-48 px-2 py-1 text-right border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        ) : (
                          <span className="text-purple-900">{safeFormatCurrency(revenue)}</span>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
                
                {/* 매출 데이터가 없는 경우 메시지 표시 */}
                {![2021, 2022, 2023, 2024, 2025, 2026].some(year => {
                  const yearCol = `${year}년` as keyof CourseData;
                  const revenue = course[yearCol] as number;
                  return revenue && Number(revenue) > 0;
                }) && (
                  <p className="text-purple-600 text-center py-2">연도별 매출 데이터가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 수료율 상세 모달 */}
        <CompletionRateModal
          course={course}
          isOpen={isCompletionRateModalOpen}
          onClose={() => setIsCompletionRateModalOpen(false)}
        />

        {/* 선도기업 매출 상세 모달 */}
        <LeadingCompanyRevenueModal
          course={course}
          isOpen={isLeadingCompanyModalOpen}
          onClose={() => setIsLeadingCompanyModalOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}