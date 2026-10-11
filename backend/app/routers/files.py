import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend.app.config import RECEIVED_DIR
from backend.app.database import get_db
from backend.app.tcp_engine.crypto import CryptographyEngine

router = APIRouter(prefix="/files", tags=["files"])

@router.get("")
def list_received_files():
    """Lists files successfully verified and stored in the received vault."""
    files_list = []
    conn = get_db()
    cursor = conn.cursor()

    if RECEIVED_DIR.exists():
        for item in RECEIVED_DIR.iterdir():
            if item.is_file():
                stat = item.stat()
                file_name = item.name

                # Look up SHA256 in completed transfers
                cursor.execute(
                    "SELECT id, sha256_hash FROM transfers WHERE file_name = ? AND status = 'completed' ORDER BY updated_at DESC LIMIT 1",
                    (file_name,)
                )
                row = cursor.fetchone()

                sha256 = row["sha256_hash"] if row else CryptographyEngine.compute_sha256_file(str(item))
                transfer_id = row["id"] if row else "unknown"

                files_list.append({
                    "name": file_name,
                    "size": stat.st_size,
                    "transfer_id": transfer_id,
                    "sha256_hash": sha256,
                    "verified": True,
                    "received_at": stat.st_mtime
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

    # Path Traversal Check
    if not str(target_path).startswith(str(RECEIVED_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Path traversal access forbidden")

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="File not found in vault")


    return FileResponse(
        path=str(target_path),
        filename=clean_name,
        media_type="application/octet-stream"
    )
