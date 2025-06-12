import { CourseData, InstitutionStat } from '@/lib/data-utils';

export const calculateInstitutionStats = (courses: CourseData[]): InstitutionStat[] => {
  const statsMap = new Map<string, InstitutionStat>();

  courses.forEach(course => {
    const institution = course.훈련기관;
    if (!statsMap.has(institution)) {
      statsMap.set(institution, {
        name: institution,
        institutionName: institution,
        totalCourses: 0,
        totalStudents: 0,
        totalCompleted: 0,
        completedStudents: 0,
        totalRevenue: 0,
        avgSatisfaction: 0,
        completionRate: 0,
        courses: []
      });
    }

    const stat = statsMap.get(institution)!;
    stat.totalCourses++;
    stat.totalStudents += course.훈련인원 || 0;
    stat.totalCompleted += course.수료인원 || 0;
    stat.completedStudents = stat.totalCompleted;  // 동일한 값 설정
    stat.totalRevenue += course.누적매출 || 0;
    
    // 평균 만족도 계산 수정
    const satisfaction = course.만족도 || 0;
    if (satisfaction > 0) {
      stat.avgSatisfaction = (stat.avgSatisfaction * (stat.totalCourses - 1) + satisfaction) / stat.totalCourses;
    }
    
    // 수료율 계산
    stat.completionRate = stat.totalStudents > 0 
      ? (stat.totalCompleted / stat.totalStudents) * 100 
      : 0;
    
    stat.courses.push(course);
  });

  return Array.from(statsMap.values());
}; 