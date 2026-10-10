import datetime
import json
from typing import Dict, Any, Optional
from app.config import settings
from app.database import get_db_connection
from app.services.alert_queue import alert_queue
from app.services.police_service import police_service

class EscalationManager:
    """
    Manages in-ride escalation lifecycle, countdowns, snoozing, and dual-dispatch:
    1. Primary Emergency Contact (with plate photo evidence & tracking link)
    2. Nearest Police Station (with official emergency dispatch dossier & plate photo)
    """
    def __init__(self,
                 countdown_duration_sec: int = settings.ESCALATION_COUNTDOWN_SECONDS,
                 snooze_duration_sec: int = settings.SNOOZE_EXTENSION_SECONDS,
                 max_snoozes: int = settings.MAX_SNOOZES):
        self.countdown_duration_sec = countdown_duration_sec
        self.snooze_duration_sec = snooze_duration_sec
        self.max_snoozes = max_snoozes

    def trigger_warning(self, trip_id: str, reason: str) -> Dict[str, Any]:
        """Trigger 'Are you okay?' warning and start countdown."""
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT deviation_status, countdown_seconds_remaining FROM trips WHERE id = ?", (trip_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise ValueError(f"Trip {trip_id} not found")

        current_status = row["deviation_status"]
        if current_status in ["COUNTDOWN", "ALERT_SENT"]:
            conn.close()
            return {"trip_id": trip_id, "deviation_status": current_status, "already_active": True}

        cursor.execute('''
        UPDATE trips
        SET deviation_status = 'COUNTDOWN',
            countdown_seconds_remaining = ?,
            countdown_started_at = ?,
            updated_at = ?
        WHERE id = ?
        ''', (self.countdown_duration_sec, now, now, trip_id))
        conn.commit()
        conn.close()

        return {
            "trip_id": trip_id,
            "deviation_status": "COUNTDOWN",
            "countdown_seconds_remaining": self.countdown_duration_sec,
            "reason": reason,
            "started_at": now
        }

    def _execute_dual_safety_escalation(self, trip: Dict[str, Any], alert_reason: str) -> Dict[str, Any]:
        """
        Executes required dual safety escalation:
        1. Alerts Primary Contact person with plate photo & live tracking link.
        2. Transmits emergency dispatch dossier with plate photo to Nearest Police Station.
        """
        trip_id = trip["id"]
        lat = trip.get("last_known_lat") or trip.get("origin_lat") or 13.0358
        lon = trip.get("last_known_lon") or trip.get("origin_lon") or 77.5970
        tracking_link = f"{settings.TRACKING_BASE_URL}/{trip['token']}"
        plate_photo = trip.get("plate_photo_data") or trip.get("plate_photo_path")

        # 1. Look up nearest police station & generate official dossier
        station = police_service.find_nearest_station(lat, lon)
        dossier = police_service.generate_police_dossier(trip, lat, lon, alert_reason)

        # 2. Alert to Primary Contact Person
        primary_msg = (
            f"EMERGENCY SAFETY ALERT (HitchSafe): {trip['user_name']} has not arrived safely at "
            f"{trip['destination_name']}. Vehicle plate: {trip['vehicle_plate']} (Photo attached). "
            f"Last GPS: {lat:.5f}, {lon:.5f}. "
            f"Nearest Police Station ({station['name']}) has been alerted. "
            f"Live Tracking: {tracking_link}"
        )

        primary_alert_res = alert_queue.dispatch_or_enqueue(
            trip_id=trip_id,
            recipient=trip["trusted_contact_phone"],
            message=primary_msg,
            alert_type="MISSED_DESTINATION_ESCALATION",
            tracking_link=tracking_link,
            plate_photo_url=plate_photo,
            recipient_type="PRIMARY_CONTACT"
        )

        # 3. Alert to Nearest Police Station
        police_msg = (
            f"[POLICE EMERGENCY SOS DISPATCH - Case {dossier['dispatch_id']}] "
            f"Hitchhiker {trip['user_name']} overdue / missed destination at {trip['destination_name']}. "
            f"Vehicle Plate: {trip['vehicle_plate']} (Photo of number plate evidence attached). "
            f"Last known GPS: {lat:.5f}, {lon:.5f} ({station['distance_km']}km from your station). "
            f"Assigned Patrol Unit: {station['highway_unit']}."
        )

        police_alert_res = alert_queue.dispatch_or_enqueue(
            trip_id=trip_id,
            recipient=f"{station['name']} Emergency Control ({station['control_room']})",
            message=police_msg,
            alert_type="POLICE_EMERGENCY_DISPATCH",
            tracking_link=tracking_link,
            plate_photo_url=plate_photo,
            recipient_type="POLICE_STATION",
            police_station_name=station["name"],
            police_dossier_json=dossier
        )

        # 4. Update trip in database
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        UPDATE trips
        SET deviation_status = 'ALERT_SENT',
            countdown_seconds_remaining = 0,
            destination_missed = 1,
            nearest_police_id = ?,
            police_alert_dispatched = 1,
            police_dossier = ?,
            updated_at = ?
        WHERE id = ?
        ''', (station["id"], json.dumps(dossier), now, trip_id))
        conn.commit()
        conn.close()

        return {
            "escalated": True,
            "primary_contact_alert": primary_alert_res,
            "police_station_alert": police_alert_res,
            "police_station": station,
            "police_dossier": dossier,
            "plate_photo_url": plate_photo
        }

    def process_countdown_tick(self, trip_id: str, seconds_passed: int = 1) -> Dict[str, Any]:
        """Decrements countdown timer. If zero, executes dual safety escalation."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        SELECT id, token, user_name, vehicle_plate, plate_photo_path, plate_photo_data,
               trusted_contact_name, trusted_contact_phone, last_known_lat, last_known_lon,
               origin_lat, origin_lon, deviation_status, countdown_seconds_remaining,
               origin_name, destination_name, expected_arrival_time
        FROM trips WHERE id = ?
        ''', (trip_id,))
        trip_row = cursor.fetchone()
        conn.close()

        if not trip_row:
            raise ValueError(f"Trip {trip_id} not found")

        trip = dict(trip_row)
        if trip["deviation_status"] != "COUNTDOWN":
            return {"trip_id": trip_id, "deviation_status": trip["deviation_status"], "escalated": False}

        rem = (trip["countdown_seconds_remaining"] or self.countdown_duration_sec) - seconds_passed
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if rem <= 0:
            escalation_details = self._execute_dual_safety_escalation(
                trip=trip,
                alert_reason=f"Route deviation countdown expired without confirmation en route to {trip['destination_name']}"
            )
            return {
                "trip_id": trip_id,
                "deviation_status": "ALERT_SENT",
                "countdown_seconds_remaining": 0,
                **escalation_details
            }
        else:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''
            UPDATE trips
            SET countdown_seconds_remaining = ?,
                updated_at = ?
            WHERE id = ?
            ''', (rem, now, trip_id))
            conn.commit()
            conn.close()

            return {
                "trip_id": trip_id,
                "deviation_status": "COUNTDOWN",
                "countdown_seconds_remaining": rem,
                "escalated": False
            }

    def trigger_missed_destination(self, trip_id: str) -> Dict[str, Any]:
        """
        Explicitly triggers missed destination escalation:
        - Sends alert with plate photo to primary person.
        - Transmits details to nearest police station.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        SELECT id, token, user_name, vehicle_plate, plate_photo_path, plate_photo_data,
               trusted_contact_name, trusted_contact_phone, last_known_lat, last_known_lon,
               origin_lat, origin_lon, deviation_status, countdown_seconds_remaining,
               origin_name, destination_name, expected_arrival_time
        FROM trips WHERE id = ?
        ''', (trip_id,))
        trip_row = cursor.fetchone()
        conn.close()

        if not trip_row:
            raise ValueError(f"Trip {trip_id} not found")

        trip = dict(trip_row)
        escalation_details = self._execute_dual_safety_escalation(
            trip=trip,
            alert_reason=f"Traveler has NOT reached specified destination: {trip['destination_name']} by scheduled deadline."
        )
        return {
            "trip_id": trip_id,
            "deviation_status": "ALERT_SENT",
            "destination_missed": True,
            **escalation_details
        }

    def resolve_user_ok(self, trip_id: str, note: Optional[str] = "User tapped I am OK") -> Dict[str, Any]:
        """User confirms they are safe, resetting warning status."""
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        UPDATE trips
        SET deviation_status = 'OK',
            countdown_seconds_remaining = NULL,
            countdown_started_at = NULL,
            updated_at = ?
        WHERE id = ?
        ''', (now, trip_id))
        conn.commit()
        conn.close()

        return {
            "trip_id": trip_id,
            "deviation_status": "OK",
            "message": "Status reset to normal. Glad you are safe!",
            "note": note
        }

    def snooze_warning(self, trip_id: str) -> Dict[str, Any]:
        """User snoozes the countdown."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT snooze_count, countdown_seconds_remaining FROM trips WHERE id = ?", (trip_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise ValueError(f"Trip {trip_id} not found")

        snooze_count = row["snooze_count"]
        if snooze_count >= self.max_snoozes:
            conn.close()
            return {
                "success": False,
                "message": f"Maximum snoozes ({self.max_snoozes}) reached. Please verify safety.",
                "snooze_count": snooze_count
            }

        new_count = snooze_count + 1
        current_rem = row["countdown_seconds_remaining"] or 0
        new_rem = current_rem + self.snooze_duration_sec
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        cursor.execute('''
        UPDATE trips
        SET snooze_count = ?,
            countdown_seconds_remaining = ?,
            updated_at = ?
        WHERE id = ?
        ''', (new_count, new_rem, now, trip_id))
        conn.commit()
        conn.close()

        return {
            "success": True,
            "trip_id": trip_id,
            "snooze_count": new_count,
            "countdown_seconds_remaining": new_rem,
            "extension_sec": self.snooze_duration_sec
        }

    def trigger_silent_distress(self, trip_id: str) -> Dict[str, Any]:
        """Disguised calculator distress mode: covertly triggers emergency alert."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        SELECT id, token, user_name, vehicle_plate, plate_photo_path, plate_photo_data,
               trusted_contact_name, trusted_contact_phone, last_known_lat, last_known_lon,
               origin_lat, origin_lon, origin_name, destination_name, expected_arrival_time
        FROM trips WHERE id = ?
        ''', (trip_id,))
        trip_row = cursor.fetchone()
        conn.close()

        if not trip_row:
            raise ValueError(f"Trip {trip_id} not found")

        trip = dict(trip_row)
        escalation_details = self._execute_dual_safety_escalation(
            trip=trip,
            alert_reason=f"COVERT DISTRESS SOS: Hitchhiker silently triggered emergency distress code via disguised interface."
        )

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE trips SET silent_distress_active = 1 WHERE id = ?", (trip_id,))
        conn.commit()
        conn.close()

        return {
            "trip_id": trip_id,
            "silent_distress_active": True,
            "deviation_status": "ALERT_SENT",
            **escalation_details
        }

    def check_missed_arrival(self, trip_id: str) -> Dict[str, Any]:
        """Checks if trip is overdue past expected_arrival_time + buffer_minutes."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        SELECT id, token, user_name, vehicle_plate, plate_photo_path, plate_photo_data,
               trusted_contact_name, trusted_contact_phone, destination_name, origin_name,
               expected_arrival_time, buffer_minutes, status, last_known_lat, last_known_lon,
               origin_lat, origin_lon
        FROM trips WHERE id = ?
        ''', (trip_id,))
        trip_row = cursor.fetchone()
        conn.close()

        if not trip_row or trip_row["status"] != "ACTIVE":
            return {"is_missed": False, "reason": "Trip not active"}

        trip = dict(trip_row)
        try:
            expected_dt = datetime.datetime.fromisoformat(trip["expected_arrival_time"])
        except Exception:
            return {"is_missed": False, "reason": "Invalid arrival timestamp"}

        if expected_dt.tzinfo is None:
            expected_dt = expected_dt.replace(tzinfo=datetime.timezone.utc)

        buffer_delta = datetime.timedelta(minutes=trip.get("buffer_minutes") or 15)
        deadline = expected_dt + buffer_delta
        now_dt = datetime.datetime.now(datetime.timezone.utc)

        if now_dt > deadline:
            escalation_details = self._execute_dual_safety_escalation(
                trip=trip,
                alert_reason=f"MISSED ARRIVAL DEADLINE: Expected at {trip['destination_name']} by {deadline.strftime('%H:%M UTC')} but check-in was not confirmed."
            )
            return {"is_missed": True, **escalation_details}

        return {"is_missed": False, "deadline": deadline.isoformat()}

escalation_manager = EscalationManager()
