import math
from typing import List, Dict, Any, Tuple
import requests
import json

class RoutingService:
    """
    Open routing service with OSRM integration and offline geodesic interpolation fallback.
    """
    def __init__(self):
        self.osrm_url = "https://router.project-osrm.org/route/v1/driving"

    def get_route(self,
                  origin_lat: float,
                  origin_lon: float,
                  dest_lat: float,
                  dest_lon: float) -> Dict[str, Any]:
        """
        Fetches route polyline points [[lat, lon], ...] and distance/duration.
        """
        # Try online OSRM with timeout 2.5s
        try:
            url = f"{self.osrm_url}/{origin_lon},{origin_lat};{dest_lon},{dest_lat}?overview=full&geometries=geojson"
            resp = requests.get(url, timeout=2.5)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("routes"):
                    route = data["routes"][0]
                    # GeoJSON is [lon, lat], convert to [lat, lon]
                    coords = [[pt[1], pt[0]] for pt in route["geometry"]["coordinates"]]
                    return {
                        "coordinates": coords,
                        "distance_meters": route.get("distance", 0),
                        "duration_seconds": route.get("duration", 0),
                        "source": "OSRM_ONLINE"
                    }
        except Exception:
            pass

        # Offline fallback: Generate realistic high-density highway route
        coords = self._generate_fallback_route(origin_lat, origin_lon, dest_lat, dest_lon)
        return {
            "coordinates": coords,
            "distance_meters": len(coords) * 250,
            "duration_seconds": len(coords) * 15,
            "source": "OFFLINE_GEODESIC_ENGINE"
        }

    def _generate_fallback_route(self,
                                 lat1: float, lon1: float,
                                 lat2: float, lon2: float,
                                 num_points: int = 30) -> List[List[float]]:
        """Interpolates smooth waypoints between origin and destination."""
        points = []
        for i in range(num_points + 1):
            t = i / float(num_points)
            # Add slight realistic curvature
            curvature = math.sin(t * math.pi) * 0.005
            p_lat = round(lat1 + t * (lat2 - lat1) + curvature * 0.4, 5)
            p_lon = round(lon1 + t * (lon2 - lon1) + curvature, 5)
            points.append([p_lat, p_lon])
        return points

    def get_standard_demo_route(self) -> Dict[str, Any]:
        """
        Returns a curated demo trip route along Bengaluru NH 44 (Hebbal -> Toll Gate -> Airport)
        with predefined on-track waypoints and an injected deviation path!
        """
        # NH 44 North Bengaluru to Devanahalli
        on_track_waypoints = [
            [13.0358, 77.5970],  # Hebbal Flyover Start
            [13.0520, 77.5995],  # Kodigehalli Gate
            [13.0780, 77.6040],  # Yelahanka Bypass
            [13.1050, 77.6110],  # Kogilu Cross
            [13.1330, 77.6185],  # Venkatala
            [13.1610, 77.6255],  # Bagalur Cross
            [13.1890, 77.6320],  # Vidyanagar
            [13.2080, 77.6400],  # Sadahalli Toll Plaza
            [13.2350, 77.6520],  # Airport Trumpet Interchange
            [13.2450, 77.6750]   # Devanahalli Terminal End
        ]

        # Deviation path turning off towards desolate unpaved quarry road
        deviated_waypoints = [
            [13.1330, 77.6185],  # Diverges here
            [13.1345, 77.6250],  # 650m off route
            [13.1360, 77.6320],  # 1.4km off route
            [13.1380, 77.6400],  # 2.2km off route
            [13.1400, 77.6450]   # 2.8km off route in isolated area
        ]

        return {
            "name": "Bengaluru NH 44 Airport Corridor",
            "origin": {"name": "Hebbal Flyover (NH 44 North)", "lat": 13.0358, "lon": 77.5970},
            "destination": {"name": "Devanahalli / Airport Gate", "lat": 13.2450, "lon": 77.6750},
            "on_track_route": on_track_waypoints,
            "deviation_branch": deviated_waypoints,
            "road_type": "national_highway"
        }

routing_service = RoutingService()
