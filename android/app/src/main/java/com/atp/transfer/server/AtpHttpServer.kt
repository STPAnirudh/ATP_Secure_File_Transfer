package com.atp.transfer.server

import android.content.Context
import android.util.Log
import com.atp.transfer.AtpApplication
import com.atp.transfer.client.AtpTcpClient
import com.atp.transfer.crypto.AtpCrypto
import fi.iki.elonen.NanoHTTPD
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.URLDecoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AtpHttpServer(
    val httpPort: Int = 8000,
    val tcpPort: Int = 9000,
    val context: Context,
    val storageDir: File
) : NanoHTTPD("0.0.0.0", httpPort) {

    companion object {
        private const val TAG = "AtpHttpServer"
        private val startTime = System.currentTimeMillis()

        fun getLocalIpAddress(): String {
            try {
                val interfaces = NetworkInterface.getNetworkInterfaces()?.toList() ?: emptyList()
                // Prioritize Wi-Fi and hotspot interfaces: wlan, ap, rndis, eth
                val sortedInterfaces = interfaces.sortedByDescending { intf ->
                    val name = intf.name.lowercase()
                    when {
                        name.startsWith("wlan") -> 10
                        name.startsWith("ap") -> 9
                        name.startsWith("rndis") -> 8
                        name.startsWith("eth") -> 7
                        else -> 1
                    }
                }

                for (intf in sortedInterfaces) {
                    if (intf.isLoopback || !intf.isUp) continue
                    val addresses = intf.inetAddresses
                    while (addresses.hasMoreElements()) {
                        val addr = addresses.nextElement()
                        if (!addr.isLoopbackAddress && addr is Inet4Address) {
                            val ip = addr.hostAddress
                            if (!ip.isNullOrBlank() && !ip.startsWith("127.")) {
                                return ip
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error obtaining local IP: ${e.message}")
            }
            return "127.0.0.1"
        }
    }

    private val receivedVaultDir: File by lazy {
        val dir = File(storageDir, "received")
        if (!dir.exists()) dir.mkdirs()
        dir
    }

    private val stagingDir: File by lazy {
        val dir = File(storageDir, "staging")
        if (!dir.exists()) dir.mkdirs()
        dir
    }

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri
        val method = session.method

        // Handle CORS Pre-flight
        if (method == Method.OPTIONS) {
            val resp = newFixedLengthResponse(Response.Status.OK, "text/plain", "")
            addCorsHeaders(resp)
            return resp
        }

        val response = try {
            if (uri.startsWith("/api/")) {
                handleApi(session, uri, method)
            } else {
                handleStaticAsset(uri)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error handling $method $uri: ${e.message}", e)
            val errJson = JSONObject().apply {
                put("detail", e.message ?: "Internal Server Error")
            }
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json", errJson.toString())
        }

        addCorsHeaders(response)
        return response
    }

    private fun addCorsHeaders(response: Response) {
        response.addHeader("Access-Control-Allow-Origin", "*")
        response.addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
        response.addHeader("Access-Control-Allow-Headers", "*")
        response.addHeader("Access-Control-Max-Age", "86400")
    }

    private fun handleApi(session: IHTTPSession, uri: String, method: Method): Response {
        val path = uri.removePrefix("/api")
        val localIp = getLocalIpAddress()

        return when {
            path == "/health" && method == Method.GET -> {
                val uptimeSeconds = ((System.currentTimeMillis() - startTime) / 1000).toInt()
                val (active, completed, interrupted) = AtpApplication.database.getSummaryCounts()
                val totalBytes = AtpApplication.database.getTotalBytesTransferred()

                val health = JSONObject().apply {
                    put("status", "healthy")
                    put("version", "1.0.0")
                    put("uptime_seconds", uptimeSeconds)
                    put("tcp_port", tcpPort)
                    put("tcp_active_connections", 0)
                    put("active_devices_count", AtpApplication.database.getConnectedDevices().length().coerceAtLeast(1))
                    put("active_transfers_count", active)
                    put("completed_transfers_count", completed)
                    put("interrupted_transfers_count", interrupted)
                    put("total_bytes_transferred", totalBytes)
                    put("database_status", "connected")
                    put("local_ip", localIp)
                    put("network_url", "http://$localIp:$httpPort")
                }
                newFixedLengthResponse(Response.Status.OK, "application/json", health.toString())
            }

            path == "/network-info" && method == Method.GET -> {
                val info = JSONObject().apply {
                    put("local_ip", localIp)
                    put("http_host", "0.0.0.0")
                    put("http_port", httpPort)
                    put("tcp_host", "0.0.0.0")
                    put("tcp_port", tcpPort)
                    put("network_url", "http://$localIp:$httpPort")
                    put("local_url", "http://localhost:$httpPort")
                }
                newFixedLengthResponse(Response.Status.OK, "application/json", info.toString())
            }

            path == "/devices" && method == Method.GET -> {
                val devices = AtpApplication.database.getConnectedDevices()
                newFixedLengthResponse(Response.Status.OK, "application/json", devices.toString())
            }

            path == "/devices/heartbeat" && method == Method.POST -> {
                val body = getRequestBodyJson(session)
                val deviceId = body.optString("device_id", "unknown")
                val deviceName = body.optString("device_name", "Unknown Device")
                val deviceType = body.optString("device_type", "mobile")
                val clientIp = session.remoteIpAddress ?: "unknown"

                AtpApplication.database.recordHeartbeat(deviceId, deviceName, deviceType, clientIp)
                val resp = JSONObject().apply {
                    put("status", "ok")
                    put("device_id", deviceId)
                    put("device_name", deviceName)
                }
                newFixedLengthResponse(Response.Status.OK, "application/json", resp.toString())
            }

            path == "/devices/rename" && method == Method.POST -> {
                val body = getRequestBodyJson(session)
                val deviceId = body.optString("device_id", "")
                val newName = body.optString("new_name", "")
                if (deviceId.isNotEmpty() && newName.isNotEmpty()) {
                    AtpApplication.database.renameDevice(deviceId, newName)
                }
                val resp = JSONObject().apply {
                    put("status", "ok")
                    put("device_id", deviceId)
                    put("new_name", newName)
                }
                newFixedLengthResponse(Response.Status.OK, "application/json", resp.toString())
            }

            path == "/transfers" && method == Method.GET -> {
                val parms = session.parameters
                val status = parms["status"]?.firstOrNull()
                val deviceId = parms["device_id"]?.firstOrNull()
                val list = AtpApplication.database.getTransfers(status, deviceId)
                newFixedLengthResponse(Response.Status.OK, "application/json", list.toString())
            }

            path.startsWith("/transfers/") && method == Method.GET -> {
                val id = path.removePrefix("/transfers/")
                val detail = AtpApplication.database.getTransferDetail(id)
                if (detail != null) {
                    newFixedLengthResponse(Response.Status.OK, "application/json", detail.toString())
                } else {
                    newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", "{\"detail\":\"Transfer not found\"}")
                }
            }

            path.startsWith("/transfers/") && method == Method.DELETE -> {
                val id = path.removePrefix("/transfers/")
                AtpApplication.database.deleteTransfer(id)
                val resp = JSONObject().apply {
                    put("status", "ok")
                    put("message", "Transfer $id removed")
                }
                newFixedLengthResponse(Response.Status.OK, "application/json", resp.toString())
            }

            path == "/transfers" && method == Method.DELETE -> {
                AtpApplication.database.clearAllTransfers()
                val resp = JSONObject().apply {
                    put("status", "ok")
                    put("message", "All transfer records cleared")
                }
                newFixedLengthResponse(Response.Status.OK, "application/json", resp.toString())
            }

            path == "/transfers/send-client" && method == Method.POST -> {
                handleSendClientUpload(session)
            }

            path == "/files" && method == Method.GET -> {
                val files = listReceivedVaultFiles()
                newFixedLengthResponse(Response.Status.OK, "application/json", files.toString())
            }

            path.startsWith("/files/") && path.endsWith("/download") && method == Method.GET -> {
                val encodedName = path.removePrefix("/files/").removeSuffix("/download")
                val filename = URLDecoder.decode(encodedName, "UTF-8")
                handleFileDownload(filename)
            }

            path.startsWith("/files/") && method == Method.DELETE -> {
                val encodedName = path.removePrefix("/files/")
                val filename = URLDecoder.decode(encodedName, "UTF-8")
                val targetFile = File(receivedVaultDir, File(filename).name)
                if (targetFile.exists()) targetFile.delete()
                AtpApplication.database.deleteTransfersForFile(targetFile.name)
                val resp = JSONObject().apply {
                    put("status", "ok")
                    put("message", "Deleted ${targetFile.name}")
                }
                newFixedLengthResponse(Response.Status.OK, "application/json", resp.toString())
            }

            path == "/files" && method == Method.DELETE -> {
                receivedVaultDir.listFiles()?.forEach { it.delete() }
                AtpApplication.database.clearAllTransfers()
                val resp = JSONObject().apply {
                    put("status", "ok")
                    put("message", "All vault files cleared")
                }
                newFixedLengthResponse(Response.Status.OK, "application/json", resp.toString())
            }

            path == "/activity" && method == Method.GET -> {
                val limit = session.parameters["limit"]?.firstOrNull()?.toIntOrNull() ?: 50
                val logs = AtpApplication.database.getActivityLogs(limit)
                newFixedLengthResponse(Response.Status.OK, "application/json", logs.toString())
            }

            path == "/activity" && method == Method.DELETE -> {
                AtpApplication.database.clearActivityLogs()
                val resp = JSONObject().apply {
                    put("status", "ok")
                    put("message", "All activity logs cleared")
                }
                newFixedLengthResponse(Response.Status.OK, "application/json", resp.toString())
            }

            path == "/security/status" && method == Method.GET -> {
                val sec = JSONObject().apply {
                    put("cipher_suite", "AES-256-GCM")
                    put("key_exchange", "X25519-HKDF-SHA256")
                    put("hash_algorithm", "SHA-256")
                    put("tcp_port", tcpPort)
                    put("aead_tag_size_bits", 128)
                    put("status", "active")
                }
                newFixedLengthResponse(Response.Status.OK, "application/json", sec.toString())
            }

            path == "/settings" && method == Method.GET -> {
                val s = JSONObject().apply {
                    put("http_port", httpPort)
                    put("tcp_port", tcpPort)
                    put("chunk_size", 65536)
                    put("max_clients", 16)
                    put("socket_timeout", 30)
                    put("cipher_suite", "AES-256-GCM")
                    put("key_exchange", "X25519-HKDF-SHA256")
                    put("uploads_dir", "data/uploads")
                    put("received_dir", "data/received")
                    put("db_path", "data/atp_transfers.db")
                }
                newFixedLengthResponse(Response.Status.OK, "application/json", s.toString())
            }

            path == "/settings" && method == Method.POST -> {
                val body = getRequestBodyJson(session)
                newFixedLengthResponse(Response.Status.OK, "application/json", body.toString())
            }

            else -> {
                newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", "{\"detail\":\"API route not found: $path\"}")
            }
        }
    }

    private fun handleSendClientUpload(session: IHTTPSession): Response {
        val files = HashMap<String, String>()
        session.parseBody(files)
        val parms = session.parameters

        val targetDeviceId = parms["target_device_id"]?.firstOrNull() ?: "broadcast"
        val senderDeviceId = parms["sender_device_id"]?.firstOrNull() ?: "anonymous"
        val tempFilePath = files["file"] ?: files.values.firstOrNull()

        if (tempFilePath == null) {
            return newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json", "{\"detail\":\"No file provided in form\"}")
        }

        val originalFilename = parms["file"]?.firstOrNull() ?: "uploaded_file.bin"
        val cleanName = File(originalFilename).name
        val stagedFile = File(stagingDir, cleanName)

        File(tempFilePath).copyTo(stagedFile, overwrite = true)

        val targetHost = parms["target_host"]?.firstOrNull() ?: parms["target_ip"]?.firstOrNull() ?: "127.0.0.1"
        val targetTcpPort = parms["target_port"]?.firstOrNull()?.toIntOrNull() ?: tcpPort

        // Transmit via local or remote TCP engine
        val client = AtpTcpClient(targetHost, targetTcpPort)
        return try {
            client.connect()
            client.performHandshake()
            val result = client.sendFile(stagedFile)

            val tid = result.optString("transfer_id")
            if (tid.isNotEmpty()) {
                val cv = android.content.ContentValues().apply {
                    put("target_device_id", targetDeviceId)
                    put("sender_device_id", senderDeviceId)
                }
                AtpApplication.database.writableDatabase.update("transfers", cv, "id = ?", arrayOf(tid))
            }
            newFixedLengthResponse(Response.Status.OK, "application/json", result.toString())
        } catch (e: Exception) {
            Log.e(TAG, "TCP send-client error: ${e.message}", e)
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json", "{\"detail\":\"TCP error: ${e.message}\"}")
        } finally {
            client.close()
        }
    }

    private fun handleFileDownload(filename: String): Response {
        val targetFile = File(receivedVaultDir, File(filename).name)
        if (!targetFile.exists() || !targetFile.isFile) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", "{\"detail\":\"File not found in vault\"}")
        }

        val mime = getMimeTypeForFile(targetFile.name)
        val fis = FileInputStream(targetFile)
        val resp = newFixedLengthResponse(Response.Status.OK, mime, fis, targetFile.length())
        resp.addHeader("Content-Disposition", "attachment; filename=\"${targetFile.name}\"")
        return resp
    }

    private fun listReceivedVaultFiles(): JSONArray {
        val array = JSONArray()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        receivedVaultDir.listFiles()?.filter { it.isFile && !it.name.endsWith(".part") }?.forEach { f ->
            val obj = JSONObject().apply {
                put("name", f.name)
                put("size", f.length())
                put("received_at", dateFormat.format(Date(f.lastModified())))
                put("sha256_hash", AtpCrypto.computeSha256File(f))
                put("target_device_id", "broadcast")
            }
            array.put(obj)
        }
        return array
    }

    private fun handleStaticAsset(uri: String): Response {
        var assetPath = "web" + (if (uri == "/" || uri.isEmpty()) "/index.html" else uri)
        if (assetPath.endsWith("/")) assetPath += "index.html"

        return try {
            val stream: InputStream = context.assets.open(assetPath)
            val mime = resolveMimeType(assetPath)
            newChunkedResponse(Response.Status.OK, mime, stream)
        } catch (e: Exception) {
            // SPA routing fallback: return web/index.html
            try {
                val fallbackStream: InputStream = context.assets.open("web/index.html")
                newChunkedResponse(Response.Status.OK, "text/html", fallbackStream)
            } catch (fe: Exception) {
                newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Asset not found: $uri")
            }
        }
    }

    private fun resolveMimeType(fileName: String): String {
        return when {
            fileName.endsWith(".html") || fileName.endsWith(".htm") -> "text/html"
            fileName.endsWith(".js") -> "application/javascript"
            fileName.endsWith(".css") -> "text/css"
            fileName.endsWith(".svg") -> "image/svg+xml"
            fileName.endsWith(".png") -> "image/png"
            fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") -> "image/jpeg"
            fileName.endsWith(".json") -> "application/json"
            fileName.endsWith(".woff2") -> "font/woff2"
            fileName.endsWith(".woff") -> "font/woff"
            fileName.endsWith(".ttf") -> "font/ttf"
            else -> "application/octet-stream"
        }
    }

    private fun getRequestBodyJson(session: IHTTPSession): JSONObject {
        val map = HashMap<String, String>()
        session.parseBody(map)
        val postData = map["postData"] ?: ""
        return if (postData.isNotEmpty()) JSONObject(postData) else JSONObject()
    }
}
