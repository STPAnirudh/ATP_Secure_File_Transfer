import struct
import json
import uuid
from enum import IntEnum
from typing import Tuple, Dict, Any, Optional

MAGIC_HEADER = b"ATP1"  # 4 bytes
HEADER_SIZE = 9          # 4 bytes Magic + 1 byte MsgType + 4 bytes BodyLength

class MsgType(IntEnum):
    HANDSHAKE_INIT = 1
    HANDSHAKE_RESP = 2
    AUTH_REQ = 3
    AUTH_RESP = 4
    TRANSFER_INIT = 5
    TRANSFER_ACK = 6
    CHUNK_DATA = 7
    CHUNK_ACK = 8
    RESUME_REQ = 9
    RESUME_RESP = 10
    COMPLETE = 11
    ERROR = 12
    PING = 13
    PONG = 14
    DOWNLOAD_INIT = 15
    DOWNLOAD_ACK = 16

class ProtocolError(Exception):
    pass

class ProtocolEngine:
    """
    Handles framing, encoding, and decoding for ATP (Agnos Transfer Protocol).
    Guarantees deterministic TCP message boundaries via length-prefix framing.
    """

    @staticmethod
    def pack_message(msg_type: MsgType, body: bytes) -> bytes:
        """
        Packs a message with 9-byte framing header:
        - 4-byte Magic (b'ATP1')
        - 1-byte MsgType
        - 4-byte uint32 Body Length (Big-Endian)
        - Followed by body bytes
        """
        body_len = len(body)
        header = struct.pack("!4sBI", MAGIC_HEADER, int(msg_type), body_len)
        return header + body

    @staticmethod
    def pack_json(msg_type: MsgType, data: Dict[str, Any]) -> bytes:
        """Helper to serialize structured metadata as JSON body."""
        body = json.dumps(data).encode("utf-8")
        return ProtocolEngine.pack_message(msg_type, body)

    @staticmethod
    def pack_chunk(
        transfer_id: str,
        chunk_index: int,
        byte_offset: int,
        nonce: bytes,
        tag: bytes,
        ciphertext: bytes
    ) -> bytes:
        """
        Packs CHUNK_DATA message:
        Body format:
        - 16 bytes transfer_id (UUID bytes)
        - 4 bytes chunk_index (uint32)
        - 8 bytes byte_offset (uint64)
        - 12 bytes nonce
        - 16 bytes auth_tag
        - 4 bytes ciphertext_len (uint32)
        - N bytes ciphertext
        Total chunk metadata header inside body: 60 bytes.
        """
        tid_bytes = uuid.UUID(transfer_id).bytes
        header = struct.pack(
            "!16sIQ12s16sI",
            tid_bytes,
            chunk_index,
            byte_offset,
            nonce,
            tag,
            len(ciphertext)
        )
        return ProtocolEngine.pack_message(MsgType.CHUNK_DATA, header + ciphertext)

    @staticmethod
    def unpack_chunk_body(body: bytes) -> Tuple[str, int, int, bytes, bytes, bytes]:
        """
        Unpacks CHUNK_DATA body.
        Returns: (transfer_id, chunk_index, byte_offset, nonce, tag, ciphertext)
        """
        if len(body) < 60:
            raise ProtocolError(f"Chunk body too short: {len(body)} < 60 bytes")

        tid_bytes, chunk_index, byte_offset, nonce, tag, ciphertext_len = struct.unpack(
            "!16sIQ12s16sI",
            body[:60]
        )
        transfer_id = str(uuid.UUID(bytes=tid_bytes))
        ciphertext = body[60:60 + ciphertext_len]
        
        if len(ciphertext) != ciphertext_len:
            raise ProtocolError(f"Ciphertext truncated: expected {ciphertext_len}, got {len(ciphertext)}")

        return transfer_id, chunk_index, byte_offset, nonce, tag, ciphertext

    @staticmethod
    async def read_exact_async(reader, num_bytes: int) -> bytes:
        """
        Asynchronously reads exact number of bytes from an asyncio.StreamReader.
        Raises EOFError if connection closes before all bytes are received.
        """
        data = bytearray()
        while len(data) < num_bytes:
            packet = await reader.read(num_bytes - len(data))
            if not packet:
                raise EOFError("Socket closed prematurely during read_exact")
            data.extend(packet)
        return bytes(data)

    @staticmethod
    async def read_message_async(reader) -> Tuple[MsgType, bytes]:
        """
        Reads a framed ATP message from an asyncio.StreamReader:
        1. Reads 9-byte header
        2. Validates 4-byte magic
        3. Extracts msg_type and body_length
        4. Reads exact body_length bytes
        """
        header_bytes = await ProtocolEngine.read_exact_async(reader, HEADER_SIZE)
        magic, msg_type_int, body_len = struct.unpack("!4sBI", header_bytes)

        if magic != MAGIC_HEADER:
            raise ProtocolError(f"Invalid magic header: {magic!r}")

        try:
            msg_type = MsgType(msg_type_int)
        except ValueError:
            raise ProtocolError(f"Unknown message type: {msg_type_int}")

        if body_len > 10 * 1024 * 1024:  # 10 MB sanity limit
            raise ProtocolError(f"Message body exceeds sanity limit: {body_len} bytes")

        body = await ProtocolEngine.read_exact_async(reader, body_len)
        return msg_type, body

    @staticmethod
    def read_exact_sync(sock, num_bytes: int) -> bytes:
        """
        Synchronously reads exact number of bytes from a socket.
        """
        data = bytearray()
        while len(data) < num_bytes:
            packet = sock.recv(num_bytes - len(data))
            if not packet:
                raise EOFError("Socket closed prematurely during read_exact_sync")
            data.extend(packet)
        return bytes(data)

    @staticmethod
    def read_message_sync(sock) -> Tuple[MsgType, bytes]:
        """
        Synchronously reads a framed ATP message from a socket.
        """
        header_bytes = ProtocolEngine.read_exact_sync(sock, HEADER_SIZE)
        magic, msg_type_int, body_len = struct.unpack("!4sBI", header_bytes)

        if magic != MAGIC_HEADER:
            raise ProtocolError(f"Invalid magic header: {magic!r}")

        msg_type = MsgType(msg_type_int)
        body = ProtocolEngine.read_exact_sync(sock, body_len)
        return msg_type, body
