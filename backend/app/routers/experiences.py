from fastapi import APIRouter, HTTPException
from typing import List, Optional
import uuid
import datetime
from app.models import UserExperience, UserExperienceCreate
from app.database import get_db_connection

router = APIRouter(prefix="/experiences", tags=["User Experiences & Community Logs"])

@router.get("", response_model=List[UserExperience])
def list_experiences(destination: Optional[str] = None, location: Optional[str] = None):
    """
    Get community hitchhiking experiences:
    Includes user story, origin location, destination, pickup spot, wait time, and safety rating.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM user_experiences"
    params = []
    conditions = []

    if destination:
        conditions.append("destination LIKE ?")
        params.append(f"%{destination}%")
    if location:
        conditions.append("location LIKE ?")
        params.append(f"%{location}%")

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_at DESC LIMIT 50"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [dict(r) for r in rows]

@router.post("", response_model=UserExperience)
def submit_experience(payload: UserExperienceCreate):
    """
    Submit a user hitchhiking experience:
    - User experience notes & safety feedback
    - Location (origin / where journey began)
    - Destination
    - From where did they get the ride (pickup spot / landmark)
    - How much they had to wait there (wait time in minutes)
    """
    if not payload.location.strip() or not payload.destination.strip() or not payload.pickup_spot.strip():
        raise HTTPException(status_code=400, detail="Location, destination, and pickup spot are required")

    exp_id = f"exp_{uuid.uuid4().hex[:8]}"
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
    INSERT INTO user_experiences (
        id, user_name, user_id, location, destination, pickup_spot,
        wait_time_minutes, rating, experience_notes, driver_behavior,
        vehicle_type, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        exp_id,
        payload.user_name,
        payload.user_id,
        payload.location,
        payload.destination,
        payload.pickup_spot,
        payload.wait_time_minutes,
        payload.rating,
        payload.experience_notes,
        payload.driver_behavior or "Friendly and respectful",
        payload.vehicle_type or "Car / Private Vehicle",
        now
    ))

    # Also check if pickup_spot matches any registered spot to update community wait time
    cursor.execute("SELECT id, avg_wait_min, sample_count FROM spots WHERE name LIKE ?", (f"%{payload.pickup_spot}%",))
    matched_spot = cursor.fetchone()
    if matched_spot:
        old_avg = matched_spot["avg_wait_min"]
        old_count = matched_spot["sample_count"]
        new_count = old_count + 1
        new_avg = round(((old_avg * old_count) + payload.wait_time_minutes) / new_count, 1)
        cursor.execute("UPDATE spots SET avg_wait_min = ?, sample_count = ? WHERE id = ?", (new_avg, new_count, matched_spot["id"]))

    conn.commit()
    conn.close()

    return {
        "id": exp_id,
        "user_name": payload.user_name,
        "user_id": payload.user_id,
        "location": payload.location,
        "destination": payload.destination,
        "pickup_spot": payload.pickup_spot,
        "wait_time_minutes": payload.wait_time_minutes,
        "rating": payload.rating,
        "experience_notes": payload.experience_notes,
        "driver_behavior": payload.driver_behavior,
        "vehicle_type": payload.vehicle_type,
        "created_at": now
    }
