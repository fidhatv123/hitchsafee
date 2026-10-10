import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

import uuid

def test_auth_registration_and_login():
    client = TestClient(app)

    unique_email = f"kavya_{uuid.uuid4().hex[:6]}@test.com"
    # 1. Register new user
    reg_payload = {
        "name": "Kavya Sharma",
        "email": unique_email,
        "password": "mypassword123",
        "phone": "+91 91234 56789",
        "primary_contact_name": "Rohan Sharma",
        "primary_contact_phone": "+91 99887 76655",
        "primary_contact_relation": "Brother"
    }
    reg_res = client.post("/api/auth/register", json=reg_payload)
    assert reg_res.status_code == 200
    user_data = reg_res.json()
    assert user_data["user"]["email"] == unique_email
    assert user_data["user"]["primary_contact_name"] == "Rohan Sharma"

    # 2. Login
    login_res = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": "mypassword123"
    })
    assert login_res.status_code == 200
    assert login_res.json()["user"]["name"] == "Kavya Sharma"

def test_destination_corridor_spot_search():
    client = TestClient(app)

    # Query spots along corridor to Kempegowda Airport Gate
    corridor_query = {
        "origin_lat": 13.0358,
        "origin_lon": 77.5970,
        "dest_lat": 13.2450,
        "dest_lon": 77.6750,
        "dest_name": "Kempegowda Airport (NH 44 North)"
    }
    res = client.post("/api/spots/corridor", json=corridor_query)
    assert res.status_code == 200
    data = res.json()
    assert data["destination_name"] == "Kempegowda Airport (NH 44 North)"
    assert len(data["spots"]) > 0
    # The Hebbal spot on NH 44 should be right on the corridor
    hebbal_spot = next((s for s in data["spots"] if "Hebbal" in s["name"]), None)
    assert hebbal_spot is not None
    assert hebbal_spot["distance_to_corridor_km"] is not None

def test_police_stations_and_dossiers_endpoints():
    client = TestClient(app)
    st_res = client.get("/api/trips/police/stations")
    assert st_res.status_code == 200
    stations = st_res.json()
    assert len(stations) >= 5
    station_names = [s["name"] for s in stations]
    assert any("Hebbal" in name for name in station_names)
