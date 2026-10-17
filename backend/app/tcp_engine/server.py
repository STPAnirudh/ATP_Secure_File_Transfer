import asyncio
import os
import struct
import json
import logging
import socket
import uuid
from typing import Dict, Optional
from backend.app.config import TCP_HOST, TCP_PORT, SOCKET_TIMEOUT, MAX_CONCURRENT_CLIENTS, DEFAULT_CHUNK_SIZE, RECEIVED_DIR
from backend.app.tcp_engine.protocol import ProtocolEngine, MsgType, ProtocolError
from backend.app.tcp_engine.crypto import CryptographyEngine, InvalidTag
from backend.app.tcp_engine.storage import StorageManager
from backend.app.database import get_db, log_activity, log_security, hash_password

logger = logging.getLogger("atp_tcp_server")
logging.basicConfig(level=logging.INFO)

class ClientSession:
    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter, client_ip: str):
        self.reader = reader
        self.writer = writer
        self.client_ip = client_ip
        self.state = "INIT"
        self.session_key: Optional[bytes] = None
        self.session_salt: bytes = os.urandom(4)
        self.transfer_id: Optional[str] = None
        self.ephemeral_priv = None
        self.ephemeral_pub_bytes = None
        self.authenticated = False
        self.username = "anonymous"
        self.role = "guest"

