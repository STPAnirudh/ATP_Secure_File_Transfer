import os
import sys
import time
import uuid
import struct
import json
import hashlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from backend.app.tcp_engine.client import TcpTransferClient
from backend.app.tcp_engine.protocol import ProtocolEngine, MsgType
from backend.app.tcp_engine.crypto import CryptographyEngine

PHONE_IP = "192.168.1.10"
PHONE_PORT = 9000

def test_tampered_ciphertext():
    print("\n--- Test 7.3A: Tampered Ciphertext Rejection ---")
    client = TcpTransferClient(host=PHONE_IP, port=PHONE_PORT)
    client.connect()
    key = client.perform_handshake()
    print("[+] Cryptographic handshake established (X25519 + HKDF-SHA256)")

    transfer_id = str(uuid.uuid4())
    init_data = {
        "transfer_id": transfer_id,
        "filename": "tamper_test.bin",
        "file_size": 1024,
        "total_chunks": 1,
        "sha256_hash": "a" * 64
    }
    client.sock.sendall(ProtocolEngine.pack_json(MsgType.TRANSFER_INIT, init_data))
    msg_type, body = ProtocolEngine.read_message_sync(client.sock)
    assert msg_type == MsgType.TRANSFER_ACK, f"Expected TRANSFER_ACK, got {msg_type}"

    # Encrypt 1024 bytes
    plaintext = b"A" * 1024
    nonce = CryptographyEngine.generate_nonce(0, client.client_salt)
    ciphertext, tag = CryptographyEngine.encrypt_chunk(key, plaintext, nonce)

    # TAMPER: Flip bits in ciphertext
    tampered_ciphertext = bytearray(ciphertext)
    tampered_ciphertext[10] ^= 0xFF
    tampered_ciphertext = bytes(tampered_ciphertext)

    chunk_packet = ProtocolEngine.pack_chunk(
        transfer_id=transfer_id,
        chunk_index=0,
        byte_offset=0,
        nonce=nonce,
        tag=tag,
        ciphertext=tampered_ciphertext
    )
    client.sock.sendall(chunk_packet)

    # Expect ERROR response or rejection from server
    try:
        resp_type, resp_body = ProtocolEngine.read_message_sync(client.sock)
        print(f"Server response to tampered chunk: msg_type={resp_type}, body={resp_body}")
        assert resp_type == MsgType.ERROR or b"tamper" in resp_body.lower() or b"tag" in resp_body.lower() or b"failed" in resp_body.lower()
        print("[PASS] Server successfully rejected tampered ciphertext!")
    except (EOFError, ConnectionResetError):
        print("[PASS] Server immediately dropped connection on AEAD tag failure!")
    finally:
        client.close()

def test_tampered_tag():
    print("\n--- Test 7.3B: Tampered 128-bit Authentication Tag Rejection ---")
    client = TcpTransferClient(host=PHONE_IP, port=PHONE_PORT)
    client.connect()
    key = client.perform_handshake()

    transfer_id = str(uuid.uuid4())
    init_data = {
        "transfer_id": transfer_id,
        "filename": "tag_tamper.bin",
        "file_size": 1024,
        "total_chunks": 1,
        "sha256_hash": "b" * 64
    }
    client.sock.sendall(ProtocolEngine.pack_json(MsgType.TRANSFER_INIT, init_data))
    msg_type, body = ProtocolEngine.read_message_sync(client.sock)
    assert msg_type == MsgType.TRANSFER_ACK

    plaintext = b"B" * 1024
    nonce = CryptographyEngine.generate_nonce(0, client.client_salt)
    ciphertext, tag = CryptographyEngine.encrypt_chunk(key, plaintext, nonce)

    # TAMPER: Corrupt authentication tag
    tampered_tag = bytearray(tag)
    tampered_tag[0] ^= 0x01
    tampered_tag = bytes(tampered_tag)

    chunk_packet = ProtocolEngine.pack_chunk(
        transfer_id=transfer_id,
        chunk_index=0,
        byte_offset=0,
        nonce=nonce,
        tag=tampered_tag,
        ciphertext=ciphertext
    )
    client.sock.sendall(chunk_packet)

    try:
        resp_type, resp_body = ProtocolEngine.read_message_sync(client.sock)
        print(f"Server response to tampered tag: msg_type={resp_type}, body={resp_body}")
        assert resp_type == MsgType.ERROR or b"failed" in resp_body.lower()
        print("[PASS] Server successfully rejected tampered auth tag!")
    except (EOFError, ConnectionResetError):
        print("[PASS] Server immediately severed socket on invalid AEAD tag!")
    finally:
        client.close()

def test_whole_file_hash_mismatch():
    print("\n--- Test 7.4: Whole-File SHA-256 Digest Mismatch Detection ---")
    client = TcpTransferClient(host=PHONE_IP, port=PHONE_PORT)
    client.connect()
    key = client.perform_handshake()

    transfer_id = str(uuid.uuid4())
    fake_sha256 = "0000000000000000000000000000000000000000000000000000000000000000"
    init_data = {
        "transfer_id": transfer_id,
        "filename": "hash_mismatch.bin",
        "file_size": 1024,
        "total_chunks": 1,
        "sha256_hash": fake_sha256
    }
    client.sock.sendall(ProtocolEngine.pack_json(MsgType.TRANSFER_INIT, init_data))
    msg_type, _ = ProtocolEngine.read_message_sync(client.sock)
    assert msg_type == MsgType.TRANSFER_ACK

    # Send valid encrypted chunk with data that won't match fake_sha256
    plaintext = b"X" * 1024
    nonce = CryptographyEngine.generate_nonce(0, client.client_salt)
    ciphertext, tag = CryptographyEngine.encrypt_chunk(key, plaintext, nonce)

    chunk_packet = ProtocolEngine.pack_chunk(
        transfer_id=transfer_id,
        chunk_index=0,
        byte_offset=0,
        nonce=nonce,
        tag=tag,
        ciphertext=ciphertext
    )
    client.sock.sendall(chunk_packet)
    ack_type, ack_body = ProtocolEngine.read_message_sync(client.sock)
    print(f"DEBUG: ack_type={ack_type}, ack_body={ack_body}")
    assert ack_type == MsgType.CHUNK_ACK

    # Send COMPLETE
    client.sock.sendall(ProtocolEngine.pack_json(MsgType.COMPLETE, {"transfer_id": transfer_id}))
    comp_type, comp_body = ProtocolEngine.read_message_sync(client.sock)
    print(f"Server response to hash mismatch: msg_type={comp_type}, body={comp_body}")

    resp_json = json.loads(comp_body.decode())
    assert resp_json.get("success") is False, "Server incorrectly marked mismatched hash as successful!"
    print(f"[PASS] Server caught hash integrity violation: {resp_json.get('message')}")
    client.close()

def main():
    print("=== TEST 7: CRYPTOGRAPHIC SECURITY & INTEGRITY VERIFICATION ===")
    test_tampered_ciphertext()
    test_tampered_tag()
    test_whole_file_hash_mismatch()
    print("\n[PASS] All Security & Tampering Rejection tests PASSED successfully!")

if __name__ == "__main__":
    main()
