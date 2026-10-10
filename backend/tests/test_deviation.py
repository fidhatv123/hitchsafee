import pytest
from app.services.deviation_detector import (
    DeviationDetector,
    haversine_distance_meters,
    distance_point_to_segment_meters,
    calculate_min_distance_to_route
)

def test_haversine_distance():
    # Hebbal flyover to approx 1km north
    lat1, lon1 = 13.0358, 77.5970
    lat2, lon2 = 13.0448, 77.5970
    dist = haversine_distance_meters(lat1, lon1, lat2, lon2)
    assert 990 < dist < 1010

def test_deviation_on_track():
    detector = DeviationDetector(highway_thresh=350.0)
    route = [
        [13.0358, 77.5970],
        [13.0520, 77.5995],
        [13.0780, 77.6040]
    ]
    # Ping right on the route segment
    res = detector.evaluate_ping(
        current_lat=13.0439,
        current_lon=13.0520 * 0.5 + 77.5970 * 0.5, # near route
        speed_kmh=45.0,
        expected_route=route,
        road_type="national_highway",
        stationary_duration_sec=0
    )
    # Ping directly on segment
    res_exact = detector.evaluate_ping(
        current_lat=13.0520,
        current_lon=77.5995,
        speed_kmh=50.0,
        expected_route=route,
        road_type="national_highway"
    )
    assert res_exact["is_deviated"] is False
    assert res_exact["trigger_warning"] is False
    assert res_exact["recommended_sampling_rate_sec"] == 30

def test_deviation_off_route():
    detector = DeviationDetector(highway_thresh=350.0)
    route = [
        [13.0358, 77.5970],
        [13.0520, 77.5995],
        [13.0780, 77.6040]
    ]
    # Point 1.5 km off east
    off_lat, off_lon = 13.0520, 77.6150
    res = detector.evaluate_ping(
        current_lat=off_lat,
        current_lon=off_lon,
        speed_kmh=40.0,
        expected_route=route,
        road_type="national_highway"
    )
    assert res["is_deviated"] is True
    assert res["distance_m"] > 350.0
    assert res["trigger_warning"] is True
    assert res["recommended_sampling_rate_sec"] == 5

def test_unusual_stop_detection():
    detector = DeviationDetector(unusual_stop_sec=240)
    route = [[13.0358, 77.5970], [13.0520, 77.5995]]

    # Vehicle stopped on track for 300 seconds
    res = detector.evaluate_ping(
        current_lat=13.0358,
        current_lon=77.5970,
        speed_kmh=1.0,
        expected_route=route,
        road_type="national_highway",
        stationary_duration_sec=300
    )
    assert res["is_deviated"] is False
    assert res["is_unusual_stop"] is True
    assert res["trigger_warning"] is True
