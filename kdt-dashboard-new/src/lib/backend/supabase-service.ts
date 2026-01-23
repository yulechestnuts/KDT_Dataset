// Supabase 데이터 서비스

import { supabase } from '@/lib/supabaseClient';
import { ProcessedCourseData } from './types';

/**
 * 처리된 과정 데이터를 Supabase에 저장
 */
export async function saveProcessedCourses(
  courses: ProcessedCourseData[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 기존 데이터 삭제 (선택사항)
    // await supabase.from('courses').delete().neq('id', 0);

    // 데이터 삽입
    const { error } = await supabase.from('courses').upsert(
      courses.map((course) => ({
        고유값: course.고유값,
        과정명: course.과정명,
        훈련과정_ID: course['훈련과정 ID'],
        회차: course.회차,
        훈련기관: course.훈련기관,
        원본훈련기관: course.원본훈련기관,
        과정시작일: course.과정시작일,
        과정종료일: course.과정종료일,
        수강신청_인원: course['수강신청 인원'],
        수료인원: course.수료인원,
        취업인원: course.취업인원,
        취업인원_3개월: course['취업인원 (3개월)'],
        취업인원_6개월: course['취업인원 (6개월)'],
        수료율: course.수료율,
        취업률: course.취업률,
        만족도: course.만족도,
        훈련비: course.훈련비,
        정원: course.정원,
        총훈련일수: course.총훈련일수,
        총훈련시간: course.총훈련시간,
        누적매출: course.누적매출,
        실_매출_대비: course['실 매출 대비'],
        매출_최대: course['매출 최대'],
        매출_최소: course['매출 최소'],
        '2021년': course['2021년'],
        '2022년': course['2022년'],
        '2023년': course['2023년'],
        '2024년': course['2024년'],
        '2025년': course['2025년'],
        '2026년': course['2026년'],
        조정_2021년: course['조정_2021년'],
        조정_2022년: course['조정_2022년'],
        조정_2023년: course['조정_2023년'],
        조정_2024년: course['조정_2024년'],
        조정_2025년: course['조정_2025년'],
        조정_2026년: course['조정_2026년'],
        조정_실매출대비: course.조정_실매출대비,
        훈련유형: course.훈련유형,
        NCS명: course.NCS명,
        NCS코드: course.NCS코드,
        선도기업: course.선도기업,
        파트너기관: course.파트너기관,
        is_leading_company_course: course.isLeadingCompanyCourse,
        leading_company_partner_institution: course.leadingCompanyPartnerInstitution,
      })),
      {
        onConflict: '고유값',
      }
    );

    if (error) {
      console.error('Supabase 저장 오류:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('데이터 저장 중 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Supabase에서 처리된 과정 데이터 조회
 */
export async function getProcessedCourses(): Promise<ProcessedCourseData[]> {
  try {
    const { data, error } = await supabase.from('courses').select('*');

    if (error) {
      console.error('Supabase 조회 오류:', error);
      return [];
    }

    if (!data) {
      return [];
    }

    // Supabase 데이터를 ProcessedCourseData 형식으로 변환
    return data.map((row: any) => ({
      고유값: row.고유값 || '',
      과정명: row.과정명 || '',
      '훈련과정 ID': row.훈련과정_ID || '',
      회차: row.회차 || '',
      훈련기관: row.훈련기관 || '',
      원본훈련기관: row.원본훈련기관 || '',
      과정시작일: row.과정시작일 || '',
      과정종료일: row.과정종료일 || '',
      '수강신청 인원': row.수강신청_인원 || 0,
      수료인원: row.수료인원 || 0,
      취업인원: row.취업인원 || 0,
      '취업인원 (3개월)': row.취업인원_3개월 || 0,
      '취업인원 (6개월)': row.취업인원_6개월 || 0,
      수료율: row.수료율 || 0,
      취업률: row.취업률 || 0,
      만족도: row.만족도 || 0,
      훈련비: row.훈련비 || 0,
      정원: row.정원 || 0,
      총훈련일수: row.총훈련일수 || 0,
      총훈련시간: row.총훈련시간 || 0,
      누적매출: row.누적매출 || 0,
      '실 매출 대비': row.실_매출_대비 || 0,
      '매출 최대': row.매출_최대 || 0,
      '매출 최소': row.매출_최소 || 0,
      '2021년': row['2021년'] || 0,
      '2022년': row['2022년'] || 0,
      '2023년': row['2023년'] || 0,
      '2024년': row['2024년'] || 0,
      '2025년': row['2025년'] || 0,
      '2026년': row['2026년'] || 0,
      '조정_2021년': row.조정_2021년 || 0,
      '조정_2022년': row.조정_2022년 || 0,
      '조정_2023년': row.조정_2023년 || 0,
      '조정_2024년': row.조정_2024년 || 0,
      '조정_2025년': row.조정_2025년 || 0,
      '조정_2026년': row.조정_2026년 || 0,
      조정_실매출대비: row.조정_실매출대비 || 0,
      훈련유형: row.훈련유형 || '',
      NCS명: row.NCS명 || '',
      NCS코드: row.NCS코드 || '',
      선도기업: row.선도기업 || '',
      파트너기관: row.파트너기관 || '',
      isLeadingCompanyCourse: row.is_leading_company_course || false,
      leadingCompanyPartnerInstitution: row.leading_company_partner_institution || undefined,
    }));
  } catch (error) {
    console.error('데이터 조회 중 오류:', error);
    return [];
  }
}

/**
 * 특정 연도의 과정 데이터 조회
 */
export async function getProcessedCoursesByYear(year: number): Promise<ProcessedCourseData[]> {
  const allCourses = await getProcessedCourses();
  return allCourses.filter((course) => {
    const startDate = new Date(course.과정시작일);
    return startDate.getFullYear() === year;
  });
}
