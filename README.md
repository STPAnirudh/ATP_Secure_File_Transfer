# ATP — Secure Multi-Client File Transfer Network

**Deterministic, Chunk-Verified File Transmission Network with AES-256-GCM Authenticated Encryption and Resumable TCP Communication**

Inspired closely by the visual language of the [Agnos Design Studio](https://agnos-wbs.framer.website/).

---

## 1. Core Capabilities

1. **Custom TCP Transfer Engine**:
   - Explicit 9-byte length-prefix framing (`Magic: ATP1`) preventing TCP stream fragmentation issues.
   - Bounded 64 KB chunk buffers guaranteeing zero memory bloat on large files.
   - Multi-client concurrency with non-blocking socket loops and isolated client session contexts.

2. **Cryptographic Security Plane**:
   - **AES-256-GCM Authenticated Encryption**: Every chunk is encrypted with an independent 96-bit nonce and verified with a 128-bit MAC tag prior to disk write.
   - **X25519 Ephemeral Key Exchange**: Curve25519 ECDH + HKDF-SHA256 session key negotiation providing Perfect Forward Secrecy (PFS). Raw keys are never transmitted.
   - **Active Tamper Rejection**: Any in-flight modification of ciphertext or authentication tags immediately raises an exception, drops the connection, and logs a security audit alert.
   - **End-to-End SHA-256 Verification**: Full reconstructed files are independently hashed on disk and compared bit-for-bit against expected digests.

3. **Persistent Resumable Checkpoints**:
   - SQLite atomic state ledger recording every verified chunk offset.
   - Fault injection testing verifies that abruptly dropped socket connections resume instantly from the exact interrupted byte offset without re-transmitting completed chunks.
   - Server strictly cross-validates existing partial files on disk against database records before approving resume offsets.

4. **Agnos-Inspired User Interface**:
   - Public Landing Page styled after Agnos's deep obsidian (`#060612`) and vibrant vermilion (`#ff6321`) palette, Geist typography, and Caveat editorial script accents.
   - Complete application console: **Overview**, **Transfers**, **Send File**, **Received Files**, **Activity Audit**, **Security Status**, and **Settings**.

---

## 2. Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, React Router DOM.
- **Backend HTTP Control Plane**: Python 3.11, FastAPI, Uvicorn, SQLite3.
- **Networking Engine**: Python Asynchronous Sockets (`asyncio`), struct-based binary framing.
- **Cryptography**: `cryptography` library (`AESGCM`, `X25519PrivateKey`, `HKDF`, `hashes.SHA256`).

---

## 3. Quick Start & Execution

### 3.1 Prerequisites
- Python 3.11+
- Node.js 20+

### 3.2 Running the Application (Single Command)
Run everything—the HTTP Control API, built React Frontend SPA, SQLite WAL database, and Background TCP Transfer Engine (:9000)—with a single command:

```powershell
python start.py
```

`start.py` automatically detects your local network IP (e.g., `192.168.1.101`), binds to `0.0.0.0`, ensures the frontend bundle is built, and outputs an interactive launch banner:

- **Local Machine Web Console**: [http://localhost:8000](http://localhost:8000)
- **Cross-Device Mobile / LAN Access**: `http://<your-lan-ip>:8000` (e.g. [http://192.168.1.101:8000](http://192.168.1.101:8000))
- **Live QR Code**: Displayed on the website header and overview dashboard—scan with your phone's camera on the same Wi-Fi to connect instantly.
- **TCP Transfer Engine**: Port 9000 (0.0.0.0:9000)
- **Interactive Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 4. Running Tests & Benchmarks

### 4.1 Automated Test Suite (20 Tests)
Run all unit, integration, concurrency, fault-injection, and tampering tests:
```powershell
python -m pytest backend/tests -v
```

### 4.2 Performance Benchmarks
Run throughput and resumption latency benchmarks:
```powershell
python -m backend.benchmark
```

**Measured Benchmark Summary**:
- **1 MB Payload**: 0.33s (3.01 MB/s / 24.1 Mbps) — SHA-256 match PASSED
- **5 MB Payload**: 1.12s (4.46 MB/s / 35.7 Mbps) — SHA-256 match PASSED
- **20 MB Payload**: 4.31s (4.64 MB/s / 37.2 Mbps) — SHA-256 match PASSED
- **Resumption Recovery Latency**: Socket dropped after 3.2 MB; resumed & remaining 6.8 MB completed in **1.62 seconds**.

---

## 5. Documentation Directory

- 📐 [Architecture & System Design](docs/architecture.md)
- 🔌 [TCP Wire Protocol Specification](docs/tcp-protocol.md)
- 🔐 [Security & Cryptography Reference](docs/security.md)
- 🧪 [Testing & Verification Guide](docs/testing.md)
- ⚡ [Performance Benchmarks](docs/benchmarking.md)
- 📋 [Implementation Status](IMPLEMENTATION_STATUS.md)

---

## 6. License & Authors
Built with Google Antigravity. MIT License.
