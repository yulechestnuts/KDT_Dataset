import { CourseData } from '../types/data';

// 날짜 파싱 함수
export const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// 수료율에 따른 매출액 보정 계수 계산
export const calculateRevenueAdjustmentFactor = (completionRate: number): number => {
  if (completionRate >= 80) return 1.0;
  if (completionRate >= 70) return 0.9;
  if (completionRate >= 60) return 0.8;
  if (completionRate >= 50) return 0.7;
  return 0.6;
};

export interface AggregatedCourseData {
  과정명: string;
  총수강신청인원: number;
  총수료인원: number;
  총누적매출: number;
  최소과정시작일: string;
  최대과정종료일: string;
  훈련유형들: string[];
  원천과정수: number;
  총훈련생수: number;
  평균만족도: number;
  만족도합계: number;
  만족도계수: number;
}

export const aggregateCoursesByCourseName = (courses: CourseData[]): AggregatedCourseData[] => {
  const aggregatedMap = new Map<string, AggregatedCourseData>();

  courses.forEach(course => {
    const courseName = course.과정명;
    if (!aggregatedMap.has(courseName)) {
      aggregatedMap.set(courseName, {
        과정명: courseName,
        총수강신청인원: 0,
        총수료인원: 0,
        총누적매출: 0,
        최소과정시작일: course.과정시작일,
        최대과정종료일: course.과정종료일,
        훈련유형들: [],
        원천과정수: 0,
        총훈련생수: 0,
        평균만족도: 0,
        만족도합계: 0,
        만족도계수: 0
      });
    }
    const aggregatedCourse = aggregatedMap.get(courseName)!;

    aggregatedCourse.총수강신청인원 += course['수강신청 인원'];
    aggregatedCourse.총수료인원 += course['수료인원'];
    aggregatedCourse.총누적매출 += course.훈련비 ?? 0; // 훈련비는 handleViewDetails에서 조정될 예정

    aggregatedCourse.원천과정수 += 1;
    aggregatedCourse.총훈련생수 += course['수강신청 인원'];

    // 만족도 계산 (수강신청 인원 가중 평균)
    if ((course.만족도 ?? 0) > 0 && (course['수강신청 인원'] ?? 0) > 0) {
      aggregatedCourse.만족도합계 += (course.만족도 ?? 0) * (course['수강신청 인원'] ?? 0);
      aggregatedCourse.만족도계수 += (course['수강신청 인원'] ?? 0);
      aggregatedCourse.평균만족도 = aggregatedCourse.만족도계수 > 0 ? aggregatedCourse.만족도합계 / aggregatedCourse.만족도계수 : 0;
    }

    // 훈련유형 중복 없이 추가
    if (course.훈련유형 && !aggregatedCourse.훈련유형들.includes(course.훈련유형)) {
      aggregatedCourse.훈련유형들.push(course.훈련유형);
    }
    
    // 시작일/종료일 업데이트
    if (new Date(course.과정시작일) < new Date(aggregatedCourse.최소과정시작일)) {
      aggregatedCourse.최소과정시작일 = course.과정시작일;
    }
    if (new Date(course.과정종료일) > new Date(aggregatedCourse.최대과정종료일)) {
      aggregatedCourse.최대과정종료일 = course.과정종료일;
    }
  });

  return Array.from(aggregatedMap.values()).sort((a, b) => b.총누적매출 - a.총누적매출);
}; 