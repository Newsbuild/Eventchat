from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

# ---------- Config ----------
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@event.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
SEED_DEMO = os.environ.get("SEED_DEMO", "true").lower() == "true"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

APP_STARTED_AT = datetime.now(timezone.utc)

app = FastAPI(title="Lokaler Event-Chat")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=60*60*12, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax", max_age=60*60*24*7, path="/")


def sanitize_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u["name"],
        "role": u["role"],
        "is_customer": u.get("is_customer", False),
        "custom_roles": u.get("custom_roles", []),
        "avatar_upload_id": u.get("avatar_upload_id"),
        "created_at": u.get("created_at"),
        "last_seen": u.get("last_seen"),
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Nicht authentifiziert")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Ungültiger Token-Typ")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Nutzer nicht gefunden")
        # update last_seen
        await db.users.update_one({"id": user["id"]}, {"$set": {"last_seen": now_iso()}})
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ungültiger Token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur für Admins")
    return user


# ---------- Models ----------
class LoginIn(BaseModel):
    email: str
    password: str


class UserCreateIn(BaseModel):
    email: str
    password: str
    name: str
    role: str = "user"  # user | admin
    is_customer: bool = False


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_customer: Optional[bool] = None
    password: Optional[str] = None
    custom_roles: Optional[List[str]] = None


class CustomRoleIn(BaseModel):
    name: str
    color: Optional[str] = None
    description: Optional[str] = None


class CreateDirectIn(BaseModel):
    user_id: str


class CreateGroupIn(BaseModel):
    name: str
    member_ids: List[str] = []


class AddMembersIn(BaseModel):
    user_ids: List[str]


class RenameGroupIn(BaseModel):
    name: str


class SetGroupAdminIn(BaseModel):
    user_id: str
    is_admin: bool


class SendMessageIn(BaseModel):
    text: Optional[str] = None
    upload_id: Optional[str] = None


class ReportIn(BaseModel):
    reason: str


class AdminCreateGroupIn(BaseModel):
    name: str
    member_ids: List[str]
    admin_ids: List[str] = []


class AdminEditGroupIn(BaseModel):
    name: Optional[str] = None
    member_ids: Optional[List[str]] = None
    admin_ids: Optional[List[str]] = None


class InviteCreateIn(BaseModel):
    role: str = "user"  # user | admin
    is_customer: bool = False
    expires_at: Optional[str] = None  # ISO datetime string
    note: Optional[str] = None


class RegisterIn(BaseModel):
    code: str
    email: str
    name: str
    password: str


# ---------- Auth ----------
@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Ungültige Zugangsdaten")
    access = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_seen": now_iso()}})
    return sanitize_user(user)


@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return sanitize_user(user)


# ---------- Registration via Invite Code (public) ----------
def _generate_invite_code() -> str:
    import secrets, string
    alphabet = string.ascii_uppercase + string.digits
    parts = ["".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(2)]
    return "EVT-" + "-".join(parts)


async def _validate_invite(code: str) -> dict:
    code = (code or "").strip().upper()
    if not code:
        raise HTTPException(400, "Kein Einladungscode angegeben")
    inv = await db.invite_codes.find_one({"code": code}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Einladungscode ungültig")
    if inv.get("used"):
        raise HTTPException(400, "Einladungscode wurde bereits eingelöst")
    if inv.get("expires_at"):
        try:
            exp = datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                raise HTTPException(400, "Einladungscode ist abgelaufen")
        except HTTPException:
            raise
        except Exception:
            pass
    return inv


@api.get("/auth/invite/{code}")
async def check_invite(code: str):
    inv = await _validate_invite(code)
    return {
        "code": inv["code"],
        "role": inv["role"],
        "is_customer": inv.get("is_customer", False),
        "expires_at": inv.get("expires_at"),
        "note": inv.get("note"),
    }


@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    inv = await _validate_invite(data.code)
    email = data.email.strip().lower()
    if not email or not data.name.strip() or not data.password:
        raise HTTPException(400, "E-Mail, Name und Passwort erforderlich")
    if len(data.password) < 6:
        raise HTTPException(400, "Passwort muss mindestens 6 Zeichen haben")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "E-Mail bereits registriert")

    uid = str(uuid.uuid4())
    user_doc = {
        "id": uid, "email": email, "name": data.name.strip(),
        "role": inv.get("role", "user"),
        "is_customer": inv.get("is_customer", False),
        "password_hash": hash_password(data.password),
        "created_at": now_iso(), "last_seen": now_iso(),
        "registered_via_invite": inv["code"],
    }
    await db.users.insert_one(user_doc)
    await db.invite_codes.update_one(
        {"code": inv["code"]},
        {"$set": {"used": True, "used_by": uid, "used_at": now_iso()}},
    )
    await db.moderation_log.insert_one({
        "id": str(uuid.uuid4()), "action": "invite_redeemed",
        "target_id": uid, "actor_id": uid,
        "note": f"code={inv['code']}", "created_at": now_iso(),
    })
    access = create_access_token(uid, email, user_doc["role"])
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return sanitize_user(user_doc)


