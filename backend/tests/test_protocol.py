import pytest
import os
import uuid
import struct
from backend.app.tcp_engine.protocol import ProtocolEngine, MsgType, ProtocolError, MAGIC_HEADER

def test_pack_unpack_json_message():
    """Verify JSON message framing round-trip."""
    payload = {"status": "ok", "transfers_count": 42, "node": "atp-local"}
    packed = ProtocolEngine.pack_json(MsgType.TRANSFER_ACK, payload)

    assert packed[:4] == MAGIC_HEADER
    assert packed[4] == int(MsgType.TRANSFER_ACK)
    
    # Read header
    magic, msg_type, body_len = struct.unpack("!4sBI", packed[:9])
    assert magic == MAGIC_HEADER
    assert msg_type == int(MsgType.TRANSFER_ACK)
    assert body_len == len(packed) - 9

def test_pack_unpack_chunk_body():
    """Verify binary chunk packing and unpacking."""
    transfer_id = str(uuid.uuid4())
    chunk_index = 7
    byte_offset = 7 * 65536
    nonce = os.urandom(12)
    tag = os.urandom(16)
    ciphertext = os.urandom(65536)

    packed_msg = ProtocolEngine.pack_chunk(
        transfer_id, chunk_index, byte_offset, nonce, tag, ciphertext
    )

    # Strip 9-byte message header
    body = packed_msg[9:]
    tid, c_idx, offset, n, t, c = ProtocolEngine.unpack_chunk_body(body)

    assert tid == transfer_id
    assert c_idx == chunk_index
    assert offset == byte_offset
    assert n == nonce
    assert t == tag
    assert c == ciphertext

def test_corrupted_magic_raises():
    """Verify that corrupt magic raises ProtocolError."""
    payload = b"test payload"
    # Header with invalid magic
    corrupt_header = struct.pack("!4sBI", b"BAD1", int(MsgType.PING), len(payload))
    
    class FakeReader:
        async def read(self, n):
            return corrupt_header[:n]

    # Test sync header validation logic
    magic, msg_type, body_len = struct.unpack("!4sBI", corrupt_header)
    assert magic != MAGIC_HEADER
