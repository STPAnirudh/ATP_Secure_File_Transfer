import sqlite3
import hashlib
import time
from datetime import datetime
from backend.app.config import DB_PATH, ADMIN_USERNAME, ADMIN_PASSWORD

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=30000;")
    return conn

def hash_password(password: str) -> str:
    salt = "atp_salt_2026_"
    return hashlib.sha256((salt + password).encode()).hexdigest()

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 2. Transfers table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transfers (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        total_chunks INTEGER NOT NULL,
        transferred_bytes INTEGER NOT NULL DEFAULT 0,
        completed_chunks INTEGER NOT NULL DEFAULT 0,
        sha256_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        direction TEXT NOT NULL DEFAULT 'upload',
        client_ip TEXT,
        session_key_fingerprint TEXT,
        error_message TEXT,
        target_device_id TEXT DEFAULT 'broadcast',
        sender_device_id TEXT DEFAULT 'anonymous',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Ensure newly added columns exist in existing database files
    cursor.execute("PRAGMA table_info(transfers)")
    transfer_columns = [col[1] for col in cursor.fetchall()]
    if "target_device_id" not in transfer_columns:
        cursor.execute("ALTER TABLE transfers ADD COLUMN target_device_id TEXT DEFAULT 'broadcast'")
    if "sender_device_id" not in transfer_columns:
        cursor.execute("ALTER TABLE transfers ADD COLUMN sender_device_id TEXT DEFAULT 'anonymous'")

    # 3. Transfer Checkpoints / Chunks table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transfer_chunks (
        transfer_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        byte_offset INTEGER NOT NULL,
        chunk_size INTEGER NOT NULL,
        sha256_chunk TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (transfer_id, chunk_index),
        FOREIGN KEY (transfer_id) REFERENCES transfers (id) ON DELETE CASCADE
    )
    """)
    
    # 4. Activity Logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id TEXT,
        event_type TEXT NOT NULL,
        details TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 5. Security Audit table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS security_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event TEXT NOT NULL,
        client_id TEXT,
        cipher_suite TEXT NOT NULL,
        key_exchange TEXT NOT NULL,
        status TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 6. Connected Devices table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS connected_devices (
        device_id TEXT PRIMARY KEY,
        device_name TEXT NOT NULL,
        device_type TEXT NOT NULL DEFAULT 'desktop',
        client_ip TEXT NOT NULL,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Indices for performance and concurrency
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_tid ON transfer_chunks(transfer_id, chunk_index)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_transfers_updated ON transfers(updated_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_transfers_target ON transfers(target_device_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_devices_seen ON connected_devices(last_seen)")
    
    # Insert default admin user if not exists
    cursor.execute("SELECT id FROM users WHERE username = ?", (ADMIN_USERNAME,))
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (ADMIN_USERNAME, hash_password(ADMIN_PASSWORD), "admin")
        )
        
    conn.commit()
    conn.close()

def log_activity(transfer_id: str | None, event_type: str, details: str, severity: str = "info"):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO activity_logs (transfer_id, event_type, details, severity) VALUES (?, ?, ?, ?)",
        (transfer_id, event_type, details, severity)
    )
    conn.commit()
    conn.close()

def log_security(event: str, client_id: str | None, status: str, details: str, cipher_suite: str = "AES-256-GCM", key_exchange: str = "X25519-HKDF"):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO security_audit (event, client_id, cipher_suite, key_exchange, status, details) VALUES (?, ?, ?, ?, ?, ?)",
        (event, client_id, cipher_suite, key_exchange, status, details)
    )
    conn.commit()
    conn.close()
