from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from backend.app.config import (
    TCP_PORT,
    HTTP_PORT,
    DEFAULT_CHUNK_SIZE,
    MAX_CONCURRENT_CLIENTS,
    SOCKET_TIMEOUT,
    CIPHER_ALGORITHM,
    KEY_EXCHANGE_ALGO,
    UPLOADS_DIR,
    RECEIVED_DIR,
    DB_PATH,
)

router = APIRouter(prefix="/settings", tags=["settings"])

class SettingsUpdate(BaseModel):
    tcp_port: Optional[int] = None
    http_port: Optional[int] = None
    chunk_size: Optional[int] = None
    max_clients: Optional[int] = None
    socket_timeout: Optional[int] = None
    received_dir: Optional[str] = None

# In-memory runtime override settings
_runtime_settings = {
    "tcp_port": TCP_PORT,
    "http_port": HTTP_PORT,
    "chunk_size": DEFAULT_CHUNK_SIZE,
    "max_clients": MAX_CONCURRENT_CLIENTS,
    "socket_timeout": int(SOCKET_TIMEOUT),
    "cipher_suite": CIPHER_ALGORITHM,
    "key_exchange": KEY_EXCHANGE_ALGO,
    "uploads_dir": str(UPLOADS_DIR),
    "received_dir": str(RECEIVED_DIR),
    "db_path": str(DB_PATH)
}

@router.get("")
def get_settings():
    return _runtime_settings

@router.post("")
def update_settings(update: SettingsUpdate):
    if update.tcp_port is not None:
        _runtime_settings["tcp_port"] = update.tcp_port
    if update.http_port is not None:
        _runtime_settings["http_port"] = update.http_port
    if update.chunk_size is not None:
        _runtime_settings["chunk_size"] = update.chunk_size
    if update.max_clients is not None:
        _runtime_settings["max_clients"] = update.max_clients
    if update.socket_timeout is not None:
        _runtime_settings["socket_timeout"] = update.socket_timeout
    if update.received_dir is not None:
        _runtime_settings["received_dir"] = update.received_dir

    return {"message": "Settings updated", "settings": _runtime_settings}
