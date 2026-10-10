from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
import json
import uuid
import datetime
from app.models import Spot, SpotCreate, SpotReview, WaitPredictionRequest, WaitPredictionResponse, FlagSpotRequest, DestinationCorridorQuery
from app.database import get_db_connection
from app.services.ml_wait_predictor import wait_predictor
from app.services.deviation_detector import haversine_distance_meters, calculate_min_distance_to_route
from app.services.routing_service import routing_service

router = APIRouter(prefix="/spots", tags=["Spots & Predictions"])

@router.get("", response_model=List[Spot])
def list_spots(
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    radius_km: float = Query(50.0),
    country: Optional[str] = Query(None)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM spots")
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        features_list = json.loads(r["features"]) if r["features"] else []
        spot_dict = dict(r)
        spot_dict["features"] = features_list
        spot_obj = Spot(**spot_dict)

        if lat is not None and lon is not None:
            dist_m = haversine_distance_meters(lat, lon, spot_obj.lat, spot_obj.lon)
            if dist_m > (radius_km * 1000.0):
                continue

        if country and spot_obj.country.lower() != country.lower():
            continue

        results.append(spot_obj)

    return results

@router.post("/corridor")
def find_spots_along_corridor(query: DestinationCorridorQuery) -> Dict[str, Any]:
    """
    Shows nearby hitchhiking spots after entering destination details:
    1. Computes expected route polyline towards destination.
    2. Identifies all spots along or servicing this corridor.
    3. Ranks spots by proximity and pull-off convenience.
    """
    route_res = routing_service.get_route(
        query.origin_lat, query.origin_lon, query.dest_lat, query.dest_lon
    )
    route_coords = route_res.get("coordinates", [])

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM spots")
    rows = cursor.fetchall()
    conn.close()

    corridor_spots = []
    for r in rows:
        features_list = json.loads(r["features"]) if r["features"] else []
        spot_dict = dict(r)
        spot_dict["features"] = features_list
        spot_obj = Spot(**spot_dict)

        dist_m = calculate_min_distance_to_route(spot_obj.lat, spot_obj.lon, route_coords)
        dist_km = round(dist_m / 1000.0, 1)

        # Include if within 40km of the travel route corridor
        if dist_km <= 40.0:
            spot_obj.distance_to_corridor_km = dist_km
            corridor_spots.append(spot_obj)

    # Sort closest to corridor first
    corridor_spots.sort(key=lambda s: s.distance_to_corridor_km if s.distance_to_corridor_km is not None else 999.0)

    return {
        "destination_name": query.dest_name,
        "origin_name": "Current Location / Bangalore Center",
        "route_coordinates": route_coords,
        "total_spots_found": len(corridor_spots),
        "spots": [s.model_dump() for s in corridor_spots]
    }

@router.get("/model-metrics")
def get_model_metrics():
    """Returns baseline vs scikit-learn GradientBoostingRegressor error metrics."""
    return wait_predictor.evaluate_model_metrics()

@router.get("/{spot_id}", response_model=Spot)
def get_spot(spot_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM spots WHERE id = ?", (spot_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Spot not found")

    features_list = json.loads(row["features"]) if row["features"] else []
    spot_dict = dict(row)
    spot_dict["features"] = features_list
    return Spot(**spot_dict)

@router.post("/predict-wait", response_model=WaitPredictionResponse)
def predict_wait_time(req: WaitPredictionRequest):
    """
    Dual-engine wait time prediction:
    Switches between scikit-learn ML model and transparent heuristic baseline.
    """
    res = wait_predictor.predict(
        spot_id=req.spot_id,
        region=req.region,
        lat=req.lat,
        lon=req.lon,
        hour=req.time_of_day_hour,
        day_of_week=req.day_of_week,
        road_type=req.road_type,
        has_petrol=req.has_petrol_station,
        has_cctv=req.has_cctv,
        has_light=req.has_street_light,
        traffic=req.traffic_density
    )
    return WaitPredictionResponse(**res)

@router.post("", response_model=Spot)
def create_spot(spot: SpotCreate):
    """Crowdsourced spot contribution flow."""
    spot_id = f"spot_user_{uuid.uuid4().hex[:8]}"
    features_json = json.dumps(spot.features)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO spots (
        id, name, lat, lon, country, region, road_type, rating,
        avg_wait_min, median_wait_min, pull_off_safety, best_times,
        features, source, license, flag_count, sample_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
    ''', (
        spot_id, spot.name, spot.lat, spot.lon, spot.country, spot.region,
        spot.road_type, spot.rating, spot.avg_wait_min, spot.median_wait_min,
        spot.pull_off_safety, spot.best_times, features_json, "User-Submitted",
        "ODbL / CC-BY-SA 4.0 Hitchmap Community"
    ))
    conn.commit()
    conn.close()

    return Spot(
        id=spot_id,
        sample_count=1,
        **spot.model_dump()
    )

@router.post("/{spot_id}/reviews")
def add_spot_review(spot_id: str, review: SpotReview):
    """Feed post-ride rating and wait time back into SQLite & ML dataset."""
    review_id = f"rev_{uuid.uuid4().hex[:8]}"
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT sample_count, avg_wait_min, rating FROM spots WHERE id = ?", (spot_id,))
    spot = cursor.fetchone()
    if not spot:
        conn.close()
        raise HTTPException(status_code=404, detail="Spot not found")

    cursor.execute('''
    INSERT INTO spot_reviews (
        id, spot_id, wait_time_minutes, rating, safety_rating,
        time_of_day_hour, day_of_week, road_type, comments, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        review_id, spot_id, review.wait_time_minutes, review.rating, review.safety_rating,
        review.time_of_day_hour, review.day_of_week, review.road_type, review.comments, now
    ))

    prev_n = spot["sample_count"]
    new_n = prev_n + 1
    new_avg_wait = round((spot["avg_wait_min"] * prev_n + review.wait_time_minutes) / new_n, 1)
    new_rating = round((spot["rating"] * prev_n + review.rating) / new_n, 2)

    cursor.execute('''
    UPDATE spots
    SET sample_count = ?, avg_wait_min = ?, rating = ?
    WHERE id = ?
    ''', (new_n, new_avg_wait, new_rating, spot_id))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "review_id": review_id,
        "new_sample_count": new_n,
        "updated_avg_wait_min": new_avg_wait,
        "updated_rating": new_rating
    }

@router.post("/{spot_id}/flag")
def flag_spot(spot_id: str, flag: FlagSpotRequest):
    """Flag spot for abuse, safety hazard, or inaccurate pull-off data."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT flag_count FROM spots WHERE id = ?", (spot_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Spot not found")

    new_flags = row["flag_count"] + 1
    cursor.execute("UPDATE spots SET flag_count = ? WHERE id = ?", (new_flags, spot_id))
    flag_id = f"flag_{uuid.uuid4().hex[:8]}"
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute("INSERT INTO spot_flags (id, spot_id, reason, created_at) VALUES (?, ?, ?, ?)",
                   (flag_id, spot_id, flag.reason, now))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "flag_id": flag_id,
        "spot_id": spot_id,
        "total_flags": new_flags,
        "status": "UNDER_REVIEW" if new_flags >= 3 else "RECORDED"
    }
