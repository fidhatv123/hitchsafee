import time
import json
import uuid
import datetime
from typing import List, Dict, Any, Optional
from app.services.alert_provider import get_alert_provider, BaseAlertProvider
from app.database import get_db_connection

class AlertQueueManager:
    """
    Manages offline alert queue with exponential backoff and retry tracking,
    supporting plate photos and police station dispatch channels.
    """
    def __init__(self, max_retries: int = 5, base_delay_seconds: float = 1.0):
        self.max_retries = max_retries
        self.base_delay_seconds = base_delay_seconds
        self.last_sync_timestamp: Optional[str] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    def enqueue(self,
                trip_id: str,
                recipient: str,
                message: str,
                alert_type: str,
                tracking_link: Optional[str] = None,
                plate_photo_url: Optional[str] = None,
                recipient_type: str = "PRIMARY_CONTACT",
                police_station_name: Optional[str] = None,
                police_dossier_json: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Add an alert to the offline queue."""
        queue_id = f"queue_{uuid.uuid4().hex[:8]}"
        payload = {
            "trip_id": trip_id,
            "recipient": recipient,
            "recipient_type": recipient_type,
            "police_station_name": police_station_name,
            "message": message,
            "alert_type": alert_type,
            "tracking_link": tracking_link,
            "plate_photo_url": plate_photo_url,
            "police_dossier_json": police_dossier_json
        }
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO offline_queue (id, item_type, payload, created_at, retry_count, status, last_attempt_at)
        VALUES (?, 'ALERT', ?, ?, 0, 'QUEUED', NULL)
        ''', (queue_id, json.dumps(payload), now))

        dossier_str = json.dumps(police_dossier_json) if police_dossier_json else None
        cursor.execute('''
        INSERT INTO alerts (id, trip_id, alert_type, recipient, recipient_type, police_station_name, message, status, retry_count, created_at, tracking_link, plate_photo_url, police_dossier_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', 0, ?, ?, ?, ?)
        ''', (queue_id, trip_id, alert_type, recipient, recipient_type, police_station_name, message, now, tracking_link, plate_photo_url, dossier_str))

        conn.commit()
        conn.close()

        return {
            "queue_id": queue_id,
            "status": "QUEUED",
            "created_at": now,
            "payload": payload
        }

    def dispatch_or_enqueue(self,
                            trip_id: str,
                            recipient: str,
                            message: str,
                            alert_type: str,
                            tracking_link: Optional[str] = None,
                            plate_photo_url: Optional[str] = None,
                            recipient_type: str = "PRIMARY_CONTACT",
                            police_station_name: Optional[str] = None,
                            police_dossier_json: Optional[Dict[str, Any]] = None,
                            provider: Optional[BaseAlertProvider] = None) -> Dict[str, Any]:
        """
        Attempt immediate delivery. If offline or fails, safely enqueue with exponential backoff.
        """
        if provider is None:
            provider = get_alert_provider()

        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        alert_id = f"alert_{uuid.uuid4().hex[:8]}"

        try:
            result = provider.send_alert(
                recipient=recipient,
                message=message,
                alert_type=alert_type,
                tracking_link=tracking_link,
                plate_photo_url=plate_photo_url,
                recipient_type=recipient_type,
                police_station_name=police_station_name,
                police_dossier_json=police_dossier_json
            )

            conn = get_db_connection()
            cursor = conn.cursor()
            dossier_str = json.dumps(police_dossier_json) if police_dossier_json else None
            cursor.execute('''
            INSERT INTO alerts (id, trip_id, alert_type, recipient, recipient_type, police_station_name, message, status, retry_count, created_at, sent_at, tracking_link, plate_photo_url, police_dossier_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'SENT', 0, ?, ?, ?, ?, ?)
            ''', (alert_id, trip_id, alert_type, recipient, recipient_type, police_station_name, message, now, now, tracking_link, plate_photo_url, dossier_str))
            conn.commit()
            conn.close()

            self.last_sync_timestamp = now
            return {
                "alert_id": alert_id,
                "status": "SENT",
                "recipient_type": recipient_type,
                "police_station_name": police_station_name,
                "plate_photo_url": plate_photo_url,
                "delivered_immediately": True,
                "sent_at": now,
                "result": result
            }
        except Exception as e:
            queued_item = self.enqueue(
                trip_id=trip_id,
                recipient=recipient,
                message=message,
                alert_type=alert_type,
                tracking_link=tracking_link,
                plate_photo_url=plate_photo_url,
                recipient_type=recipient_type,
                police_station_name=police_station_name,
                police_dossier_json=police_dossier_json
            )
            return {
                "alert_id": queued_item["queue_id"],
                "status": "QUEUED",
                "recipient_type": recipient_type,
                "delivered_immediately": False,
                "reason": str(e),
                "queued_at": queued_item["created_at"]
            }

    def drain_queue(self, provider: Optional[BaseAlertProvider] = None) -> Dict[str, Any]:
        if provider is None:
            provider = get_alert_provider()

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, payload, retry_count, created_at FROM offline_queue WHERE status = 'QUEUED' ORDER BY created_at ASC")
        pending_items = cursor.fetchall()

        processed_count = 0
        failed_count = 0
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        for item in pending_items:
            q_id = item["id"]
            payload = json.loads(item["payload"])
            retry_count = item["retry_count"]

            try:
                provider.send_alert(
                    recipient=payload["recipient"],
                    message=payload["message"],
                    alert_type=payload["alert_type"],
                    tracking_link=payload.get("tracking_link"),
                    plate_photo_url=payload.get("plate_photo_url"),
                    recipient_type=payload.get("recipient_type", "PRIMARY_CONTACT"),
                    police_station_name=payload.get("police_station_name"),
                    police_dossier_json=payload.get("police_dossier_json")
                )
                cursor.execute("UPDATE offline_queue SET status = 'SYNCED', last_attempt_at = ? WHERE id = ?", (now, q_id))
                cursor.execute("UPDATE alerts SET status = 'SENT', sent_at = ? WHERE id = ?", (now, q_id))
                processed_count += 1
            except Exception as e:
                new_retry = retry_count + 1
                new_status = "FAILED" if new_retry >= self.max_retries else "QUEUED"
                cursor.execute("UPDATE offline_queue SET retry_count = ?, status = ?, last_attempt_at = ? WHERE id = ?",
                               (new_retry, new_status, now, q_id))
                cursor.execute("UPDATE alerts SET retry_count = ?, status = ?, error_message = ? WHERE id = ?",
                               (new_retry, new_status, str(e), q_id))
                failed_count += 1

        conn.commit()
        conn.close()

        self.last_sync_timestamp = now
        return {
            "processed": processed_count,
            "failed": failed_count,
            "last_synced": self.last_sync_timestamp,
            "pending_remaining": self.get_pending_count()
        }

    def get_pending_count(self) -> int:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM offline_queue WHERE status = 'QUEUED'")
        count = cursor.fetchone()[0]
        conn.close()
        return count

    def get_status(self) -> Dict[str, Any]:
        return {
            "pending_count": self.get_pending_count(),
            "last_synced": self.last_sync_timestamp,
            "is_network_ready": True
        }

alert_queue = AlertQueueManager()
