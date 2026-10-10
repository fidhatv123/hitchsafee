import os

class Settings:
    APP_NAME: str = "HitchSafe"
    API_PREFIX: str = "/api"
    DB_PATH: str = os.getenv("HITCHSAFE_DB_PATH", "hitchsafe.db")
    
    # Deviation Thresholds (meters)
    DEVIATION_THRESHOLD_HIGHWAY: float = 350.0
    DEVIATION_THRESHOLD_URBAN: float = 180.0
    DEVIATION_THRESHOLD_RURAL: float = 500.0
    
    # Escalation Timings (seconds)
    ESCALATION_COUNTDOWN_SECONDS: int = 45  # Grace countdown before contact alert
    SNOOZE_EXTENSION_SECONDS: int = 120    # Grace extension upon user snooze
    MAX_SNOOZES: int = 2                   # Maximum allowed snoozes before forced escalation
    UNUSUAL_STOP_SECONDS: int = 240        # 4 minutes stationary triggers check
    MISSED_ARRIVAL_BUFFER_MINUTES: int = 15
    
    # Data Threshold for ML vs Baseline Heuristic
    ML_MIN_REGIONAL_SAMPLES: int = 10
    
    # Alert Provider
    USE_MOCK_ALERTS: bool = os.getenv("USE_MOCK_ALERTS", "true").lower() == "true"
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER: str = os.getenv("TWILIO_PHONE_NUMBER", "")
    
    # Live Tracking Public Base URL
    TRACKING_BASE_URL: str = os.getenv("TRACKING_BASE_URL", "http://localhost:8000/track")

settings = Settings()
