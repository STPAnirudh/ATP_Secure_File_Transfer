from typing import Optional
from fastapi import APIRouter, Query
from backend.app.database import get_db

router = APIRouter(prefix="/activity", tags=["activity"])

@router.get("")
def get_activity_logs(limit: int = Query(50, ge=1, le=500)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?",
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.delete("")
def clear_activity_logs():
    """
    Clears all recorded activity logs.
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM activity_logs")
    conn.commit()
    conn.close()
    return {"status": "ok", "message": "Activity logs cleared"}
