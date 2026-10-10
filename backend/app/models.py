from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
import datetime

# --- Auth & User Models ---
class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    phone: str
    primary_contact_name: str
    primary_contact_phone: str
    primary_contact_relation: str = "Partner / Family"

class UserLogin(BaseModel):
    email: str
    password: str

class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    primary_contact_name: str
    primary_contact_phone: str
    primary_contact_relation: str
    created_at: str

# --- Spots & Corridor Query ---
class SpotBase(BaseModel):
    name: str
    lat: float
    lon: float
    country: str = "India"
    region: str = "Karnataka"
    road_type: str = "national_highway"  # expressways, national_highway, state_highway, arterial, rural
    rating: float = Field(default=4.0, ge=1.0, le=5.0)
    avg_wait_min: float = 25.0
    median_wait_min: float = 20.0
    pull_off_safety: str = "Wide paved shoulder with clear line of sight (150m+)"
    best_times: str = "08:00 - 11:30 AM & 15:00 - 17:30 PM"
    features: List[str] = ["petrol_pump", "well_lit", "cctv"]
    source: str = "Hitchmap"
    license: str = "ODbL / CC-BY-SA 4.0 Hitchmap Community"
    flag_count: int = 0

class SpotCreate(SpotBase):
    pass

class Spot(SpotBase):
    id: str
    sample_count: int = 1
    distance_to_corridor_km: Optional[float] = None

class DestinationCorridorQuery(BaseModel):
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float
    dest_name: str

class SpotReview(BaseModel):
    id: Optional[str] = None
    spot_id: str
    wait_time_minutes: float
    rating: int = Field(default=4, ge=1, le=5)
    safety_rating: int = Field(default=4, ge=1, le=5)
    time_of_day_hour: int = 10
    day_of_week: int = 1  # 0=Mon, 6=Sun
    road_type: str = "national_highway"
    comments: Optional[str] = None
    created_at: Optional[str] = None

# --- Trips & Emergency Telemetry ---
class TripCreate(BaseModel):
    user_name: str
    user_id: Optional[str] = None
    vehicle_plate: str
    plate_photo_path: Optional[str] = None
    plate_photo_data: Optional[str] = None  # Base64 or image URI for evidence transmission
    origin_lat: float
    origin_lon: float
    origin_name: str
    destination_lat: float
    destination_lon: float
    destination_name: str
    expected_arrival_time: str
    buffer_minutes: int = 15
    trusted_contact_name: str
    trusted_contact_phone: str
    battery_level: Optional[int] = 95
    expected_route: Optional[List[List[float]]] = None  # [[lat, lon], ...]

class GPSPing(BaseModel):
    trip_id: str
    lat: float
    lon: float
    speed_kmh: float = 0.0
    accuracy_m: float = 5.0
    battery_pct: int = 90
    timestamp: Optional[str] = None
    is_offline_cached: bool = False

class Trip(BaseModel):
    id: str
    token: str
    user_name: str
    user_id: Optional[str] = None
    vehicle_plate: str
    plate_photo_path: Optional[str] = None
    plate_photo_data: Optional[str] = None
    origin_lat: float
    origin_lon: float
    origin_name: str
    destination_lat: float
    destination_lon: float
    destination_name: str
    expected_arrival_time: str
    buffer_minutes: int = 15
    trusted_contact_name: str
    trusted_contact_phone: str
    trusted_contact_accepted: bool = True
    status: str = "ACTIVE"  # ACTIVE, COMPLETED, CANCELLED, ESCALATED
    created_at: str
    updated_at: str
    expected_route: List[List[float]] = []
    last_known_lat: Optional[float] = None
    last_known_lon: Optional[float] = None
    last_known_speed: Optional[float] = None
    last_known_time: Optional[str] = None
    battery_level: Optional[int] = 100
    deviation_status: str = "OK"  # OK, WARNING, COUNTDOWN, ALERT_SENT
    countdown_seconds_remaining: Optional[int] = None
    countdown_started_at: Optional[str] = None
    snooze_count: int = 0
    silent_distress_active: bool = False
    destination_missed: bool = False
    nearest_police_id: Optional[str] = None
    police_alert_dispatched: bool = False
    police_dossier: Optional[Dict[str, Any]] = None
    tracking_link: Optional[str] = None

class AlertEvent(BaseModel):
    id: str
    trip_id: str
    alert_type: str  # TRIP_STARTED, DEVIATION_WARNING, DEVIATION_ESCALATION, MISSED_DESTINATION, SILENT_DISTRESS, SAFE_ARRIVAL
    recipient: str
    recipient_type: str = "PRIMARY_CONTACT"  # PRIMARY_CONTACT, POLICE_STATION
    police_station_name: Optional[str] = None
    message: str
    status: str = "QUEUED"  # QUEUED, SENT, FAILED
    retry_count: int = 0
    created_at: str
    sent_at: Optional[str] = None
    tracking_link: Optional[str] = None
    plate_photo_url: Optional[str] = None
    police_dossier_json: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

class OfflineQueueItem(BaseModel):
    id: str
    item_type: str  # GPS_PING, ALERT, TRIP_STATUS, REVIEW
    payload: Dict[str, Any]
    created_at: str
    retry_count: int = 0
    status: str = "QUEUED"  # QUEUED, SYNCED, FAILED
    last_attempt_at: Optional[str] = None

class WaitPredictionRequest(BaseModel):
    spot_id: Optional[str] = None
    lat: float
    lon: float
    region: str = "Karnataka"
    time_of_day_hour: int = 10
    day_of_week: int = 2
    road_type: str = "national_highway"
    has_petrol_station: bool = True
    has_cctv: bool = True
    has_street_light: bool = True
    traffic_density: str = "moderate"  # low, moderate, high

class WaitPredictionResponse(BaseModel):
    predicted_wait_min: float
    range_min: float
    range_max: float
    confidence: str  # HIGH, MEDIUM, LOW
    model_used: str  # ML_GRADIENT_BOOST or HEURISTIC_BASELINE
    bus_alternative_threshold_min: int
    regional_sample_count: int
    explanation: str

class FlagSpotRequest(BaseModel):
    spot_id: str
    reason: str

class UserExperienceCreate(BaseModel):
    user_name: str
    user_id: Optional[str] = None
    location: str            # origin location / starting city
    destination: str         # destination details
    pickup_spot: str         # from where did they get the ride
    wait_time_minutes: float # how much they had to wait there
    rating: float = 5.0      # 1 to 5 stars
    experience_notes: str    # narrative / tips
    driver_behavior: Optional[str] = "Friendly and respectful"
    vehicle_type: Optional[str] = "Car / Private Vehicle"

class UserExperience(UserExperienceCreate):
    id: str
    created_at: str

