from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional, Dict, Any
import json
import uuid
import datetime
from app.models import Trip, TripCreate, GPSPing, AlertEvent
from app.config import settings
from app.database import get_db_connection
from app.services.routing_service import routing_service
from app.services.deviation_detector import DeviationDetector
from app.services.escalation_manager import escalation_manager
from app.services.alert_queue import alert_queue
from app.services.alert_provider import mock_provider
from app.services.police_service import police_service

router = APIRouter(prefix="/trips", tags=["Trips & Safety Monitoring"])
detector = DeviationDetector()

@router.post("", response_model=Trip)
def create_trip(payload: TripCreate):
    """
    Start a monitored ride:
    1. Records vehicle plate, plate photo, trusted contact, and destination.
    2. Generates secure, tokenized live-tracking link.
    3. Finds nearest police station for emergency pre-routing.
    4. Dispatches start notification to trusted primary contact.
    """
    trip_id = f"trip_{uuid.uuid4().hex[:10]}"
    token = uuid.uuid4().hex
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Route generation
    if payload.expected_route and len(payload.expected_route) > 1:
        route_coords = payload.expected_route
    else:
        route_res = routing_service.get_route(
            payload.origin_lat, payload.origin_lon,
            payload.destination_lat, payload.destination_lon
        )
        route_coords = route_res.get("coordinates", [
            [payload.origin_lat, payload.origin_lon],
            [payload.destination_lat, payload.destination_lon]
        ])

    tracking_link = f"{settings.TRACKING_BASE_URL}/{token}"

    # Pre-identify nearest police station
    station = police_service.find_nearest_station(payload.origin_lat, payload.origin_lon)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO trips (
        id, token, user_name, user_id, vehicle_plate, plate_photo_path, plate_photo_data,
        origin_lat, origin_lon, origin_name,
        destination_lat, destination_lon, destination_name,
        expected_arrival_time, buffer_minutes,
        trusted_contact_name, trusted_contact_phone, trusted_contact_accepted,
        status, created_at, updated_at, expected_route,
        last_known_lat, last_known_lon, last_known_speed, last_known_time,
        battery_level, deviation_status, countdown_seconds_remaining,
        snooze_count, silent_distress_active, destination_missed, nearest_police_id,
        police_alert_dispatched, police_dossier
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', ?, ?, ?, ?, ?, 0.0, ?, ?, 'OK', NULL, 0, 0, 0, ?, 0, NULL)
    ''', (
        trip_id, token, payload.user_name, payload.user_id, payload.vehicle_plate, payload.plate_photo_path, payload.plate_photo_data,
        payload.origin_lat, payload.origin_lon, payload.origin_name,
        payload.destination_lat, payload.destination_lon, payload.destination_name,
        payload.expected_arrival_time, payload.buffer_minutes,
        payload.trusted_contact_name, payload.trusted_contact_phone,
        now, now, json.dumps(route_coords),
        payload.origin_lat, payload.origin_lon, now,
        payload.battery_level or 100,
        station["id"]
    ))
    conn.commit()
    conn.close()

    # Send start alert to primary contact (with plate photo link/tag)
    start_msg = (
        f"TRIP STARTED (HitchSafe): {payload.user_name} hitched a ride in vehicle {payload.vehicle_plate} "
        f"heading to {payload.destination_name}. Expected arrival: {payload.expected_arrival_time}. "
        f"Photo of vehicle plate logged. Nearest Police Sector: {station['name']}. "
        f"Live tracking link: {tracking_link}"
    )

    alert_queue.dispatch_or_enqueue(
        trip_id=trip_id,
        recipient=payload.trusted_contact_phone,
        message=start_msg,
        alert_type="TRIP_STARTED",
        tracking_link=tracking_link,
        plate_photo_url=payload.plate_photo_data or payload.plate_photo_path,
        recipient_type="PRIMARY_CONTACT"
    )

    trip_dict = {
        "id": trip_id,
        "token": token,
        "user_name": payload.user_name,
        "user_id": payload.user_id,
        "vehicle_plate": payload.vehicle_plate,
        "plate_photo_path": payload.plate_photo_path,
        "plate_photo_data": payload.plate_photo_data,
        "origin_lat": payload.origin_lat,
        "origin_lon": payload.origin_lon,
        "origin_name": payload.origin_name,
        "destination_lat": payload.destination_lat,
        "destination_lon": payload.destination_lon,
        "destination_name": payload.destination_name,
        "expected_arrival_time": payload.expected_arrival_time,
        "buffer_minutes": payload.buffer_minutes,
        "trusted_contact_name": payload.trusted_contact_name,
        "trusted_contact_phone": payload.trusted_contact_phone,
        "trusted_contact_accepted": True,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now,
        "expected_route": route_coords,
        "last_known_lat": payload.origin_lat,
        "last_known_lon": payload.origin_lon,
        "last_known_speed": 0.0,
        "last_known_time": now,
        "battery_level": payload.battery_level or 100,
        "deviation_status": "OK",
        "countdown_seconds_remaining": None,
        "countdown_started_at": None,
        "snooze_count": 0,
        "silent_distress_active": False,
        "destination_missed": False,
        "nearest_police_id": station["id"],
        "police_alert_dispatched": False,
        "police_dossier": None,
        "tracking_link": tracking_link
    }
    return Trip(**trip_dict)

@router.get("/{trip_id}", response_model=Trip)
def get_trip(trip_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trips WHERE id = ?", (trip_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Trip not found")

    d = dict(row)
    d["expected_route"] = json.loads(d["expected_route"]) if d["expected_route"] else []
    d["tracking_link"] = f"{settings.TRACKING_BASE_URL}/{d['token']}"
    d["trusted_contact_accepted"] = bool(d["trusted_contact_accepted"])
    d["silent_distress_active"] = bool(d["silent_distress_active"])
    d["destination_missed"] = bool(d.get("destination_missed", 0))
    d["police_alert_dispatched"] = bool(d.get("police_alert_dispatched", 0))
    d["police_dossier"] = json.loads(d["police_dossier"]) if d.get("police_dossier") else None
    return Trip(**d)

@router.get("/track/{token}")
def get_trip_by_token(token: str):
    """
    Public live-tracking link for trusted primary contact.
    Accessible on any web browser with NO app install needed.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trips WHERE token = ?", (token,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Tracking link invalid or expired.")

    d = dict(row)
    route_coords = json.loads(d["expected_route"]) if d["expected_route"] else []
    is_active = (d["status"] == "ACTIVE")
    dossier = json.loads(d["police_dossier"]) if d.get("police_dossier") else None

    return {
        "trip_id": d["id"],
        "token": token,
        "user_name": d["user_name"],
        "vehicle_plate": d["vehicle_plate"],
        "plate_photo_url": d.get("plate_photo_data") or d.get("plate_photo_path"),
        "origin_name": d["origin_name"],
        "destination_name": d["destination_name"],
        "status": d["status"],
        "is_active": is_active,
        "expected_arrival_time": d["expected_arrival_time"],
        "last_known_lat": d["last_known_lat"] if is_active else None,
        "last_known_lon": d["last_known_lon"] if is_active else None,
        "last_known_speed": d["last_known_speed"] if is_active else None,
        "last_known_time": d["last_known_time"],
        "battery_level": d["battery_level"],
        "deviation_status": d["deviation_status"],
        "destination_missed": bool(d.get("destination_missed", 0)),
        "police_alert_dispatched": bool(d.get("police_alert_dispatched", 0)),
        "police_dossier": dossier,
        "silent_distress_active": bool(d["silent_distress_active"]),
        "expected_route": route_coords,
        "trusted_contact_name": d["trusted_contact_name"],
        "expires_info": "Tracking link active only during ride and automatically expires upon trip completion."
    }

@router.post("/{trip_id}/ping")
def submit_gps_ping(trip_id: str, ping: GPSPing):
    """Live GPS Ping with deviation detection and missed arrival check."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trips WHERE id = ?", (trip_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Trip not found")

    if row["status"] != "ACTIVE":
        conn.close()
        return {"status": row["status"], "message": "Trip is not active"}

    expected_route = json.loads(row["expected_route"]) if row["expected_route"] else []
    current_status = row["deviation_status"]
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    eval_res = detector.evaluate_ping(
        current_lat=ping.lat,
        current_lon=ping.lon,
        speed_kmh=ping.speed_kmh,
        expected_route=expected_route,
        road_type="national_highway"
    )

    ping_id = f"ping_{uuid.uuid4().hex[:8]}"
    cursor.execute('''
    INSERT INTO gps_pings (
        id, trip_id, lat, lon, speed_kmh, accuracy_m, battery_pct,
        distance_from_route_m, timestamp, is_offline_cached
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        ping_id, trip_id, ping.lat, ping.lon, ping.speed_kmh, ping.accuracy_m,
        ping.battery_pct, eval_res["distance_m"], ping.timestamp or now,
        1 if ping.is_offline_cached else 0
    ))

    cursor.execute('''
    UPDATE trips
    SET last_known_lat = ?,
        last_known_lon = ?,
        last_known_speed = ?,
        last_known_time = ?,
        battery_level = ?,
        updated_at = ?
    WHERE id = ?
    ''', (ping.lat, ping.lon, ping.speed_kmh, now, ping.battery_pct, now, trip_id))
    conn.commit()
    conn.close()

    if eval_res["trigger_warning"] and current_status == "OK":
        escalation_res = escalation_manager.trigger_warning(trip_id, eval_res["reason"])
        current_status = "COUNTDOWN"
        countdown_rem = escalation_res.get("countdown_seconds_remaining", 45)
    else:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT countdown_seconds_remaining, deviation_status FROM trips WHERE id = ?", (trip_id,))
        t_row = cursor.fetchone()
        current_status = t_row["deviation_status"]
        countdown_rem = t_row["countdown_seconds_remaining"]
        conn.close()

    # Check missed arrival deadline
    escalation_manager.check_missed_arrival(trip_id)

    return {
        "trip_id": trip_id,
        "evaluation": eval_res,
        "deviation_status": current_status,
        "countdown_seconds_remaining": countdown_rem,
        "recommended_sampling_rate_sec": eval_res["recommended_sampling_rate_sec"],
        "last_known_time": now
    }

