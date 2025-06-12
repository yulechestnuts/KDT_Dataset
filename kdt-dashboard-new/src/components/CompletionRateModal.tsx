"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CourseData } from "@/lib/data-utils";
import { formatNumber } from "@/utils/formatters";

interface CompletionRateModalProps {
  course: CourseData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CompletionRateModal({ course, isOpen, onClose }: CompletionRateModalProps) {
  if (!course) return null;

  // 수료율 계산 로직 (수료인원이 0인 과정 제외)
  const calculateDisplayCompletionRate = (course: CourseData): string => {
    const enrolledStudents = course['수강신청 인원'] ?? 0;
    const completedStudents = course['수료인원'] ?? 0;

    if (enrolledStudents === 0) {
      return '0.0%'; // 수강신청 인원이 0이면 수료율 0으로 표시
    }
    return ((completedStudents / enrolledStudents) * 100).toFixed(1) + '%';
  };

  const displayCompletionRate = calculateDisplayCompletionRate(course);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>수료율 상세</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <p>
            <span className="font-medium">과정명:</span> {course.과정명 || '미정'}
          </p>
          <p>
            <span className="font-medium">수강신청 인원:</span> {formatNumber(course['수강신청 인원'])}명
          </p>
          <p>
            <span className="font-medium">수료 인원:</span> {formatNumber(course['수료인원'])}명
          </p>
          <p className="text-lg font-bold mt-4">
            <span className="font-medium">계산된 수료율:</span> {displayCompletionRate}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
} 