import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
RECEIVED_DIR = DATA_DIR / "received"
DB_PATH = DATA_DIR / "atp_transfers.db"

# Ensure runtime directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
RECEIVED_DIR.mkdir(parents=True, exist_ok=True)

# Network settings
HTTP_HOST = os.getenv("ATP_HTTP_HOST", "127.0.0.1")
HTTP_PORT = int(os.getenv("ATP_HTTP_PORT", "8000"))
TCP_HOST = os.getenv("ATP_TCP_HOST", "127.0.0.1")
TCP_PORT = int(os.getenv("ATP_TCP_PORT", "9000"))

# Protocol engine settings
MAGIC_HEADER = b"ATP1"  # Agnos Transfer Protocol v1 (4 bytes)
DEFAULT_CHUNK_SIZE = 64 * 1024  # 64 KB per chunk
MAX_CHUNK_SIZE = 1024 * 1024   # 1 MB max chunk
SOCKET_TIMEOUT = 30.0          # seconds
MAX_CONCURRENT_CLIENTS = 16

# Security settings
CIPHER_ALGORITHM = "AES-256-GCM"
KEY_EXCHANGE_ALGO = "X25519-HKDF-SHA256"
AUTH_TAG_LENGTH = 16          # 128-bit authentication tag
NONCE_LENGTH = 12             # 96-bit unique IV
JWT_SECRET = os.getenv("ATP_JWT_SECRET", "atp-super-secure-production-secret-2026")
JWT_ALGORITHM = "HS256"
ADMIN_USERNAME = os.getenv("ATP_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ATP_ADMIN_PASS", "admin123")