# ---------- Users ----------
@api.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@api.get("/users/{user_id}")
async def get_user(user_id: str, user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    return u


@api.post("/users")
async def create_user(data: UserCreateIn, admin: dict = Depends(require_admin)):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email existiert bereits")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": email, "name": data.name, "role": data.role,
        "is_customer": data.is_customer, "password_hash": hash_password(data.password),
        "created_at": now_iso(), "last_seen": None,
    }
    await db.users.insert_one(doc)
    return sanitize_user(doc)


@api.patch("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdateIn, admin: dict = Depends(require_admin)):
    upd = {}
    if data.name is not None: upd["name"] = data.name
    if data.role is not None: upd["role"] = data.role
    if data.is_customer is not None: upd["is_customer"] = data.is_customer
    if data.password: upd["password_hash"] = hash_password(data.password)
    if data.custom_roles is not None:
        # only allow assigning roles that exist
        existing = await db.custom_roles.find({}, {"_id": 0, "name": 1}).to_list(1000)
        allowed = {r["name"] for r in existing}
        upd["custom_roles"] = [r for r in data.custom_roles if r in allowed]
    if not upd:
        return {"ok": True}
    await db.users.update_one({"id": user_id}, {"$set": upd})
    return {"ok": True}


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(400, "Eigener Account nicht löschbar")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}


@api.patch("/me/profile")
async def update_my_profile(data: UserUpdateIn, user: dict = Depends(get_current_user)):
    upd = {}
    if data.name is not None: upd["name"] = data.name
    if data.password: upd["password_hash"] = hash_password(data.password)
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return u


@api.post("/me/avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Nur Bilder erlaubt")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "Maximal 5 MB")
    uid = str(uuid.uuid4())
    ext = Path(file.filename or "avatar.jpg").suffix or ".jpg"
    stored = f"avatar-{uid}{ext}"
    (UPLOAD_DIR / stored).write_bytes(content)
    doc = {
        "id": uid, "filename": file.filename or "avatar",
        "stored_name": stored, "content_type": file.content_type,
        "size": len(content), "uploaded_by": user["id"],
        "chat_id": None, "is_avatar": True,
        "created_at": now_iso(), "deleted": False,
    }
    await db.uploads.insert_one(doc)
    await db.users.update_one({"id": user["id"]}, {"$set": {"avatar_upload_id": uid}})
    return {"upload_id": uid}


