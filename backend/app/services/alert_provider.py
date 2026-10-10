from abc import ABC, abstractmethod
import datetime
import uuid
import logging
from typing import Dict, Any, Optional, List
from app.config import settings

logger = logging.getLogger("hitchsafe.alerts")

class BaseAlertProvider(ABC):
    @abstractmethod
    def send_alert(self,
                   recipient: str,
                   message: str,
                   alert_type: str,
                   tracking_link: Optional[str] = None,
                   plate_photo_url: Optional[str] = None,
                   recipient_type: str = "PRIMARY_CONTACT",
                   police_station_name: Optional[str] = None,
                   police_dossier_json: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send an SMS, Push notification, or Police Dispatch dossier."""
        pass

class MockAlertProvider(BaseAlertProvider):
    """
    Mock alert provider for hackathon MVP and offline testing.
    Keeps an in-memory dispatch log and allows simulating network failures.
    """
    def __init__(self):
        self.dispatch_log: List[Dict[str, Any]] = []
        self.is_network_online: bool = True

    def set_network_status(self, is_online: bool):
        self.is_network_online = is_online

    def send_alert(self,
                   recipient: str,
                   message: str,
                   alert_type: str,
                   tracking_link: Optional[str] = None,
                   plate_photo_url: Optional[str] = None,
                   recipient_type: str = "PRIMARY_CONTACT",
                   police_station_name: Optional[str] = None,
                   police_dossier_json: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.is_network_online:
            raise ConnectionError("Simulated Network Offline: Alert queued for reconnect")

        alert_record = {
            "id": f"mock_sms_{uuid.uuid4().hex[:8]}",
            "recipient": recipient,
            "recipient_type": recipient_type,
            "police_station_name": police_station_name,
            "message": message,
            "alert_type": alert_type,
            "tracking_link": tracking_link,
            "plate_photo_url": plate_photo_url,
            "police_dossier": police_dossier_json,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "status": "DELIVERED",
            "channel": "POLICE_DISPATCH_NET" if recipient_type == "POLICE_STATION" else "SMS_MOCK"
        }
        self.dispatch_log.append(alert_record)
        logger.info(f"[{alert_record['channel']} DISPATCHED to {recipient}] [{alert_type}] {message} | Plate Photo: {plate_photo_url is not None}")
        return {
            "success": True,
            "message_id": alert_record["id"],
            "recipient": recipient,
            "recipient_type": recipient_type,
            "police_station_name": police_station_name,
            "plate_photo_url": plate_photo_url,
            "status": "DELIVERED",
            "timestamp": alert_record["timestamp"]
        }

    def get_recent_alerts(self, limit: int = 50) -> List[Dict[str, Any]]:
        return list(reversed(self.dispatch_log[-limit:]))

class TwilioAlertProvider(BaseAlertProvider):
    """Real Twilio SMS integration behind the provider interface."""
    def __init__(self, account_sid: str, auth_token: str, from_phone: str):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_phone = from_phone
        self.client = None
        try:
            from twilio.rest import Client
            self.client = Client(account_sid, auth_token)
        except Exception as e:
            logger.warning(f"Could not initialize Twilio client: {e}. Will fallback to Mock.")

    def send_alert(self,
                   recipient: str,
                   message: str,
                   alert_type: str,
                   tracking_link: Optional[str] = None,
                   plate_photo_url: Optional[str] = None,
                   recipient_type: str = "PRIMARY_CONTACT",
                   police_station_name: Optional[str] = None,
                   police_dossier_json: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.client:
            raise RuntimeError("Twilio client is not initialized")

        full_body = message
        if tracking_link:
            full_body += f"\nLive tracking: {tracking_link}"
        if plate_photo_url and len(plate_photo_url) < 300:
            full_body += f"\nPlate photo evidence: {plate_photo_url}"

        msg = self.client.messages.create(
            to=recipient,
            from_=self.from_phone,
            body=full_body
        )
        return {
            "success": True,
            "message_id": msg.sid,
            "recipient": recipient,
            "status": msg.status,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

mock_provider = MockAlertProvider()

def get_alert_provider() -> BaseAlertProvider:
    if settings.USE_MOCK_ALERTS or not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN):
        return mock_provider
    try:
        return TwilioAlertProvider(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN,
            settings.TWILIO_PHONE_NUMBER
        )
    except Exception:
        return mock_provider
