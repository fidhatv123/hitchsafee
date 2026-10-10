from fastapi import APIRouter, Body
from typing import Dict, Any
from app.services.routing_service import routing_service
from app.services.alert_provider import mock_provider
from app.services.alert_queue import alert_queue

router = APIRouter(prefix="/simulator", tags=["Demo Mode Simulator"])

@router.get("/demo-route")
def get_demo_route():
    """Returns curated Bangalore NH 44 demo route with waypoints and deviation branch."""
    return routing_service.get_standard_demo_route()

@router.post("/toggle-network")
def toggle_network(online: bool = Body(..., embed=True)):
    """Simulates disconnecting or reconnecting phone network."""
    mock_provider.set_network_status(online)
    return {
        "network_online": online,
        "message": f"Network simulated as {'ONLINE' if online else 'OFFLINE (Airplane Mode / No Signal)'}"
    }

@router.get("/alerts/recent")
def get_recent_alerts(limit: int = 20):
    """Inspect dispatched SMS alerts for the demo screen."""
    return mock_provider.get_recent_alerts(limit)

@router.post("/alerts/sync")
def sync_queued_alerts():
    """Triggers offline alert queue drain and delivery upon network reconnect."""
    result = alert_queue.drain_queue()
    return result

@router.get("/alerts/status")
def get_alert_queue_status():
    """Returns pending alert queue count and last synced timestamp."""
    return alert_queue.get_status()
