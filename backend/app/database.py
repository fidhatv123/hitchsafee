import sqlite3
import json
import uuid
import datetime
from typing import List, Dict, Any, Optional
from app.config import settings

def get_db_connection():
    conn = sqlite3.connect(settings.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        primary_contact_name TEXT NOT NULL,
        primary_contact_phone TEXT NOT NULL,
        primary_contact_relation TEXT DEFAULT 'Partner',
        created_at TEXT NOT NULL
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS police_stations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        phone TEXT NOT NULL,
        control_room TEXT NOT NULL,
        highway_unit TEXT NOT NULL
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS spots (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        country TEXT NOT NULL,
        region TEXT NOT NULL,
        road_type TEXT NOT NULL,
        rating REAL NOT NULL,
        avg_wait_min REAL NOT NULL,
        median_wait_min REAL NOT NULL,
        pull_off_safety TEXT NOT NULL,
        best_times TEXT NOT NULL,
        features TEXT NOT NULL,
        source TEXT NOT NULL,
        license TEXT NOT NULL,
        flag_count INTEGER DEFAULT 0,
        sample_count INTEGER DEFAULT 1
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS spot_reviews (
        id TEXT PRIMARY KEY,
        spot_id TEXT NOT NULL,
        wait_time_minutes REAL NOT NULL,
        rating INTEGER NOT NULL,
        safety_rating INTEGER NOT NULL,
        time_of_day_hour INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        road_type TEXT NOT NULL,
        comments TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(spot_id) REFERENCES spots(id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        user_name TEXT NOT NULL,
        user_id TEXT,
        vehicle_plate TEXT NOT NULL,
        plate_photo_path TEXT,
        plate_photo_data TEXT,
        origin_lat REAL NOT NULL,
        origin_lon REAL NOT NULL,
        origin_name TEXT NOT NULL,
        destination_lat REAL NOT NULL,
        destination_lon REAL NOT NULL,
        destination_name TEXT NOT NULL,
        expected_arrival_time TEXT NOT NULL,
        buffer_minutes INTEGER DEFAULT 15,
        trusted_contact_name TEXT NOT NULL,
        trusted_contact_phone TEXT NOT NULL,
        trusted_contact_accepted INTEGER DEFAULT 1,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expected_route TEXT NOT NULL,
        last_known_lat REAL,
        last_known_lon REAL,
        last_known_speed REAL,
        last_known_time TEXT,
        battery_level INTEGER DEFAULT 100,
        deviation_status TEXT DEFAULT 'OK',
        countdown_seconds_remaining INTEGER,
        countdown_started_at TEXT,
        snooze_count INTEGER DEFAULT 0,
        silent_distress_active INTEGER DEFAULT 0,
        destination_missed INTEGER DEFAULT 0,
        nearest_police_id TEXT,
        police_alert_dispatched INTEGER DEFAULT 0,
        police_dossier TEXT
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS gps_pings (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        speed_kmh REAL NOT NULL,
        accuracy_m REAL NOT NULL,
        battery_pct INTEGER NOT NULL,
        distance_from_route_m REAL NOT NULL,
        timestamp TEXT NOT NULL,
        is_offline_cached INTEGER DEFAULT 0,
        FOREIGN KEY(trip_id) REFERENCES trips(id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        recipient TEXT NOT NULL,
        recipient_type TEXT DEFAULT 'PRIMARY_CONTACT',
        police_station_name TEXT,
        message TEXT NOT NULL,
        status TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        sent_at TEXT,
        tracking_link TEXT,
        plate_photo_url TEXT,
        police_dossier_json TEXT,
        error_message TEXT,
        FOREIGN KEY(trip_id) REFERENCES trips(id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS offline_queue (
        id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        last_attempt_at TEXT
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS spot_flags (
        id TEXT PRIMARY KEY,
        spot_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(spot_id) REFERENCES spots(id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_experiences (
        id TEXT PRIMARY KEY,
        user_name TEXT NOT NULL,
        user_id TEXT,
        location TEXT NOT NULL,
        destination TEXT NOT NULL,
        pickup_spot TEXT NOT NULL,
        wait_time_minutes REAL NOT NULL,
        rating REAL DEFAULT 5.0,
        experience_notes TEXT NOT NULL,
        driver_behavior TEXT DEFAULT 'Friendly and respectful',
        vehicle_type TEXT DEFAULT 'Car / Private Vehicle',
        created_at TEXT NOT NULL
    )
    ''')

    # Safe column migrations if table already exists in database
    for col_def in [
        ("trips", "user_id", "TEXT"),
        ("trips", "plate_photo_data", "TEXT"),
        ("trips", "destination_missed", "INTEGER DEFAULT 0"),
        ("trips", "nearest_police_id", "TEXT"),
        ("trips", "police_alert_dispatched", "INTEGER DEFAULT 0"),
        ("trips", "police_dossier", "TEXT"),
        ("alerts", "recipient_type", "TEXT DEFAULT 'PRIMARY_CONTACT'"),
        ("alerts", "police_station_name", "TEXT"),
        ("alerts", "plate_photo_url", "TEXT"),
        ("alerts", "police_dossier_json", "TEXT")
    ]:
        try:
            cursor.execute(f"ALTER TABLE {col_def[0]} ADD COLUMN {col_def[1]} {col_def[2]}")
        except Exception:
            pass

    conn.commit()

    # Seed data
    cursor.execute("SELECT COUNT(*) FROM spots")
    if cursor.fetchone()[0] == 0:
        seed_default_data(conn)
    else:
        seed_police_and_users(conn)

    seed_experiences(conn)

    conn.close()

def seed_police_and_users(conn):
    cursor = conn.cursor()

    # Seed Police Stations
    police_stations = [
        {
            "id": "ps_blr_hebbal",
            "name": "Hebbal Law & Highway Patrol Police Station",
            "jurisdiction": "NH 44 North Corridor (Bengaluru City North)",
            "lat": 13.0360,
            "lon": 77.5980,
            "phone": "+91 80 2294 2531",
            "control_room": "112 / 100",
            "highway_unit": "NHAI Highway Intercept PCR-07"
        },
        {
            "id": "ps_blr_yelahanka",
            "name": "Yelahanka Traffic & Law Police Station",
            "jurisdiction": "NH 44 Yelahanka Bypass & Kogilu Cross",
            "lat": 13.1000,
            "lon": 77.5960,
            "phone": "+91 80 2294 2535",
            "control_room": "112",
            "highway_unit": "Highway Patrol PCR-12"
        },
        {
            "id": "ps_blr_bial",
            "name": "BIAL Airport Emergency Police Station",
            "jurisdiction": "Devanahalli & Kempegowda Airport Gate Zone",
            "lat": 13.2000,
            "lon": 77.6900,
            "phone": "+91 80 2201 2000",
            "control_room": "112 / 1033",
            "highway_unit": "Airport Expressway Intercept Unit"
        },
        {
            "id": "ps_blr_nelamangala",
            "name": "Nelamangala Rural Police Station",
            "jurisdiction": "NH 48 Westbound Corridor (Hassan / Mangaluru)",
            "lat": 13.0980,
            "lon": 77.3910,
            "phone": "+91 80 2772 2222",
            "control_room": "112",
            "highway_unit": "NH 48 Rural Highway Patrol 03"
        },
        {
            "id": "ps_blr_attibele",
            "name": "Attibele Border Police Station",
            "jurisdiction": "NH 44 South Karnataka-Tamil Nadu Border",
            "lat": 12.7820,
            "lon": 77.7700,
            "phone": "+91 80 2782 0222",
            "control_room": "112",
            "highway_unit": "Interstate Checkpost Patrol PCR-04"
        },
        {
            "id": "ps_mum_kalamboli",
            "name": "Kalamboli Highway Police Chowki",
            "jurisdiction": "Mumbai-Pune Expressway Entry Toll Layby",
            "lat": 19.0230,
            "lon": 73.1000,
            "phone": "+91 22 2742 1212",
            "control_room": "112 / 1033",
            "highway_unit": "Expressway Flying Squad 01"
        }
    ]

    for ps in police_stations:
        cursor.execute('''
        INSERT OR REPLACE INTO police_stations (id, name, jurisdiction, lat, lon, phone, control_room, highway_unit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (ps["id"], ps["name"], ps["jurisdiction"], ps["lat"], ps["lon"], ps["phone"], ps["control_room"], ps["highway_unit"]))

    # Seed Demo User: Aarav Nair
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute('''
    INSERT OR REPLACE INTO users (
        id, email, password_hash, name, phone, primary_contact_name, primary_contact_phone, primary_contact_relation, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        "user_demo_aarav",
        "aarav@hitchsafe.org",
        "safe123",
        "Aarav Nair",
        "+91 98765 43210",
        "Priya Nair",
        "+91 98450 12345",
        "Partner",
        now
    ))
    conn.commit()

def seed_experiences(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM user_experiences")
    if cursor.fetchone()[0] == 0:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        sample_experiences = [
            (
                "exp_001",
                "Aarav Nair",
                "user_demo_aarav",
                "Bengaluru (Mekhri Circle)",
                "Kempegowda Airport Gate (NH 44 North)",
                "Hebbal Flyover Exit Ramp (NH 44 North)",
                14.0,
                5.0,
                "Waited 14 mins next to the HP petrol pump layby. A polite tech commuter picked me up directly to Terminal 1. Very safe, well lit, and constant highway patrol presence.",
                "Professional commuter, offered bottle of water",
                "Sedan (Honda City)",
                now
            ),
            (
                "exp_002",
                "Pooja Reddy",
                None,
                "Yeshwanthpur Industrial Area",
                "Hassan / Sakleshpur",
                "Nelamangala Toll Plaza Layby (NH 48 West)",
                22.0,
                4.5,
                "Stood on the wide paved shoulder right after the toll gates. A family traveling to Hassan offered a lift. Car had plenty of room and driver was very courteous.",
                "Family traveling together, very kind",
                "SUV (Mahindra Scorpio)",
                now
            ),
            (
                "exp_003",
                "Devan Krishnan",
                None,
                "Electronic City Phase 1",
                "Hosur / Salem Highway",
                "Attibele Toll Gate (NH 44 South)",
                18.0,
                4.5,
                "Huge layby with truck stop dhabas. Took only 18 minutes on a Saturday morning. Logged plate photo on HitchSafe before boarding.",
                "Logistics supervisor, verified company vehicle",
                "Utility Van",
                now
            )
        ]
        cursor.executemany('''
        INSERT INTO user_experiences (
            id, user_name, user_id, location, destination, pickup_spot,
            wait_time_minutes, rating, experience_notes, driver_behavior,
            vehicle_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', sample_experiences)
        conn.commit()

def seed_default_data(conn):
    cursor = conn.cursor()

    seed_police_and_users(conn)

    # Seed spots: Open Hitchmap Data (ODbL / CC-BY-SA 4.0) + Curated Indian and International Highway spots
    seed_spots = [
        {
            "id": "spot_blr_nh44_hebbal",
            "name": "Hebbal Flyover Exit Ramp (NH 44 North)",
            "lat": 13.0358,
            "lon": 77.5970,
            "country": "India",
            "region": "Karnataka",
            "road_type": "national_highway",
            "rating": 4.5,
            "avg_wait_min": 18.0,
            "median_wait_min": 15.0,
            "pull_off_safety": "Paved service lane with high visibility, 50m before toll plaza. Constant police patrolling and CCTV.",
            "best_times": "07:30 - 10:30 AM (morning commuters & long haul freight)",
            "features": ["cctv", "petrol_pump", "well_lit", "bus_stop_nearby", "tea_stall"],
            "source": "Hitchmap & Local Community",
            "license": "ODbL / CC-BY-SA 4.0 Hitchmap Community",
            "sample_count": 28
        },
        {
            "id": "spot_blr_nh48_nelamangala",
            "name": "Nelamangala Toll Plaza Layby (NH 48 West towards Hassan/Mangaluru)",
            "lat": 13.0964,
            "lon": 77.3884,
            "country": "India",
            "region": "Karnataka",
            "road_type": "national_highway",
            "rating": 4.2,
            "avg_wait_min": 24.0,
            "median_wait_min": 20.0,
            "pull_off_safety": "Broad truck rest stop right after the toll gates. Cars slow down to 20 km/h.",
            "best_times": "08:00 - 12:00 PM on weekends",
            "features": ["petrol_pump", "cctv", "food_stall", "drinking_water", "well_lit"],
            "source": "Hitchmap",
            "license": "ODbL / CC-BY-SA 4.0 Hitchmap Community",
            "sample_count": 22
        },
        {
            "id": "spot_blr_hosur_attibele",
            "name": "Attibele Toll Gate (NH 44 South towards Salem/Chennai)",
            "lat": 12.7801,
            "lon": 77.7682,
            "country": "India",
            "region": "Karnataka",
            "road_type": "national_highway",
            "rating": 4.1,
            "avg_wait_min": 22.0,
            "median_wait_min": 19.0,
            "pull_off_safety": "Wide asphalt shoulder 100m after Karnataka-Tamil Nadu checkpost. High visibility.",
            "best_times": "06:00 - 09:30 AM",
            "features": ["petrol_pump", "cctv", "well_lit", "dhabas"],
            "source": "Hitchmap & Hitchr",
            "license": "ODbL / CC-BY-SA 4.0 Hitchmap Community",
            "sample_count": 19
        },
        {
            "id": "spot_mysore_nanjangud_nh766",
            "name": "Nanjangud Bypass Junction (NH 766 towards Wayanad/Kerala)",
            "lat": 12.1285,
            "lon": 76.6853,
            "country": "India",
            "region": "Karnataka",
            "road_type": "state_highway",
            "rating": 3.8,
            "avg_wait_min": 32.0,
            "median_wait_min": 28.0,
            "pull_off_safety": "Gravel shoulder before forest checkpoint. Daylight recommended.",
            "best_times": "09:00 AM - 01:00 PM (before Bandipur night closure)",
            "features": ["forest_checkpost", "tea_stall", "daylight_only"],
            "source": "User-Submitted (Verified)",
            "license": "ODbL / CC-BY-SA 4.0 Hitchmap Community",
            "sample_count": 14
        },
        {
            "id": "spot_mum_pune_expressway",
            "name": "Kalamboli McD Circle (Mumbai-Pune Expressway Start)",
            "lat": 19.0222,
            "lon": 73.0991,
            "country": "India",
            "region": "Maharashtra",
            "road_type": "expressways",
            "rating": 4.6,
            "avg_wait_min": 14.0,
            "median_wait_min": 12.0,
            "pull_off_safety": "Famous designated pickup layby before expressway barrier. Street lighting & food outlets.",
            "best_times": "06:30 - 10:00 AM and Friday evening 17:00 - 20:00",
            "features": ["food_court", "petrol_pump", "well_lit", "cctv", "high_traffic"],
            "source": "Hitchmap",
            "license": "ODbL / CC-BY-SA 4.0 Hitchmap Community",
            "sample_count": 35
        },
        {
            "id": "spot_delhi_gurugram_nh48",
            "name": "Kherki Daula Toll Slip Road (NH 48 towards Jaipur)",
            "lat": 28.4069,
            "lon": 76.9855,
            "country": "India",
            "region": "Haryana",
            "road_type": "national_highway",
            "rating": 4.0,
            "avg_wait_min": 26.0,
            "median_wait_min": 22.0,
            "pull_off_safety": "Spacious service lane past police booth. Avoid late night hours.",
            "best_times": "08:00 - 11:00 AM",
            "features": ["cctv", "police_booth", "petrol_pump"],
            "source": "Hitchmap",
            "license": "ODbL / CC-BY-SA 4.0 Hitchmap Community",
            "sample_count": 18
        },
        {
            "id": "spot_berlin_dreilinden_a115",
            "name": "Berlin Dreilinden Raststätte (A115 Southbound)",
            "lat": 52.4172,
            "lon": 13.1972,
            "country": "Germany",
            "region": "Brandenburg",
            "road_type": "highway",
            "rating": 4.8,
            "avg_wait_min": 12.0,
            "median_wait_min": 10.0,
            "pull_off_safety": "Historic motorway service station with massive parking and gas station.",
            "best_times": "All day, peak 09:00 - 14:00",
            "features": ["petrol_pump", "restaurant", "cctv", "toilets", "wifi"],
            "source": "Hitchmap (Classic)",
            "license": "ODbL / CC-BY-SA 4.0 Hitchmap Community",
            "sample_count": 110
        },
        {
            "id": "spot_lyon_peage_a6",
            "name": "Péage de Villefranche-Limas (A6 towards Paris)",
            "lat": 45.9754,
            "lon": 4.7088,
            "country": "France",
            "region": "Rhône-Alpes",
            "road_type": "highway",
            "rating": 4.7,
            "avg_wait_min": 15.0,
            "median_wait_min": 12.0,
            "pull_off_safety": "Directly past the toll booths with a dedicated hitching walkway and barrier.",
            "best_times": "10:00 AM - 16:00 PM",
            "features": ["toll_booth", "safe_walkway", "rest_area", "cctv"],
            "source": "Hitchmap",
            "license": "ODbL / CC-BY-SA 4.0 Hitchmap Community",
            "sample_count": 95
        }
    ]

    for s in seed_spots:
        cursor.execute('''
        INSERT OR REPLACE INTO spots (
            id, name, lat, lon, country, region, road_type, rating,
            avg_wait_min, median_wait_min, pull_off_safety, best_times,
            features, source, license, flag_count, sample_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            s["id"], s["name"], s["lat"], s["lon"], s["country"], s["region"],
            s["road_type"], s["rating"], s["avg_wait_min"], s["median_wait_min"],
            s["pull_off_safety"], s["best_times"], json.dumps(s["features"]),
            s["source"], s["license"], 0, s["sample_count"]
        ))

    base_reviews = [
        ("spot_blr_nh44_hebbal", 15.0, 5, 5, 8, 1, "national_highway", "Picked up by a tech car heading to Hyderabad."),
        ("spot_blr_nh44_hebbal", 20.0, 4, 4, 9, 2, "national_highway", "Fast ride, safe shoulder."),
        ("spot_blr_nh44_hebbal", 12.0, 5, 5, 10, 3, "national_highway", "Very quick, truck driver was very polite."),
        ("spot_blr_nh44_hebbal", 25.0, 4, 4, 14, 4, "national_highway", "Afternoon lull, took 25 min."),
        ("spot_blr_nh44_hebbal", 18.0, 4, 5, 8, 5, "national_highway", "Regular commuter gave me a lift."),
        ("spot_blr_nh48_nelamangala", 18.0, 4, 4, 8, 5, "national_highway", "Easy catch near toll booths."),
        ("spot_blr_nh48_nelamangala", 30.0, 3, 4, 13, 2, "national_highway", "Warm afternoon, waited 30m."),
        ("spot_blr_nh48_nelamangala", 22.0, 4, 4, 9, 6, "national_highway", "Weekend crowd heading to hills."),
        ("spot_blr_nh48_nelamangala", 15.0, 5, 4, 10, 0, "national_highway", "Cargo lorry was happy for company."),
        ("spot_mum_pune_expressway", 10.0, 5, 5, 7, 4, "expressways", "Huge commuter flow."),
        ("spot_mum_pune_expressway", 12.0, 5, 5, 9, 5, "expressways", "Friday evening ride to Pune."),
        ("spot_mum_pune_expressway", 16.0, 4, 5, 15, 2, "expressways", "Decent wait time."),
        ("spot_delhi_gurugram_nh48", 22.0, 4, 4, 8, 1, "national_highway", "Commercial cab shared empty seats."),
        ("spot_delhi_gurugram_nh48", 35.0, 3, 3, 17, 3, "national_highway", "Heavy traffic slowed pickups."),
        ("spot_mysore_nanjangud_nh766", 28.0, 4, 4, 9, 1, "state_highway", "Tourist SUV heading to Wayanad."),
        ("spot_mysore_nanjangud_nh766", 45.0, 3, 3, 16, 4, "state_highway", "Approaching forest closing time, less cars."),
        ("spot_berlin_dreilinden_a115", 8.0, 5, 5, 10, 2, "highway", "Great spot, huge gas station."),
        ("spot_berlin_dreilinden_a115", 14.0, 5, 5, 12, 4, "highway", "Lift straight to Leipzig."),
        ("spot_lyon_peage_a6", 11.0, 5, 5, 11, 3, "highway", "Trucker bought me coffee and drove to Beaune.")
    ]

    for br in base_reviews:
        review_id = str(uuid.uuid4())
        cursor.execute('''
        INSERT INTO spot_reviews (
            id, spot_id, wait_time_minutes, rating, safety_rating,
            time_of_day_hour, day_of_week, road_type, comments, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            review_id, br[0], br[1], br[2], br[3], br[4], br[5], br[6], br[7],
            datetime.datetime.now(datetime.timezone.utc).isoformat()
        ))

    conn.commit()

init_db()
