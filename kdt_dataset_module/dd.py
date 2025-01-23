import mysql.connector
from dotenv import load_dotenv
import os
from urllib.parse import urlparse, unquote  # unquote 추가

# .env 파일 로드
load_dotenv()

# DB_URL 환경 변수 가져오기
db_url = os.getenv('DB_URL')

# DB_URL 파싱
parsed_url = urlparse(db_url)

# 데이터베이스 연결 인자 추출
username = parsed_url.username
password = parsed_url.password
password = unquote(password)  # 👈  password 를 URL 디코딩
host = parsed_url.hostname
port = parsed_url.port
database = parsed_url.path.lstrip('/')

print("Username:", username)
print("Password:", password) # 👈  디코딩된 비밀번호 확인
print("Host:", host)
print("Port:", port)
print("Database:", database)


# MySQL 연결
try:
    connection = mysql.connector.connect(
        user=username,
        password=password,
        host=host,
        port=port,
        database=database
    )
    print("MySQL에 연결되었습니다.")
except mysql.connector.Error as err:
    print(f"Error: {err}")

# DB_TYPE=mysql          <--- 삭제 또는 주석 처리
# DB_URL=mysql://...     <--- 삭제 또는 주석 처리
# TABLE_NAME=kdt_dataset_202412  <--- 삭제 또는 주석 처리