'use client';

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Course } from '@/lib/types';
import { Button } from '@/components/ui/button';

// Helper functions
const formatNumber = (num: number) => (num || 0).toLocaleString();
const formatCurrency = (num: number) => `₩${Math.round(num || 0).toLocaleString()}`;
const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

interface YearlyDetailsModalProps {
  year: string;
  data: Course[];
  children: React.ReactNode; // To use as a trigger
}

const YearlyDetailsModal: React.FC<YearlyDetailsModalProps> = ({ year, data, children }) => {
  const yearlyCourses = useMemo(() => {
    return data
      .filter(c => c.연도 === year)
      .sort((a, b) => new Date(b.과정시작일).getTime() - new Date(a.과정시작일).getTime());
  }, [year, data]);

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>{year}년 개설 과정 전체 목록</DialogTitle>
        </DialogHeader>
        <div className="max-h-[80vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>훈련기관</TableHead>
                <TableHead>과정명</TableHead>
                <TableHead>회차</TableHead>
                <TableHead>시작일</TableHead>
                <TableHead>종료일</TableHead>
                <TableHead>수강생</TableHead>
                <TableHead>수료생</TableHead>
                <TableHead>매출</TableHead>
                <TableHead>만족도</TableHead>
                <TableHead>링크</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearlyCourses.map((course, index) => (
                <TableRow key={`${course.과정명}-${course.회차}-${index}`}>
                  <TableCell className="text-xs">{course.훈련기관}</TableCell>
                  <TableCell className="font-medium">{course.과정명}</TableCell>
                  <TableCell>{course.회차}</TableCell>
                  <TableCell>{formatDate(course.과정시작일)}</TableCell>
                  <TableCell>{formatDate(course.과정종료일)}</TableCell>
                  <TableCell>{formatNumber(course['수강신청 인원'])}</TableCell>
                  <TableCell>{formatNumber(course.수료인원)}</TableCell>
                  <TableCell>{formatCurrency(course.누적매출)}</TableCell>
                  <TableCell>{course.만족도?.toFixed(1) ?? 'N/A'}</TableCell>
                  <TableCell>
                    {course.과정페이지링크 && (
                      <Button variant="link" size="sm" asChild>
                        <a href={course.과정페이지링크} target="_blank" rel="noopener noreferrer">
                          보기
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default YearlyDetailsModal;