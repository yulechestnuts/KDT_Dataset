"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CourseData } from "@/lib/data-utils";
import { formatCurrency, formatNumber } from "@/utils/formatters";

interface LeadingCompanyRevenueModalProps {
  course: CourseData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LeadingCompanyRevenueModal({ course, isOpen, onClose }: LeadingCompanyRevenueModalProps) {
  if (!course) return null;

  const isLeadingCompanyCourse = course.과정유형 === '선도기업형';

  // 매출 분배 계산
  const calculateRevenueDistribution = (totalRevenue: number) => {
    if (isLeadingCompanyCourse) {
      return {
        leadingCompanyRevenue: totalRevenue * 0.1, // 선도기업 10%
        partnerInstitutionRevenue: totalRevenue * 0.9, // 파트너기관 90%
      };
    } else {
      return {
        leadingCompanyRevenue: 0,
        partnerInstitutionRevenue: totalRevenue,
      };
    }
  };

  const totalActualRevenue = course['실 매출 대비'] ?? 0;
  const { leadingCompanyRevenue, partnerInstitutionRevenue } = calculateRevenueDistribution(totalActualRevenue);

  // 평균 만족도 계산 (0 또는 특이값 제외)
  const calculateAverageSatisfaction = (course: CourseData): string => {
    const satisfaction = course.만족도 ?? 0;
    if (satisfaction === 0 || isNaN(satisfaction)) {
      return '측정 불가'; // 0 또는 유효하지 않은 값은 제외
    }
    return satisfaction.toFixed(1) + '점';
  };

  const displaySatisfaction = calculateAverageSatisfaction(course);

  // 파트너기관 수료율
  const calculatePartnerCompletionRate = (course: CourseData): string => {
    if (isLeadingCompanyCourse) {
      const enrolledStudents = course['수강신청 인원'] ?? 0;
      const completedStudents = course['수료인원'] ?? 0;
      if (enrolledStudents === 0) return '0.0%';
      return ((completedStudents / enrolledStudents) * 100).toFixed(1) + '%';
    } else {
      return '해당 없음';
    }
  };

  const displayPartnerCompletionRate = calculatePartnerCompletionRate(course);


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>선도기업 매출 상세</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <p>
            <span className="font-medium">과정명:</span> {course.과정명 || '미정'}
          </p>
          <p>
            <span className="font-medium">과정 유형:</span> {course.과정유형 || '미정'}
          </p>
          <p className="font-bold mt-4">
            <span className="font-medium">총 실 매출 대비:</span> {formatCurrency(totalActualRevenue)}
          </p>

          {isLeadingCompanyCourse && (
            <>
              <p>
                <span className="font-medium">선도기업 매출 (10%):</span> {formatCurrency(leadingCompanyRevenue)}
              </p>
              <p>
                <span className="font-medium">파트너기관 매출 (90%):</span> {formatCurrency(partnerInstitutionRevenue)}
              </p>
              <p>
                <span className="font-medium">파트너기관 만족도:</span> {displaySatisfaction}
              </p>
              <p>
                <span className="font-medium">파트너기관 수료율:</span> {displayPartnerCompletionRate}
              </p>
            </>
          )}
          {!isLeadingCompanyCourse && (
            <p>
              <span className="font-medium">일반 과정 매출:</span> {formatCurrency(partnerInstitutionRevenue)}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 