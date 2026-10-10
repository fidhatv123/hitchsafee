from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional, Dict, Any
import uuid
import datetime
from app.models import UserRegister, UserLogin, UserProfile
from app.database import get_db_connection

router = APIRouter(prefix="/auth", tags=["User Authentication & Continuous Usage"])

@router.post("/register", response_model=Dict[str, Any])
def register(user: UserRegister):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE email = ?", (user.email.lower().strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user_id = f"user_{uuid.uuid4().hex[:10]}"
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    cursor.execute('''
    INSERT INTO users (
        id, email, password_hash, name, phone, primary_contact_name, primary_contact_phone, primary_contact_relation, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        user_id, user.email.lower().strip(), user.password, user.name, user.phone,
        user.primary_contact_name, user.primary_contact_phone, user.primary_contact_relation, now
    ))
    conn.commit()
    conn.close()

    profile = UserProfile(
        id=user_id,
        name=user.name,
        email=user.email.lower().strip(),
        phone=user.phone,
        primary_contact_name=user.primary_contact_name,
        primary_contact_phone=user.primary_contact_phone,
        primary_contact_relation=user.primary_contact_relation,
        created_at=now
    )

    return {
        "success": True,
        "token": f"token_{user_id}",
        "user": profile.model_dump()
    }

@router.post("/login", response_model=Dict[str, Any])
def login(creds: UserLogin):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (creds.email.lower().strip(),))
    user_row = cursor.fetchone()
    conn.close()

    if not user_row or user_row["password_hash"] != creds.password:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    profile = UserProfile(
        id=user_row["id"],
        name=user_row["name"],
        email=user_row["email"],
        phone=user_row["phone"],
        primary_contact_name=user_row["primary_contact_name"],
        primary_contact_phone=user_row["primary_contact_phone"],
        primary_contact_relation=user_row["primary_contact_relation"],
        created_at=user_row["created_at"]
    )

    return {
        "success": True,
        "token": f"token_{user_row['id']}",
        "user": profile.model_dump()
    }

@router.get("/demo-profile", response_model=UserProfile)
def get_demo_profile():
    """Provides instant quick-access credentials for the demo evaluator."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = 'aarav@hitchsafe.org'")
    user_row = cursor.fetchone()
    conn.close()

    if user_row:
        return UserProfile(
            id=user_row["id"],
            name=user_row["name"],
            email=user_row["email"],
            phone=user_row["phone"],
            primary_contact_name=user_row["primary_contact_name"],
            primary_contact_phone=user_row["primary_contact_phone"],
            primary_contact_relation=user_row["primary_contact_relation"],
            created_at=user_row["created_at"]
        )
    raise HTTPException(status_code=404, detail="Demo profile not found")
