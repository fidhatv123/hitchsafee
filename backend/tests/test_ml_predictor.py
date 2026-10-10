import pytest
from app.services.ml_wait_predictor import WaitTimePredictor

def test_heuristic_baseline_switch():
    predictor = WaitTimePredictor(min_samples_for_ml=15)
    # Spot with low regional count in India
    res = predictor.predict(
        spot_id="test_sparse_spot",
        region="Bihar",
        lat=25.5941,
        lon=85.1376,
        hour=10,
        day_of_week=1,
        road_type="national_highway",
        has_petrol=True
    )
    assert res["model_used"] == "HEURISTIC_BASELINE"
    assert res["range_min"] < res["predicted_wait_min"] < res["range_max"]
    assert res["bus_alternative_threshold_min"] >= 30
    assert "heuristic baseline" in res["explanation"].lower()

def test_ml_model_prediction_when_trained():
    predictor = WaitTimePredictor(min_samples_for_ml=10)
    # Bangalore Hebbal spot has 28 seed samples (>= 10 threshold)
    res = predictor.predict(
        spot_id="spot_blr_nh44_hebbal",
        region="Karnataka",
        lat=13.0358,
        lon=77.5970,
        hour=9,
        day_of_week=1,
        road_type="national_highway",
        has_petrol=True
    )
    assert res["model_used"] == "ML_GRADIENT_BOOST"
    assert res["confidence"] in ["HIGH", "MEDIUM"]
    assert res["predicted_wait_min"] > 0
    assert res["range_min"] <= res["predicted_wait_min"] <= res["range_max"]

def test_model_metrics_evaluation():
    predictor = WaitTimePredictor()
    metrics = predictor.evaluate_model_metrics()
    assert "baseline" in metrics
    assert "ml_model" in metrics
    assert metrics["baseline"]["mae_minutes"] > 0
    assert metrics["ml_model"]["mae_minutes"] > 0
    print("Baseline MAE:", metrics["baseline"]["mae_minutes"], "ML MAE:", metrics["ml_model"]["mae_minutes"])