@router.post("/{trip_id}/tick-countdown")
def tick_countdown(trip_id: str, seconds: int = Body(1, embed=True)):
    """Process one tick of countdown timer. If zero, executes dual safety escalation."""
    res = escalation_manager.process_countdown_tick(trip_id, seconds_passed=seconds)
    return res

@router.post("/{trip_id}/missed-destination")
def trigger_missed_destination(trip_id: str):
    """
    Triggers emergency alert when user has not reached specified destination:
    1. Sends alert message with plate photo to the primary person.
    2. Sends details & plate photo to the nearest police station.
    """
    res = escalation_manager.trigger_missed_destination(trip_id)
    return res

@router.post("/{trip_id}/resolve-ok")
def resolve_ok(trip_id: str, note: Optional[str] = Body("User pressed I am OK", embed=True)):
    """User pressed 'I am okay', clearing warning countdown."""
    res = escalation_manager.resolve_user_ok(trip_id, note)
    return res

@router.post("/{trip_id}/snooze")
def snooze_trip(trip_id: str):
    """User pressed 'Snooze' (+120s grace period, up to 2 times)."""
    res = escalation_manager.snooze_warning(trip_id)
    return res

@router.post("/{trip_id}/silent-distress")
def silent_distress(trip_id: str):
    """Covert calculator distress SOS trigger."""
    res = escalation_manager.trigger_silent_distress(trip_id)
    return res