class TcpTransferServer:
    def __init__(self, host: str = TCP_HOST, port: int = TCP_PORT):
        self.host = host
        self.port = port
        self.server: Optional[asyncio.Server] = None
        self.active_sessions: Dict[str, ClientSession] = {}
        self.is_running = False

    async def start(self):
        """Starts the multi-client TCP socket server."""
        self.server = await asyncio.start_server(
            self.handle_client,
            self.host,
            self.port,
            limit=2 * 1024 * 1024  # 2 MB buffer limit
        )
        self.is_running = True
        logger.info(f"ATP TCP Server listening on {self.host}:{self.port}")

    async def stop(self):
        """Stops the TCP server and cleanly closes all client sessions."""
        if self.server:
            self.server.close()
            try:
                await self.server.wait_closed()
            except Exception:
                pass
            for session in list(self.active_sessions.values()):
                try:
                    if session.writer and not session.writer.is_closing():
                        session.writer.close()
                except Exception:
                    pass
            self.active_sessions.clear()
            self.is_running = False
            logger.info("ATP TCP Server stopped.")

    async def handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        peer = writer.get_extra_info("peername")
        client_ip = f"{peer[0]}:{peer[1]}" if peer else "unknown"

        # Optimize socket for low-latency transmission
        raw_sock = writer.get_extra_info("socket")
        if raw_sock:
            try:
                raw_sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            except Exception:
                pass

        session = ClientSession(reader, writer, client_ip)
        session_id = f"sess_{os.urandom(6).hex()}"
        self.active_sessions[session_id] = session

        logger.info(f"[{session_id}] New client connected from {client_ip}")

        try:
            while True:
                # Read next message with timeout
                try:
                    msg_type, body = await asyncio.wait_for(
                        ProtocolEngine.read_message_async(reader),
                        timeout=SOCKET_TIMEOUT
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"[{session_id}] Connection timed out")
                    break
                except EOFError:
                    logger.info(f"[{session_id}] Client disconnected cleanly")
                    break

                # Dispatch message
                await self.process_message(session, msg_type, body)

        except ProtocolError as pe:
            logger.error(f"[{session_id}] Protocol violation: {pe}")
            log_security("PROTOCOL_VIOLATION", client_ip, "REJECTED", str(pe))
            try:
                err_resp = ProtocolEngine.pack_json(MsgType.ERROR, {"error": str(pe)})
                writer.write(err_resp)
                await writer.drain()
            except Exception:
                pass
        except Exception as e:
            logger.exception(f"[{session_id}] Unexpected error: {e}")
        finally:
            # Mark active transfer as interrupted if not completed
            if session.transfer_id:
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE transfers SET status = 'interrupted' WHERE id = ? AND status = 'in_progress'",
                    (session.transfer_id,)
                )
                conn.commit()
                conn.close()
                log_activity(
                    session.transfer_id,
                    "TRANSFER_INTERRUPTED",
                    f"Client disconnected; transfer saved as resumable checkpoint",
                    "warning"
                )

            self.active_sessions.pop(session_id, None)
            try:
                if not writer.is_closing():
                    writer.close()
                    await writer.wait_closed()
            except Exception:
                pass
            logger.info(f"[{session_id}] Session closed")


    async def process_message(self, session: ClientSession, msg_type: MsgType, body: bytes):
        writer = session.writer

        # 1. Handshake Initiation
        if msg_type == MsgType.HANDSHAKE_INIT:
            if len(body) < 36:
                raise ProtocolError("HANDSHAKE_INIT requires 32-byte public key + 4-byte salt")

            client_pub_bytes = body[:32]
            client_salt = body[32:36]

            # Generate server keypair
            server_priv, server_pub_bytes = CryptographyEngine.generate_keypair()
            combined_salt = client_salt + session.session_salt

            # Derive symmetric AES-256 session key
            session.session_key = CryptographyEngine.derive_session_key(
                server_priv,
                client_pub_bytes,
                salt=combined_salt
            )
            session.state = "AUTHENTICATED"

            # Reply with server public key + server salt
            resp_body = server_pub_bytes + session.session_salt
            writer.write(ProtocolEngine.pack_message(MsgType.HANDSHAKE_RESP, resp_body))
            await writer.drain()

            key_fingerprint = CryptographyEngine.compute_sha256_bytes(session.session_key)[:16]
            log_security(
                "KEY_EXCHANGE_SUCCESS",
                session.client_ip,
                "ESTABLISHED",
                f"X25519 ECDH established. Session key fingerprint: {key_fingerprint}"
            )

        # 1b. Session Authentication (Optional / Explicit)
        elif msg_type == MsgType.AUTH_REQ:
            if not session.session_key:
                raise ProtocolError("Cannot authenticate before key exchange")

            auth_data = json.loads(body.decode("utf-8"))
            username = auth_data.get("username", "")
            password = auth_data.get("password", "")

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id, role, password_hash FROM users WHERE username = ?", (username,))
            user = cursor.fetchone()
            conn.close()

            if user and user["password_hash"] == hash_password(password):
                session.authenticated = True
                session.username = username
                session.role = user["role"]
                log_security("AUTH_SUCCESS", session.client_ip, "AUTHENTICATED", f"User {username} authenticated successfully")
                resp = {"authenticated": True, "username": username, "role": session.role}
            else:
                log_security("AUTH_FAILURE", session.client_ip, "REJECTED", f"Failed authentication for user {username}")
                resp = {"authenticated": False, "error": "Invalid username or password"}

            writer.write(ProtocolEngine.pack_json(MsgType.AUTH_RESP, resp))
            await writer.drain()

        # 2. Transfer Metadata Initiation
        elif msg_type == MsgType.TRANSFER_INIT:
            if session.state != "AUTHENTICATED" or not session.session_key:
                raise ProtocolError("Cannot initiate transfer before successful handshake")

            meta = json.loads(body.decode("utf-8"))
            transfer_id = meta["transfer_id"]
            filename = meta["filename"]
            file_size = meta["file_size"]
            total_chunks = meta["total_chunks"]
            sha256_hash = meta["sha256_hash"]

            session.transfer_id = transfer_id
            session.state = "TRANSFERRING"

            key_fingerprint = CryptographyEngine.compute_sha256_bytes(session.session_key)[:16]
            StorageManager.init_transfer_record(
                transfer_id, filename, file_size, total_chunks, sha256_hash,
                session.client_ip, key_fingerprint
            )

            # Check if partial resume is possible
            verified_offset, completed_count, can_resume = StorageManager.get_validated_resume_state(transfer_id)

            ack_data = {
                "transfer_id": transfer_id,
                "status": "ready",
                "resume_offset": verified_offset if can_resume else 0,
                "completed_chunks": completed_count if can_resume else 0
            }
            writer.write(ProtocolEngine.pack_json(MsgType.TRANSFER_ACK, ack_data))
            await writer.drain()

        # 3. Resume Request Negotiation
        elif msg_type == MsgType.RESUME_REQ:
            if not session.session_key:
                raise ProtocolError("Handshake required before resume")

            data = json.loads(body.decode("utf-8"))
            transfer_id = data["transfer_id"]
            claimed_offset = data.get("claimed_offset", 0)

            # Strictly validate against local SQLite & disk!
            verified_offset, completed_count, can_resume = StorageManager.get_validated_resume_state(transfer_id)
            session.transfer_id = transfer_id
            session.state = "TRANSFERRING"

            resp_data = {
                "transfer_id": transfer_id,
                "can_resume": can_resume,
                "verified_offset": verified_offset,
                "completed_chunks": completed_count
            }

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE transfers SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (transfer_id,)
            )
            conn.commit()
            conn.close()

            log_activity(
                transfer_id,
                "TRANSFER_RESUMED",
                f"Resuming transfer from verified byte offset {verified_offset} (claimed: {claimed_offset})",
                "info"
            )

            writer.write(ProtocolEngine.pack_json(MsgType.RESUME_RESP, resp_data))
            await writer.drain()

        # 4. Chunk Data Transmission
        elif msg_type == MsgType.CHUNK_DATA:
            if not session.session_key:
                raise ProtocolError("No session key for decrypting chunk")

            transfer_id, chunk_index, byte_offset, nonce, tag, ciphertext = ProtocolEngine.unpack_chunk_body(body)

            # Attempt AES-256-GCM authenticated decryption
            try:
                plaintext = CryptographyEngine.decrypt_chunk(
                    session.session_key,
                    nonce,
                    ciphertext,
                    tag
                )
            except InvalidTag:
                logger.error(f"[{session.client_ip}] AES-GCM Tag Verification Failed on chunk #{chunk_index}")
                log_security(
                    "TAMPERING_DETECTED",
                    session.client_ip,
                    "REJECTED",
                    f"Invalid authentication tag for chunk #{chunk_index} in transfer {transfer_id}. Potential ciphertext tampering."
                )
                log_activity(
                    transfer_id,
                    "TAMPER_DETECTED",
                    f"Authentication tag verification failed on chunk #{chunk_index}. Dropping connection.",
                    "error"
                )
                err_resp = ProtocolEngine.pack_json(MsgType.ERROR, {
                    "error": "AES-GCM Authentication Tag mismatch. Data was corrupted or tampered with."
                })
                writer.write(err_resp)
                await writer.drain()
                raise ProtocolError("Cryptographic authentication failure")

            # Write verified plaintext & checkpoint in SQLite
            transferred_bytes, completed_chunks = StorageManager.write_verified_chunk(
                transfer_id, chunk_index, byte_offset, plaintext
            )

            # Send ACK
            ack_body = struct.pack("!IQ", chunk_index, byte_offset + len(plaintext))
            writer.write(ProtocolEngine.pack_message(MsgType.CHUNK_ACK, ack_body))
            await writer.drain()

        # 5. Finalize Transfer
        elif msg_type == MsgType.COMPLETE:
            transfer_id = session.transfer_id
            if not transfer_id:
                raise ProtocolError("No active transfer to complete")

            success, msg = StorageManager.validate_and_finalize_transfer(transfer_id)
            resp_data = {
                "transfer_id": transfer_id,
                "success": success,
                "message": msg
            }
            writer.write(ProtocolEngine.pack_json(MsgType.COMPLETE, resp_data))
            await writer.drain()
            session.state = "COMPLETE"

        # 6. TCP Encrypted File Download
        elif msg_type == MsgType.DOWNLOAD_INIT:
            if not session.session_key:
                raise ProtocolError("Handshake required before download")

            data = json.loads(body.decode("utf-8"))
            raw_filename = data.get("filename", "")
            client_offset = data.get("client_offset", 0)
            clean_filename = os.path.basename(raw_filename)

            target_path = RECEIVED_DIR / clean_filename
            if not target_path.exists() or not target_path.is_file():
                err_resp = ProtocolEngine.pack_json(MsgType.ERROR, {"error": f"File '{clean_filename}' not found in vault"})
                writer.write(err_resp)
                await writer.drain()
                return

            file_size = target_path.stat().st_size
            total_chunks = (file_size + DEFAULT_CHUNK_SIZE - 1) // DEFAULT_CHUNK_SIZE if file_size > 0 else 1
            sha256_hash = CryptographyEngine.compute_sha256_file(str(target_path))
            transfer_id = str(uuid.uuid4())
            session.transfer_id = transfer_id
            session.state = "STREAMING_DOWNLOAD"

            key_fingerprint = CryptographyEngine.compute_sha256_bytes(session.session_key)[:16]
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO transfers (
                    id, file_name, file_size, total_chunks, transferred_bytes,
                    completed_chunks, sha256_hash, status, direction, client_ip,
                    session_key_fingerprint, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', 'download', ?, ?, CURRENT_TIMESTAMP)
            """, (transfer_id, clean_filename, file_size, total_chunks, client_offset, client_offset // DEFAULT_CHUNK_SIZE if DEFAULT_CHUNK_SIZE else 0, sha256_hash, session.client_ip, key_fingerprint))
            conn.commit()
            conn.close()

            ack_data = {
                "transfer_id": transfer_id,
                "filename": clean_filename,
                "file_size": file_size,
                "total_chunks": total_chunks,
                "sha256_hash": sha256_hash,
                "start_offset": client_offset
            }
            writer.write(ProtocolEngine.pack_json(MsgType.DOWNLOAD_ACK, ack_data))
            await writer.drain()

            log_activity(transfer_id, "DOWNLOAD_START", f"Streaming TCP download of {clean_filename} to {session.client_ip}", "info")

            start_chunk = client_offset // DEFAULT_CHUNK_SIZE if DEFAULT_CHUNK_SIZE else 0
            bytes_sent = client_offset
            with open(target_path, "rb") as f:
                if client_offset > 0:
                    f.seek(client_offset)

                for chunk_idx in range(start_chunk, total_chunks):
                    plaintext = f.read(DEFAULT_CHUNK_SIZE)
                    if not plaintext and file_size > 0:
                        break

                    byte_offset = bytes_sent
                    nonce = CryptographyEngine.generate_nonce(chunk_idx, session.session_salt)
                    ciphertext, tag = CryptographyEngine.encrypt_chunk(session.session_key, plaintext, nonce)

                    chunk_packet = ProtocolEngine.pack_chunk(
                        transfer_id, chunk_idx, byte_offset, nonce, tag, ciphertext
                    )
                    writer.write(chunk_packet)
                    await writer.drain()

                    # Await client CHUNK_ACK
                    ack_type, ack_b = await ProtocolEngine.read_message_async(session.reader)
                    if ack_type != MsgType.CHUNK_ACK:
                        raise ProtocolError(f"Expected CHUNK_ACK during download, got {ack_type}")

                    bytes_sent += len(plaintext)

            # Send COMPLETE notification
            writer.write(ProtocolEngine.pack_json(MsgType.COMPLETE, {
                "transfer_id": transfer_id,
                "success": True,
                "file_size": file_size,
                "sha256": sha256_hash
            }))
            await writer.drain()

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE transfers SET status = 'completed', transferred_bytes = ?, completed_chunks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                           (bytes_sent, total_chunks, transfer_id))
            conn.commit()
            conn.close()
            log_activity(transfer_id, "DOWNLOAD_COMPLETE", f"TCP download of {clean_filename} verified and completed", "success")

        # 7. Ping / Pong Keep-Alive
        elif msg_type == MsgType.PING:
            writer.write(ProtocolEngine.pack_message(MsgType.PONG, b"PONG"))
            await writer.drain()
