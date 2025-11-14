import json
from typing import Dict
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import select
from sqlmodel import Session
from fastapi import Query


from database import init_db, engine
from models import User, Conversation, Message
from auth import get_password_hash, verify_password, create_access_token, decode_token

# Initialize DB (creates tables if not present)
init_db()

app = FastAPI(title="Chat App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# in-memory active connections: user_id -> websocket
active_connections: Dict[int, WebSocket] = {}

@app.post("/register")
async def register(payload: dict):
    username = payload.get("username")
    password = payload.get("password")
    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password required")
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.username == username)).first()
        if existing:
            raise HTTPException(status_code=400, detail="username exists")
        user = User(username=username, hashed_password=get_password_hash(password))
        session.add(user)
        session.commit()
        session.refresh(user)
        return {"id": user.id, "username": user.username}

@app.post("/login")
async def login(payload: dict):
    username = payload.get("username")
    password = payload.get("password")
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_access_token({"sub": str(user.id)})
        return {"access_token": token, "user": {"id": user.id, "username": user.username}}

@app.get("/conversations/{user_id}")
async def get_conversations(user_id: int):
    with Session(engine) as session:
        convs = session.exec(
            select(Conversation).where((Conversation.user_a == user_id) | (Conversation.user_b == user_id))
        ).all()
        return convs

@app.get("/messages/{conversation_id}")
async def get_messages(conversation_id: int):
    with Session(engine) as session:
        msgs = session.exec(select(Message).where(Message.conversation_id == conversation_id).order_by(Message.timestamp)).all()
        return msgs

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    await websocket.accept()
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=1008)
        return
    user_id = int(payload.get("sub"))
    active_connections[user_id] = websocket
    try:
        while True:
            data = await websocket.receive_text()
            obj = json.loads(data)
            to = obj.get("to")
            content = obj.get("content")
            conv_id = obj.get("conversation_id")
            with Session(engine) as session:
                if conv_id is None:
                    conv = Conversation(user_a=user_id, user_b=to)
                    session.add(conv)
                    session.commit()
                    session.refresh(conv)
                    conv_id = conv.id
                msg = Message(conversation_id=conv_id, sender_id=user_id, content=content)
                session.add(msg)
                session.commit()
                session.refresh(msg)
            payload_out = {
                "conversation_id": conv_id,
                "sender_id": user_id,
                "content": content,
                "timestamp": str(msg.timestamp),
            }
            ws = active_connections.get(to)
            if ws:
                await ws.send_text(json.dumps(payload_out))
    except Exception:
        if user_id in active_connections:
            del active_connections[user_id]

@app.get("/search-users")
async def search_users(q: str = Query("")):
    with Session(engine) as session:
        users = session.exec(
            select(User).where(User.username.contains(q))
        ).all()
        return [{"id": u.id, "username": u.username} for u in users]