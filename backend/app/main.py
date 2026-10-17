import asyncio
import os
import time
from pathlib import Path
from typing import Dict
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.config import HTTP_HOST, HTTP_PORT, TCP_HOST, TCP_PORT, BASE_DIR, LOCAL_LAN_IP
from backend.app.database import init_db, get_db
from backend.app.tcp_engine.server import TcpTransferServer
from backend.app.routers import transfers, files, activity, security, settings

START_TIME = time.time()
tcp_server_instance: TcpTransferServer | None = None
tcp_task: asyncio.Task | None = None

# Active connected client devices tracking (IP -> last seen timestamp)
_active_devices: Dict[str, float] = {}

def record_device_activity(client_ip: str):
    if not client_ip:
        return
    now = time.time()
    _active_devices[client_ip] = now
    # Evict devices with no activity in 45 seconds
    for ip in list(_active_devices.keys()):
        if now - _active_devices[ip] > 45:
            _active_devices.pop(ip, None)

def get_active_devices_count() -> int:
    now = time.time()
    for ip in list(_active_devices.keys()):
        if now - _active_devices[ip] > 45:
            _active_devices.pop(ip, None)
    return max(1, len(_active_devices))

@asynccontextmanager
async def lifespan(app: FastAPI):
    global tcp_server_instance, tcp_task
    # 1. Initialize SQLite Database Schema
    init_db()

    # 2. Launch background TCP Transfer Engine
    try:
        tcp_server_instance = TcpTransferServer(host=TCP_HOST, port=TCP_PORT)
        await tcp_server_instance.start()
    except OSError as err:
        import logging
        logging.getLogger("atp_tcp_server").warning(f"TCP Transfer Server bind skipped: {err}")

    yield

    # Shutdown TCP Server
    if tcp_server_instance and tcp_server_instance.is_running:
        await tcp_server_instance.stop()

app = FastAPI(
    title="ATP — Agnos Transfer Protocol API",
    description="Control plane for secure, authenticated, and resumable TCP file transfer network.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(transfers.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(activity.router, prefix="/api")
app.include_router(security.router, prefix="/api")
app.include_router(settings.router, prefix="/api")

@app.get("/api/health")
def get_health(request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    record_device_activity(client_ip)

    uptime = int(time.time() - START_TIME)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM transfers WHERE status = 'in_progress'")
    active_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM transfers WHERE status = 'completed'")
    completed_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM transfers WHERE status = 'interrupted'")
    interrupted_count = cursor.fetchone()[0]

    cursor.execute("SELECT COALESCE(SUM(transferred_bytes), 0) FROM transfers")
    total_bytes = cursor.fetchone()[0]

    conn.close()

    active_conns = len(tcp_server_instance.active_sessions) if tcp_server_instance else 0

    return {
        "status": "healthy",
        "version": "1.0.0",
        "uptime_seconds": uptime,
        "tcp_port": TCP_PORT,
        "tcp_active_connections": active_conns,
        "active_devices_count": get_active_devices_count(),
        "active_transfers_count": active_count,
        "completed_transfers_count": completed_count,
        "interrupted_transfers_count": interrupted_count,
        "total_bytes_transferred": total_bytes,
        "database_status": "connected",
        "local_ip": LOCAL_LAN_IP,
        "network_url": f"http://{LOCAL_LAN_IP}:{HTTP_PORT}"
    }

@app.get("/api/network-info")
def get_network_info():
    """Returns local LAN and loopback URLs for cross-device access."""
    return {
        "local_ip": LOCAL_LAN_IP,
        "http_host": HTTP_HOST,
        "http_port": HTTP_PORT,
        "tcp_host": TCP_HOST,
        "tcp_port": TCP_PORT,
        "network_url": f"http://{LOCAL_LAN_IP}:{HTTP_PORT}",
        "local_url": f"http://localhost:{HTTP_PORT}"
    }

# Serve Frontend static assets if built
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        # Don't intercept /api routes
        if full_path.startswith("api"):
            return {"error": "API route not found"}
        target_file = FRONTEND_DIST / full_path
        if target_file.exists() and target_file.is_file():
            return FileResponse(target_file)
        return FileResponse(FRONTEND_DIST / "index.html")
