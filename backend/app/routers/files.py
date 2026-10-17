import os
from pathlib import Path
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from backend.app.config import RECEIVED_DIR
from backend.app.database import get_db, log_activity
from backend.app.tcp_engine.crypto import CryptographyEngine

router = APIRouter(prefix="/files", tags=["files"])

@router.get("")
def list_received_files(device_id: Optional[str] = None):
    """
    Lists files successfully verified and stored in the received vault.
    If device_id is provided, only includes files that were broadcast
    or explicitly targeted to this device.
    """
    files_list = []
    conn = get_db()
    cursor = conn.cursor()

    if RECEIVED_DIR.exists():
        for item in RECEIVED_DIR.iterdir():
            if item.is_file() and not item.name.startswith("."):
                stat = item.stat()
                file_name = item.name

                cursor.execute(
                    "SELECT id, sha256_hash, target_device_id, sender_device_id FROM transfers WHERE file_name = ? ORDER BY updated_at DESC LIMIT 1",
                    (file_name,)
                )
                row = cursor.fetchone()

                target_device_id = row["target_device_id"] if row and "target_device_id" in row.keys() else "broadcast"
                sender_device_id = row["sender_device_id"] if row and "sender_device_id" in row.keys() else "anonymous"

                # Filter by device_id if requested
                if device_id and target_device_id != "broadcast":
                    if target_device_id != device_id and sender_device_id != device_id:
                        continue

                sha256 = row["sha256_hash"] if row else CryptographyEngine.compute_sha256_file(str(item))
                transfer_id = row["id"] if row else "unknown"

                # Convert stat.st_mtime to ISO string for precise date & time
                iso_time = datetime.fromtimestamp(stat.st_mtime).isoformat()

                files_list.append({
                    "name": file_name,
                    "size": stat.st_size,
                    "transfer_id": transfer_id,
                    "sha256_hash": sha256,
                    "target_device_id": target_device_id,
                    "sender_device_id": sender_device_id,
                    "verified": True,
                    "received_at": iso_time
                })

    conn.close()
    return sorted(files_list, key=lambda x: x["received_at"], reverse=True)

@router.get("/{filename}/download")
def download_file(filename: str):
    """
    Safely downloads a file from the vault.
    Validates strictly against path traversal vulnerabilities.
    """
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=403, detail="Path traversal access forbidden")

    clean_name = os.path.basename(filename)
    target_path = (RECEIVED_DIR / clean_name).resolve()

    if not str(target_path).startswith(str(RECEIVED_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Path traversal access forbidden")

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="File not found in vault")

    return FileResponse(
        path=str(target_path),
        filename=clean_name,
        media_type="application/octet-stream"
    )

@router.delete("/{filename}")
def delete_received_file(filename: str):
    """
    Deletes a specific file from the received vault.
    """
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=403, detail="Path traversal access forbidden")

    clean_name = os.path.basename(filename)
    target_path = (RECEIVED_DIR / clean_name).resolve()

    if not str(target_path).startswith(str(RECEIVED_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Path traversal access forbidden")

    if not target_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        target_path.unlink()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")

    # Cascade deletion to transfer history in SQLite
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM transfers WHERE file_name = ?", (clean_name,))
    matching = cursor.fetchall()
    for row in matching:
        cursor.execute("DELETE FROM transfer_chunks WHERE transfer_id = ?", (row["id"],))
    cursor.execute("DELETE FROM transfers WHERE file_name = ?", (clean_name,))
    conn.commit()
    conn.close()

    log_activity(None, "FILE_DELETED", f"Received vault file {clean_name} and transfer history deleted", "info")
    return {"status": "ok", "message": f"File {clean_name} and related transfer history deleted successfully"}

@router.delete("")
def clear_all_received_files():
    """
    Clears all files from the received vault and cascades deletion to completed transfers.
    """
    deleted_count = 0
    deleted_names = []
    if RECEIVED_DIR.exists():
        for item in RECEIVED_DIR.iterdir():
            if item.is_file() and not item.name.startswith("."):
                try:
                    deleted_names.append(item.name)
                    item.unlink()
                    deleted_count += 1
                except Exception:
                    pass

    # Cascade delete to completed transfers for these files
    if deleted_names:
        conn = get_db()
        cursor = conn.cursor()
        for fname in deleted_names:
            cursor.execute("SELECT id FROM transfers WHERE file_name = ?", (fname,))
            for row in cursor.fetchall():
                cursor.execute("DELETE FROM transfer_chunks WHERE transfer_id = ?", (row["id"],))
            cursor.execute("DELETE FROM transfers WHERE file_name = ?", (fname,))
        conn.commit()
        conn.close()

    log_activity(None, "VAULT_CLEARED", f"All files ({deleted_count}) removed from received vault and history", "info")
    return {"status": "ok", "message": f"Cleared {deleted_count} files from vault and history"}
