"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CourseData } from "@/lib/data-utils";

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
}

export function CourseDetailDialog({ course, isOpen, onClose }: CourseDetailDialogProps) {
  if (!course) return null;

  // 날짜 포맷팅 함수 (null 처리 포함)
  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return '미정';
    try {
      return date.toLocaleDateString('ko-KR');
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
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto p-6 sm:p-8 bg-white dark:bg-[#1E1E1E] text-gray-950 dark:text-[#F5F5F5] border-2 border-gray-400 dark:border-gray-600 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-950 dark:text-gray-100">
            {course.과정명 || '과정명 미정'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold mb-3 text-lg text-gray-800 dark:text-gray-200">기본 정보</h3>
              <div className="space-y-3">
                <p className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">훈련기관:</span> 
                  <span className="text-gray-900 dark:text-gray-100">{course.훈련기관 || '미정'}</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">과정기간:</span> 
                  <span className="text-gray-900 dark:text-gray-100">
                    {formatDate(course.과정시작일)} ~ {formatDate(course.과정종료일)}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">훈련일수:</span> 
                  <span className="text-gray-900 dark:text-gray-100">{safeFormatNumber(course.총훈련일수)}일</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">훈련시간:</span> 
                  <span className="text-gray-900 dark:text-gray-100">{safeFormatNumber(course.총훈련시간)}시간</span>
                </p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold mb-3 text-lg text-blue-800 dark:text-blue-300">수강 정보</h3>
              <div className="space-y-3">
                <p className="flex justify-between">
                  <span className="font-medium text-blue-600 dark:text-blue-400">정원:</span> 
                  <span className="text-blue-900 dark:text-blue-100">{safeFormatNumber(course.정원)}명</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-blue-600 dark:text-blue-400">수강신청인원:</span> 
                  <span className="text-blue-900 dark:text-blue-100">{safeFormatNumber(course.수강신청인원)}명</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-blue-600 dark:text-blue-400">수료인원:</span> 
                  <span className="text-blue-900 dark:text-blue-100">{safeFormatNumber(course.수료인원)}명</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-blue-600 dark:text-blue-400">수료율:</span> 
                  <span className="text-blue-900 dark:text-blue-100">{safeFormatNumber(course.수료율)}%</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-blue-600 dark:text-blue-400">만족도:</span> 
                  <span className="text-blue-900 dark:text-blue-100">{safeFormatNumber(course.만족도)}%</span>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-lg border border-green-200 dark:border-green-800">
              <h3 className="font-semibold mb-3 text-lg text-green-800 dark:text-green-300">매출 정보</h3>
              <div className="space-y-3">
                <p className="flex justify-between">
                  <span className="font-medium text-green-600 dark:text-green-400">실 매출 대비:</span> 
                  <span className="text-green-900 dark:text-green-100">{safeFormatCurrency(course['실 매출 대비'])}</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-green-600 dark:text-green-400">매출 최소:</span> 
                  <span className="text-green-900 dark:text-green-100">{safeFormatCurrency(course['매출 최소'])}</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-green-600 dark:text-green-400">매출 최대:</span> 
                  <span className="text-green-900 dark:text-green-100">{safeFormatCurrency(course['매출 최대'])}</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium text-green-600 dark:text-green-400">누적매출:</span> 
                  <span className="text-green-900 dark:text-green-100 font-bold">{safeFormatCurrency(course.누적매출)}</span>
                </p>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-lg border border-purple-200 dark:border-purple-800">
              <h3 className="font-semibold mb-3 text-lg text-purple-800 dark:text-purple-300">연도별 매출</h3>
              <div className="space-y-3">
                {[2021, 2022, 2023, 2024, 2025, 2026].map(year => {
                  const yearCol = `${year}년` as keyof CourseData;
                  const revenue = course[yearCol] as number;
                  
                  // 매출이 있는 연도만 표시
                  if (revenue && Number(revenue) > 0) {
                    return (
                      <p key={year} className="flex justify-between">
                        <span className="font-medium text-purple-600 dark:text-purple-400">{year}년:</span> 
                        <span className="text-purple-900 dark:text-purple-100">{safeFormatCurrency(revenue)}</span>
                      </p>
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
                  <p className="text-purple-600 dark:text-purple-400 text-center py-2">연도별 매출 데이터가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}