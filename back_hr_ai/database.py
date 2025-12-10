from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise Exception("DATABASE_URL environment variable not set.")

# MySQL 데이터베이스 연결을 위한 설정
# create_engine 함수의 pool_pre_ping=True 옵션은 데이터베이스 연결이 유효한지 확인
# pool_recycle은 지정된 시간이 경과하면 연결 풀의 연결을 재생
engine = create_engine(
    DATABASE_URL, pool_pre_ping=True, pool_recycle=3600
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
