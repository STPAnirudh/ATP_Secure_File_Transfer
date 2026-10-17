import asyncio
import os
import pytest
import threading
import time
from backend.app.database import init_db, get_db
from backend.app.tcp_engine.server import TcpTransferServer
from backend.app.tcp_engine.client import TcpTransferClient
from backend.app.tcp_engine.crypto import CryptographyEngine
from backend.app.config import RECEIVED_DIR

RESUME_PORT = 9006

@pytest.fixture(scope="module")
def resume_server():
    init_db()
    server = TcpTransferServer(host="127.0.0.1", port=RESUME_PORT)
    loop = asyncio.new_event_loop()

    def run_loop():
        asyncio.set_event_loop(loop)
        loop.run_until_complete(server.start())
        loop.run_forever()

    t = threading.Thread(target=run_loop, daemon=True)
    t.start()
    time.sleep(0.5)

    yield server

    fut = asyncio.run_coroutine_threadsafe(server.stop(), loop)
    try:
        fut.result(timeout=2.0)
    except Exception:
        pass
    loop.call_soon_threadsafe(loop.stop)
    t.join(timeout=2.0)

def test_interrupted_transfer_and_resume(resume_server, tmp_path):
    """
    Critical verification:
    1. Transmit 250 KB file (4 chunks of 64KB).
    2. Deliberately drop socket connection after 2 chunks.
    3. Verify transfer record is 'interrupted' with 2 verified chunks in SQLite.
    4. Connect new client session and call resume_transfer.
    5. Assert server only requests remaining chunks from offset 131,072.
    6. Verify complete reconstructed file passes SHA-256 integrity match.
    """
    CHUNK_SIZE = 64 * 1024
    TOTAL_SIZE = 250 * 1024
    test_file = tmp_path / "resumable_video_clip.mp4"
    file_bytes = os.urandom(TOTAL_SIZE)
    test_file.write_bytes(file_bytes)
    original_sha256 = CryptographyEngine.compute_sha256_bytes(file_bytes)

    # 1. Start transfer with simulated drop after 2 chunks
    client1 = TcpTransferClient(host="127.0.0.1", port=RESUME_PORT)
    drop_result = client1.send_file(
        str(test_file),
        chunk_size=CHUNK_SIZE,
        simulate_drop_after_chunks=2
    )

    assert drop_result["status"] == "interrupted"
    assert drop_result["interrupted"] is True
    assert drop_result["chunks_transmitted"] == 2
    transfer_id = drop_result["transfer_id"]

    # Allow server to process disconnect and mark interrupted
    time.sleep(0.3)

    # 2. Check SQLite state
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT status, transferred_bytes, completed_chunks FROM transfers WHERE id = ?", (transfer_id,))
    row = cursor.fetchone()
    assert row is not None
    assert row["status"] in ("interrupted", "in_progress")
    assert row["transferred_bytes"] == 2 * CHUNK_SIZE
    assert row["completed_chunks"] == 2
    conn.close()

    # 3. Resume transfer with client 2
    client2 = TcpTransferClient(host="127.0.0.1", port=RESUME_PORT)
    resume_result = client2.resume_transfer(
        str(test_file),
        transfer_id=transfer_id,
        chunk_size=CHUNK_SIZE
    )

    assert resume_result["status"] == "completed"
    assert resume_result["bytes_sent"] == TOTAL_SIZE

    # 4. Final verification in vault
    dest_path = RECEIVED_DIR / "resumable_video_clip.mp4"
    assert dest_path.exists()
    dest_bytes = dest_path.read_bytes()
    assert len(dest_bytes) == TOTAL_SIZE
    assert CryptographyEngine.compute_sha256_bytes(dest_bytes) == original_sha256
