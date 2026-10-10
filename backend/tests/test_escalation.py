import pytest
import datetime
import uuid
import json
from app.database import init_db, get_db_connection
from app.services.escalation_manager import EscalationManager

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

def create_sample_trip():
    trip_id = f"trip_esc_{uuid.uuid4().hex[:6]}"
    token = uuid.uuid4().hex
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO trips (
        id, token, user_name, vehicle_plate, plate_photo_path, plate_photo_data,
        origin_lat, origin_lon, origin_name,
        destination_lat, destination_lon, destination_name, expected_arrival_time,
        buffer_minutes, trusted_contact_name, trusted_contact_phone, status,
        created_at, updated_at, expected_route, last_known_lat, last_known_lon,
        deviation_status, countdown_seconds_remaining, snooze_count, silent_distress_active
    ) VALUES (?, ?, 'Aarav', 'KA 04 MB 7821', 'plate_ka04.jpg', 'https://example.com/plate.jpg',
              13.0358, 77.5970, 'Hebbal', 13.2450, 77.6750, 'Airport', ?, 15,
              'Priya', '+919999999999', 'ACTIVE', ?, ?, '[]', 13.0358, 77.5970, 'OK', NULL, 0, 0)
    ''', (trip_id, token, now, now, now))
    conn.commit()
    conn.close()
    return trip_id

def test_escalation_lifecycle():
    trip_id = create_sample_trip()
    manager = EscalationManager(countdown_duration_sec=30, snooze_duration_sec=60, max_snoozes=2)

    # 1. Trigger warning
    warn_res = manager.trigger_warning(trip_id, "Route deviation detected")
    assert warn_res["deviation_status"] == "COUNTDOWN"
    assert warn_res["countdown_seconds_remaining"] == 30

    # 2. Process ticks
    tick_res = manager.process_countdown_tick(trip_id, seconds_passed=10)
    assert tick_res["countdown_seconds_remaining"] == 20
    assert tick_res["escalated"] is False

    # 3. Snooze
    snooze_res = manager.snooze_warning(trip_id)
    assert snooze_res["success"] is True
    assert snooze_res["countdown_seconds_remaining"] == 80  # 20 + 60
    assert snooze_res["snooze_count"] == 1

    # 4. User OK resolution
    ok_res = manager.resolve_user_ok(trip_id)
    assert ok_res["deviation_status"] == "OK"

def test_escalation_triggers_on_zero():
    trip_id = create_sample_trip()
    manager = EscalationManager(countdown_duration_sec=10)

    manager.trigger_warning(trip_id, "Drifted off course")
    escalated_res = manager.process_countdown_tick(trip_id, seconds_passed=15)
    assert escalated_res["escalated"] is True
    assert escalated_res["deviation_status"] == "ALERT_SENT"
    assert escalated_res["countdown_seconds_remaining"] == 0
    # Verifies both primary person alert and nearest police station dispatch were fired
    assert "primary_contact_alert" in escalated_res
    assert "police_station_alert" in escalated_res
    assert escalated_res["police_station"] is not None
    assert "Hebbal" in escalated_res["police_station"]["name"]

def test_missed_destination_alerts_primary_and_police():
    trip_id = create_sample_trip()
    manager = EscalationManager()

    res = manager.trigger_missed_destination(trip_id)
    assert res["destination_missed"] is True
    assert res["escalated"] is True
    assert res["primary_contact_alert"]["recipient_type"] == "PRIMARY_CONTACT"
    assert res["police_station_alert"]["recipient_type"] == "POLICE_STATION"
    assert res["police_dossier"] is not None
    assert res["plate_photo_url"] is not None
    assert "FIR-SOS-2026" in res["police_dossier"]["dispatch_id"]

def test_silent_distress():
    trip_id = create_sample_trip()
    manager = EscalationManager()

    distress_res = manager.trigger_silent_distress(trip_id)
    assert distress_res["silent_distress_active"] is True
    assert distress_res["deviation_status"] == "ALERT_SENT"
    assert distress_res["police_station"] is not None
