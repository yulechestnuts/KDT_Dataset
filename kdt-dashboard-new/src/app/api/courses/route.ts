import { NextResponse } from 'next/server';
import { loadDataFromGithub } from '@/utils/data-loader';
import { parse } from 'papaparse';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'edge';

export async function GET() {
  try {
    const csvData = await loadDataFromGithub();
    const { data, errors } = parse(csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    if (errors && errors.length > 0) {
      console.error('CSV 파싱 오류:', errors);
      throw new Error('CSV 데이터 파싱에 실패했습니다.');
    }

    // 데이터 전처리
    const processedData = data.map((row: any) => ({
      institutionName: row.훈련기관명 || '',
      courseName: row.훈련과정명 || '',
      tuition: Number(row.훈련비) || 0,
      totalStudents: Number(row.훈련생수) || 0,
      completedStudents: Number(row.수료인원) || 0,
      completionRate: Number(row.수료율) || 0,
      satisfaction: Number(row.만족도) || 0,
      revenue: Number(row.매출액) || 0,
    }));

    return NextResponse.json(processedData);
  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
} 