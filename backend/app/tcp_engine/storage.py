import os
import shutil
import sqlite3
from pathlib import Path
from typing import Tuple, Optional, Dict, Any
from backend.app.config import UPLOADS_DIR, RECEIVED_DIR
from backend.app.database import get_db, log_activity, log_security
from backend.app.tcp_engine.crypto import CryptographyEngine

class StorageManager:
    """
    Manages partial file assembly, checkpoint validation,
    and finalized verified storage for the ATP engine.
    """

    @staticmethod
    def get_partial_filepath(transfer_id: str) -> Path:
        return UPLOADS_DIR / f"{transfer_id}.part"

    @staticmethod
    def get_final_filepath(filename: str) -> Path:
        # Sanitize filename against path traversal
        clean_name = os.path.basename(filename)
        return RECEIVED_DIR / clean_name

    @staticmethod
    def init_transfer_record(
        transfer_id: str,
        filename: str,
        file_size: int,
        total_chunks: int,
        sha256_hash: str,
        client_ip: str,
        session_key_fingerprint: str
    ):
        """Creates or resets transfer metadata in SQLite."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO transfers (
                id, file_name, file_size, total_chunks, transferred_bytes,
                completed_chunks, sha256_hash, status, direction, client_ip,
                session_key_fingerprint, updated_at
            ) VALUES (?, ?, ?, ?, 0, 0, ?, 'in_progress', 'upload', ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                file_name = excluded.file_name,
                file_size = excluded.file_size,
                total_chunks = excluded.total_chunks,
                sha256_hash = excluded.sha256_hash,
                status = excluded.status,
                direction = excluded.direction,
                client_ip = excluded.client_ip,
                session_key_fingerprint = excluded.session_key_fingerprint,
                updated_at = CURRENT_TIMESTAMP
        """, (transfer_id, filename, file_size, total_chunks, sha256_hash, client_ip, session_key_fingerprint))
        conn.commit()
        conn.close()

        # Touch empty partial file
        part_path = StorageManager.get_partial_filepath(transfer_id)
        part_path.parent.mkdir(parents=True, exist_ok=True)
        if not part_path.exists():
            with open(part_path, "wb") as f:
                pass

        log_activity(
            transfer_id,
            "TRANSFER_INIT",
            f"Transfer initialized for {filename} ({file_size} bytes, {total_chunks} chunks)",
            "info"
        )

    @staticmethod
    def write_verified_chunk(
        transfer_id: str,
        chunk_index: int,
        byte_offset: int,
        plaintext: bytes
    ) -> Tuple[int, int]:
        """
        Writes decrypted & AEAD-verified chunk into partial file at byte_offset.
        Persists atomic checkpoint in SQLite.
        Returns: (transferred_bytes, completed_chunks)
        """
        part_path = StorageManager.get_partial_filepath(transfer_id)
        
        # Seek and write at exact offset
        with open(part_path, "r+b" if part_path.exists() else "wb") as f:
            f.seek(byte_offset)
            f.write(plaintext)

        chunk_size = len(plaintext)
        chunk_hash = CryptographyEngine.compute_sha256_bytes(plaintext)

        conn = get_db()
        cursor = conn.cursor()
        
        # Insert chunk checkpoint
        cursor.execute("""
            INSERT OR REPLACE INTO transfer_chunks (
                transfer_id, chunk_index, byte_offset, chunk_size, sha256_chunk, status
            ) VALUES (?, ?, ?, ?, ?, 'confirmed')
        """, (transfer_id, chunk_index, byte_offset, chunk_size, chunk_hash))

        # Update transfer progress
        cursor.execute("""
            UPDATE transfers
            SET transferred_bytes = (
                SELECT COALESCE(SUM(chunk_size), 0) FROM transfer_chunks WHERE transfer_id = ?
            ),
            completed_chunks = (
                SELECT COUNT(*) FROM transfer_chunks WHERE transfer_id = ?
            ),
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (transfer_id, transfer_id, transfer_id))

        cursor.execute("SELECT transferred_bytes, completed_chunks FROM transfers WHERE id = ?", (transfer_id,))
        row = cursor.fetchone()
        transferred_bytes = row["transferred_bytes"] if row else 0
        completed_chunks = row["completed_chunks"] if row else 0

        conn.commit()
        conn.close()

        return transferred_bytes, completed_chunks

    @staticmethod
    def validate_and_finalize_transfer(transfer_id: str) -> Tuple[bool, str]:
        """
        Validates full reconstructed file against expected SHA-256 digest.
        If valid: promotes partial file to final received storage.
        Returns: (is_valid, message)
        """
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT file_name, file_size, sha256_hash FROM transfers WHERE id = ?", (transfer_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return False, "Transfer record not found"

        file_name = row["file_name"]
        file_size = row["file_size"]
        expected_sha256 = row["sha256_hash"].lower()

        part_path = StorageManager.get_partial_filepath(transfer_id)
        if not part_path.exists():
            conn.close()
            return False, "Partial file missing on disk"

        actual_size = part_path.stat().st_size
        if actual_size != file_size:
            cursor.execute("UPDATE transfers SET status = 'failed', error_message = ? WHERE id = ?",
                           (f"File size mismatch: {actual_size} != {file_size}", transfer_id))
            conn.commit()
            conn.close()
            log_activity(transfer_id, "INTEGRITY_FAILED", f"Size mismatch: actual {actual_size} vs expected {file_size}", "error")
            return False, f"Size mismatch: {actual_size} != {file_size}"

        # Compute full-file SHA-256
        actual_sha256 = CryptographyEngine.compute_sha256_file(str(part_path)).lower()
        if actual_sha256 != expected_sha256:
            cursor.execute("UPDATE transfers SET status = 'failed', error_message = ? WHERE id = ?",
                           ("SHA-256 checksum mismatch", transfer_id))
            conn.commit()
            conn.close()
            log_security("INTEGRITY_MISMATCH", transfer_id, "REJECTED",
                         f"Computed {actual_sha256} != expected {expected_sha256}")
            log_activity(transfer_id, "INTEGRITY_FAILED", "SHA-256 mismatch detected; rejecting file", "error")
            return False, "SHA-256 checksum mismatch"

        # Safe atomic move to received vault
        final_path = StorageManager.get_final_filepath(file_name)
        if final_path.exists():
            final_path.unlink()
        shutil.move(str(part_path), str(final_path))


        cursor.execute("""
            UPDATE transfers
            SET status = 'completed', error_message = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (transfer_id,))
        conn.commit()
        conn.close()

        log_activity(transfer_id, "TRANSFER_COMPLETE", f"File {file_name} successfully verified and committed to storage vault", "success")
        log_security("INTEGRITY_VERIFIED", transfer_id, "VERIFIED", f"SHA-256 digest match: {actual_sha256}")
        return True, "File verified and finalized"

    @staticmethod
    def get_validated_resume_state(transfer_id: str) -> Tuple[int, int, bool]:
        """
        Cross-validates SQLite checkpoint state against partial file on disk.
        Returns: (verified_byte_offset, completed_chunks, can_resume)
        """
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT file_size, status FROM transfers WHERE id = ?", (transfer_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return 0, 0, False

        file_size = row["file_size"]
        part_path = StorageManager.get_partial_filepath(transfer_id)

        if not part_path.exists():
            conn.close()
            return 0, 0, False

        disk_size = part_path.stat().st_size

        # Find continuous confirmed chunks
        cursor.execute("""
            SELECT chunk_index, byte_offset, chunk_size
            FROM transfer_chunks
            WHERE transfer_id = ?
            ORDER BY chunk_index ASC
        """, (transfer_id,))
        chunks = cursor.fetchall()
        conn.close()

        verified_offset = 0
        completed_count = 0
        for chk in chunks:
            if chk["byte_offset"] == verified_offset and (verified_offset + chk["chunk_size"]) <= disk_size:
                verified_offset += chk["chunk_size"]
                completed_count += 1
            else:
                break

        return verified_offset, completed_count, True