@router.post("/{trip_id}/end")
def end_trip(trip_id: str):
    """End trip safely."""
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trips WHERE id = ?", (trip_id,))
    trip = cursor.fetchone()
    if not trip:
        conn.close()
        raise HTTPException(status_code=404, detail="Trip not found")

    cursor.execute('''
    UPDATE trips
    SET status = 'COMPLETED',
        deviation_status = 'OK',
        countdown_seconds_remaining = NULL,
        updated_at = ?
    WHERE id = ?
    ''', (now, trip_id))
    conn.commit()
    conn.close()

    safe_msg = (
        f"SAFE ARRIVAL (HitchSafe): {trip['user_name']} has confirmed safe arrival "
        f"at {trip['destination_name']}. The active tracking session has safely concluded."
    )
    alert_queue.dispatch_or_enqueue(
        trip_id=trip_id,
        recipient=trip["trusted_contact_phone"],
        message=safe_msg,
        alert_type="SAFE_ARRIVAL",
        recipient_type="PRIMARY_CONTACT"
    )

    return {
        "success": True,
        "trip_id": trip_id,
        "status": "COMPLETED",
        "message": "Trip marked complete. Safe arrival notified to primary contact."
    }

@router.post("/{trip_id}/delete-data")
def delete_trip_data(trip_id: str):
    """Privacy design: Delete my data option."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM gps_pings WHERE trip_id = ?", (trip_id,))
    cursor.execute("DELETE FROM alerts WHERE trip_id = ?", (trip_id,))
    cursor.execute('''
    UPDATE trips
    SET user_name = 'ANONYMIZED',
        vehicle_plate = 'DELETED',
        plate_photo_path = NULL,
        plate_photo_data = NULL,
        trusted_contact_name = 'DELETED',
        trusted_contact_phone = 'DELETED',
        status = 'PURGED'
    WHERE id = ?
    ''', (trip_id,))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "trip_id": trip_id,
        "message": "All trip GPS pings, photos, and personal identification permanently deleted."
    }

# --- Police Station Intercept Endpoints ---
@router.get("/police/stations")
def get_police_stations():
    """Returns local police stations list."""
    return police_service.get_all_stations()

@router.get("/police/dossiers")
def get_police_dossiers():
    """Returns recent emergency police dispatch dossiers with plate photo evidence."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    SELECT id, trip_id, alert_type, recipient, police_station_name, message,
           status, created_at, plate_photo_url, police_dossier_json
    FROM alerts
    WHERE recipient_type = 'POLICE_STATION'
    ORDER BY created_at DESC LIMIT 20
    ''')
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        d["police_dossier_json"] = json.loads(d["police_dossier_json"]) if d.get("police_dossier_json") else None
        results.append(d)
    return results
