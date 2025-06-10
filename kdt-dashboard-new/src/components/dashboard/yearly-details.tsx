'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseData } from "@/lib/data-utils";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface YearlyDetailsProps {
  data: CourseData[];
  year: string;
}

export function YearlyDetails({ data, year }: YearlyDetailsProps) {
  const yearData = data.filter(row => row.훈련연도.toString() === year);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{year}년 과정 상세</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>시작일</TableHead>
              <TableHead>종료일</TableHead>
              <TableHead>훈련기관</TableHead>
              <TableHead>과정명</TableHead>
              <TableHead>수강인원</TableHead>
              <TableHead>훈련비</TableHead>
              <TableHead>수료율</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {yearData.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.과정시작일.toLocaleDateString()}</TableCell>
                <TableCell>{row.과정종료일.toLocaleDateString()}</TableCell>
                <TableCell>{row.훈련기관}</TableCell>
                <TableCell>{row.과정명}</TableCell>
                <TableCell>{formatNumber(row.수강신청인원)}</TableCell>
                <TableCell>{formatCurrency(row.훈련비)}</TableCell>
                <TableCell>{row.수료율}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
} 