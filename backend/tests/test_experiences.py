import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

def test_user_experience_submission_and_retrieval():
    client = TestClient(app)

    # 1. Fetch initial seeded experiences
    res = client.get("/api/experiences")
    assert res.status_code == 200
    experiences = res.json()
    assert len(experiences) >= 3

    # 2. Submit new user experience with location, destination, pickup spot, wait time
    payload = {
        "user_name": "Maya Sen",
        "location": "Koramangala 4th Block",
        "destination": "Devanahalli / Airport Gate",
        "pickup_spot": "Hebbal Flyover Exit Ramp",
        "wait_time_minutes": 16.5,
        "rating": 5.0,
        "experience_notes": "Clean pickup area near highway police checkpoint. Quick lift in 16 minutes.",
        "driver_behavior": "Courteous software architect",
        "vehicle_type": "Hyundai Creta"
    }

    post_res = client.post("/api/experiences", json=payload)
    assert post_res.status_code == 200
    created = post_res.json()
    assert created["user_name"] == "Maya Sen"
    assert created["location"] == "Koramangala 4th Block"
    assert created["destination"] == "Devanahalli / Airport Gate"
    assert created["pickup_spot"] == "Hebbal Flyover Exit Ramp"
    assert created["wait_time_minutes"] == 16.5

    # 3. Verify it shows up in filtered listing
    filter_res = client.get("/api/experiences?destination=Devanahalli")
    assert filter_res.status_code == 200
    filtered = filter_res.json()
    assert any(exp["user_name"] == "Maya Sen" for exp in filtered)
