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

### 3.2 Running the Application
The FastAPI backend automatically starts both the HTTP control API (Port 8000) and the background TCP transfer engine (Port 9000), while serving the built frontend SPA:

```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Open your browser to:
- **Web Application Console**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive API Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 3.3 Running Frontend in Development Mode (Optional)
If you wish to make live modifications to the frontend:
```powershell
python run_npm.py --prefix frontend run dev
```
Visit `http://localhost:5173`.

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
