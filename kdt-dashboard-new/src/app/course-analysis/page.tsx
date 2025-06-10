"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CourseAnalysis } from '@/components/course-analysis/course-analysis';

function CourseAnalysisContent() {
  const searchParams = useSearchParams();
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
  
  return (
    <div className="container mx-auto px-4 py-8">
      <CourseAnalysis year={year} />
    </div>
  );
}

export default function CourseAnalysisPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <CourseAnalysisContent />
    </Suspense>
  );
} 