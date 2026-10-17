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

def test_cascade_delete_received_file_removes_transfers(client):
    import os
    from backend.app.config import RECEIVED_DIR
    from backend.app.database import get_db

    os.makedirs(RECEIVED_DIR, exist_ok=True)
    test_file_path = os.path.join(RECEIVED_DIR, "cascade_test.txt")
    with open(test_file_path, "w") as f:
        f.write("test cascade deletion payload")

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT OR REPLACE INTO transfers (id, file_name, file_size, transferred_bytes, total_chunks, completed_chunks, status, direction, sha256_hash)
               VALUES ('cascade-tid-1', 'cascade_test.txt', 100, 100, 1, 1, 'completed', 'receive', 'mockhash_cascade_12345')"""
        )
        cur.execute(
            """INSERT OR REPLACE INTO transfer_chunks (transfer_id, chunk_index, byte_offset, chunk_size, sha256_chunk, status)
               VALUES ('cascade-tid-1', 0, 0, 100, 'mockchunkhash', 'confirmed')"""
        )
        conn.commit()
    finally:
        conn.close()

    # Call DELETE /api/files/cascade_test.txt
    res = client.delete("/api/files/cascade_test.txt")
    assert res.status_code == 200
    assert not os.path.exists(test_file_path)

    # Verify that the transfer and chunks were cascaded and removed
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM transfers WHERE id = 'cascade-tid-1'")
        transfer_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM transfer_chunks WHERE transfer_id = 'cascade-tid-1'")
        chunk_count = cur.fetchone()[0]
    finally:
        conn.close()

    assert transfer_count == 0
    assert chunk_count == 0

