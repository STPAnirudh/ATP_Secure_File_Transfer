import asyncio
import os
import struct
import json
import logging
from typing import Dict, Optional
from backend.app.config import TCP_HOST, TCP_PORT, SOCKET_TIMEOUT, MAX_CONCURRENT_CLIENTS
from backend.app.tcp_engine.protocol import ProtocolEngine, MsgType, ProtocolError
from backend.app.tcp_engine.crypto import CryptographyEngine, InvalidTag
from backend.app.tcp_engine.storage import StorageManager
from backend.app.database import get_db, log_activity, log_security

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
        """Stops the TCP server."""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            self.is_running = False
            logger.info("ATP TCP Server stopped.")

    async def handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        peer = writer.get_extra_info("peername")
        client_ip = f"{peer[0]}:{peer[1]}" if peer else "unknown"
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

        # 6. Ping / Pong Keep-Alive
        elif msg_type == MsgType.PING:
            writer.write(ProtocolEngine.pack_message(MsgType.PONG, b"PONG"))
            await writer.drain()
