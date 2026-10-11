# Performance Evaluation & Benchmarking

## 1. Benchmarking Environment

- **Operating System**: Windows 11 (64-bit)
- **Runtime**: Python 3.11.9, Node.js 24.20.0
- **Transport**: Real TCP sockets over loopback (`127.0.0.1:9009`)
- **Cipher Suite**: AES-256-GCM (256-bit key, 128-bit Poly1305/GHASH tag, 96-bit unique IV)
- **Key Exchange**: X25519 Ephemeral ECDH + HKDF-SHA256
- **Chunk Size**: 65,536 bytes (64 KB)

---

## 2. Throughput & Latency Measurements

The benchmark suite (`backend/benchmark.py`) streams cryptographically random byte payloads through the real TCP engine, measuring elapsed time, effective throughput, and byte-for-byte SHA-256 verification:

| Payload Size | Total Bytes | Chunks Transmitted | Elapsed Time | Throughput (MB/s) | Throughput (Mbps) | SHA-256 Match |
|---|---|---|---|---|---|---|
| **1 MB** | 1,048,576 B | 16 chunks | 0.33 s | 3.01 MB/s | 24.10 Mbps | **PASSED [OK]** |
| **5 MB** | 5,242,880 B | 80 chunks | 1.12 s | 4.46 MB/s | 35.71 Mbps | **PASSED [OK]** |
| **20 MB** | 20,971,520 B | 320 chunks | 4.31 s | 4.64 MB/s | 37.16 Mbps | **PASSED [OK]** |

---

## 3. Resumption Recovery Benchmark

To evaluate fault tolerance under network interruption:
1. A **10 MB** test file (160 chunks) was initiated.
2. The socket connection was deliberately dropped after **50 chunks (3.2 MB)**.
3. A new client established a fresh TCP connection, completed a new X25519 key exchange, and requested resumption.
4. The server verified its existing 3.2 MB checkpoint in SQLite and on disk, approving resumption starting from chunk #50.
5. The remaining **6.8 MB** was streamed to completion.

- **Checkpoint Lookup Latency**: < 15 ms
- **Resumption & Final Reassembly Time**: **1.62 seconds**
- **Final SHA-256 Digest Match**: **PASSED [OK]**

---

## 4. Multi-Client Concurrency Evaluation

Under `test_concurrency.py`, 5 simultaneous clients were spawned across separate threads:
- All 5 transfers executed concurrently through non-blocking asyncio event loops without socket head-of-line blocking.
- Memory usage remained strictly bounded because each connection processes only one 64 KB chunk buffer at a time.
- All 5 received files passed independent SHA-256 verification upon receipt.
