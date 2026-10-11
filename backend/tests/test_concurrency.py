import asyncio
import os
import pytest
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from backend.app.database import init_db
from backend.app.tcp_engine.server import TcpTransferServer
from backend.app.tcp_engine.client import TcpTransferClient
from backend.app.tcp_engine.crypto import CryptographyEngine
from backend.app.config import RECEIVED_DIR

CONCURRENT_PORT = 9008

@pytest.fixture(scope="module")
def concurrent_server():
    init_db()
    server = TcpTransferServer(host="127.0.0.1", port=CONCURRENT_PORT)
    loop = asyncio.new_event_loop()

    def run_loop():
        asyncio.set_event_loop(loop)
        loop.run_until_complete(server.start())
        loop.run_forever()

    t = threading.Thread(target=run_loop, daemon=True)
    t.start()
    time.sleep(0.5)

    yield server

    loop.call_soon_threadsafe(loop.stop)
    t.join(timeout=2.0)

def transfer_single_file(client_idx: int, tmp_path):
    filename = f"concurrent_client_{client_idx}.dat"
    test_file = tmp_path / filename
    # 120 KB file (2 chunks)
    data = os.urandom(120 * 1024)
    test_file.write_bytes(data)
    expected_sha = CryptographyEngine.compute_sha256_bytes(data)

    client = TcpTransferClient(host="127.0.0.1", port=CONCURRENT_PORT)
    res = client.send_file(str(test_file))
    assert res["status"] == "completed"

    received_file = RECEIVED_DIR / filename
    assert received_file.exists()
    assert CryptographyEngine.compute_sha256_file(str(received_file)) == expected_sha
    return True

def test_multi_client_concurrent_transfers(concurrent_server, tmp_path):
    """
    Test 5 simultaneous clients transferring distinct files concurrently.
    Verifies isolation of cryptographic states and buffer handling.
    """
    num_clients = 5
    with ThreadPoolExecutor(max_workers=num_clients) as executor:
        futures = [
            executor.submit(transfer_single_file, i, tmp_path)
            for i in range(num_clients)
        ]
        results = [f.result() for f in futures]

    assert len(results) == num_clients
    assert all(results)