@api.delete("/me/avatar")
async def delete_avatar(user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$unset": {"avatar_upload_id": ""}})
    return {"ok": True}


# Public avatar image (any authenticated user can view any avatar)
@api.get("/avatars/{upload_id}")
async def get_avatar(upload_id: str, user: dict = Depends(get_current_user)):
    up = await db.uploads.find_one({"id": upload_id, "is_avatar": True, "deleted": {"$ne": True}}, {"_id": 0})
    if not up:
        raise HTTPException(404, "Avatar nicht gefunden")
    path = UPLOAD_DIR / up["stored_name"]
    if not path.exists():
        raise HTTPException(404, "Datei fehlt")
    return FileResponse(path, media_type=up.get("content_type") or "image/jpeg")


# ---------- Chats ----------
async def enrich_chat(chat: dict, user_id: str) -> dict:
    # add display name for direct chats, unread placeholders, last message meta
    c = {k: v for k, v in chat.items() if k != "_id"}
    if c["type"] == "direct":
        other_id = next((m for m in c["member_ids"] if m != user_id), None)
        if other_id:
            other = await db.users.find_one({"id": other_id}, {"_id": 0, "password_hash": 0})
            c["display_name"] = other["name"] if other else "Unbekannt"
            c["other_user_id"] = other_id
            c["other_user_avatar"] = other.get("avatar_upload_id") if other else None
    else:
        c["display_name"] = c.get("name", "Gruppe")
    last = await db.messages.find_one(
        {"chat_id": c["id"], "deleted": {"$ne": True}},
        sort=[("created_at", -1)], projection={"_id": 0}
    )
    if last and last.get("sender_id"):
        sender = await db.users.find_one({"id": last["sender_id"]}, {"_id": 0, "name": 1})
        last["sender_name"] = sender["name"] if sender else None
    c["last_message"] = last
    c["message_count"] = await db.messages.count_documents({"chat_id": c["id"]})

    # unread count: messages newer than last_read, not from current user, not deleted
    read_doc = await db.chat_reads.find_one(
        {"user_id": user_id, "chat_id": c["id"]}, {"_id": 0}
    )
    last_read_at = read_doc["last_read_at"] if read_doc else "1970-01-01T00:00:00+00:00"
    c["unread_count"] = await db.messages.count_documents({
        "chat_id": c["id"],
        "created_at": {"$gt": last_read_at},
        "sender_id": {"$ne": user_id},
        "deleted": {"$ne": True},
        "type": {"$ne": "system"},
    })
    c["last_read_at"] = last_read_at
    return c


@api.get("/chats")
async def list_my_chats(user: dict = Depends(get_current_user)):
    hidden = await db.hidden_chats.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    hidden_ids = {h["chat_id"] for h in hidden}
    chats = await db.chats.find(
        {"member_ids": user["id"], "archived": {"$ne": True}}, {"_id": 0}
    ).to_list(1000)
    chats = [c for c in chats if c["id"] not in hidden_ids]
    result = [await enrich_chat(c, user["id"]) for c in chats]
    result.sort(key=lambda c: (c.get("last_message") or {}).get("created_at", c["created_at"]), reverse=True)
    return result


@api.post("/chats/direct")
async def create_direct(data: CreateDirectIn, user: dict = Depends(get_current_user)):
    if data.user_id == user["id"]:
        raise HTTPException(400, "Kein Chat mit sich selbst")
    other = await db.users.find_one({"id": data.user_id}, {"_id": 0})
    if not other:
        raise HTTPException(404, "Nutzer nicht gefunden")
    existing = await db.chats.find_one({
        "type": "direct",
        "member_ids": {"$all": [user["id"], data.user_id], "$size": 2}
    }, {"_id": 0})
    if existing:
        # unhide if hidden
        await db.hidden_chats.delete_one({"user_id": user["id"], "chat_id": existing["id"]})
        return await enrich_chat(existing, user["id"])
    chat = {
        "id": str(uuid.uuid4()), "type": "direct",
        "member_ids": [user["id"], data.user_id],
        "admin_ids": [], "name": None,
        "created_at": now_iso(), "created_by": user["id"],
    }
    await db.chats.insert_one(chat)
    return await enrich_chat(chat, user["id"])


@api.post("/chats/group")
async def create_group(data: CreateGroupIn, user: dict = Depends(get_current_user)):
    members = list({*data.member_ids, user["id"]})
    chat = {
        "id": str(uuid.uuid4()), "type": "group", "name": data.name,
        "member_ids": members, "admin_ids": [user["id"]],
        "created_at": now_iso(), "created_by": user["id"],
    }
    await db.chats.insert_one(chat)
    # System message
    await db.messages.insert_one({
        "id": str(uuid.uuid4()), "chat_id": chat["id"], "sender_id": None,
        "text": f"Gruppe '{data.name}' erstellt", "type": "system",
        "upload_id": None, "deleted": False, "created_at": now_iso(),
    })
    return await enrich_chat(chat, user["id"])


@api.post("/chats/{chat_id}/hide")
async def hide_chat(chat_id: str, user: dict = Depends(get_current_user)):
    await db.hidden_chats.update_one(
        {"user_id": user["id"], "chat_id": chat_id},
        {"$set": {"user_id": user["id"], "chat_id": chat_id, "hidden_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


@api.post("/chats/{chat_id}/read")
async def mark_chat_read(chat_id: str, user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat or user["id"] not in chat["member_ids"]:
        raise HTTPException(404, "Chat nicht gefunden")
    ts = now_iso()
    await db.chat_reads.update_one(
        {"user_id": user["id"], "chat_id": chat_id},
        {"$set": {"user_id": user["id"], "chat_id": chat_id, "last_read_at": ts}},
        upsert=True,
    )
    return {"ok": True, "last_read_at": ts}


@api.get("/chats/{chat_id}")
async def get_chat(chat_id: str, user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat or user["id"] not in chat["member_ids"]:
        raise HTTPException(404, "Chat nicht gefunden")
    enriched = await enrich_chat(chat, user["id"])
    # attach members
    members = await db.users.find({"id": {"$in": chat["member_ids"]}}, {"_id": 0, "password_hash": 0}).to_list(1000)
    enriched["members"] = members
    return enriched


# ---------- Messages ----------
@api.get("/chats/{chat_id}/messages")
async def list_messages(chat_id: str, limit: int = 50, before: Optional[str] = None,
                        user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat or user["id"] not in chat["member_ids"] or chat.get("archived"):
        raise HTTPException(404, "Chat nicht gefunden")
    q = {"chat_id": chat_id}
    if before:
        q["created_at"] = {"$lt": before}
    msgs = await db.messages.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    msgs.reverse()

    # Compute read receipts: for each message, count members (excluding sender)
    # whose last_read_at >= message.created_at
    other_member_ids = [m for m in chat["member_ids"]]
    reads = await db.chat_reads.find(
        {"chat_id": chat_id, "user_id": {"$in": other_member_ids}},
        {"_id": 0, "user_id": 1, "last_read_at": 1},
    ).to_list(1000)
    reads_map = {r["user_id"]: r["last_read_at"] for r in reads}
    total_recipients = max(len(chat["member_ids"]) - 1, 0)  # excluding sender

    for m in msgs:
        if not m.get("sender_id") or m.get("type") == "system":
            m["read_by_count"] = 0
            m["total_recipients"] = 0
            continue
        recipients = [uid for uid in chat["member_ids"] if uid != m["sender_id"]]
        cnt = 0
        for uid in recipients:
            lr = reads_map.get(uid)
            if lr and lr >= m["created_at"]:
                cnt += 1
        m["read_by_count"] = cnt
        m["total_recipients"] = len(recipients)
    return msgs


@api.post("/chats/{chat_id}/messages")
async def send_message(chat_id: str, data: SendMessageIn, user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat or user["id"] not in chat["member_ids"] or chat.get("archived"):
        raise HTTPException(404, "Chat nicht gefunden")
    if not (data.text or data.upload_id):
        raise HTTPException(400, "Nachricht leer")
    msg = {
        "id": str(uuid.uuid4()), "chat_id": chat_id, "sender_id": user["id"],
        "text": data.text, "upload_id": data.upload_id, "type": "text",
        "deleted": False, "created_at": now_iso(),
    }
    await db.messages.insert_one(msg)
    return {k: v for k, v in msg.items() if k != "_id"}


# ---------- Groups ----------
async def require_group_admin(chat_id: str, user: dict) -> dict:
    chat = await db.chats.find_one({"id": chat_id, "type": "group"}, {"_id": 0})
    if not chat:
        raise HTTPException(404, "Gruppe nicht gefunden")
    if user["id"] not in chat.get("admin_ids", []) and user.get("role") != "admin":
        raise HTTPException(403, "Nur Gruppenadmin")
    return chat


@api.post("/groups/{chat_id}/members")
async def add_members(chat_id: str, data: AddMembersIn, user: dict = Depends(get_current_user)):
    chat = await require_group_admin(chat_id, user)
    new_members = list(set(chat["member_ids"]) | set(data.user_ids))
    await db.chats.update_one({"id": chat_id}, {"$set": {"member_ids": new_members}})
    for uid in data.user_ids:
        u = await db.users.find_one({"id": uid}, {"_id": 0})
        if u:
            await db.messages.insert_one({
                "id": str(uuid.uuid4()), "chat_id": chat_id, "sender_id": None,
                "text": f"{u['name']} wurde hinzugefügt", "type": "system",
                "upload_id": None, "deleted": False, "created_at": now_iso(),
            })
    return {"ok": True, "member_ids": new_members}


@api.delete("/groups/{chat_id}/members/{user_id}")
async def remove_member(chat_id: str, user_id: str, user: dict = Depends(get_current_user)):
    chat = await require_group_admin(chat_id, user)
    members = [m for m in chat["member_ids"] if m != user_id]
    admins = [a for a in chat.get("admin_ids", []) if a != user_id]
    await db.chats.update_one({"id": chat_id}, {"$set": {"member_ids": members, "admin_ids": admins}})
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if u:
        await db.messages.insert_one({
            "id": str(uuid.uuid4()), "chat_id": chat_id, "sender_id": None,
            "text": f"{u['name']} wurde entfernt", "type": "system",
            "upload_id": None, "deleted": False, "created_at": now_iso(),
        })
    return {"ok": True}


@api.patch("/groups/{chat_id}")
async def rename_group(chat_id: str, data: RenameGroupIn, user: dict = Depends(get_current_user)):
    await require_group_admin(chat_id, user)
    await db.chats.update_one({"id": chat_id}, {"$set": {"name": data.name}})
    await db.messages.insert_one({
        "id": str(uuid.uuid4()), "chat_id": chat_id, "sender_id": None,
        "text": f"Gruppe umbenannt zu '{data.name}'", "type": "system",
        "upload_id": None, "deleted": False, "created_at": now_iso(),
    })
    return {"ok": True}


@api.post("/groups/{chat_id}/admin")
async def set_group_admin(chat_id: str, data: SetGroupAdminIn, user: dict = Depends(get_current_user)):
    chat = await require_group_admin(chat_id, user)
    admins = set(chat.get("admin_ids", []))
    if data.is_admin:
        admins.add(data.user_id)
    else:
        admins.discard(data.user_id)
    await db.chats.update_one({"id": chat_id}, {"$set": {"admin_ids": list(admins)}})
    return {"ok": True, "admin_ids": list(admins)}


# ---------- Uploads ----------
@api.post("/uploads")
async def upload_file(chat_id: str = Form(...), file: UploadFile = File(...),
                      user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    if not chat or user["id"] not in chat["member_ids"]:
        raise HTTPException(404, "Chat nicht gefunden")
    uid = str(uuid.uuid4())
    ext = Path(file.filename).suffix
    stored_name = f"{uid}{ext}"
    dest = UPLOAD_DIR / stored_name
    content = await file.read()
    dest.write_bytes(content)
    doc = {
        "id": uid, "filename": file.filename, "stored_name": stored_name,
        "content_type": file.content_type, "size": len(content),
        "uploaded_by": user["id"], "chat_id": chat_id,
        "created_at": now_iso(), "deleted": False,
    }
    await db.uploads.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/uploads/{upload_id}/download")
async def download_upload(upload_id: str, user: dict = Depends(get_current_user)):
    up = await db.uploads.find_one({"id": upload_id}, {"_id": 0})
    if not up or up.get("deleted"):
        raise HTTPException(404, "Nicht gefunden")
    # permission: admin or chat member
    if user.get("role") != "admin":
        chat = await db.chats.find_one({"id": up["chat_id"]}, {"_id": 0})
        if not chat or user["id"] not in chat["member_ids"]:
            raise HTTPException(403, "Kein Zugriff")
    path = UPLOAD_DIR / up["stored_name"]
    if not path.exists():
        raise HTTPException(404, "Datei fehlt")
    return FileResponse(path, filename=up["filename"], media_type=up.get("content_type") or "application/octet-stream")


# ---------- Reports / Moderation ----------
@api.post("/messages/{message_id}/report")
async def report_message(message_id: str, data: ReportIn, user: dict = Depends(get_current_user)):
    msg = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(404, "Nachricht nicht gefunden")
    chat = await db.chats.find_one({"id": msg["chat_id"]}, {"_id": 0})
    if not chat or user["id"] not in chat["member_ids"]:
        raise HTTPException(403, "Kein Zugriff")
    rep = {
        "id": str(uuid.uuid4()), "message_id": message_id, "chat_id": msg["chat_id"],
        "reporter_id": user["id"], "reason": data.reason,
        "status": "pending",  # pending | resolved_kept | resolved_deleted
        "created_at": now_iso(), "resolved_at": None, "resolved_by": None,
    }
    await db.reports.insert_one(rep)
    return {k: v for k, v in rep.items() if k != "_id"}


# ---------- Admin endpoints ----------
@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    users_count = await db.users.count_documents({})
    chats_count = await db.chats.count_documents({})
    direct_count = await db.chats.count_documents({"type": "direct"})
    group_count = await db.chats.count_documents({"type": "group"})
    msg_count = await db.messages.count_documents({})
    reports_pending = await db.reports.count_documents({"status": "pending"})
    uploads_count = await db.uploads.count_documents({"deleted": {"$ne": True}})
    # active in last 5 min
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    active_users = await db.users.count_documents({"last_seen": {"$gte": cutoff}})
    return {
        "users": users_count,
        "active_users": active_users,
        "chats": chats_count,
        "direct_chats": direct_count,
        "group_chats": group_count,
        "messages": msg_count,
        "reports_pending": reports_pending,
        "uploads": uploads_count,
        "server_time": now_iso(),
    }


@api.get("/admin/chats")
async def admin_list_chats(admin: dict = Depends(require_admin)):
    chats = await db.chats.find({}, {"_id": 0}).to_list(1000)
    result = []
    for c in chats:
        msg_count = await db.messages.count_documents({"chat_id": c["id"]})
        last = await db.messages.find_one({"chat_id": c["id"]}, sort=[("created_at", -1)], projection={"_id": 0, "created_at": 1})
        result.append({
            "id": c["id"], "type": c["type"], "name": c.get("name"),
            "member_count": len(c["member_ids"]), "member_ids": c["member_ids"],
            "message_count": msg_count,
            "last_message_at": (last or {}).get("created_at"),
            "created_at": c["created_at"],
        })
    return result


@api.get("/admin/groups")
async def admin_list_groups(admin: dict = Depends(require_admin)):
    groups = await db.chats.find({"type": "group"}, {"_id": 0}).to_list(1000)
    return groups


@api.post("/admin/groups")
async def admin_create_group(data: AdminCreateGroupIn, admin: dict = Depends(require_admin)):
    if not data.name.strip():
        raise HTTPException(400, "Gruppenname erforderlich")
    if not data.member_ids:
        raise HTTPException(400, "Mindestens ein Mitglied erforderlich")
    # admin_ids must be a subset of member_ids
    invalid_admins = [a for a in data.admin_ids if a not in data.member_ids]
    if invalid_admins:
        raise HTTPException(400, "Gruppen-Admins müssen Mitglieder sein")
    # verify users exist
    found = await db.users.count_documents({"id": {"$in": list(set(data.member_ids))}})
    if found != len(set(data.member_ids)):
        raise HTTPException(400, "Ein oder mehrere Nutzer existieren nicht")

    group_id = str(uuid.uuid4())
    chat = {
        "id": group_id, "type": "group", "name": data.name,
        "member_ids": list(set(data.member_ids)),
        "admin_ids": list(set(data.admin_ids)),
        "created_at": now_iso(),
        "created_by": admin["id"],  # admin is creator, NOT a member
        "created_by_admin": True,
    }
    await db.chats.insert_one(chat)
    await db.messages.insert_one({
        "id": str(uuid.uuid4()), "chat_id": group_id, "sender_id": None,
        "text": f"Gruppe '{data.name}' wurde durch Administration erstellt",
        "type": "system", "upload_id": None, "deleted": False,
        "created_at": now_iso(),
    })
    await db.moderation_log.insert_one({
        "id": str(uuid.uuid4()), "action": "create_group", "target_id": group_id,
        "actor_id": admin["id"], "note": data.name, "created_at": now_iso(),
    })
    return {k: v for k, v in chat.items() if k != "_id"}


@api.patch("/admin/groups/{chat_id}")
async def admin_edit_group(chat_id: str, data: AdminEditGroupIn,
                           admin: dict = Depends(require_admin)):
    chat = await db.chats.find_one({"id": chat_id, "type": "group"}, {"_id": 0})
    if not chat:
        raise HTTPException(404, "Gruppe nicht gefunden")

    upd = {}
    system_messages = []

    if data.name is not None and data.name.strip() and data.name != chat.get("name"):
        upd["name"] = data.name.strip()
        system_messages.append(f"Gruppe umbenannt zu '{data.name.strip()}' (Admin)")

    if data.member_ids is not None:
        new_members = list(set(data.member_ids))
        if not new_members:
            raise HTTPException(400, "Mindestens ein Mitglied erforderlich")
        found = await db.users.count_documents({"id": {"$in": new_members}})
        if found != len(new_members):
            raise HTTPException(400, "Ein oder mehrere Nutzer existieren nicht")
        old = set(chat["member_ids"])
        new = set(new_members)
        added = new - old
        removed = old - new
        upd["member_ids"] = new_members
        for uid in added:
            u = await db.users.find_one({"id": uid}, {"_id": 0, "name": 1})
            if u:
                system_messages.append(f"{u['name']} wurde hinzugefügt (Admin)")
        for uid in removed:
            u = await db.users.find_one({"id": uid}, {"_id": 0, "name": 1})
            if u:
                system_messages.append(f"{u['name']} wurde entfernt (Admin)")

    if data.admin_ids is not None:
        member_pool = upd.get("member_ids", chat["member_ids"])
        invalid = [a for a in data.admin_ids if a not in member_pool]
        if invalid:
            raise HTTPException(400, "Gruppen-Admins müssen Mitglieder sein")
        upd["admin_ids"] = list(set(data.admin_ids))

    if upd:
        await db.chats.update_one({"id": chat_id}, {"$set": upd})
        for text in system_messages:
            await db.messages.insert_one({
                "id": str(uuid.uuid4()), "chat_id": chat_id, "sender_id": None,
                "text": text, "type": "system", "upload_id": None,
                "deleted": False, "created_at": now_iso(),
            })
        await db.moderation_log.insert_one({
            "id": str(uuid.uuid4()), "action": "edit_group", "target_id": chat_id,
            "actor_id": admin["id"], "note": ", ".join(upd.keys()),
            "created_at": now_iso(),
        })
    updated = await db.chats.find_one({"id": chat_id}, {"_id": 0})
    return updated


@api.post("/admin/groups/{chat_id}/archive")
async def admin_archive_group(chat_id: str, admin: dict = Depends(require_admin)):
    chat = await db.chats.find_one({"id": chat_id, "type": "group"}, {"_id": 0})
    if not chat:
        raise HTTPException(404, "Gruppe nicht gefunden")
    if chat.get("archived"):
        return {"ok": True, "archived": True}
    await db.chats.update_one({"id": chat_id}, {"$set": {
        "archived": True, "archived_at": now_iso(), "archived_by": admin["id"],
    }})
    await db.messages.insert_one({
        "id": str(uuid.uuid4()), "chat_id": chat_id, "sender_id": None,
        "text": "Gruppe wurde durch Administration archiviert",
        "type": "system", "upload_id": None, "deleted": False,
        "created_at": now_iso(),
    })
    await db.moderation_log.insert_one({
        "id": str(uuid.uuid4()), "action": "archive_group", "target_id": chat_id,
        "actor_id": admin["id"], "note": chat.get("name"), "created_at": now_iso(),
    })
    return {"ok": True, "archived": True}


@api.post("/admin/groups/{chat_id}/unarchive")
async def admin_unarchive_group(chat_id: str, admin: dict = Depends(require_admin)):
    chat = await db.chats.find_one({"id": chat_id, "type": "group"}, {"_id": 0})
    if not chat:
        raise HTTPException(404, "Gruppe nicht gefunden")
    if not chat.get("archived"):
        return {"ok": True, "archived": False}
    await db.chats.update_one({"id": chat_id}, {"$set": {"archived": False}})
    await db.messages.insert_one({
        "id": str(uuid.uuid4()), "chat_id": chat_id, "sender_id": None,
        "text": "Gruppe wurde durch Administration reaktiviert",
        "type": "system", "upload_id": None, "deleted": False,
        "created_at": now_iso(),
    })
    await db.moderation_log.insert_one({
        "id": str(uuid.uuid4()), "action": "unarchive_group", "target_id": chat_id,
        "actor_id": admin["id"], "note": chat.get("name"), "created_at": now_iso(),
    })
    return {"ok": True, "archived": False}


# ---------- Admin: Invite Codes ----------
@api.get("/admin/invites")
async def admin_list_invites(admin: dict = Depends(require_admin)):
    invites = await db.invite_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    # enrich with user name if used
    for inv in invites:
        if inv.get("used_by"):
            u = await db.users.find_one({"id": inv["used_by"]}, {"_id": 0, "name": 1, "email": 1})
            if u:
                inv["used_by_name"] = u["name"]
                inv["used_by_email"] = u["email"]
    return invites


@api.post("/admin/invites")
async def admin_create_invite(data: InviteCreateIn, admin: dict = Depends(require_admin)):
    if data.role not in ("user", "admin"):
        raise HTTPException(400, "Rolle muss 'user' oder 'admin' sein")
    # generate unique code
    for _ in range(10):
        code = _generate_invite_code()
        if not await db.invite_codes.find_one({"code": code}, {"_id": 0}):
            break
    else:
        raise HTTPException(500, "Konnte keinen eindeutigen Code erzeugen")

    doc = {
        "id": str(uuid.uuid4()), "code": code,
        "role": data.role, "is_customer": data.is_customer,
        "expires_at": data.expires_at, "note": data.note,
        "used": False, "used_by": None, "used_at": None,
        "created_by": admin["id"], "created_at": now_iso(),
    }
    await db.invite_codes.insert_one(doc)
    await db.moderation_log.insert_one({
        "id": str(uuid.uuid4()), "action": "invite_created",
        "target_id": doc["id"], "actor_id": admin["id"],
        "note": f"code={code} role={data.role} customer={data.is_customer}",
        "created_at": now_iso(),
    })
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/admin/invites/{invite_id}")
async def admin_delete_invite(invite_id: str, admin: dict = Depends(require_admin)):
    inv = await db.invite_codes.find_one({"id": invite_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Nicht gefunden")
    if inv.get("used"):
        raise HTTPException(400, "Eingelöste Codes können nicht gelöscht werden")
    await db.invite_codes.delete_one({"id": invite_id})
    await db.moderation_log.insert_one({
        "id": str(uuid.uuid4()), "action": "invite_revoked",
        "target_id": invite_id, "actor_id": admin["id"],
        "note": inv.get("code"), "created_at": now_iso(),
    })
    return {"ok": True}


@api.get("/admin/uploads")
async def admin_list_uploads(admin: dict = Depends(require_admin)):
    items = await db.uploads.find({}, {"_id": 0}).to_list(1000)
    return items


@api.delete("/admin/uploads/{upload_id}")
async def admin_delete_upload(upload_id: str, admin: dict = Depends(require_admin)):
    up = await db.uploads.find_one({"id": upload_id}, {"_id": 0})
    if not up:
        raise HTTPException(404, "Nicht gefunden")
    await db.uploads.update_one({"id": upload_id}, {"$set": {"deleted": True, "deleted_at": now_iso(), "deleted_by": admin["id"]}})
    path = UPLOAD_DIR / up["stored_name"]
    if path.exists():
        try:
            path.unlink()
        except Exception:
            pass
    await db.moderation_log.insert_one({
        "id": str(uuid.uuid4()), "action": "delete_upload", "target_id": upload_id,
        "actor_id": admin["id"], "note": up.get("filename"), "created_at": now_iso(),
    })
    return {"ok": True}


@api.post("/admin/uploads")
async def admin_upload(file: UploadFile = File(...), note: str = Form(""),
                       admin: dict = Depends(require_admin)):
    uid = str(uuid.uuid4())
    ext = Path(file.filename).suffix
    stored = f"{uid}{ext}"
    content = await file.read()
    (UPLOAD_DIR / stored).write_bytes(content)
    doc = {
        "id": uid, "filename": file.filename, "stored_name": stored,
        "content_type": file.content_type, "size": len(content),
        "uploaded_by": admin["id"], "chat_id": None, "admin_note": note,
        "created_at": now_iso(), "deleted": False,
    }
    await db.uploads.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/admin/reports")
async def admin_list_reports(status: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {}
    if status:
        q["status"] = status
    reports = await db.reports.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    # attach message + sender + chat meta
    for r in reports:
        msg = await db.messages.find_one({"id": r["message_id"]}, {"_id": 0})
        r["message"] = msg
        if msg and msg.get("sender_id"):
            sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "password_hash": 0})
            r["sender"] = sender
        reporter = await db.users.find_one({"id": r["reporter_id"]}, {"_id": 0, "password_hash": 0})
        r["reporter"] = reporter
        chat = await db.chats.find_one({"id": r["chat_id"]}, {"_id": 0})
        r["chat"] = {"id": chat["id"], "type": chat["type"], "name": chat.get("name")} if chat else None
    return reports


@api.post("/admin/reports/{report_id}/resolve")
async def admin_resolve_report(report_id: str, action: str,
                               admin: dict = Depends(require_admin)):
    # action: delete | keep
    rep = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not rep:
        raise HTTPException(404, "Nicht gefunden")
    if action == "delete":
        await db.messages.update_one({"id": rep["message_id"]}, {"$set": {"deleted": True, "deleted_by": admin["id"], "deleted_at": now_iso()}})
        status_new = "resolved_deleted"
    else:
        status_new = "resolved_kept"
    await db.reports.update_one({"id": report_id}, {"$set": {
        "status": status_new, "resolved_at": now_iso(), "resolved_by": admin["id"],
    }})
    await db.moderation_log.insert_one({
        "id": str(uuid.uuid4()), "action": action, "target_id": rep["message_id"],
        "actor_id": admin["id"], "note": rep.get("reason"), "created_at": now_iso(),
    })
    return {"ok": True, "status": status_new}


@api.get("/admin/moderation-log")
async def admin_moderation_log(admin: dict = Depends(require_admin)):
    log = await db.moderation_log.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return log


# ---------- Admin: Custom Roles ----------
@api.get("/admin/custom-roles")
async def admin_list_custom_roles(admin: dict = Depends(require_admin)):
    roles = await db.custom_roles.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    for r in roles:
        r["assigned_count"] = await db.users.count_documents({"custom_roles": r["name"]})
    return roles


@api.get("/custom-roles")
async def list_custom_roles(user: dict = Depends(get_current_user)):
    roles = await db.custom_roles.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return roles


@api.post("/admin/custom-roles")
async def admin_create_custom_role(data: CustomRoleIn, admin: dict = Depends(require_admin)):
    name = data.name.strip()
    if not name:
        raise HTTPException(400, "Name erforderlich")
    if await db.custom_roles.find_one({"name": name}):
        raise HTTPException(400, "Rolle existiert bereits")
    doc = {
        "id": str(uuid.uuid4()), "name": name,
        "color": (data.color or "#06B6D4").strip(),
        "description": (data.description or "").strip(),
        "created_at": now_iso(), "created_by": admin["id"],
    }
    await db.custom_roles.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/admin/custom-roles/{role_id}")
async def admin_delete_custom_role(role_id: str, admin: dict = Depends(require_admin)):
    role = await db.custom_roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(404, "Nicht gefunden")
    await db.custom_roles.delete_one({"id": role_id})
    # remove from all users
    await db.users.update_many({}, {"$pull": {"custom_roles": role["name"]}})
    return {"ok": True}


# ---------- Admin: Health / Server Status ----------
@api.get("/admin/health")
async def admin_health(admin: dict = Depends(require_admin)):
    start = datetime.now(timezone.utc)
    db_ok = False
    db_latency_ms = None
    try:
        t0 = datetime.now(timezone.utc)
        await client.admin.command("ping")
        db_ok = True
        db_latency_ms = (datetime.now(timezone.utc) - t0).total_seconds() * 1000
    except Exception as e:
        logger.error(f"DB ping failed: {e}")
    # storage estimate for uploads dir
    total_size = 0
    file_count = 0
    try:
        for p in UPLOAD_DIR.iterdir():
            if p.is_file():
                total_size += p.stat().st_size
                file_count += 1
    except Exception:
        pass
    uptime_s = (datetime.now(timezone.utc) - APP_STARTED_AT).total_seconds()
    return {
        "backend": {"status": "ok", "uptime_seconds": int(uptime_s)},
        "database": {
            "status": "ok" if db_ok else "down",
            "latency_ms": round(db_latency_ms, 2) if db_latency_ms is not None else None,
        },
        "storage": {
            "upload_files": file_count,
            "upload_bytes": total_size,
        },
        "check_duration_ms": round((datetime.now(timezone.utc) - start).total_seconds() * 1000, 2),
        "checked_at": now_iso(),
    }


# Public frontend probe (no auth) so the frontend health widget can self-check via its own origin
@api.get("/health")
async def public_health():
    return {"status": "ok", "checked_at": now_iso()}


# ---------- Router ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Startup: indexes + seed ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.chats.create_index("id", unique=True)
    await db.chats.create_index("member_ids")
    await db.messages.create_index([("chat_id", 1), ("created_at", -1)])
    await db.messages.create_index("id", unique=True)
    await db.uploads.create_index("id", unique=True)
    await db.reports.create_index("status")
    await db.chat_reads.create_index([("user_id", 1), ("chat_id", 1)], unique=True)
    await db.invite_codes.create_index("code", unique=True)
    await db.custom_roles.create_index("name", unique=True)

    # seed admin
    admin = await db.users.find_one({"email": ADMIN_EMAIL.lower()}, {"_id": 0})
    if not admin:
        admin_doc = {
            "id": str(uuid.uuid4()), "email": ADMIN_EMAIL.lower(), "name": "System-Admin",
            "role": "admin", "is_customer": False,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "created_at": now_iso(), "last_seen": None,
        }
        await db.users.insert_one(admin_doc)
        logger.info(f"Admin seeded: {ADMIN_EMAIL}")
    elif not verify_password(ADMIN_PASSWORD, admin["password_hash"]):
        await db.users.update_one({"id": admin["id"]}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})

    if SEED_DEMO:
        demo_users = [
            ("anna@event.local", "Anna Müller", False),
            ("ben@event.local", "Ben Schulz", False),
            ("clara@event.local", "Clara Weber", True),
        ]
        created_ids = {}
        for email, name, customer in demo_users:
            existing = await db.users.find_one({"email": email}, {"_id": 0})
            if existing:
                created_ids[email] = existing["id"]
                continue
            uid = str(uuid.uuid4())
            await db.users.insert_one({
                "id": uid, "email": email, "name": name, "role": "user",
                "is_customer": customer, "password_hash": hash_password("demo123"),
                "created_at": now_iso(), "last_seen": None,
            })
            created_ids[email] = uid

        # create sample group if none exists
        if not await db.chats.find_one({"type": "group", "name": "Event-Team"}, {"_id": 0}):
            anna_id = created_ids.get("anna@event.local")
            ben_id = created_ids.get("ben@event.local")
            clara_id = created_ids.get("clara@event.local")
            group_id = str(uuid.uuid4())
            await db.chats.insert_one({
                "id": group_id, "type": "group", "name": "Event-Team",
                "member_ids": [anna_id, ben_id, clara_id],
                "admin_ids": [anna_id],
                "created_at": now_iso(), "created_by": anna_id,
            })
            await db.messages.insert_many([
                {"id": str(uuid.uuid4()), "chat_id": group_id, "sender_id": None,
                 "text": "Gruppe 'Event-Team' erstellt", "type": "system",
                 "upload_id": None, "deleted": False, "created_at": now_iso()},
                {"id": str(uuid.uuid4()), "chat_id": group_id, "sender_id": anna_id,
                 "text": "Willkommen im Event-Team Chat!", "type": "text",
                 "upload_id": None, "deleted": False, "created_at": now_iso()},
                {"id": str(uuid.uuid4()), "chat_id": group_id, "sender_id": ben_id,
                 "text": "Danke Anna, freue mich auf das Event.", "type": "text",
                 "upload_id": None, "deleted": False, "created_at": now_iso()},
            ])

            # direct chat Anna <-> Ben
            direct_id = str(uuid.uuid4())
            await db.chats.insert_one({
                "id": direct_id, "type": "direct", "name": None,
                "member_ids": [anna_id, ben_id], "admin_ids": [],
                "created_at": now_iso(), "created_by": anna_id,
            })
            await db.messages.insert_one({
                "id": str(uuid.uuid4()), "chat_id": direct_id, "sender_id": anna_id,
                "text": "Hi Ben, bist du heute Abend dabei?", "type": "text",
                "upload_id": None, "deleted": False, "created_at": now_iso(),
            })


@app.on_event("shutdown")
async def shutdown():
    client.close()
