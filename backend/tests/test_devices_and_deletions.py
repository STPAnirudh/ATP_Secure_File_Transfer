import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import init_db

@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as c:
        yield c

def test_device_heartbeat_and_list(client):
    # 1. Send heartbeat for device 1
    hb1 = client.post("/api/devices/heartbeat", json={
        "device_id": "test_phone_01",
        "device_name": "Test iPhone 15",
        "device_type": "mobile"
    })
    assert hb1.status_code == 200
    assert hb1.json()["device_id"] == "test_phone_01"

    # 2. List devices
    dev_res = client.get("/api/devices")
    assert dev_res.status_code == 200
    devices = dev_res.json()
    assert any(d["device_id"] == "test_phone_01" for d in devices)

def test_device_rename(client):
    rename_res = client.post("/api/devices/rename", json={
        "device_id": "test_phone_01",
        "new_name": "Anirudh's Primary iPhone"
    })
    assert rename_res.status_code == 200
    assert rename_res.json()["new_name"] == "Anirudh's Primary iPhone"

    dev_res = client.get("/api/devices")
    assert any(d["device_name"] == "Anirudh's Primary iPhone" for d in dev_res.json())

def test_delete_transfers_and_activity(client):
    # Clear transfers
    del_t = client.delete("/api/transfers")
    assert del_t.status_code == 200

    # Clear activity logs
    del_a = client.delete("/api/activity")
    assert del_a.status_code == 200

    # Clear vault
    del_f = client.delete("/api/files")
    assert del_f.status_code == 200
