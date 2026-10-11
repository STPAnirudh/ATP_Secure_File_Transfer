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
