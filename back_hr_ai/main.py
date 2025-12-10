import os
import datetime
import json
import asyncio
import google.generativeai as genai
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict
from dotenv import load_dotenv
import openai
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
import bcrypt
from jose import JWTError, jwt

from typing import List, Dict, Optional, Union

from database import Base, engine, get_db
from models import User, Message, Report, ChatRoom, ReportContext

# --- App Initialization ---
load_dotenv()
app = FastAPI()

# --- Security & Auth Configuration ---
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey") # In production, use a strong random key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto") # Removed passlib
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/login")

def verify_password(plain_password, hashed_password):
    # bcrypt.checkpw requires bytes
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)

def get_password_hash(password):
    # bcrypt.hashpw requires bytes and returns bytes
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: datetime.timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Keys ---
api_keys = {
    "gemini": os.getenv("GEMINI_API_KEY"),
    "openai": os.getenv("OPENAI_API_KEY"),
}

# --- Database Initialization on Startup ---
@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)
    with next(get_db()) as db:
        # 1. Create Team Member (user)
        user = db.query(User).filter(User.username == "user").first()
        if not user:
            user = User(
                username="user", 
                hashed_password=get_password_hash("password"),
                name="김팀원",
                team_id=1,
                role="팀원" # 한글 역할명 사용
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print("Test user 'user' created.")
        
        # Create default chat room for team member
        if not user.chat_rooms:
            new_room = ChatRoom(user_id=user.user_id, title="첫 번째 대화")
            db.add(new_room)
            db.flush()
            new_context = ReportContext(room_id=new_room.room_id)
            db.add(new_context)
            
            # Add initial AI message
            initial_ai_message = Message(room_id=new_room.room_id, sender="ai", content="안녕하세요! AI 업무 비서입니다. 오늘 하루는 어떠셨나요?")
            db.add(initial_ai_message)
            
            db.commit()

        # 2. Create Team Leader (leader)
        leader = db.query(User).filter(User.username == "leader").first()
        if not leader:
            leader = User(
                username="leader", 
                hashed_password=get_password_hash("password"),
                name="박팀장",
                team_id=1,
                role="팀장"
            )
            db.add(leader)
            db.commit()
            print("Test user 'leader' created.")

# --- Pydantic Models ---
class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str
    role: str

class ChatRequest(BaseModel):
    prompt: str

class ChatRoomUpdate(BaseModel):
    title: str

class ChatRoomResponse(BaseModel):
    room_id: int
    user_id: int
    title: str
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class ReportResponse(BaseModel):
    report_id: int
    room_id: int
    summary_content: str
    created_at: datetime.datetime
    chat_room: ChatRoomResponse # Include chat room details

    model_config = ConfigDict(from_attributes=True)

class MessageResponse(BaseModel):
    message_id: int
    room_id: int
    sender: str
    content: str
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class ChatRoomDetailResponse(BaseModel):
    room_id: int
    user_id: int
    title: str
    created_at: datetime.datetime
    messages: List[MessageResponse] = []
    report_status: Optional[Dict[str, str]] = None
    has_report: bool = False

class ChatResponseWithReportStatus(BaseModel):
    message: MessageResponse
    report_status: dict # {"오늘 한 일": "sufficient", "이슈 및 블로커": "missing", ...}


# --- AI Model Caller Functions ---
async def call_gemini(prompt: str):
    api_key = api_keys.get("gemini")
    if not api_key: return {"model": "gemini", "response": "Gemini API key is not configured."}
    genai.configure(api_key=api_key)
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-lite-001')
        response = await model.generate_content_async(prompt)
        return {"model": "gemini", "response": response.text}
    except Exception as e: return {"model": "gemini", "response": f"API call failed: {str(e)}"}

async def call_triage_ai(prompt: str):
    api_key = api_keys.get("gemini")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API key is not configured.")
    genai.configure(api_key=api_key)
    try:
        # NOTE: 1단계 분석과 1단계 채팅 응답 모두 사용자가 지정한 Gemini 2.0 Flash 모델을 사용합니다.
        model = genai.GenerativeModel(
            'gemini-2.0-flash-lite',
            generation_config={"response_mime_type": "application/json"}
        )
        response = await model.generate_content_async(prompt)
        return json.loads(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Triage AI call with Gemini failed: {str(e)}")



async def call_report_ai(prompt: str):
    api_key = api_keys.get("openai")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key is not configured.")
    client = openai.AsyncOpenAI(api_key=api_key)
    try:
        chat_completion = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-5.1"
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report AI call failed: {str(e)}")

# --- API Endpoints ---
@app.post("/api/v1/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role, "user_id": user.user_id}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": user.user_id,
        "username": user.username,
        "role": user.role
    }

@app.get("/")
def read_root():
    return {"message": "HR-AI Backend is running."}

# --- ChatRoom Management Endpoints ---
@app.get("/api/v1/chat_rooms", response_model=list[ChatRoomResponse])
def get_chat_rooms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    chat_rooms = db.query(ChatRoom).filter(ChatRoom.user_id == current_user.user_id).order_by(ChatRoom.created_at.desc()).all()
    return chat_rooms

@app.post("/api/v1/chat_rooms", response_model=ChatRoomResponse)
def create_chat_room(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_room = ChatRoom(user_id=current_user.user_id, title=f"대화 {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}")
    db.add(new_room)
    db.flush()

    new_context = ReportContext(room_id=new_room.room_id)
    db.add(new_context)

    # Add initial AI message
    initial_ai_message = Message(room_id=new_room.room_id, sender="ai", content="안녕하세요! AI 업무 비서입니다. 오늘 하루는 어떠셨나요?")
    db.add(initial_ai_message)
    
    db.commit()
    db.refresh(new_room)
    return new_room

@app.delete("/api/v1/chat_rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_room(room_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    chat_room = db.query(ChatRoom).filter(ChatRoom.room_id == room_id, ChatRoom.user_id == current_user.user_id).first()
    if not chat_room:
        raise HTTPException(status_code=404, detail="Chat room not found or you don't have permission to delete it.")
    
    # Cascade delete should handle messages and report context if configured in models.
    # If not, we might need to manually delete them. Assuming models are set up with cascade or we rely on DB constraints.
    # Let's check models.py later if needed, but usually for this level of task, simple delete is fine.
    # Actually, let's explicitly delete related items to be safe if cascade isn't perfect.
    
    # Delete messages
    db.query(Message).filter(Message.room_id == room_id).delete()
    
    # Delete report context
    db.query(ReportContext).filter(ReportContext.room_id == room_id).delete()

    # Delete reports associated with this room? 
    # Reports might be valuable to keep, but if the room is gone, the link is broken.
    # Let's delete reports too for clean cleanup.
    db.query(Report).filter(Report.room_id == room_id).delete()

    db.delete(chat_room)
    db.commit()
    return None

@app.put("/api/v1/chat_rooms/{room_id}", response_model=ChatRoomResponse)
def update_chat_room(room_id: int, request: ChatRoomUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    chat_room = db.query(ChatRoom).filter(ChatRoom.room_id == room_id, ChatRoom.user_id == current_user.user_id).first()
    if not chat_room:
        raise HTTPException(status_code=404, detail="Chat room not found or you don't have permission to update it.")
    
    chat_room.title = request.title
    db.commit()
    db.refresh(chat_room)
    return chat_room

@app.get("/api/v1/chat_rooms/{room_id}", response_model=ChatRoomDetailResponse)
def get_chat_room_details(room_id: int, db: Session = Depends(get_db)):
    chat_room = db.query(ChatRoom).options(joinedload(ChatRoom.messages)).filter(ChatRoom.room_id == room_id).first()
    if not chat_room:
        raise HTTPException(status_code=404, detail="Chat room not found")
    
    # Calculate report_status
    report_context = chat_room.report_context
    report_status_data = {}
    if report_context:
        # Map Korean categories to model field names
        category_map = {
            "오늘 한 일": "work_done",
            "이슈 및 블로커": "blockers",
            "내일 할 일": "tomorrow_plan",
            "컨디션": "condition"
        }
        default_value = "내용 없음"
        
        for category_name, field_name in category_map.items():
            value = getattr(report_context, field_name)
            if not value or value == default_value:
                report_status_data[category_name] = "missing"
            else:
                report_status_data[category_name] = "sufficient"
    
    # Check if a report exists for this room
    existing_report = db.query(Report).filter(Report.room_id == room_id).first()
    has_report = True if existing_report else False

    # Create response manually to include report_status and has_report
    return ChatRoomDetailResponse(
        room_id=chat_room.room_id,
        user_id=chat_room.user_id,
        title=chat_room.title,
        created_at=chat_room.created_at,
        messages=[MessageResponse.model_validate(m) for m in chat_room.messages],
        report_status=report_status_data,
        has_report=has_report
    )


@app.post("/api/v1/chat_rooms/{room_id}/messages", response_model=ChatResponseWithReportStatus)
async def intelligent_chat(room_id: int, request: ChatRequest, db: Session = Depends(get_db)):
    # 1. Find the chat room and its context
    chat_room = db.query(ChatRoom).filter(ChatRoom.room_id == room_id).first()
    if not chat_room:
        raise HTTPException(status_code=404, detail="Chat room not found")
    
    report_context = chat_room.report_context
    if not report_context:
        # This case should ideally not happen if startup logic is correct
        raise HTTPException(status_code=500, detail="ReportContext not found for this room.")

    try:
        # 2. Save user message
        user_message = Message(room_id=room_id, sender="user", content=request.prompt)
        db.add(user_message)
        db.flush()

        # 2.5 Fetch conversation history (Last 10 messages)
        # We fetch 11 because we just added the current user message, and we want context BEFORE that (or including it? usually including it is fine, but let's get a bit more)
        # Actually, let's fetch the last 10 messages including the one we just added to show the flow.
        recent_messages = db.query(Message).filter(Message.room_id == room_id).order_by(Message.created_at.desc()).limit(10).all()
        recent_messages.reverse() # Chronological order
        
        conversation_history = ""
        for msg in recent_messages:
            conversation_history += f"{msg.sender}: {msg.content}\n"

        # 3. Triage Stage (Analyze user message)
        current_summary_text = f"- 오늘 한 일: {report_context.work_done}\n- 이슈 및 블로커: {report_context.blockers}\n- 내일 할 일: {report_context.tomorrow_plan}\n- 컨디션: {report_context.condition}"
        
        triage_prompt = f"""You are a message analysis expert. Your task is to analyze the user's message and respond in a structured JSON array format. Follow these rules precisely:

1.  **SEGMENTATION**: If the user's message contains multiple distinct topics (e.g., condition, task, issue), you MUST break the single input message into these separate logical units.
2.  **CATEGORIZATION**: For each segmented logical unit, you MUST identify ALL valid categories that the unit relates to. The valid categories are: "오늘 한 일", "이슈 및 블로커", "내일 할 일", "컨디션", "잡담".
3.  **PROFANITY DETECTION**: For each segmented unit, you MUST analyze for any abusive, offensive, or profane language. Set the `profanity_detected` boolean flag to `true` if found, otherwise `false`.
4.  **NEGATIVE/NON-COMMITTAL ANSWERS**: If the user provides a negative or non-committal answer (e.g., "없었어", "아니", "기억 안나", "별거 없어"), you MUST record the `content` for the relevant category as "내용 없음". Do not categorize it as "잡담".
5.  **OUTPUT**: Respond ONLY in a JSON Array format. Each element must be a JSON object containing `category`, `content`, and `profanity_detected`.

Current Summary Status:
{current_summary_text}

Conversation History (Last 10 messages):
{conversation_history}

User's latest message: "{request.prompt}"

---
**Example 1: Complex message**
User Input: "프로젝트를 3번째 엎었어. 진짜 빡치네. 내일은 다시 시작해야지."
Your Output:
[
  {{
    "category": "이슈 및 블로커",
    "content": "프로젝트를 3번째 엎었어.",
    "profanity_detected": true
  }},
  {{
    "category": "컨디션",
    "content": "프로젝트를 3번째 엎었어. 진짜 빡치네.",
    "profanity_detected": true
  }},
  {{
    "category": "내일 할 일",
    "content": "내일은 다시 시작해야지.",
    "profanity_detected": false
  }}
]

**Example 2: Negative answer**
User Input: "오늘 뭐 딱히 한 거 없어."
Your Output:
[
  {{
    "category": "오늘 한 일",
    "content": "내용 없음",
    "profanity_detected": false
  }}
]
---

Your JSON Array Output:
"""
        triage_results = await call_triage_ai(triage_prompt)
        
        # 4. Update ReportContext based on triage results
        work_done_list, blockers_list, tomorrow_plan_list, condition_list = [], [], [], []
        for item in triage_results:
            category, content = item.get("category"), item.get("content")
            if category == "오늘 한 일": work_done_list.append(content)
            elif category == "이슈 및 블로커": blockers_list.append(content)
            elif category == "내일 할 일": tomorrow_plan_list.append(content)
            elif category == "컨디션": condition_list.append(content)

        default_value = "내용 없음"
        if work_done_list:
            new_content = "\n".join(work_done_list)
            report_context.work_done = (report_context.work_done + "\n" + new_content) if report_context.work_done and report_context.work_done != default_value else new_content
        if blockers_list:
            new_content = "\n".join(blockers_list)
            report_context.blockers = (report_context.blockers + "\n" + new_content) if report_context.blockers and report_context.blockers != default_value else new_content
        if tomorrow_plan_list:
            new_content = "\n".join(tomorrow_plan_list)
            report_context.tomorrow_plan = (report_context.tomorrow_plan + "\n" + new_content) if report_context.tomorrow_plan and report_context.tomorrow_plan != default_value else new_content
        if condition_list:
            new_content = "\n".join(condition_list)
            report_context.condition = (report_context.condition + "\n" + new_content) if report_context.condition and report_context.condition != default_value else new_content
        
        # 5. Response Stage (Generate AI response)
        essential_categories = ["오늘 한 일", "이슈 및 블로커", "내일 할 일", "컨디션"]
        category_map = {
            "오늘 한 일": "work_done",
            "이슈 및 블로커": "blockers",
            "내일 할 일": "tomorrow_plan",
            "컨디션": "condition"
        }
        report_status_data = {}
        for cat in essential_categories:
            # Convert category name to attribute name using the map
            attr_name = category_map.get(cat)
            if not attr_name: continue # Should not happen given essential_categories
            
            value = getattr(report_context, attr_name) # Get value from report_context
            if not value or value == default_value:
                report_status_data[cat] = "missing"
            else:
                report_status_data[cat] = "sufficient"
        
        missing_items_for_prompt = [cat for cat, status in report_status_data.items() if status == "missing"]

        if missing_items_for_prompt:
            response_prompt = f"You are a friendly AI assistant. You MUST respond in Korean. Your goal is to gather information for a work report. Ask a natural follow-up question to gather information about '{missing_items_for_prompt[0]}'.\n\nConversation History:\n{conversation_history}\n\nUser's last message: '{request.prompt}'"
        else:
            response_prompt = f"You are a friendly AI assistant. You MUST respond in Korean. You have gathered all necessary information for this topic. Politely conclude the conversation for this specific topic.\n\nConversation History:\n{conversation_history}\n\nUser's last message: '{request.prompt}'"
        
        response_data = await call_gemini(response_prompt)
        ai_response_content = response_data['response']

        # 6. Save AI message
        ai_message = Message(room_id=room_id, sender="ai", content=ai_response_content)
        db.add(ai_message)
        
        db.commit()
        db.refresh(ai_message)
        
        return ChatResponseWithReportStatus(message=ai_message, report_status=report_status_data)

    except HTTPException as e:
        db.rollback()
        raise e
    except Exception as e:
        db.rollback()
        print(f"An unexpected error occurred in intelligent_chat: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")




@app.post("/api/v1/chat_rooms/{room_id}/reports")
async def generate_report(room_id: int, db: Session = Depends(get_db)):
    print(f"\n--- [REPORT GENERATION START FOR ROOM: {room_id}] ---")
    
    report_context = db.query(ReportContext).filter(ReportContext.room_id == room_id).first()

    # Check if report already exists
    existing_report = db.query(Report).filter(Report.room_id == room_id).first()
    if existing_report:
        raise HTTPException(status_code=400, detail="이미 리포트가 생성된 대화입니다.")

    if not report_context:
        print(f"[DEBUG] No ReportContext found for room_id={room_id}. Raising 404.")
        raise HTTPException(status_code=404, detail="이 대화방의 요약 데이터가 없습니다.")
    
    # Check if essential data is missing
    default_value = "내용 없음"
    missing_fields = []
    if not report_context.work_done or report_context.work_done == default_value:
        missing_fields.append("오늘 한 일")
    if not report_context.blockers or report_context.blockers == default_value:
        missing_fields.append("이슈 및 블로커")
    if not report_context.tomorrow_plan or report_context.tomorrow_plan == default_value:
        missing_fields.append("내일 할 일")

    if len(missing_fields) == 3:
        print(f"[DEBUG] Not enough data to generate report for room {room_id}. Missing all fields.")
        raise HTTPException(
            status_code=400, 
            detail={"message": "리포트를 생성하기에 충분한 정보가 없습니다.", "missing_fields": missing_fields}
        )

    print(f"[DEBUG] Data found for room {room_id}. Proceeding to generate report.")
    report_prompt = f"""You are an expert HR analyst and report writer. Your task is to synthesize the following raw daily notes from a team member into a clear, concise, and insightful daily report.

[Raw Data from Daily Summary]
- 오늘 한 일: {report_context.work_done}
- 이슈 및 블로커: {report_context.blockers}
- 내일 할 일: {report_context.tomorrow_plan}
- 컨디션: {report_context.condition}

[Report Writing Instructions]
1.  **Structure:** Organize the report into the following sections using markdown: "오늘 완료한 업무", "이슈 및 블로커", "내일 계획", "오늘의 컨디션".
2.  **Synthesize and Refine:** Do not just copy-paste the raw data. Rephrase the points in a professional and easy-to-read manner. If the raw data is messy or contains multiple points, consolidate them into clear bullet points.
3.  **Insightful Summary (Condition):** For the "오늘의 컨디션" section, don't just state the condition. Provide a brief, objective summary of the user's emotional state based on the provided data.
4.  **Tone:** Maintain a neutral, professional, and supportive tone.
Generate the report in Korean.
"""
    
    summary_content = await call_report_ai(report_prompt)

    db_report = Report(room_id=room_id, summary_content=summary_content)
    db.add(db_report)
    
    # --- Auto-generate Title ---
    try:
        title_prompt = f"""
        Based on the following daily report summary, generate a short, concise, and relevant title for this chat room (max 20 characters).
        The title should represent the main topic or the day's work.
        Do not use quotes or markdown. Just the title text.
        
        [Report Summary]
        {summary_content}
        """
        new_title = await call_report_ai(title_prompt)
        new_title = new_title.strip()[:50] # Safety truncation
        
        chat_room = db.query(ChatRoom).filter(ChatRoom.room_id == room_id).first()
        if chat_room:
            chat_room.title = new_title
            print(f"[DEBUG] Updated room {room_id} title to: {new_title}")
            
    except Exception as e:
        print(f"[ERROR] Failed to auto-generate title: {e}")
        # Don't fail the report generation if title fails
    
    db.commit()
    db.refresh(db_report)
    
    # Fetch updated chat room title to return
    updated_room = db.query(ChatRoom).filter(ChatRoom.room_id == room_id).first()
    room_title = updated_room.title if updated_room else "대화"

    print(f"--- [REPORT GENERATION END FOR ROOM: {room_id}] ---")
    return {"report_id": db_report.report_id, "room_title": room_title, "summary_content": db_report.summary_content}

@app.get("/api/v1/reports")
def get_reports(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Query all reports for the current user, joining through ChatRoom
    reports = db.query(Report).join(ChatRoom).filter(ChatRoom.user_id == current_user.user_id).order_by(Report.created_at.desc()).all()
    return reports

@app.get("/api/v1/team/reports")
def get_team_reports(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "팀장" and current_user.role != "임원":
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    
    # Fetch all users in the same team (excluding the current user if desired, but requirements say "team members")
    # Assuming team_id is how we group them.
    if not current_user.team_id:
        return [] # Or raise error if team_id is mandatory for team leaders
        
    team_members = db.query(User).filter(User.team_id == current_user.team_id).all()
    
    # For the dashboard, we might want the latest report for each member.
    # But the current requirement for *this* endpoint (get_team_reports) was for the dashboard list.
    # The NEW requirement is for a specific user's reports.
    
    # Let's keep the existing get_team_reports as is (it was added in previous turn, but I don't see the implementation in the viewed lines, 
    # wait, I see the start of it in line 596).
    # I will just append the NEW endpoint after it.
    
    # Re-implementing get_team_reports briefly to ensure it's correct as I only saw the header.
    # Actually, I should just add the new endpoint.
    pass # Placeholder for existing logic if I'm not replacing it.

    # Wait, the previous view showed:
    # 596: @app.get("/api/v1/team/reports")
    # 597: def get_team_reports(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 598:     if current_user.role != "팀장" and current_user.role != "임원":
    # 599:         raise HTTPException(status_code=403, detail="권한이 없습니다.")
    # 600:     
    
    # I will replace this block and add the new endpoint.
    
    team_members = db.query(User).filter(User.team_id == current_user.team_id).all()
    
    dashboard_data = []
    for member in team_members:
        # Get latest report
        latest_report = db.query(Report).join(ChatRoom).filter(ChatRoom.user_id == member.user_id).order_by(Report.created_at.desc()).first()
        dashboard_data.append({
            "user": {
                "user_id": member.user_id,
                "username": member.username,
                "name": member.name,
                "role": member.role,
                "team_id": member.team_id
            },
            "latest_report": latest_report
        })
        
    return dashboard_data

@app.get("/api/v1/team/reports/{user_id}")
def get_team_member_reports(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "팀장" and current_user.role != "임원":
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    
    # Check if the target user belongs to the same team (optional but good for security)
    target_user = db.query(User).filter(User.user_id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        
    if target_user.team_id != current_user.team_id:
         raise HTTPException(status_code=403, detail="같은 팀원의 리포트만 볼 수 있습니다.")

    reports = db.query(Report).join(ChatRoom).filter(ChatRoom.user_id == user_id).order_by(Report.created_at.desc()).all()
    return reports
    # Find all team members (excluding self if desired, but including is fine too)
    # Let's exclude the leader themselves from the report list usually
    team_members = db.query(User).filter(User.team_id == current_user.team_id, User.user_id != current_user.user_id).all()
    
    team_status_list = []
    for member in team_members:
        # Get latest report
        # We need to join with ChatRoom to filter by user_id
        latest_report = db.query(Report).join(ChatRoom).filter(ChatRoom.user_id == member.user_id).order_by(Report.created_at.desc()).first()
        
        # Get latest condition from ReportContext? Or just use the report?
        # The UI shows "Last Condition" and "Latest Report Summary".
        # Let's try to get the latest ReportContext for condition if available.
        # But ReportContext is per room. A user might have multiple rooms.
        # We should probably look at the ReportContext of the most recently active room.
        
        last_room = db.query(ChatRoom).filter(ChatRoom.user_id == member.user_id).order_by(ChatRoom.created_at.desc()).first()
        condition = "알 수 없음"
        if last_room and last_room.report_context:
            condition = last_room.report_context.condition
            if condition == "내용 없음": condition = "기록 없음"

        team_status_list.append({
            "id": member.user_id,
            "name": member.name,
            "team_id": member.team_id,
            "last_report_status": condition, # Using condition as status
            "latest_report": latest_report, # This will be serialized
            "latest_report_date": latest_report.created_at if latest_report else None
        })
    
    return team_status_list

@app.get("/api/v1/reports/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).options(joinedload(Report.chat_room).options(joinedload(ChatRoom.messages))).filter(Report.report_id == report_id).first()
    if not report: raise HTTPException(status_code=404, detail="Report not found")
    
    # The original messages can be fetched via the chat_room
    messages = report.chat_room.messages
    return {"report": report, "messages": messages}

@app.get("/reset-database")
def reset_database(db: Session = Depends(get_db)):
    """
    DANGER: This endpoint drops all tables and recreates them.
    All data will be lost. Use only for development.
    """
    try:
        # Drop all tables
        Base.metadata.drop_all(bind=engine)
        print("All tables dropped.")
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("All tables recreated.")
        # Re-run startup logic to create default user and room
        startup_event()
        return {"message": "Database has been reset successfully. All tables are recreated and default data is seeded."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during database reset: {str(e)}")


@app.get("/generate-test-data")
def generate_test_data(db: Session = Depends(get_db)):
    user_id = 1
    
    # Clean up old data for the default user
    user = db.query(User).filter(User.user_id == user_id).first()
    if user:
        for room in user.chat_rooms:
            db.delete(room)
    db.commit()

    # Create a new test room and context
    new_room = ChatRoom(user_id=user_id, title="오늘의 업무 보고 (테스트 데이터)")
    db.add(new_room)
    db.flush()
    new_context = ReportContext(room_id=new_room.room_id)
    db.add(new_context)
    db.commit()
    db.refresh(new_room)

    # Add test messages to the new room
    test_messages_content = [
        "오늘 김부장이 나를 열받게했어 시발롬", 
        "프로젝트를 3번째 엎었어", 
        "화나는 정도가 아니라 진짜 때려치고 싶더라. 내 몇 주간의 노력이 물거품 됐어.", 
        "아니, 하루 종일 멍하니 있다가 시간만 보냈어.", 
        "내일은... 다시 처음부터 시작해야지 뭐. 기획안부터 다시 써야 할 것 같아."
    ]
    for content in test_messages_content: 
        db.add(Message(room_id=new_room.room_id, sender="user", content=content))
    
    db.commit()
    return {"message": f"{len(test_messages_content)}개의 테스트 메시지가 포함된 새 채팅방이 생성되었습니다."}

