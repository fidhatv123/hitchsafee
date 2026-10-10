import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from typing import Dict, Any, Tuple, Optional
import json
from app.config import settings
from app.database import get_db_connection

ROAD_TYPE_MAP = {
    "expressways": 0,
    "highway": 1,
    "national_highway": 2,
    "state_highway": 3,
    "arterial": 4,
    "urban": 4,
    "rural": 5
}

TRAFFIC_MAP = {
    "low": 0,
    "moderate": 1,
    "high": 2
}

class WaitTimePredictor:
    """
    Dual-engine wait time predictor:
    1. Transparent Heuristic Baseline for data-sparse regions (e.g. much of India).
    2. Scikit-learn Gradient-Boosted Regressor when regional sample threshold is met.
    """
    def __init__(self, min_samples_for_ml: int = settings.ML_MIN_REGIONAL_SAMPLES):
        self.min_samples_for_ml = min_samples_for_ml
        self.model = GradientBoostingRegressor(
            n_estimators=60,
            learning_rate=0.08,
            max_depth=3,
            random_state=42
        )
        self.is_trained = False
        self._train_initial_model()

    def _extract_features(self,
                          hour: int,
                          day_of_week: int,
                          road_type: str,
                          has_petrol: bool,
                          has_cctv: bool,
                          has_light: bool,
                          traffic: str = "moderate") -> list:
        return [
            float(hour),
            float(day_of_week),
            float(ROAD_TYPE_MAP.get(road_type.lower(), 2)),
            1.0 if has_petrol else 0.0,
            1.0 if has_cctv else 0.0,
            1.0 if has_light else 0.0,
            float(TRAFFIC_MAP.get(traffic.lower(), 1))
        ]

    def _train_initial_model(self):
        """
        Train ML model on reviews in SQLite + bootstrap training distribution.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        SELECT wait_time_minutes, time_of_day_hour, day_of_week, road_type
        FROM spot_reviews
        ''')
        rows = cursor.fetchall()
        conn.close()

        X = []
        y = []

        for r in rows:
            feat = self._extract_features(
                hour=r["time_of_day_hour"],
                day_of_week=r["day_of_week"],
                road_type=r["road_type"],
                has_petrol=True,
                has_cctv=True,
                has_light=True,
                traffic="moderate"
            )
            X.append(feat)
            y.append(float(r["wait_time_minutes"]))

        # Seed with synthetic representative distribution across road types & hours
        np.random.seed(42)
        for _ in range(120):
            hour = np.random.randint(6, 22)
            dow = np.random.randint(0, 7)
            road_type = np.random.choice(["expressways", "national_highway", "state_highway", "rural"])
            petrol = bool(np.random.choice([True, False], p=[0.7, 0.3]))
            cctv = bool(np.random.choice([True, False], p=[0.6, 0.4]))
            light = bool(np.random.choice([True, False], p=[0.8, 0.2]))
            traffic = np.random.choice(["low", "moderate", "high"])

            # Realistic physics-based wait ground truth with noise
            base = 14.0 if road_type == "expressways" else (20.0 if road_type == "national_highway" else (32.0 if road_type == "state_highway" else 48.0))
            if 7 <= hour <= 10 or 16 <= hour <= 19:
                base *= 0.85
            elif hour >= 20 or hour < 7:
                base *= 1.55

            if petrol:
                base *= 0.85
            if traffic == "high":
                base *= 0.85
            elif traffic == "low":
                base *= 1.25

            wait_sampled = max(5.0, np.random.normal(base, 4.0))

            feat = self._extract_features(hour, dow, road_type, petrol, cctv, light, traffic)
            X.append(feat)
            y.append(wait_sampled)

        self.model.fit(np.array(X), np.array(y))
        self.is_trained = True

    def calculate_heuristic_baseline(self,
                                     hour: int,
                                     road_type: str,
                                     has_petrol: bool,
                                     has_cctv: bool,
                                     has_light: bool,
                                     traffic: str = "moderate") -> Tuple[float, float, float]:
        """
        Transparent rule-based baseline for regions with insufficient crowdsourced data.
        Returns: (predicted_wait, range_min, range_max)
        """
        base_times = {
            "expressways": 15.0,
            "highway": 20.0,
            "national_highway": 22.0,
            "state_highway": 32.0,
            "arterial": 26.0,
            "urban": 26.0,
            "rural": 48.0
        }
        wait = base_times.get(road_type.lower(), 25.0)

        # Time of day factors
        if 7 <= hour <= 10:
            wait *= 0.85  # Morning commute lift
        elif 11 <= hour <= 15:
            wait *= 1.10  # Midday slump
        elif 16 <= hour <= 18:
            wait *= 0.90  # Evening return
        elif 19 <= hour <= 21:
            wait *= 1.30  # Dusk
        else:
            wait *= 1.65  # Night / Pre-dawn

        # Facility bonuses
        if has_petrol:
            wait *= 0.85
        if has_cctv and has_light:
            wait *= 0.92

        if traffic.lower() == "high":
            wait *= 0.90
        elif traffic.lower() == "low":
            wait *= 1.25

        wait = round(wait, 1)
        # Transparent range bounds: +/- 35%
        range_min = max(5.0, round(wait * 0.65, 0))
        range_max = round(wait * 1.40, 0)
        return wait, range_min, range_max

    def predict(self,
                spot_id: Optional[str],
                region: str,
                lat: float,
                lon: float,
                hour: int,
                day_of_week: int,
                road_type: str,
                has_petrol: bool = True,
                has_cctv: bool = True,
                has_light: bool = True,
                traffic: str = "moderate") -> Dict[str, Any]:
        """
        Generates calibrated wait-time prediction range, confidence, and bus threshold.
        """
        # Count available samples for this spot or region in SQLite
        conn = get_db_connection()
        cursor = conn.cursor()

        sample_count = 0
        if spot_id:
            cursor.execute("SELECT sample_count FROM spots WHERE id = ?", (spot_id,))
            s_row = cursor.fetchone()
            if s_row:
                sample_count = s_row["sample_count"]

        if sample_count == 0:
            cursor.execute("SELECT COUNT(*) FROM spot_reviews WHERE road_type = ?", (road_type,))
            sample_count = cursor.fetchone()[0]

        conn.close()

        # Decide whether to use Heuristic Baseline or ML Model
        use_ml = sample_count >= self.min_samples_for_ml and self.is_trained

        if use_ml:
            features = self._extract_features(hour, day_of_week, road_type, has_petrol, has_cctv, has_light, traffic)
            pred_val = float(self.model.predict([features])[0])
            pred_val = max(5.0, round(pred_val, 1))

            # ML Confidence & Range estimation
            if sample_count > 25:
                confidence = "HIGH"
                range_spread = 0.22
            else:
                confidence = "MEDIUM"
                range_spread = 0.32

            range_min = max(5.0, round(pred_val * (1.0 - range_spread), 0))
            range_max = round(pred_val * (1.0 + range_spread), 0)
            model_used = "ML_GRADIENT_BOOST"
            explanation = (
                f"Trained Gradient-Boosted Model ({sample_count} regional observations). "
                f"Factoring peak traffic window ({hour:02d}:00), {road_type.replace('_', ' ')} flow, and spot amenities."
            )
        else:
            pred_val, range_min, range_max = self.calculate_heuristic_baseline(
                hour, road_type, has_petrol, has_cctv, has_light, traffic
            )
            confidence = "LOW" if sample_count < 5 else "MEDIUM"
            model_used = "HEURISTIC_BASELINE"
            explanation = (
                f"Sparse regional data ({sample_count} reports for {region}). "
                f"Utilizing transparent heuristic baseline calibrated for {road_type.replace('_', ' ')} road conditions."
            )

        # Bus alternative recommendation
        bus_threshold = int(max(30.0, range_max * 1.25))

        return {
            "predicted_wait_min": pred_val,
            "range_min": range_min,
            "range_max": range_max,
            "confidence": confidence,
            "model_used": model_used,
            "bus_alternative_threshold_min": bus_threshold,
            "regional_sample_count": sample_count,
            "explanation": explanation
        }

    def evaluate_model_metrics(self) -> Dict[str, Any]:
        """
        Computes Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE)
        comparing Baseline Heuristic vs GradientBoostingRegressor on test set.
        """
        np.random.seed(101)
        test_samples = 40
        X_test, y_true = [], []
        baseline_preds = []

        for _ in range(test_samples):
            h = np.random.randint(6, 22)
            d = np.random.randint(0, 7)
            rt = np.random.choice(["expressways", "national_highway", "state_highway", "rural"])
            p = bool(np.random.choice([True, False]))
            c = bool(np.random.choice([True, False]))
            l = bool(np.random.choice([True, False]))
            t = np.random.choice(["low", "moderate", "high"])

            # Ground truth
            base = 15.0 if rt == "expressways" else (22.0 if rt == "national_highway" else (32.0 if rt == "state_highway" else 48.0))
            if 7 <= h <= 10 or 16 <= h <= 19:
                base *= 0.85
            if p:
                base *= 0.85
            actual = max(5.0, np.random.normal(base, 4.0))

            feat = self._extract_features(h, d, rt, p, c, l, t)
            X_test.append(feat)
            y_true.append(actual)

            b_pred, _, _ = self.calculate_heuristic_baseline(h, rt, p, c, l, t)
            baseline_preds.append(b_pred)

        y_true = np.array(y_true)
        ml_preds = self.model.predict(np.array(X_test))

        baseline_mae = float(np.mean(np.abs(np.array(baseline_preds) - y_true)))
        baseline_rmse = float(np.sqrt(np.mean((np.array(baseline_preds) - y_true) ** 2)))

        ml_mae = float(np.mean(np.abs(ml_preds - y_true)))
        ml_rmse = float(np.sqrt(np.mean((ml_preds - y_true) ** 2)))

        return {
            "test_sample_count": test_samples,
            "baseline": {
                "mae_minutes": round(baseline_mae, 2),
                "rmse_minutes": round(baseline_rmse, 2)
            },
            "ml_model": {
                "mae_minutes": round(ml_mae, 2),
                "rmse_minutes": round(ml_rmse, 2),
                "mae_improvement_pct": round(((baseline_mae - ml_mae) / baseline_mae) * 100, 1)
            }
        }

wait_predictor = WaitTimePredictor()
