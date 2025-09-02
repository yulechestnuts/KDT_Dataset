import requests
import pandas as pd
import logging
import time
import threading
from tkinter import Tk, Label, Button, filedialog, messagebox, StringVar, Progressbar
import csv
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from tkcalendar import Calendar
import re

# 로깅 설정
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s: %(message)s',
    handlers=[
        logging.FileHandler('kdt_automated_collection.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

class KDTDataCalculator:
    """KDT 데이터 계산 및 보정 클래스"""
    
    def __init__(self):
        # 특별 기관 목록 (파트너기관과 매출 분배)
        self.special_institutions = ['대한상공회의소', '한국표준협회']
        
        # 기관 그룹화 규칙
        self.institution_groups = {
            '대한상공회의소': ['대한상공회의소', '대한상공회의소중앙회', '대한상공회의소지방회'],
            '한국표준협회': ['한국표준협회', '한국표준협회지부'],
            '한국산업인력공단': ['한국산업인력공단', '한국산업인력공단지부'],
            '한국전문대학교육협의회': ['한국전문대학교육협의회', '전문대학교육협의회'],
            '한국대학교육협의회': ['한국대학교육협의회', '대학교육협의회'],
            '한국기술교육대학교': ['한국기술교육대학교', '기술교육대학교'],
            '한국폴리텍대학교': ['한국폴리텍대학교', '폴리텍대학교', '폴리텍'],
            '한국폴리텍': ['한국폴리텍', '폴리텍', '폴리텍대학'],
            '한국폴리텍대학': ['한국폴리텍대학', '폴리텍대학'],
            '한국폴리텍대학교': ['한국폴리텍대학교', '폴리텍대학교'],
            '한국폴리텍대학교': ['한국폴리텍대학교', '폴리텍대학교'],
            '한국폴리텍대학교': ['한국폴리텍대학교', '폴리텍대학교'],
        }
    
    def group_institutions_advanced(self, institution_name, similarity_threshold=0.6):
        """기관명 그룹화 (유사도 기반)"""
        if not institution_name:
            return institution_name
        
        # 정확한 매칭 우선 확인
        for group_name, variants in self.institution_groups.items():
            if institution_name in variants:
                return group_name
        
        # 유사도 기반 매칭
        for group_name, variants in self.institution_groups.items():
            for variant in variants:
                if self.calculate_similarity(institution_name, variant) >= similarity_threshold:
                    return group_name
        
        return institution_name
    
    def calculate_similarity(self, str1, str2):
        """문자열 유사도 계산 (간단한 버전)"""
        if not str1 or not str2:
            return 0.0
        
        # 공통 문자열 길이 계산
        common = 0
        min_len = min(len(str1), len(str2))
        
        for i in range(min_len):
            if str1[i] == str2[i]:
                common += 1
            else:
                break
        
        return common / max(len(str1), len(str2))
    
    def detect_leading_company_course(self, course_data):
        """선도기업 과정 판단"""
        # 특정 기관이 파트너기관으로 참여하는 경우
        institution = course_data.get('훈련기관', '')
        grouped_institution = self.group_institutions_advanced(institution)
        
        # 특별 기관이 참여하는 경우 선도기업 과정으로 판단
        if grouped_institution in self.special_institutions:
            return True, grouped_institution
        
        # 과정명에서 선도기업 키워드 검사
        course_name = course_data.get('과정명', '')
        leading_keywords = ['선도기업', '파트너십', '컨소시엄', '산학연계']
        
        for keyword in leading_keywords:
            if keyword in course_name:
                return True, grouped_institution
        
        return False, None
    
    def calculate_course_revenue(self, course_data, target_year=None):
        """과정별 매출 계산"""
        base_revenue = 0
        
        # 기본 매출 계산 (훈련비 * 정원)
        training_cost = self.safe_int(course_data.get('훈련비', 0))
        capacity = self.safe_int(course_data.get('정원', 0))
        
        if training_cost > 0 and capacity > 0:
            base_revenue = training_cost * capacity
        
        # 수료율에 따른 보정
        completion_rate = self.safe_float(course_data.get('수료율', 0))
        if completion_rate > 0:
            if completion_rate >= 80:
                adjustment_factor = 1.2
            elif completion_rate >= 50:
                adjustment_factor = 1.0
            else:
                adjustment_factor = 0.75
            
            base_revenue *= adjustment_factor
        
        # 연도별 분배
        start_date = pd.to_datetime(course_data.get('과정시작일', ''), errors='coerce')
        end_date = pd.to_datetime(course_data.get('과정종료일', ''), errors='coerce')
        
        if pd.isna(start_date) or pd.isna(end_date):
            return base_revenue if target_year is None else 0
        
        yearly_revenue = {}
        total_months = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month) + 1
        
        if total_months <= 0:
            return base_revenue if target_year is None else 0
        
        monthly_revenue = base_revenue / total_months
        
        # 연도별 매출 분배
        current_date = start_date
        while current_date <= end_date:
            year = current_date.year
            if year not in yearly_revenue:
                yearly_revenue[year] = 0
            yearly_revenue[year] += monthly_revenue
            
            # 다음 달로 이동
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
        
        if target_year:
            return yearly_revenue.get(target_year, 0)
        
        return yearly_revenue
    
    def calculate_revenue_distribution(self, course_data):
        """매출 분배 계산 (선도기업/파트너기관)"""
        is_leading, partner_institution = self.detect_leading_company_course(course_data)
        
        revenue_info = {
            'is_leading_company': is_leading,
            'partner_institution': partner_institution if is_leading else '',
            'training_institution_share': 1.0,
            'partner_institution_share': 0.0
        }
        
        if is_leading and partner_institution:
            # 선도기업 과정: 파트너기관 90%, 훈련기관 10%
            revenue_info['training_institution_share'] = 0.1
            revenue_info['partner_institution_share'] = 0.9
        
        return revenue_info
    
    def safe_int(self, value, default=0):
        """안전한 정수 변환"""
        try:
            if pd.isna(value) or value == '':
                return default
            return int(float(str(value).replace(',', '')))
        except:
            return default
    
    def safe_float(self, value, default=0.0):
        """안전한 실수 변환"""
        try:
            if pd.isna(value) or value == '':
                return default
            return float(str(value).replace(',', '').replace('%', ''))
        except:
            return default

class AutomatedKDTDataCollector:
    def __init__(self):
        self.auth_key = "da3974b2-e74e-42f1-8fc5-fb2ae0d938ea"
        self.calculator = KDTDataCalculator()
        self.base_urls = {
            'basic': "https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo310L01.do",
            'detail': "https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo310L02.do",
            'employment': "https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo310L03.do"
        }
    
    def collect_and_process_data(self, start_date, end_date, progress_callback=None):
        """데이터 수집 및 자동 계산 처리"""
        logging.info("전체 데이터 수집 및 처리 시작")
        
        # 1단계: 기본 과정 정보 수집
        if progress_callback:
            progress_callback("기본 과정 정보 수집 중...", 10)
        
        basic_data = self.fetch_basic_data(start_date, end_date)
        
        if not basic_data:
            logging.error("기본 과정 정보 수집 실패")
            return None
        
        # 2단계: 상세 정보 및 취업 통계 수집
        total_items = len(basic_data)
        enriched_data = []
        
        for idx, item in enumerate(basic_data):
            if progress_callback:
                progress_callback(f"상세 정보 수집 중... ({idx+1}/{total_items})", 10 + (idx+1) / total_items * 60)
            
            # 상세 정보 수집
            detail_info = self.fetch_detail_data(
                item['훈련과정 ID'], 
                item['회차'], 
                item['훈련기관ID']
            )
            
            # 취업 통계 수집
            employment_info = self.fetch_employment_data(
                item['훈련과정 ID'], 
                item['회차'], 
                item['훈련기관ID']
            )
            
            # 데이터 통합
            enriched_item = {**item, **detail_info, **employment_info}
            enriched_data.append(enriched_item)
            
            time.sleep(0.1)  # API 호출 간격 조절
        
        # 3단계: 자동 계산 및 보정
        if progress_callback:
            progress_callback("매출 및 기타 정보 계산 중...", 80)
        
        final_data = self.apply_automated_calculations(enriched_data)
        
        if progress_callback:
            progress_callback("처리 완료!", 100)
        
        logging.info(f"전체 데이터 처리 완료: {len(final_data)}개")
        return final_data
    
    def apply_automated_calculations(self, data):
        """자동 계산 로직 적용"""
        processed_data = []
        
        for course in data:
            # 선도기업/파트너기관 판단
            revenue_dist = self.calculator.calculate_revenue_distribution(course)
            
            # 연도별 매출 계산
            yearly_revenues = self.calculator.calculate_course_revenue(course)
            total_revenue = sum(yearly_revenues.values()) if isinstance(yearly_revenues, dict) else yearly_revenues
            
            # 계산된 정보 추가
            processed_course = course.copy()
            
            # 선도기업/파트너기관 정보
            processed_course['선도기업'] = 'Y' if revenue_dist['is_leading_company'] else 'N'
            processed_course['파트너기관'] = revenue_dist['partner_institution']
            
            # 매출 정보
            processed_course['매출 최소'] = total_revenue * 0.8  # 보수적 추정
            processed_course['실 매출 대비'] = total_revenue
            processed_course['매출 최대'] = total_revenue * 1.2  # 낙관적 추정
            
            # 연도별 매출
            if isinstance(yearly_revenues, dict):
                for year in range(2021, 2027):
                    processed_course[f'{year}년'] = yearly_revenues.get(year, 0)
            else:
                # 단일 값인 경우 현재 연도에 할당
                current_year = datetime.now().year
                for year in range(2021, 2027):
                    processed_course[f'{year}년'] = yearly_revenues if year == current_year else 0
            
            processed_data.append(processed_course)
        
        return processed_data
    
    def fetch_basic_data(self, start_date, end_date):
        """기본 과정 정보 수집 (API 310L01)"""
        logging.info(f"기본 과정 정보 수집 시작: {start_date} ~ {end_date}")
        
        params = {
            "authKey": self.auth_key,
            "returnType": "JSON",
            "outType": "2",
            "pageNum": "1",
            "pageSize": "100",
            "srchTraStDt": start_date,
            "srchTraEndDt": end_date,
            "sort": "ASC",
            "sortCol": "TRNG_BGDE",
            "crseTracseSe": "C0104"
        }
        
        all_data = []
        page_num = 1
        
        while True:
            params["pageNum"] = str(page_num)
            try:
                response = requests.get(self.base_urls['basic'], params=params, timeout=30)
                if response.status_code != 200:
                    logging.error(f"API 요청 실패: {response.status_code}")
                    break
                
                data = response.json()
                if 'srchList' not in data or len(data['srchList']) == 0:
                    break
                
                for item in data['srchList']:
                    basic_info = {
                        '고유값': f"{item.get('trprId', '')}_{item.get('trprDegr', '')}_{item.get('instCd', '')}",
                        '과정명': item.get('title', ''),
                        '훈련과정 ID': item.get('trprId', ''),
                        '회차': item.get('trprDegr', ''),
                        '훈련기관': item.get('instNm', ''),
                        '훈련기관ID': item.get('instCd', ''),
                        '총 훈련일수': item.get('trDcnt', ''),
                        '총 훈련시간': item.get('trtm', ''),
                        '과정시작일': item.get('traStartDate', ''),
                        '과정종료일': item.get('traEndDate', ''),
                        'NCS명': item.get('ncsNm', ''),
                        'NCS코드': item.get('ncsCd', ''),
                        '훈련비': item.get('courseMan', ''),
                        '정원': item.get('yardMan', ''),
                        '수강신청 인원': item.get('regCourseMan', ''),
                        '수료인원': '',  # 3단계에서 채워질 예정
                        '수료율': '',    # 3단계에서 계산될 예정
                        '만족도': item.get('stdgScor', ''),
                        '취업인원 (3개월)': '',  # 3단계에서 채워질 예정
                        '취업률 (3개월)': '',    # 3단계에서 채워질 예정
                        '취업인원 (6개월)': '',  # 3단계에서 채워질 예정
                        '취업률 (6개월)': '',    # 3단계에서 채워될 예정
                        '지역': item.get('trngAreaCd', ''),
                        '주소': item.get('address', ''),
                        '과정페이지 링크': item.get('titleLink', ''),
                        # 이후 자동 계산될 컬럼들
                        '선도기업': '',
                        '파트너기관': '',
                        '매출 최소': '',
                        '실 매출 대비': '',
                        '매출 최대': '',
                        '2021년': '',
                        '2022년': '',
                        '2023년': '',
                        '2024년': '',
                        '2025년': '',
                        '2026년': ''
                    }
                    all_data.append(basic_info)
                
                logging.info(f"페이지 {page_num} 처리 완료: {len(data['srchList'])}개 항목")
                page_num += 1
                
            except Exception as e:
                logging.error(f"기본 데이터 수집 중 오류: {e}")
                break
        
        logging.info(f"기본 과정 정보 수집 완료: 총 {len(all_data)}개")
        return all_data
    
    def fetch_detail_data(self, trpr_id, trpr_degr, torg_id):
        """기관 상세 정보 수집 (API 310L02)"""
        params = {
            "authKey": self.auth_key,
            "returnType": "XML",
            "outType": "2",
            "srchTrprId": trpr_id,
            "srchTrprDegr": trpr_degr,
            "srchTorgId": torg_id
        }
        
        try:
            response = requests.get(self.base_urls['detail'], params=params, timeout=30)
            if response.status_code != 200:
                return {}
            
            root = ET.fromstring(response.content)
            base_info = root.find('inst_base_info')
            
            if base_info is None:
                return {}
            
            detail_data = {}
            
            # 추가 상세 정보 추출
            if base_info.find('instPerTrco') is not None:
                detail_data['실제 훈련비'] = base_info.find('instPerTrco').text
            if base_info.find('perTrco') is not None:
                detail_data['정부지원금'] = base_info.find('perTrco').text
            
            return detail_data
            
        except Exception as e:
            logging.error(f"상세 정보 수집 중 오류: {e}")
            return {}
    
    def fetch_employment_data(self, trpr_id, trpr_degr, torg_id):
        """취업 통계 정보 수집 (API 310L03)"""
        params = {
            "authKey": self.auth_key,
            "returnType": "XML",
            "outType": "2",
            "srchTrprId": trpr_id,
            "srchTrprDegr": trpr_degr,
            "srchTorgId": torg_id
        }
        
        try:
            response = requests.get(self.base_urls['employment'], params=params, timeout=30)
            if response.status_code != 200:
                return {}
            
            root = ET.fromstring(response.content)
            scn_list = root.findall('scn_list')
            
            if not scn_list:
                return {}
            
            info = scn_list[0]
            employment_data = {}
            
            # 취업 관련 데이터 추출
            if info.find('eiEmplCnt3') is not None:
                employment_data['취업인원 (3개월)'] = info.find('eiEmplCnt3').text
            if info.find('eiEmplRate3') is not None:
                employment_data['취업률 (3개월)'] = info.find('eiEmplRate3').text
            if info.find('eiEmplCnt6') is not None:
                employment_data['취업인원 (6개월)'] = info.find('eiEmplCnt6').text
            if info.find('eiEmplRate6') is not None:
                employment_data['취업률 (6개월)'] = info.find('eiEmplRate6').text
            
            # 수료 관련 데이터 추출
            if info.find('finiCnt') is not None:
                employment_data['수료인원'] = info.find('finiCnt').text
            
            # 수료율 계산
            completed = self.calculator.safe_int(employment_data.get('수료인원', 0))
            enrolled = self.calculator.safe_int(employment_data.get('수강신청 인원', 0))
            
            if enrolled > 0:
                completion_rate = (completed / enrolled) * 100
                employment_data['수료율'] = f"{completion_rate:.1f}%"
            
            return employment_data
            
        except Exception as e:
            logging.error(f"취업 통계 수집 중 오류: {e}")
            return {}

class AutomatedKDTDataCollectorGUI:
    def __init__(self):
        self.collector = AutomatedKDTDataCollector()
        self.setup_gui()
    
    def setup_gui(self):
        self.root = Tk()
        self.root.title("KDT 데이터 완전 자동화 수집기")
        self.root.geometry("600x500")
        
        # 제목
        Label(self.root, text="K-Digital Training 데이터 완전 자동화 수집기", 
              font=("Arial", 16, "bold")).pack(pady=20)
        
        Label(self.root, text="API 수집 + 선도기업/파트너기관 + 매출 계산 + 연도별 분배", 
              font=("Arial", 12)).pack(pady=5)
        
        # 기능 설명
        features_frame = Label(self.root, text="""
자동화 기능:
✅ 3단계 API 데이터 수집 (기본/상세/취업통계)
✅ 선도기업/파트너기관 자동 판단
✅ 매출 최소/최대 자동 계산
✅ 연도별 매출 자동 분배 (2021~2026년)
✅ 수료율 기반 매출 보정
✅ 기관 그룹화 자동 적용
        """, font=("Arial", 10), justify="left", bg="#f0f0f0")
        features_frame.pack(pady=20, padx=20, fill="x")
        
        # 날짜 선택 버튼
        Button(self.root, text="📅 날짜 선택 및 완전 자동화 수집 시작", 
               command=self.open_calendar, font=("Arial", 12), 
               bg="#4CAF50", fg="white", pady=10).pack(pady=20)
        
        # 진행률 표시
        self.progress_label = Label(self.root, text="대기 중...", font=("Arial", 11))
        self.progress_label.pack(pady=10)
        
        self.progress_bar = Progressbar(self.root, length=500, mode='determinate')
        self.progress_bar.pack(pady=10)
        
        # 상태 표시
        self.status_label = Label(self.root, text="", font=("Arial", 10), fg="blue")
        self.status_label.pack(pady=10)
    
    def open_calendar(self):
        """날짜 선택 팝업"""
        def get_dates():
            start_date = cal_start.get_date().replace('-', '')
            end_date = cal_end.get_date().replace('-', '')
            top.destroy()
            self.start_automated_collection(start_date, end_date)
        
        top = Toplevel(self.root)
        top.title("수집 기간 선택")
        top.geometry("350x450")
        
        Label(top, text="시작 날짜", font=("Arial", 12, "bold")).pack(pady=10)
        cal_start = Calendar(top, selectmode='day', year=2024, month=1, day=1, date_pattern='yyyy-mm-dd')
        cal_start.pack(pady=10)
        
        Label(top, text="종료 날짜", font=("Arial", 12, "bold")).pack(pady=10)
        cal_end = Calendar(top, selectmode='day', year=2024, month=12, day=31, date_pattern='yyyy-mm-dd')
        cal_end.pack(pady=10)
        
        Button(top, text="🚀 완전 자동화 수집 시작", command=get_dates, 
               font=("Arial", 12), bg="#FF5722", fg="white", pady=10).pack(pady=20)
    
    def update_progress(self, message, percentage):
        """진행률 업데이트"""
        self.progress_label.config(text=message)
        self.progress_bar['value'] = percentage
        self.status_label.config(text=f"진행률: {percentage:.1f}%")
        self.root.update_idletasks()
    
    def start_automated_collection(self, start_date, end_date):
        """완전 자동화 데이터 수집 시작"""
        def collect_and_process():
            try:
                # 완전 자동화 데이터 수집 및 처리
                data = self.collector.collect_and_process_data(
                    start_date, 
                    end_date, 
                    self.update_progress
                )
                
                if data:
                    # 파일 저장
                    self.update_progress("파일 저장 중...", 95)
                    output_path = f"kdt_automated_complete_{start_date}_{end_date}.csv"
                    
                    # DataFrame 생성 및 저장
                    df = pd.DataFrame(data)
                    
                    # 컬럼 순서 정리 (현재 CSV와 동일하게)
                    column_order = [
                        '고유값', '과정명', '훈련과정 ID', '회차', '훈련기관', '총 훈련일수', '총 훈련시간',
                        '과정시작일', '과정종료일', 'NCS명', 'NCS코드', '훈련비', '정원', '수강신청 인원',
                        '수료인원', '수료율', '만족도', '취업인원 (3개월)', '취업률 (3개월)',
                        '취업인원 (6개월)', '취업률 (6개월)', '지역', '주소', '과정페이지 링크',
                        '선도기업', '파트너기관', '매출 최소', '실 매출 대비', '매출 최대',
                        '2021년', '2022년', '2023년', '2024년', '2025년', '2026년'
                    ]
                    
                    df = df.reindex(columns=column_order)
                    df.to_csv(output_path, index=False, encoding='utf-8-sig')
                    
                    self.root.after(0, lambda: messagebox.showinfo("완료!", 
                        f"""🎉 완전 자동화 데이터 수집 완료!
                        
📁 저장 위치: {output_path}
📊 총 {len(data)}개 과정 데이터 수집
🤖 모든 계산 자동 완료:
   • 선도기업/파트너기관 판단
   • 매출 최소/최대 계산  
   • 연도별 매출 분배
   • 수료율 기반 보정"""))
                    
                    self.update_progress("🎉 완전 자동화 수집 완료!", 100)
                    
                else:
                    self.root.after(0, lambda: messagebox.showerror("오류", "데이터 수집에 실패했습니다."))
                    
            except Exception as e:
                logging.error(f"자동화 수집 중 오류: {e}")
                self.root.after(0, lambda: messagebox.showerror("오류", 
                    f"자동화 수집 중 오류가 발생했습니다: {str(e)}"))
        
        # 별도 스레드에서 데이터 수집 실행
        thread = threading.Thread(target=collect_and_process, daemon=True)
        thread.start()

if __name__ == "__main__":
    app = AutomatedKDTDataCollectorGUI()
    app.root.mainloop()
