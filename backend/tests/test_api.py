import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import init_db

@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as c:
        yield c

def test_health_endpoint(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "uptime_seconds" in data
    assert data["database_status"] == "connected"

def test_list_transfers(client):
    res = client.get("/api/transfers")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_list_files(client):
    res = client.get("/api/files")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_activity_logs(client):
    res = client.get("/api/activity")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_security_status(client):
    res = client.get("/api/security/status")
    assert res.status_code == 200
    data = res.json()
    assert data["cipher_suite"] == "AES-256-GCM"
    assert data["sha256_integrity_enforced"] is True

def test_settings_get_and_update(client):
    res = client.get("/api/settings")
    assert res.status_code == 200
    data = res.json()
    assert "tcp_port" in data

    update_res = client.post("/api/settings", json={"socket_timeout": 45})
    assert update_res.status_code == 200
    assert update_res.json()["settings"]["socket_timeout"] == 45

def test_path_traversal_blocked(client):
    """Verify that requests trying to escape the received vault directory are rejected."""
    res = client.get("/api/files/..etc/download")
    assert res.status_code == 403

def test_network_info_endpoint(client):
    """Verify that network-info exposes LAN IP and cross-device access URL."""
    res = client.get("/api/network-info")
    assert res.status_code == 200
    data = res.json()
    assert "local_ip" in data
    assert "network_url" in data
    assert "tcp_port" in data
    assert data["tcp_port"] == 9000

