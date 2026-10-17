import asyncio
import os
import pytest
import threading
import time
from pathlib import Path
from backend.app.database import init_db, get_db
from backend.app.tcp_engine.server import TcpTransferServer
from backend.app.tcp_engine.client import TcpTransferClient
from backend.app.tcp_engine.crypto import CryptographyEngine
from backend.app.config import RECEIVED_DIR

TEST_PORT = 9005

@pytest.fixture(scope="module")
def tcp_server():
    init_db()
    server = TcpTransferServer(host="127.0.0.1", port=TEST_PORT)
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

def test_full_file_transfer(tcp_server, tmp_path):
    """
    Integration test: Transmits a multi-chunk file over real TCP sockets.
    Verifies AES-256-GCM authenticated encryption and SHA-256 digest match.
    """
    # Create 150 KB test file (3 chunks with 64KB chunk size)
    test_file = tmp_path / "test_data_stream.bin"
    file_bytes = os.urandom(150 * 1024)
    test_file.write_bytes(file_bytes)
    original_sha256 = CryptographyEngine.compute_sha256_bytes(file_bytes)

    client = TcpTransferClient(host="127.0.0.1", port=TEST_PORT)
    result = client.send_file(str(test_file), chunk_size=64 * 1024)

    assert result["status"] == "completed"
    assert result["interrupted"] is False
    assert result["bytes_sent"] == 150 * 1024
    assert result["sha256"] == original_sha256

    # Verify finalized file in received vault
    dest_path = RECEIVED_DIR / "test_data_stream.bin"
    assert dest_path.exists()
    dest_bytes = dest_path.read_bytes()
    assert len(dest_bytes) == len(file_bytes)
    assert CryptographyEngine.compute_sha256_bytes(dest_bytes) == original_sha256

def test_empty_file_transfer(tcp_server, tmp_path):
    """Verify transmission of an empty 0-byte file."""
    empty_file = tmp_path / "empty.txt"
    empty_file.write_bytes(b"")

    client = TcpTransferClient(host="127.0.0.1", port=TEST_PORT)
    result = client.send_file(str(empty_file))

    assert result["status"] == "completed"
    assert result["bytes_sent"] == 0

    dest_path = RECEIVED_DIR / "empty.txt"
    assert dest_path.exists()
    assert dest_path.stat().st_size == 0

def test_tcp_file_download(tcp_server, tmp_path):
    """
    Verifies bi-directional TCP communication:
    Downloads the transferred file back from the server vault over encrypted TCP stream.
    """
    download_dest = tmp_path / "downloaded_stream.bin"
    client = TcpTransferClient(host="127.0.0.1", port=TEST_PORT)
    result = client.download_file("test_data_stream.bin", str(download_dest))

    assert result["status"] == "completed"
    assert download_dest.exists()
    assert result["file_size"] == 150 * 1024

    vault_file = RECEIVED_DIR / "test_data_stream.bin"
    expected_sha256 = CryptographyEngine.compute_sha256_file(str(vault_file))
    assert result["sha256"] == expected_sha256
    assert download_dest.read_bytes() == vault_file.read_bytes()

def test_tcp_authentication(tcp_server):
    """Verifies TCP socket authentication layer."""
    client = TcpTransferClient(host="127.0.0.1", port=TEST_PORT)
    client.connect()
    client.perform_handshake()

    # Valid admin credentials
    auth_res = client.authenticate("admin", "admin123")
    assert auth_res["authenticated"] is True
    assert auth_res["role"] == "admin"
    client.close()

    # Invalid credentials
    client2 = TcpTransferClient(host="127.0.0.1", port=TEST_PORT)
    client2.connect()
    client2.perform_handshake()
    auth_bad = client2.authenticate("admin", "wrongpassword")
    assert auth_bad["authenticated"] is False
    client2.close()
