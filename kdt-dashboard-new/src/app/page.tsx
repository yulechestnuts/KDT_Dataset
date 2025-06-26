'use client';

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Rocket, Calendar, TrendingUp, Building2, BookText, Factory, Users } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4 text-center">KDT 데이터 분석</h1>
        <p className="text-center text-lg text-gray-600 mb-12">디지털 인재 양성 및 사업 분석을 위한 시스템</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Link href="/yearly-analysis">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:shadow-lg transition-shadow duration-200">
              <Calendar className="h-12 w-12 text-blue-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">연도별 분석</h2>
              <p className="text-sm text-gray-500">연도별 매출, 훈련생 수, 과정 수의 추이를 분석합니다.</p>
            </Card>
          </Link>

          <Link href="/monthly-analysis">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:shadow-lg transition-shadow duration-200">
              <TrendingUp className="h-12 w-12 text-green-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">월별 분석</h2>
              <p className="text-sm text-gray-500">월별 매출, 훈련생 수, 과정 수의 추이를 분석합니다.</p>
            </Card>
          </Link>

          <Link href="/institution-analysis">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:shadow-lg transition-shadow duration-200">
              <Building2 className="h-12 w-12 text-purple-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">훈련기관별 분석</h2>
              <p className="text-sm text-gray-500">훈련기관별 매출, 훈련생 수, 과정 수를 분석합니다.</p>
            </Card>
          </Link>

          <Link href="/ncs-analysis">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:shadow-lg transition-shadow duration-200">
              <BookText className="h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">NCS 분석</h2>
              <p className="text-sm text-gray-500">NCS별 매출, 훈련생 수, 과정 수를 분석합니다.</p>
            </Card>
          </Link>

          <Link href="/course-analysis">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:shadow-lg transition-shadow duration-200">
              <Rocket className="h-12 w-12 text-orange-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">훈련과정 분석</h2>
              <p className="text-sm text-gray-500">훈련과정별 매출, 훈련생 수, 과정 수를 분석합니다.</p>
            </Card>
          </Link>

          <Link href="/leading-company-analysis">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:shadow-lg transition-shadow duration-200">
              <Factory className="h-12 w-12 text-cyan-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">선도기업형 과정 분석</h2>
              <p className="text-sm text-gray-500">선도기업의 과정을 분석합니다.</p>
            </Card>
          </Link>

          <Link href="/employment-analysis">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:shadow-lg transition-shadow duration-200">
              <Users className="h-12 w-12 text-indigo-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">취업률 분석</h2>
              <p className="text-sm text-gray-500">3개월, 6개월, 전체 기준 취업률을 분석합니다.</p>
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
}
