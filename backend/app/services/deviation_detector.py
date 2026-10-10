import math
from typing import List, Dict, Any, Tuple, Optional
from app.config import settings

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def distance_point_to_segment_meters(p_lat: float, p_lon: float,
                                     a_lat: float, a_lon: float,
                                     b_lat: float, b_lon: float) -> float:
    """Distance from point P to line segment AB in meters using planar approximation locally."""
    # Convert lat/lon difference to approximate local flat meters
    mid_lat = math.radians((a_lat + b_lat) / 2.0)
    meters_per_deg_lat = 111132.92
    meters_per_deg_lon = 111412.84 * math.cos(mid_lat)

    px = (p_lon - a_lon) * meters_per_deg_lon
    py = (p_lat - a_lat) * meters_per_deg_lat
    bx = (b_lon - a_lon) * meters_per_deg_lon
    by = (b_lat - a_lat) * meters_per_deg_lat

    seg_len_sq = bx * bx + by * by
    if seg_len_sq == 0.0:
        return math.sqrt(px * px + py * py)

    # Project P onto AB: t in [0, 1]
    t = max(0.0, min(1.0, (px * bx + py * by) / seg_len_sq))
    proj_x = t * bx
    proj_y = t * by

    dx = px - proj_x
    dy = py - proj_y
    return math.sqrt(dx * dx + dy * dy)

def calculate_min_distance_to_route(lat: float, lon: float, route_coords: List[List[float]]) -> float:
    """
    Computes minimum distance in meters from (lat, lon) to a polyline route coords [[lat, lon], ...].
    """
    if not route_coords or len(route_coords) < 1:
        return 0.0
    if len(route_coords) == 1:
        return haversine_distance_meters(lat, lon, route_coords[0][0], route_coords[0][1])

    min_dist = float('inf')
    for i in range(len(route_coords) - 1):
        a_lat, a_lon = route_coords[i][0], route_coords[i][1]
        b_lat, b_lon = route_coords[i + 1][0], route_coords[i + 1][1]
        d = distance_point_to_segment_meters(lat, lon, a_lat, a_lon, b_lat, b_lon)
        if d < min_dist:
            min_dist = d
            if min_dist < 10.0:  # Early stop if practically on top of segment
                break

    return min_dist

class DeviationDetector:
    """
    Detects route deviations and unusual stops with noise filtering and adaptive sampling.
    """
    def __init__(self,
                 highway_thresh: float = settings.DEVIATION_THRESHOLD_HIGHWAY,
                 urban_thresh: float = settings.DEVIATION_THRESHOLD_URBAN,
                 rural_thresh: float = settings.DEVIATION_THRESHOLD_RURAL,
                 unusual_stop_sec: int = settings.UNUSUAL_STOP_SECONDS):
        self.thresholds = {
            "highway": highway_thresh,
            "expressways": highway_thresh,
            "national_highway": highway_thresh,
            "urban": urban_thresh,
            "arterial": urban_thresh,
            "rural": rural_thresh,
            "state_highway": (highway_thresh + rural_thresh) / 2.0
        }
        self.unusual_stop_sec = unusual_stop_sec

    def get_threshold(self, road_type: str) -> float:
        return self.thresholds.get(road_type.lower(), self.thresholds["national_highway"])

    def smooth_gps(self, recent_pings: List[Dict[str, Any]]) -> Tuple[float, float]:
        """
        Simple median/mean smoothing over last 3 pings to reduce GPS multipath noise.
        """
        if not recent_pings:
            raise ValueError("No pings to smooth")
        if len(recent_pings) == 1:
            return recent_pings[0]["lat"], recent_pings[0]["lon"]

        lats = [p["lat"] for p in recent_pings[-3:]]
        lons = [p["lon"] for p in recent_pings[-3:]]
        return sum(lats) / len(lats), sum(lons) / len(lons)

    def evaluate_ping(self,
                      current_lat: float,
                      current_lon: float,
                      speed_kmh: float,
                      expected_route: List[List[float]],
                      road_type: str = "national_highway",
                      stationary_duration_sec: int = 0) -> Dict[str, Any]:
        """
        Evaluate if current position deviates from route or if stationary stop is unusual.
        Returns:
            - distance_m: distance from expected route in meters
            - threshold_m: allowed threshold for road type
            - is_deviated: boolean flag
            - is_unusual_stop: boolean flag
            - trigger_warning: boolean flag (either deviation or unusual stop)
            - recommended_sampling_rate_sec: adaptive GPS frequency (e.g., 30s when safe, 5s when warning)
            - reason: explanatory string
        """
        dist_m = calculate_min_distance_to_route(current_lat, current_lon, expected_route)
        allowed_thresh = self.get_threshold(road_type)
        is_deviated = dist_m > allowed_thresh

        # Check unusual stationary stop
        is_unusual_stop = (speed_kmh < 3.0 and stationary_duration_sec >= self.unusual_stop_sec)

        trigger_warning = is_deviated or is_unusual_stop

        # Adaptive sampling: 30s on track, 5s on suspected deviation/stop
        rec_sampling = 5 if trigger_warning else 30

        reasons = []
        if is_deviated:
            reasons.append(f"Vehicle drifted {dist_m:.0f}m from planned route (limit {allowed_thresh:.0f}m)")
        if is_unusual_stop:
            reasons.append(f"Vehicle stationary for {stationary_duration_sec}s (< 3 km/h)")

        reason_str = "; ".join(reasons) if reasons else "On expected route"

        return {
            "distance_m": round(dist_m, 1),
            "threshold_m": allowed_thresh,
            "is_deviated": is_deviated,
            "is_unusual_stop": is_unusual_stop,
            "trigger_warning": trigger_warning,
            "recommended_sampling_rate_sec": rec_sampling,
            "reason": reason_str
        }
