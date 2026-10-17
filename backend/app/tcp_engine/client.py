import os
import socket
import struct
import json
import uuid
import time
from pathlib import Path
from typing import Optional, Callable, Dict, Any
from backend.app.config import TCP_HOST, TCP_PORT, DEFAULT_CHUNK_SIZE, MAGIC_HEADER
from backend.app.tcp_engine.protocol import ProtocolEngine, MsgType, ProtocolError
from backend.app.tcp_engine.crypto import CryptographyEngine

class TcpTransferClient:
    """
    Client for transmitting files over the Agnos Transfer Protocol (ATP).
    Handles ephemeral key exchange, chunked AES-256-GCM encryption,
    and checkpoint-based resumption.
    """

    def __init__(self, host: str = TCP_HOST, port: int = TCP_PORT):
        self.host = host
        self.port = port
        self.sock: Optional[socket.socket] = None
        self.session_key: Optional[bytes] = None
        self.client_salt: bytes = os.urandom(4)
        self.transfer_id: Optional[str] = None

    def connect(self):
        """Establishes TCP connection to the transfer server."""
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.settimeout(30.0)
        try:
            self.sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except Exception:
            pass
        self.sock.connect((self.host, self.port))

    def close(self):
        """Closes the TCP socket cleanly."""
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
            self.sock = None

    def perform_handshake(self) -> bytes:
        """
        Executes X25519 ephemeral key exchange and derives AES-256 session key.
        """
        if not self.sock:
            raise RuntimeError("Socket not connected")

        # 1. Generate client ephemeral keypair
        client_priv, client_pub_bytes = CryptographyEngine.generate_keypair()

        # 2. Send HANDSHAKE_INIT: 32 bytes pub_key + 4 bytes salt
        handshake_payload = client_pub_bytes + self.client_salt
        self.sock.sendall(ProtocolEngine.pack_message(MsgType.HANDSHAKE_INIT, handshake_payload))

        # 3. Receive HANDSHAKE_RESP: 32 bytes server_pub + 4 bytes server_salt
        msg_type, body = ProtocolEngine.read_message_sync(self.sock)
        if msg_type != MsgType.HANDSHAKE_RESP or len(body) < 36:
            raise ProtocolError(f"Handshake failed: expected HANDSHAKE_RESP, got {msg_type}")

        server_pub_bytes = body[:32]
        server_salt = body[32:36]

        combined_salt = self.client_salt + server_salt

        # 4. Derive symmetric 256-bit AES session key
        self.session_key = CryptographyEngine.derive_session_key(
            client_priv,
            server_pub_bytes,
            salt=combined_salt
        )
        return self.session_key

    def authenticate(self, username: str = "admin", password: str = "admin123") -> Dict[str, Any]:
        """Sends AUTH_REQ and verifies server AUTH_RESP."""
        if not self.sock or not self.session_key:
            raise RuntimeError("Must perform handshake prior to authentication")
        payload = {"username": username, "password": password}
        self.sock.sendall(ProtocolEngine.pack_json(MsgType.AUTH_REQ, payload))
        msg_type, body = ProtocolEngine.read_message_sync(self.sock)
        if msg_type != MsgType.AUTH_RESP:
            raise ProtocolError(f"Expected AUTH_RESP, got {msg_type}")
        return json.loads(body.decode("utf-8"))

    def send_file(
        self,
        filepath: str,
        transfer_id: Optional[str] = None,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        simulate_drop_after_chunks: Optional[int] = None,
        on_progress: Optional[Callable[[int, int, float], None]] = None
    ) -> Dict[str, Any]:
        """
        Transmits a file to the TCP server in AES-256-GCM encrypted chunks.
        Supports resume and simulated drop.
        """
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {filepath}")

        file_size = path.stat().st_size
        filename = path.name
        total_chunks = (file_size + chunk_size - 1) // chunk_size if file_size > 0 else 1
        sha256_hash = CryptographyEngine.compute_sha256_file(str(path))

        if not transfer_id:
            transfer_id = str(uuid.uuid4())
        self.transfer_id = transfer_id

        # 1. Connect and perform cryptographic handshake
        self.connect()
        self.perform_handshake()

        # 2. Initiate transfer metadata
        init_data = {
            "transfer_id": transfer_id,
            "filename": filename,
            "file_size": file_size,
            "total_chunks": total_chunks,
            "sha256_hash": sha256_hash
        }
        self.sock.sendall(ProtocolEngine.pack_json(MsgType.TRANSFER_INIT, init_data))

        # 3. Read ACK & Checkpoint Resume Offset
        msg_type, body = ProtocolEngine.read_message_sync(self.sock)
        if msg_type != MsgType.TRANSFER_ACK:
            raise ProtocolError(f"Expected TRANSFER_ACK, got {msg_type}")

        ack_data = json.loads(body.decode("utf-8"))
        resume_offset = ack_data.get("resume_offset", 0)
        start_chunk = ack_data.get("completed_chunks", 0)

        # 4. Stream Chunks
        bytes_sent = resume_offset
        chunks_transmitted = 0

        with open(path, "rb") as f:
            if resume_offset > 0:
                f.seek(resume_offset)

            for chunk_idx in range(start_chunk, total_chunks):
                # Check for simulated connection interruption
                if simulate_drop_after_chunks and chunks_transmitted >= simulate_drop_after_chunks:
                    self.close()
                    return {
                        "transfer_id": transfer_id,
                        "status": "interrupted",
                        "interrupted": True,
                        "bytes_sent": bytes_sent,
                        "file_size": file_size,
                        "chunks_transmitted": chunks_transmitted,
                        "message": f"Simulated network drop after chunk #{chunk_idx}"
                    }

                chunk_plaintext = f.read(chunk_size)
                if not chunk_plaintext and file_size > 0:
                    break

                byte_offset = bytes_sent
                # Generate unique 96-bit nonce for this chunk
                nonce = CryptographyEngine.generate_nonce(chunk_idx, self.client_salt)

                # AES-256-GCM Encrypt
                ciphertext, tag = CryptographyEngine.encrypt_chunk(
                    self.session_key,
                    chunk_plaintext,
                    nonce
                )

                # Pack CHUNK_DATA message
                chunk_packet = ProtocolEngine.pack_chunk(
                    transfer_id,
                    chunk_idx,
                    byte_offset,
                    nonce,
                    tag,
                    ciphertext
                )
                self.sock.sendall(chunk_packet)

                # Await CHUNK_ACK
                ack_type, ack_body = ProtocolEngine.read_message_sync(self.sock)
                if ack_type != MsgType.CHUNK_ACK:
                    if ack_type == MsgType.ERROR:
                        err_info = json.loads(ack_body.decode("utf-8"))
                        raise ProtocolError(f"Server error on chunk #{chunk_idx}: {err_info.get('error')}")
                    raise ProtocolError(f"Expected CHUNK_ACK, got {ack_type}")

                bytes_sent += len(chunk_plaintext)
                chunks_transmitted += 1

                if on_progress:
                    percent = (bytes_sent / file_size) * 100 if file_size > 0 else 100.0
                    on_progress(bytes_sent, file_size, percent)

        # 5. Send COMPLETE
        self.sock.sendall(ProtocolEngine.pack_message(MsgType.COMPLETE, b""))
        comp_type, comp_body = ProtocolEngine.read_message_sync(self.sock)

        self.close()

        if comp_type != MsgType.COMPLETE:
            raise ProtocolError(f"Expected final COMPLETE, got {comp_type}")

        comp_data = json.loads(comp_body.decode("utf-8"))
        return {
            "transfer_id": transfer_id,
            "status": "completed" if comp_data.get("success") else "failed",
            "interrupted": False,
            "bytes_sent": bytes_sent,
            "file_size": file_size,
            "chunks_transmitted": chunks_transmitted,
            "sha256": sha256_hash,
            "server_response": comp_data
        }

    def resume_transfer(
        self,
        filepath: str,
        transfer_id: str,
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        on_progress: Optional[Callable[[int, int, float], None]] = None
    ) -> Dict[str, Any]:
        """
        Resumes an existing interrupted transfer session.
        Negotiates verified resume offset and completes transmission.
        """
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {filepath}")

        file_size = path.stat().st_size
        total_chunks = (file_size + chunk_size - 1) // chunk_size if file_size > 0 else 1

        self.connect()
        self.perform_handshake()

        # Send RESUME_REQ
        resume_req = {
            "transfer_id": transfer_id,
            "claimed_offset": 0
        }
        self.sock.sendall(ProtocolEngine.pack_json(MsgType.RESUME_REQ, resume_req))

        msg_type, body = ProtocolEngine.read_message_sync(self.sock)
        if msg_type != MsgType.RESUME_RESP:
            raise ProtocolError(f"Expected RESUME_RESP, got {msg_type}")

        resp_data = json.loads(body.decode("utf-8"))
        if not resp_data.get("can_resume"):
            raise ProtocolError(f"Server declined resumption for transfer {transfer_id}")

        verified_offset = resp_data["verified_offset"]
        start_chunk = resp_data["completed_chunks"]

        bytes_sent = verified_offset
        chunks_transmitted = 0

        with open(path, "rb") as f:
            f.seek(verified_offset)

            for chunk_idx in range(start_chunk, total_chunks):
                chunk_plaintext = f.read(chunk_size)
                if not chunk_plaintext:
                    break

                byte_offset = bytes_sent
                nonce = CryptographyEngine.generate_nonce(chunk_idx, self.client_salt)
                ciphertext, tag = CryptographyEngine.encrypt_chunk(
                    self.session_key,
                    chunk_plaintext,
                    nonce
                )

                chunk_packet = ProtocolEngine.pack_chunk(
                    transfer_id,
                    chunk_idx,
                    byte_offset,
                    nonce,
                    tag,
                    ciphertext
                )
                self.sock.sendall(chunk_packet)

                ack_type, ack_body = ProtocolEngine.read_message_sync(self.sock)
                if ack_type != MsgType.CHUNK_ACK:
                    raise ProtocolError(f"Expected CHUNK_ACK on chunk #{chunk_idx}, got {ack_type}")

                bytes_sent += len(chunk_plaintext)
                chunks_transmitted += 1

                if on_progress:
                    percent = (bytes_sent / file_size) * 100 if file_size > 0 else 100.0
                    on_progress(bytes_sent, file_size, percent)

        # Finalize
        self.sock.sendall(ProtocolEngine.pack_message(MsgType.COMPLETE, b""))
        comp_type, comp_body = ProtocolEngine.read_message_sync(self.sock)
        self.close()

        comp_data = json.loads(comp_body.decode("utf-8"))
        return {
            "transfer_id": transfer_id,
            "status": "completed" if comp_data.get("success") else "failed",
            "bytes_sent": bytes_sent,
            "file_size": file_size,
            "chunks_transmitted": chunks_transmitted,
            "server_response": comp_data
        }

    def download_file(
        self,
        remote_filename: str,
        output_filepath: str,
        resume_from_offset: int = 0,
        on_progress: Optional[Callable[[int, int, float], None]] = None
    ) -> Dict[str, Any]:
        """
        Downloads a file from the server vault over an authenticated AES-256-GCM TCP stream.
        Validates each chunk's MAC tag and verifies end-to-end SHA-256 digest.
        """
        dest_path = Path(output_filepath)
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        self.connect()
        self.perform_handshake()

        # Send DOWNLOAD_INIT
        req_data = {
            "filename": remote_filename,
            "client_offset": resume_from_offset
        }
        self.sock.sendall(ProtocolEngine.pack_json(MsgType.DOWNLOAD_INIT, req_data))

        msg_type, body = ProtocolEngine.read_message_sync(self.sock)
        if msg_type == MsgType.ERROR:
            err_info = json.loads(body.decode("utf-8"))
            raise ProtocolError(f"Server rejected download: {err_info.get('error')}")
        if msg_type != MsgType.DOWNLOAD_ACK:
            raise ProtocolError(f"Expected DOWNLOAD_ACK, got {msg_type}")

        ack_data = json.loads(body.decode("utf-8"))
        transfer_id = ack_data["transfer_id"]
        file_size = ack_data["file_size"]
        expected_sha256 = ack_data["sha256_hash"]
        total_chunks = ack_data["total_chunks"]

        bytes_received = resume_from_offset
        chunks_received = 0

        mode = "r+b" if (dest_path.exists() and resume_from_offset > 0) else "wb"
        with open(dest_path, mode) as f:
            if resume_from_offset > 0:
                f.seek(resume_from_offset)

            while True:
                msg_type, body = ProtocolEngine.read_message_sync(self.sock)
                if msg_type == MsgType.COMPLETE:
                    break
                elif msg_type == MsgType.ERROR:
                    err_info = json.loads(body.decode("utf-8"))
                    raise ProtocolError(f"Download stream error: {err_info.get('error')}")
                elif msg_type != MsgType.CHUNK_DATA:
                    raise ProtocolError(f"Expected CHUNK_DATA, got {msg_type}")

                tid, chunk_idx, byte_offset, nonce, tag, ciphertext = ProtocolEngine.unpack_chunk_body(body)

                # Decrypt with AES-256-GCM and verify MAC tag
                plaintext = CryptographyEngine.decrypt_chunk(self.session_key, nonce, ciphertext, tag)
                f.write(plaintext)
                bytes_received += len(plaintext)
                chunks_received += 1

                # Send CHUNK_ACK
                ack_body = struct.pack("!IQ", chunk_idx, byte_offset + len(plaintext))
                self.sock.sendall(ProtocolEngine.pack_message(MsgType.CHUNK_ACK, ack_body))

                if on_progress:
                    percent = (bytes_received / file_size) * 100 if file_size > 0 else 100.0
                    on_progress(bytes_received, file_size, percent)

        self.close()

        # Validate final file SHA-256
        actual_sha256 = CryptographyEngine.compute_sha256_file(str(dest_path))
        if actual_sha256.lower() != expected_sha256.lower():
            raise ProtocolError(f"Downloaded file SHA-256 mismatch: {actual_sha256} != {expected_sha256}")

        return {
            "transfer_id": transfer_id,
            "status": "completed",
            "file_size": file_size,
            "bytes_received": bytes_received,
            "chunks_received": chunks_received,
            "sha256": actual_sha256
        }
