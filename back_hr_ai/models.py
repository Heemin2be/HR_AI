from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "Users"

    user_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=True) # Added for authentication
    name = Column(String(50), nullable=True)
    team_id = Column(Integer, nullable=True)
    role = Column(String(20), default="user", nullable=False)

    chat_rooms = relationship("ChatRoom", back_populates="user")

class ChatRoom(Base):
    __tablename__ = "ChatRooms"

    room_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("Users.user_id"), nullable=False)
    title = Column(String(200), default="새 대화")
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="chat_rooms")
    messages = relationship("Message", back_populates="chat_room", cascade="all, delete-orphan")
    report_context = relationship("ReportContext", uselist=False, back_populates="chat_room", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="chat_room", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "Messages"

    message_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("ChatRooms.room_id"), nullable=False)
    sender = Column(String(10), nullable=False) # 'user' or 'ai'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=func.now())

    chat_room = relationship("ChatRoom", back_populates="messages")


class Report(Base):
    __tablename__ = "Reports"

    report_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("ChatRooms.room_id"), nullable=False)
    summary_content = Column(Text, nullable=False) # Markdown summary
    created_at = Column(DateTime, default=func.now())

    chat_room = relationship("ChatRoom", back_populates="reports")


class ReportContext(Base):
    __tablename__ = "ReportContexts"

    context_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("ChatRooms.room_id"), unique=True, nullable=False)
    
    work_done = Column(Text, default="내용 없음")
    blockers = Column(Text, default="내용 없음")
    tomorrow_plan = Column(Text, default="내용 없음")
    condition = Column(Text, default="내용 없음")

    last_updated = Column(DateTime, default=func.now(), onupdate=func.now())

    chat_room = relationship("ChatRoom", back_populates="report_context")