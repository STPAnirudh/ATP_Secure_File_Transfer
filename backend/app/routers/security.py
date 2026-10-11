from fastapi import APIRouter
from backend.app.database import get_db
from backend.app.config import (
    CIPHER_ALGORITHM,
    KEY_EXCHANGE_ALGO,
    AUTH_TAG_LENGTH,
    NONCE_LENGTH,
)

router = APIRouter(prefix="/security", tags=["security"])

@router.get("/status")
def get_security_status():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM transfer_chunks")
    total_chunks = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT session_key_fingerprint) FROM transfers WHERE session_key_fingerprint IS NOT NULL")
    active_keys = cursor.fetchone()[0]

    cursor.execute("SELECT * FROM security_audit ORDER BY id DESC LIMIT 50")
    audit_rows = cursor.fetchall()
    conn.close()

    return {
        "cipher_suite": CIPHER_ALGORITHM,
        "key_exchange": KEY_EXCHANGE_ALGO,
        "nonce_length_bytes": NONCE_LENGTH,
        "tag_length_bytes": AUTH_TAG_LENGTH,
        "sha256_integrity_enforced": True,
        "resumable_verification_enforced": True,
        "active_sessions_count": active_keys,
        "total_authenticated_chunks": total_chunks,
        "audit_logs": [dict(r) for r in audit_rows]
    }
