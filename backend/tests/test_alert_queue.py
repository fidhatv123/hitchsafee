import pytest
from app.services.alert_provider import MockAlertProvider
from app.services.alert_queue import AlertQueueManager
from app.database import init_db

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

def test_alert_queue_immediate_delivery():
    provider = MockAlertProvider()
    queue_mgr = AlertQueueManager()

    res = queue_mgr.dispatch_or_enqueue(
        trip_id="trip_test_1",
        recipient="+919876543210",
        message="Test alert delivery",
        alert_type="TEST",
        provider=provider
    )
    assert res["status"] == "SENT"
    assert res["delivered_immediately"] is True
    assert len(provider.dispatch_log) >= 1

def test_alert_queue_offline_enqueuing_and_drain():
    provider = MockAlertProvider()
    provider.set_network_status(False)  # Disconnect network
    queue_mgr = AlertQueueManager()

    # Attempt to dispatch while offline
    res = queue_mgr.dispatch_or_enqueue(
        trip_id="trip_test_2",
        recipient="+919876543210",
        message="Queued offline alert",
        alert_type="TEST_OFFLINE",
        provider=provider
    )
    assert res["status"] == "QUEUED"
    assert res["delivered_immediately"] is False
    assert queue_mgr.get_pending_count() >= 1

    # Reconnect network and drain queue
    provider.set_network_status(True)
    drain_res = queue_mgr.drain_queue(provider=provider)

    assert drain_res["processed"] >= 1
    assert queue_mgr.get_pending_count() == 0
    # Provider should now have received the queued alert
    matched = [a for a in provider.dispatch_log if a["alert_type"] == "TEST_OFFLINE"]
    assert len(matched) >= 1
