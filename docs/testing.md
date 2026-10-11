# Testing & Verification Strategy

## 1. Test Suite Overview

ATP is tested through 20 automated unit and integration tests spanning cryptography, TCP socket networking, concurrent client pooling, fault injection (simulated drops), adversarial tampering, and API security.

```
backend/tests/
├── test_crypto.py          # 5 tests: ECDH, AES-GCM, Tampering, Tag rejection, SHA-256
├── test_protocol.py        # 3 tests: Framing, Chunk packing, Magic header validation
├── test_tcp_transfer.py    # 2 tests: Real TCP socket multi-chunk stream & empty files
├── test_resumable.py       # 1 test: Socket drop fault injection & atomic offset resume
├── test_tampering.py       # 1 test: In-flight bit-flip rejection & audit logging
├── test_api.py             # 7 tests: FastAPI endpoints, health, path traversal defense
└── test_concurrency.py     # 1 test: 5 simultaneous concurrent client transfers
```

---

## 2. Running Automated Tests

To execute the complete test suite:

```powershell
python -m pytest backend/tests -v
```

### Running Specific Categories

1. **Cryptographic Suite Verification**:
   ```powershell
   python -m pytest backend/tests/test_crypto.py -v
   ```

2. **Fault-Injection & Resumability**:
   ```powershell
   python -m pytest backend/tests/test_resumable.py -v
   ```

3. **Active Adversarial Tampering Rejection**:
   ```powershell
   python -m pytest backend/tests/test_tampering.py -v
   ```

4. **Multi-Client Concurrency**:
   ```powershell
   python -m pytest backend/tests/test_concurrency.py -v
   ```

---

## 3. Test Cases & Verification Results

| Test File | Test Case | Purpose | Verified Result |
|---|---|---|---|
| `test_crypto.py` | `test_x25519_key_exchange` | X25519 ECDH shared secret derivation | PASSED |
| `test_crypto.py` | `test_aes_gcm_encryption_decryption` | 256-bit AES-GCM round-trip | PASSED |
| `test_crypto.py` | `test_aes_gcm_tampering_rejected` | Modifies 1 bit in ciphertext; asserts `InvalidTag` | PASSED |
| `test_crypto.py` | `test_aes_gcm_tag_tampering_rejected` | Alters 1 byte in MAC tag; asserts `InvalidTag` | PASSED |
| `test_crypto.py` | `test_sha256_digests` | FIPS 180-4 SHA-256 standard vector validation | PASSED |
| `test_protocol.py` | `test_pack_unpack_json_message` | 9-byte header framing and JSON decoding | PASSED |
| `test_protocol.py` | `test_pack_unpack_chunk_body` | 60-byte binary chunk metadata packing | PASSED |
| `test_protocol.py` | `test_corrupted_magic_raises` | Validates rejection of non-ATP1 headers | PASSED |
| `test_tcp_transfer.py` | `test_full_file_transfer` | Streams 150 KB multi-chunk file over real TCP | PASSED |
| `test_tcp_transfer.py` | `test_empty_file_transfer` | Streams 0-byte file without corruption | PASSED |
| `test_resumable.py` | `test_interrupted_transfer_and_resume` | Drops socket after chunk #2; resumes from offset 131,072 | PASSED |
| `test_tampering.py` | `test_tampered_chunk_rejected_by_server` | In-flight bit-flip rejected; audit recorded | PASSED |
| `test_concurrency.py` | `test_multi_client_concurrent_transfers` | 5 simultaneous clients with isolated sessions | PASSED |
| `test_api.py` | `test_health_endpoint` | Health telemetry and uptime check | PASSED |
| `test_api.py` | `test_list_transfers` | Transfer history metadata retrieval | PASSED |
| `test_api.py` | `test_list_files` | Vault directory listing | PASSED |
| `test_api.py` | `test_activity_logs` | Event audit log retrieval | PASSED |
| `test_api.py` | `test_security_status` | Cryptographic parameter verification | PASSED |
| `test_api.py` | `test_settings_get_and_update` | Dynamic runtime settings modification | PASSED |
| `test_api.py` | `test_path_traversal_blocked` | Rejection of directory traversal paths (`..etc`) | PASSED |
