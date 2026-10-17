import os
import shutil
import asyncio
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from backend.app.database import get_db, log_activity
from backend.app.config import DATA_DIR, UPLOADS_DIR, TCP_PORT, DEFAULT_CHUNK_SIZE
from backend.app.tcp_engine.client import TcpTransferClient
from backend.app.tcp_engine.storage import StorageManager

router = APIRouter(prefix="/transfers", tags=["transfers"])

@router.get("")
def list_transfers(status: Optional[str] = None, device_id: Optional[str] = None):
    """
    Lists transfers. If device_id is provided, only shows transfers
    addressed to 'broadcast' OR matching the target/sender device ID.
    """
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM transfers WHERE 1=1"
    params = []

    if status and status != "all":
        query += " AND status = ?"
        params.append(status)

    if device_id:
        query += " AND (target_device_id = 'broadcast' OR target_device_id = ? OR sender_device_id = ?)"
        params.extend([device_id, device_id])

    query += " ORDER BY created_at DESC"
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/{transfer_id}")
def get_transfer_detail(transfer_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transfers WHERE id = ?", (transfer_id,))
    transfer = cursor.fetchone()
    if not transfer:
        conn.close()
        raise HTTPException(status_code=404, detail="Transfer not found")

    cursor.execute(
        "SELECT * FROM transfer_chunks WHERE transfer_id = ? ORDER BY chunk_index ASC LIMIT 200",
        (transfer_id,)
    )
    chunks = cursor.fetchall()
    conn.close()

    result = dict(transfer)
    result["chunks"] = [dict(c) for c in chunks]
    return result

@router.delete("/{transfer_id}")
def delete_transfer(transfer_id: str):
    """
    Deletes an individual transfer record and associated checkpoint chunks from the database.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transfer_chunks WHERE transfer_id = ?", (transfer_id,))
    cursor.execute("DELETE FROM transfers WHERE id = ?", (transfer_id,))
    conn.commit()
    conn.close()

    log_activity(transfer_id, "TRANSFER_DELETED", f"Transfer record {transfer_id} removed by user", "info")
    return {"status": "ok", "message": f"Transfer {transfer_id} removed"}

@router.delete("")
def clear_all_transfers():
    """
    Clears all transfer history and chunks.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transfer_chunks")
    cursor.execute("DELETE FROM transfers")
    conn.commit()
    conn.close()

    log_activity(None, "TRANSFERS_CLEARED", "All transfer history records cleared by user", "info")
    return {"status": "ok", "message": "All transfer records cleared"}

@router.post("/send-client")
async def send_file_via_tcp(
    file: UploadFile = File(...),
    simulate_drop_after_chunks: Optional[int] = Form(None),
    target_device_id: Optional[str] = Form("broadcast"),
    sender_device_id: Optional[str] = Form("anonymous")
):
    """
    Saves uploaded file to temp staging and triggers the real TCP client
    to transmit it chunk-by-chunk to the TCP server over port 9000.
    Executed in a worker thread so the main asyncio event loop remains non-blocking.
    """
    # 1. Save uploaded file to staging
    staging_dir = DATA_DIR / "staging"
    staging_dir.mkdir(parents=True, exist_ok=True)
    clean_filename = os.path.basename(file.filename or "uploaded_file.bin")
    staged_path = staging_dir / clean_filename

    def _save_file():
        with open(staged_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    await asyncio.to_thread(_save_file)

    # 2. Trigger real TCP transfer client in threadpool
    client = TcpTransferClient(host="127.0.0.1", port=TCP_PORT)
    try:
        result = await asyncio.to_thread(
            client.send_file,
            filepath=str(staged_path),
            simulate_drop_after_chunks=simulate_drop_after_chunks
        )

        # Update target_device_id and sender_device_id in transfers table
        transfer_id = result.get("transfer_id")
        if transfer_id:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE transfers SET target_device_id = ?, sender_device_id = ? WHERE id = ?",
                (target_device_id or "broadcast", sender_device_id or "anonymous", transfer_id)
            )
            conn.commit()
            conn.close()

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TCP Transmission Error: {str(e)}")

@router.post("/{transfer_id}/resume")
async def resume_transfer(transfer_id: str):
    """
    Triggers resumption for an interrupted transfer.
    Uses staged or source file to continue TCP chunk streaming from the verified checkpoint.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transfers WHERE id = ?", (transfer_id,))
    transfer = cursor.fetchone()
    conn.close()

    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    staging_dir = DATA_DIR / "staging"
    staged_path = staging_dir / transfer["file_name"]

    if not staged_path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Source file {transfer['file_name']} no longer in client staging for resume"
        )

    client = TcpTransferClient(host="127.0.0.1", port=TCP_PORT)
    try:
        result = await asyncio.to_thread(
            client.resume_transfer,
            filepath=str(staged_path),
            transfer_id=transfer_id
        )
        return {"message": "Transfer resumed successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume failed: {str(e)}")

@router.post("/{transfer_id}/retry")
async def retry_transfer(transfer_id: str):
    return await resume_transfer(transfer_id)

@router.post("/download-tcp")
async def download_file_via_tcp(filename: str = Query(...)):
    """
    Triggers an end-to-end TCP download of a vault file via the TCP client over port 9000,
    validating AEAD tags on all chunks and the final SHA-256 digest.
    """
    staging_downloads = DATA_DIR / "client_downloads"
    staging_downloads.mkdir(parents=True, exist_ok=True)
    clean_name = os.path.basename(filename)
    dest_file = staging_downloads / f"tcp_downloaded_{clean_name}"

    client = TcpTransferClient(host="127.0.0.1", port=TCP_PORT)
    try:
        result = await asyncio.to_thread(
            client.download_file,
            remote_filename=clean_name,
            output_filepath=str(dest_file)
        )
        return {
            "message": "TCP Download succeeded with verified AEAD and SHA-256",
            "result": result,
            "saved_to": str(dest_file)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TCP Download failed: {str(e)}")
