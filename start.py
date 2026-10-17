#!/usr/bin/env python3
"""
ATP (Agnos Transfer Protocol) — Unified Single-Command Startup Script
Starts the HTTP Control Plane, Frontend Web Console, Background TCP Transfer Engine,
and Database persistence plane in a single unified process.
"""

import os
import sys
import socket
import subprocess
from pathlib import Path

# Resolve base directories
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR

if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

DATA_DIR = PROJECT_DIR / "data"
(DATA_DIR / "uploads").mkdir(parents=True, exist_ok=True)
(DATA_DIR / "received").mkdir(parents=True, exist_ok=True)
(DATA_DIR / "staging").mkdir(parents=True, exist_ok=True)
(DATA_DIR / "client_downloads").mkdir(parents=True, exist_ok=True)


def get_lan_ip() -> str:
    """Discovers machine's primary local network IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


def ensure_frontend_built():
    """Ensures frontend dist assets exist; builds them automatically if missing."""
    frontend_dir = PROJECT_DIR / "frontend"
    dist_index = frontend_dir / "dist" / "index.html"

    if not dist_index.exists():
        print("\n[+] Frontend production bundle not found. Building with Vite...")
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        try:
            subprocess.run([npm_cmd, "run", "build"], cwd=str(frontend_dir), check=True)
            print("[+] Frontend built successfully!\n")
        except Exception as e:
            print(f"[!] Warning: Automatic frontend build failed ({e}). Proceeding anyway...\n")


def main():
    ensure_frontend_built()

    lan_ip = get_lan_ip()
    http_port = int(os.getenv("ATP_HTTP_PORT", "8000"))
    tcp_port = int(os.getenv("ATP_TCP_PORT", "9000"))

    banner = f"""
================================================================================
     AGNOS TRANSFER PROTOCOL (ATP) — SECURE MULTI-CLIENT NETWORK
================================================================================

  >>> OPEN THIS IN YOUR BROWSER:   http://localhost:{http_port}
  >>> FROM OTHER DEVICES (Wi-Fi):  http://{lan_ip}:{http_port}

  [+] TCP Socket Engine:      Port {tcp_port} (all interfaces)
  [+] Cryptographic Suite:    AES-256-GCM + X25519 ECDH + SHA-256 Digest
  [+] State Persistence:      SQLite3 WAL Mode Active
  [+] QR Code Access:         Visible on the website for easy mobile access

  NOTE: Ignore any line below saying "http://0.0.0.0:{http_port}" — that is
        only an internal bind address and CANNOT be used in a browser.
        Always use:  http://localhost:{http_port}

  Press Ctrl+C to shut down cleanly.
================================================================================
"""
    print(banner)

    # Auto-open browser after a short delay so the server has time to start
    import threading
    import time
    import webbrowser

    def _open_browser():
        time.sleep(1.5)
        webbrowser.open(f"http://localhost:{http_port}")

    threading.Thread(target=_open_browser, daemon=True).start()

    import uvicorn
    try:
        uvicorn.run(
            "backend.app.main:app",
            host="0.0.0.0",
            port=http_port,
            reload=False,
            log_level="warning",  # suppresses confusing "Running on http://0.0.0.0" line
        )
    except KeyboardInterrupt:
        print("\n[+] Shutting down ATP Server and TCP Engine gracefully. Goodbye!\n")


if __name__ == "__main__":
    main()
