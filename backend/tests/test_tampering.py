import asyncio
import os
import pytest
import threading
import time
import uuid
from backend.app.database import init_db, get_db
from backend.app.tcp_engine.server import TcpTransferServer
from backend.app.tcp_engine.client import TcpTransferClient
from backend.app.tcp_engine.protocol import ProtocolEngine, MsgType, ProtocolError
from backend.app.tcp_engine.crypto import CryptographyEngine

TAMPER_PORT = 9007

@pytest.fixture(scope="module")
def tamper_server():
    init_db()
    server = TcpTransferServer(host="127.0.0.1", port=TAMPER_PORT)
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

def test_tampered_chunk_rejected_by_server(tamper_server):
    """
    Active adversarial test:
    Transmits an AES-GCM chunk where 1 byte in the ciphertext is flipped.
    Server MUST detect invalid authentication tag, reject packet, and log security alert.
    """
    client = TcpTransferClient(host="127.0.0.1", port=TAMPER_PORT)
    client.connect()
    session_key = client.perform_handshake()

    transfer_id = str(uuid.uuid4())
    filename = "tampered_payload.bin"
    file_size = 1024
    total_chunks = 1
    sha256_hash = "0" * 64

    # Send TRANSFER_INIT
    init_data = {
        "transfer_id": transfer_id,
        "filename": filename,
        "file_size": file_size,
        "total_chunks": total_chunks,
        "sha256_hash": sha256_hash
    }
    client.sock.sendall(ProtocolEngine.pack_json(MsgType.TRANSFER_INIT, init_data))
    msg_type, body = ProtocolEngine.read_message_sync(client.sock)
    assert msg_type == MsgType.TRANSFER_ACK

    # Encrypt chunk
    plaintext = b"A" * 1024
    nonce = CryptographyEngine.generate_nonce(0, client.client_salt)
    ciphertext, tag = CryptographyEngine.encrypt_chunk(session_key, plaintext, nonce)

    # TAMPER: Invert 1 byte of ciphertext in transit!
    tampered_ciphertext = bytearray(ciphertext)
    tampered_ciphertext[10] ^= 0x55

    # Pack and send tampered chunk
    chunk_packet = ProtocolEngine.pack_chunk(
        transfer_id, 0, 0, nonce, tag, bytes(tampered_ciphertext)
    )
    client.sock.sendall(chunk_packet)

    # Server should return MSG_ERROR
    err_type, err_body = ProtocolEngine.read_message_sync(client.sock)
    assert err_type == MsgType.ERROR
    client.close()

    time.sleep(0.2)

    # Check that security audit recorded TAMPERING_DETECTED
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT event, status FROM security_audit WHERE event = 'TAMPERING_DETECTED'"
    )
    row = cursor.fetchone()
    assert row is not None
    assert row["status"] == "REJECTED"
    conn.close()
