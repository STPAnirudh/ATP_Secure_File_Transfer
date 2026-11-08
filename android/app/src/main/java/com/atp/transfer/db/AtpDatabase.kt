package com.atp.transfer.db

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AtpDatabase(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "atp_transfers.db"
        private const val DATABASE_VERSION = 1
    }

    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
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
            """.trimIndent()
        )

        db.execSQL(
            """
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
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transfer_id TEXT,
                event_type TEXT NOT NULL,
                details TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'info',
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS security_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event TEXT NOT NULL,
                client_ip TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS connected_devices (
                device_id TEXT PRIMARY KEY,
                device_name TEXT NOT NULL,
                device_type TEXT DEFAULT 'mobile',
                client_ip TEXT NOT NULL,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Migration logic if schema changes
    }

    @Synchronized
    fun logActivity(transferId: String?, eventType: String, details: String, severity: String = "info") {
        val cv = ContentValues().apply {
            put("transfer_id", transferId)
            put("event_type", eventType)
            put("details", details)
            put("severity", severity)
            put("timestamp", isoFormat.format(Date()))
        }
        writableDatabase.insert("activity_logs", null, cv)
    }

    @Synchronized
    fun logSecurity(event: String, clientIp: String, action: String, details: String) {
        val cv = ContentValues().apply {
            put("event", event)
            put("client_ip", clientIp)
            put("action", action)
            put("details", details)
            put("timestamp", isoFormat.format(Date()))
        }
        writableDatabase.insert("security_audit", null, cv)
    }

    @Synchronized
    fun recordHeartbeat(deviceId: String, deviceName: String, deviceType: String, clientIp: String) {
        val cv = ContentValues().apply {
            put("device_id", deviceId)
            put("device_name", deviceName)
            put("device_type", deviceType)
            put("client_ip", clientIp)
            put("last_seen", isoFormat.format(Date()))
        }
        writableDatabase.insertWithOnConflict("connected_devices", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    @Synchronized
    fun renameDevice(deviceId: String, newName: String) {
        val cv = ContentValues().apply {
            put("device_name", newName)
        }
        writableDatabase.update("connected_devices", cv, "device_id = ?", arrayOf(deviceId))
    }

    @Synchronized
    fun getConnectedDevices(): JSONArray {
        val array = JSONArray()
        val cursor = readableDatabase.rawQuery(
            "SELECT device_id, device_name, device_type, client_ip, last_seen FROM connected_devices ORDER BY last_seen DESC",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                val obj = JSONObject().apply {
                    put("device_id", it.getString(0))
                    put("device_name", it.getString(1))
                    put("device_type", it.getString(2))
                    put("client_ip", it.getString(3))
                    put("last_seen", it.getString(4))
                }
                array.put(obj)
            }
        }
        return array
    }

    @Synchronized
    fun initTransferRecord(
        transferId: String,
        fileName: String,
        fileSize: Long,
        totalChunks: Int,
        sha256Hash: String,
        clientIp: String,
        sessionKeyFingerprint: String,
        direction: String = "upload",
        targetDeviceId: String = "broadcast",
        senderDeviceId: String = "anonymous"
    ) {
        val now = isoFormat.format(Date())
        val cv = ContentValues().apply {
            put("id", transferId)
            put("file_name", fileName)
            put("file_size", fileSize)
            put("total_chunks", totalChunks)
            put("transferred_bytes", 0L)
            put("completed_chunks", 0)
            put("sha256_hash", sha256Hash)
            put("status", "in_progress")
            put("direction", direction)
            put("client_ip", clientIp)
            put("session_key_fingerprint", sessionKeyFingerprint)
            put("target_device_id", targetDeviceId)
            put("sender_device_id", senderDeviceId)
            put("created_at", now)
            put("updated_at", now)
        }
        writableDatabase.insertWithOnConflict("transfers", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    @Synchronized
    fun getValidatedResumeState(transferId: String): Triple<Long, Int, Boolean> {
        val cursor = readableDatabase.rawQuery(
            "SELECT transferred_bytes, completed_chunks, status FROM transfers WHERE id = ?",
            arrayOf(transferId)
        )
        cursor.use {
            if (it.moveToFirst()) {
                val bytes = it.getLong(0)
                val chunks = it.getInt(1)
                val status = it.getString(2)
                val canResume = status == "interrupted" || status == "in_progress"
                return Triple(bytes, chunks, canResume)
            }
        }
        return Triple(0L, 0, false)
    }

    @Synchronized
    fun writeVerifiedChunkCheckpoint(
        transferId: String,
        chunkIndex: Int,
        byteOffset: Long,
        chunkSize: Int
    ): Pair<Long, Int> {
        val cvChunk = ContentValues().apply {
            put("transfer_id", transferId)
            put("chunk_index", chunkIndex)
            put("byte_offset", byteOffset)
            put("chunk_size", chunkSize)
            put("status", "confirmed")
            put("created_at", isoFormat.format(Date()))
        }
        writableDatabase.insertWithOnConflict("transfer_chunks", null, cvChunk, SQLiteDatabase.CONFLICT_REPLACE)

        val newBytes = byteOffset + chunkSize
        val now = isoFormat.format(Date())

        val cursor = readableDatabase.rawQuery(
            "SELECT COUNT(*) FROM transfer_chunks WHERE transfer_id = ?",
            arrayOf(transferId)
        )
        val completedCount = cursor.use { if (it.moveToFirst()) it.getInt(0) else chunkIndex + 1 }

        val cvTransfer = ContentValues().apply {
            put("transferred_bytes", newBytes)
            put("completed_chunks", completedCount)
            put("updated_at", now)
        }
        writableDatabase.update("transfers", cvTransfer, "id = ?", arrayOf(transferId))

        return Pair(newBytes, completedCount)
    }

    @Synchronized
    fun markTransferStatus(transferId: String, status: String, errorMsg: String? = null) {
        val cv = ContentValues().apply {
            put("status", status)
            if (errorMsg != null) put("error_message", errorMsg)
            put("updated_at", isoFormat.format(Date()))
        }
        writableDatabase.update("transfers", cv, "id = ?", arrayOf(transferId))
    }

    @Synchronized
    fun getTransfers(status: String? = null, deviceId: String? = null): JSONArray {
        val array = JSONArray()
        var sql = "SELECT * FROM transfers WHERE 1=1"
        val params = mutableListOf<String>()

        if (!status.isNullOrEmpty() && status != "all") {
            sql += " AND status = ?"
            params.add(status)
        }

        if (!deviceId.isNullOrEmpty()) {
            sql += " AND (target_device_id = 'broadcast' OR target_device_id = ? OR sender_device_id = ?)"
            params.add(deviceId)
            params.add(deviceId)
        }

        sql += " ORDER BY created_at DESC"

        val cursor = readableDatabase.rawQuery(sql, params.toTypedArray())
        cursor.use { c ->
            val cols = c.columnNames
            while (c.moveToNext()) {
                val obj = JSONObject()
                for (i in cols.indices) {
                    obj.put(cols[i], c.getString(i) ?: "")
                }
                array.put(obj)
            }
        }
        return array
    }

    @Synchronized
    fun getTransferDetail(transferId: String): JSONObject? {
        val cursor = readableDatabase.rawQuery("SELECT * FROM transfers WHERE id = ?", arrayOf(transferId))
        val obj = cursor.use { c ->
            if (c.moveToFirst()) {
                val row = JSONObject()
                for (col in c.columnNames) {
                    row.put(col, c.getString(c.getColumnIndexOrThrow(col)) ?: "")
                }
                row
            } else null
        } ?: return null

        val chunkArray = JSONArray()
        val chunkCursor = readableDatabase.rawQuery(
            "SELECT chunk_index, byte_offset, chunk_size, status FROM transfer_chunks WHERE transfer_id = ? ORDER BY chunk_index ASC LIMIT 200",
            arrayOf(transferId)
        )
        chunkCursor.use { cc ->
            while (cc.moveToNext()) {
                val chunkObj = JSONObject().apply {
                    put("chunk_index", cc.getInt(0))
                    put("byte_offset", cc.getLong(1))
                    put("chunk_size", cc.getInt(2))
                    put("status", cc.getString(3))
                }
                chunkArray.put(chunkObj)
            }
        }
        obj.put("chunks", chunkArray)
        return obj
    }

    @Synchronized
    fun deleteTransfer(transferId: String) {
        writableDatabase.delete("transfer_chunks", "transfer_id = ?", arrayOf(transferId))
        writableDatabase.delete("transfers", "id = ?", arrayOf(transferId))
        logActivity(transferId, "TRANSFER_DELETED", "Transfer record $transferId deleted by user", "info")
    }

    @Synchronized
    fun clearAllTransfers() {
        writableDatabase.delete("transfer_chunks", null, null)
        writableDatabase.delete("transfers", null, null)
        logActivity(null, "TRANSFERS_CLEARED", "All transfer records cleared by user", "info")
    }

    @Synchronized
    fun getFileSha256(fileName: String): String? {
        val cursor = readableDatabase.rawQuery(
            "SELECT sha256_hash FROM transfers WHERE file_name = ? AND sha256_hash IS NOT NULL AND sha256_hash != '' ORDER BY id DESC LIMIT 1",
            arrayOf(fileName)
        )
        return cursor.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    }

    @Synchronized
    fun deleteTransferByFilename(fileName: String) {
        deleteTransfersForFile(fileName)
    }

    @Synchronized
    fun deleteTransfersForFile(fileName: String) {
        // Cascade deletion from received vault
        val cursor = readableDatabase.rawQuery("SELECT id FROM transfers WHERE file_name = ?", arrayOf(fileName))
        val ids = mutableListOf<String>()
        cursor.use {
            while (it.moveToNext()) ids.add(it.getString(0))
        }
        for (id in ids) {
            writableDatabase.delete("transfer_chunks", "transfer_id = ?", arrayOf(id))
            writableDatabase.delete("transfers", "id = ?", arrayOf(id))
        }
    }

    @Synchronized
    fun getActivityLogs(limit: Int = 50): JSONArray {
        val array = JSONArray()
        val cursor = readableDatabase.rawQuery(
            "SELECT id, transfer_id, event_type, details, severity, timestamp FROM activity_logs ORDER BY id DESC LIMIT ?",
            arrayOf(limit.toString())
        )
        cursor.use { c ->
            while (c.moveToNext()) {
                val obj = JSONObject().apply {
                    put("id", c.getInt(0))
                    put("transfer_id", c.getString(1) ?: "")
                    put("event_type", c.getString(2))
                    put("details", c.getString(3))
                    put("severity", c.getString(4))
                    put("timestamp", c.getString(5))
                }
                array.put(obj)
            }
        }
        return array
    }

    @Synchronized
    fun clearActivityLogs() {
        writableDatabase.delete("activity_logs", null, null)
    }

    @Synchronized
    fun getSummaryCounts(): Triple<Int, Int, Int> {
        var active = 0
        var completed = 0
        var interrupted = 0

        readableDatabase.rawQuery("SELECT status, COUNT(*) FROM transfers GROUP BY status", null).use { c ->
            while (c.moveToNext()) {
                val status = c.getString(0)
                val count = c.getInt(1)
                when (status) {
                    "in_progress" -> active = count
                    "completed" -> completed = count
                    "interrupted" -> interrupted = count
                }
            }
        }
        return Triple(active, completed, interrupted)
    }

    @Synchronized
    fun getTotalBytesTransferred(): Long {
        readableDatabase.rawQuery("SELECT COALESCE(SUM(transferred_bytes), 0) FROM transfers", null).use {
            if (it.moveToFirst()) return it.getLong(0)
        }
        return 0L
    }
}
