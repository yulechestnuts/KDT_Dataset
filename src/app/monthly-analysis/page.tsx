'use client';

import React, { useEffect, useState } from 'react';

  {selectedMonthDetails.map((course, idx) => {
    const courseId = `${course.과정명}-${course.회차}`;
    const isExpanded = expandedCourses.has(courseId);
    const allCourseDetails = data.filter(c => c.과정명 === course.과정명)
      .sort((a, b) => new Date(a.과정시작일).getTime() - new Date(b.과정시작일).getTime());

    return (
      <React.Fragment key={courseId}>
        <TableRow>
          <TableCell>
            {course.과정명}
          </TableCell>
          <TableCell>{course.훈련기관}</TableCell>
          <TableCell>{course.회차}</TableCell>
          <TableCell>{new Date(course.과정시작일).toLocaleDateString()}</TableCell>
          <TableCell>{new Date(course.과정종료일).toLocaleDateString()}</TableCell>
          <TableCell>{formatNumber(course['수강신청 인원'])}</TableCell>
          <TableCell>{formatNumber(course.수료인원)}</TableCell>
          <TableCell>{((course.수료인원 || 0) / (course['수강신청 인원'] || 1) * 100).toFixed(1)}%</TableCell>
          <TableCell>{formatCurrency(course.누적매출)}</TableCell>
          <TableCell>
            {course.과정페이지링크 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(course.과정페이지링크, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                바로가기
              </Button>
            )}
          </TableCell>
        </TableRow>
        {isExpanded && allCourseDetails.map((detail, detailIdx) => (
          <TableRow key={`${courseId}-${detail.회차}-${detailIdx}`} className="bg-gray-50">
            <TableCell className="pl-12">{detail.과정명}</TableCell>
            <TableCell>{detail.훈련기관}</TableCell>
            <TableCell>{detail.회차}</TableCell>
            <TableCell>{new Date(detail.과정시작일).toLocaleDateString()}</TableCell>
            <TableCell>{new Date(detail.과정종료일).toLocaleDateString()}</TableCell>
            <TableCell>{formatNumber(detail['수강신청 인원'])}</TableCell>
            <TableCell>{formatNumber(detail.수료인원)}</TableCell>
            <TableCell>{((detail.수료인원 || 0) / (detail['수강신청 인원'] || 1) * 100).toFixed(1)}%</TableCell>
            <TableCell>{formatCurrency(detail.누적매출)}</TableCell>
            <TableCell>
              {detail.과정페이지링크 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(detail.과정페이지링크, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  바로가기
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </React.Fragment>
    );
  })} 