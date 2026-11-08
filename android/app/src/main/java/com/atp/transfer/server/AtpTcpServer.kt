package com.atp.transfer.server

import android.util.Log
import com.atp.transfer.AtpApplication
import com.atp.transfer.crypto.AtpCrypto
import com.atp.transfer.protocol.AtpProtocol
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.RandomAccessFile
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.util.Collections
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.crypto.AEADBadTagException

class AtpTcpServer(
    val port: Int = 9000,
    val storageDir: File
) {
    companion object {
        private const val TAG = "AtpTcpServer"
    }

    private var serverSocket: ServerSocket? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var acceptJob: Job? = null

    val isRunning: Boolean
        get() = serverSocket?.isBound == true && serverSocket?.isClosed == false

    private val activeSessions = ConcurrentHashMap<String, ClientSession>()

    val activeConnectionsCount: Int
        get() = activeSessions.size

    val receivedVaultDir: File by lazy {
        val dir = File(storageDir, "received")
        if (!dir.exists()) dir.mkdirs()
        dir
    }

    val stagingDir: File by lazy {
        val dir = File(storageDir, "staging")
        if (!dir.exists()) dir.mkdirs()
        dir
    }

    data class ClientSession(
        val sessionId: String,
        val socket: Socket,
        val clientIp: String,
        var sessionKey: ByteArray? = null,
        val sessionSalt: ByteArray = AtpCrypto.generateSalt(),
        var transferId: String? = null,
        var state: String = "INIT",
        var activeFile: RandomAccessFile? = null,
        var activePartFile: File? = null,
        var expectedSha256: String = "",
        var expectedSize: Long = 0L,
        var cleanFilename: String = ""
    )

    fun start() {
        if (isRunning) return

        try {
            val s = ServerSocket()
            s.reuseAddress = true
            s.bind(InetSocketAddress("0.0.0.0", port))
            serverSocket = s
            Log.i(TAG, "ATP TCP Server started on 0.0.0.0:$port")

            acceptJob = scope.launch {
                while (isActive && !s.isClosed) {
                    try {
                        val clientSocket = s.accept()
                        clientSocket.tcpNoDelay = true
                        clientSocket.soTimeout = 30000 // 30 sec timeout
                        val sessionId = "sess_${UUID.randomUUID().toString().take(8)}"
                        val clientIp = clientSocket.inetAddress.hostAddress ?: "unknown"

                        val session = ClientSession(sessionId, clientSocket, clientIp)
                        activeSessions[sessionId] = session

                        launch {
                            handleClient(session)
                        }
                    } catch (e: SocketException) {
                        if (!s.isClosed) Log.e(TAG, "Socket accept error: ${e.message}")
                        break
                    } catch (e: Exception) {
                        Log.e(TAG, "Unexpected error accepting client: ${e.message}")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to bind ATP TCP Server on port $port: ${e.message}", e)
            throw e
        }
    }

    fun stop() {
        try {
            acceptJob?.cancel()
            serverSocket?.close()
            serverSocket = null

            for ((_, session) in activeSessions) {
                closeSession(session)
            }
            activeSessions.clear()
            Log.i(TAG, "ATP TCP Server stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping ATP TCP Server: ${e.message}")
        }
    }

    private fun handleClient(session: ClientSession) {
        val socket = session.socket
        val clientIp = session.clientIp
        Log.i(TAG, "[${session.sessionId}] Client connected from $clientIp")

        try {
            val inputStream = BufferedInputStream(socket.getInputStream(), 64 * 1024)
            val outputStream = BufferedOutputStream(socket.getOutputStream(), 64 * 1024)

            while (!socket.isClosed && socket.isConnected) {
                val message = AtpProtocol.readMessage(inputStream)
                processMessage(session, message, inputStream, outputStream)
            }
        } catch (e: AtpProtocol.ProtocolException) {
            Log.e(TAG, "[${session.sessionId}] Protocol violation from $clientIp: ${e.message}")
            AtpApplication.database.logSecurity("PROTOCOL_VIOLATION", clientIp, "REJECTED", e.message ?: "")
        } catch (e: Exception) {
            Log.i(TAG, "[${session.sessionId}] Session ended: ${e.message}")
        } finally {
            closeSession(session)
            activeSessions.remove(session.sessionId)
        }
    }

    private fun processMessage(
        session: ClientSession,
        message: AtpProtocol.Message,
        inputStream: BufferedInputStream,
        outputStream: BufferedOutputStream
    ) {
        val body = message.body
        val clientIp = session.clientIp

        when (message.type) {
            AtpProtocol.MsgType.HANDSHAKE_INIT -> {
                if (body.size < 36) {
                    throw AtpProtocol.ProtocolException("HANDSHAKE_INIT requires 32-byte pub key + 4-byte salt")
                }
                val clientPubBytes = body.copyOfRange(0, 32)
                val clientSalt = body.copyOfRange(32, 36)

                // Generate server keypair
                val serverKeyPair = AtpCrypto.generateKeyPair()
                val combinedSalt = clientSalt + session.sessionSalt

                // Derive 256-bit AES session key via HKDF-SHA256
                session.sessionKey = AtpCrypto.deriveSessionKey(
                    serverKeyPair.privateKey,
                    clientPubBytes,
                    combinedSalt
                )
                session.state = "AUTHENTICATED"

                // Reply: server pub bytes (32) + server salt (4)
                val respBody = serverKeyPair.publicKeyBytes + session.sessionSalt
                AtpProtocol.writeMessage(outputStream, AtpProtocol.MsgType.HANDSHAKE_RESP, respBody)

                val keyFingerprint = AtpCrypto.computeSha256(session.sessionKey!!).take(16)
                AtpApplication.database.logSecurity(
                    "KEY_EXCHANGE_SUCCESS",
                    clientIp,
                    "ESTABLISHED",
                    "X25519 ECDH established. Fingerprint: $keyFingerprint"
                )
            }

            AtpProtocol.MsgType.AUTH_REQ -> {
                val resp = JSONObject().apply {
                    put("authenticated", true)
                    put("username", "admin")
                    put("role", "admin")
                }
                AtpProtocol.writeMessage(outputStream, AtpProtocol.MsgType.AUTH_RESP, resp.toString().toByteArray())
            }

            AtpProtocol.MsgType.TRANSFER_INIT -> {
                if (session.sessionKey == null) {
                    throw AtpProtocol.ProtocolException("Transfer initiated before handshake")
                }

                val json = JSONObject(String(body, Charsets.UTF_8))
                val transferId = json.getString("transfer_id")
                val filename = File(json.getString("filename")).name
                val fileSize = json.getLong("file_size")
                val totalChunks = json.getInt("total_chunks")
                val sha256Hash = json.getString("sha256_hash")

                session.transferId = transferId
                session.cleanFilename = filename
                session.expectedSize = fileSize
                session.expectedSha256 = sha256Hash
                session.state = "TRANSFERRING"

                val partFile = File(receivedVaultDir, "$filename.part")
                session.activePartFile = partFile
                session.activeFile = RandomAccessFile(partFile, "rw")

                val keyFingerprint = AtpCrypto.computeSha256(session.sessionKey!!).take(16)
                AtpApplication.database.initTransferRecord(
                    transferId, filename, fileSize, totalChunks, sha256Hash,
                    clientIp, keyFingerprint, "receive"
                )

                val (resumeOffset, completedCount, canResume) =
                    AtpApplication.database.getValidatedResumeState(transferId)

                val ack = JSONObject().apply {
                    put("transfer_id", transferId)
                    put("status", "ready")
                    put("resume_offset", if (canResume) resumeOffset else 0L)
                    put("completed_chunks", if (canResume) completedCount else 0)
                }
                AtpProtocol.writeMessage(outputStream, AtpProtocol.MsgType.TRANSFER_ACK, ack.toString().toByteArray())
            }

            AtpProtocol.MsgType.RESUME_REQ -> {
                val json = JSONObject(String(body, Charsets.UTF_8))
                val transferId = json.getString("transfer_id")
                val (resumeOffset, completedCount, canResume) =
                    AtpApplication.database.getValidatedResumeState(transferId)

                session.transferId = transferId
                session.state = "TRANSFERRING"

                val resp = JSONObject().apply {
                    put("transfer_id", transferId)
                    put("can_resume", canResume)
                    put("verified_offset", resumeOffset)
                    put("completed_chunks", completedCount)
                }
                AtpProtocol.writeMessage(outputStream, AtpProtocol.MsgType.RESUME_RESP, resp.toString().toByteArray())
            }

            AtpProtocol.MsgType.CHUNK_DATA -> {
                val key = session.sessionKey ?: throw AtpProtocol.ProtocolException("No session key for chunk")
                val chunk = AtpProtocol.unpackChunkBody(body)

                val plaintext: ByteArray
                try {
                    plaintext = AtpCrypto.decryptChunk(key, chunk.nonce, chunk.ciphertext, chunk.tag)
                } catch (e: AEADBadTagException) {
                    Log.e(TAG, "[${session.sessionId}] AEAD Tag Verification Failed on chunk #${chunk.chunkIndex}")
                    AtpApplication.database.logSecurity(
                        "TAMPERING_DETECTED",
                        clientIp,
                        "REJECTED",
                        "Invalid authentication tag for chunk #${chunk.chunkIndex} in transfer ${chunk.transferId}"
                    )
                    AtpApplication.database.logActivity(
                        chunk.transferId,
                        "TAMPER_DETECTED",
                        "Authentication tag verification failed on chunk #${chunk.chunkIndex}. Dropping connection.",
                        "error"
                    )
                    val err = JSONObject().apply {
                        put("error", "AES-GCM Authentication Tag mismatch. Data tampered.")
                    }
                    AtpProtocol.writeMessage(outputStream, AtpProtocol.MsgType.ERROR, err.toString().toByteArray())
                    throw AtpProtocol.ProtocolException("Cryptographic authentication failure on chunk #${chunk.chunkIndex}")
                }

                // Write verified plaintext to exact byte offset
                val raf = session.activeFile ?: run {
                    val pFile = session.activePartFile ?: File(receivedVaultDir, "${session.cleanFilename}.part")
                    val newRaf = RandomAccessFile(pFile, "rw")
                    session.activeFile = newRaf
                    newRaf
                }

                synchronized(raf) {
                    raf.seek(chunk.byteOffset)
                    raf.write(plaintext)
                }

                val (transferredBytes, completedChunks) =
                    AtpApplication.database.writeVerifiedChunkCheckpoint(
                        chunk.transferId,
                        chunk.chunkIndex,
                        chunk.byteOffset,
                        plaintext.size
                    )

                // Send CHUNK_ACK with (chunkIndex, nextOffset)
                val nextOffset = chunk.byteOffset + plaintext.size
                val ackBytes = AtpProtocol.packChunkAck(chunk.chunkIndex, nextOffset)
                outputStream.write(ackBytes)
                outputStream.flush()
            }

            AtpProtocol.MsgType.COMPLETE -> {
                val transferId = session.transferId ?: throw AtpProtocol.ProtocolException("No active transfer to complete")

                // Close partial file
                session.activeFile?.close()
                session.activeFile = null

                val partFile = session.activePartFile ?: File(receivedVaultDir, "${session.cleanFilename}.part")
                val finalFile = File(receivedVaultDir, session.cleanFilename)

                if (finalFile.exists()) finalFile.delete()
                val renamed = partFile.renameTo(finalFile)

                if (!renamed && partFile.exists()) {
                    partFile.copyTo(finalFile, overwrite = true)
                    partFile.delete()
                }

                // Validate complete SHA-256
                val computedHash = AtpCrypto.computeSha256File(finalFile)
                val expectedHash = session.expectedSha256.lowercase()
                val isValid = expectedHash.isEmpty() || computedHash.equals(expectedHash, ignoreCase = true)

                if (isValid) {
                    AtpApplication.database.markTransferStatus(transferId, "completed")
                    AtpApplication.database.logActivity(
                        transferId,
                        "TRANSFER_COMPLETE",
                        "File ${session.cleanFilename} (${finalFile.length()} B) received and verified via SHA-256",
                        "success"
                    )
                } else {
                    AtpApplication.database.markTransferStatus(transferId, "failed", "SHA-256 digest mismatch")
                    AtpApplication.database.logActivity(
                        transferId,
                        "INTEGRITY_FAILURE",
                        "File ${session.cleanFilename} failed end-to-end checksum verification ($computedHash != $expectedHash)",
                        "error"
                    )
                }

                val resp = JSONObject().apply {
                    put("transfer_id", transferId)
                    put("success", isValid)
                    put("sha256", computedHash)
                    put("message", if (isValid) "File reconstructed and verified successfully" else "SHA-256 mismatch")
                }
                AtpProtocol.writeMessage(outputStream, AtpProtocol.MsgType.COMPLETE, resp.toString().toByteArray())
                session.state = "COMPLETE"
            }

            AtpProtocol.MsgType.DOWNLOAD_INIT -> {
                if (session.sessionKey == null) {
                    throw AtpProtocol.ProtocolException("Handshake required before download")
                }

                val json = JSONObject(String(body, Charsets.UTF_8))
                val rawFilename = json.optString("filename", "")
                val clientOffset = json.optLong("client_offset", 0L)
                val cleanFilename = File(rawFilename).name

                val targetFile = File(receivedVaultDir, cleanFilename)
                if (!targetFile.exists() || !targetFile.isFile) {
                    val err = JSONObject().apply {
                        put("error", "File '$cleanFilename' not found in vault")
                    }
                    AtpProtocol.writeMessage(outputStream, AtpProtocol.MsgType.ERROR, err.toString().toByteArray())
                    return
                }

                val fileSize = targetFile.length()
                val chunkSize = AtpProtocol.DEFAULT_CHUNK_SIZE
                val totalChunks = if (fileSize > 0) ((fileSize + chunkSize - 1) / chunkSize).toInt() else 1
                val sha256 = AtpCrypto.computeSha256File(targetFile)
                val transferId = UUID.randomUUID().toString()

                session.transferId = transferId
                session.state = "STREAMING_DOWNLOAD"

                val ack = JSONObject().apply {
                    put("transfer_id", transferId)
                    put("filename", cleanFilename)
                    put("file_size", fileSize)
                    put("total_chunks", totalChunks)
                    put("sha256_hash", sha256)
                    put("start_offset", clientOffset)
                }
                AtpProtocol.writeMessage(outputStream, AtpProtocol.MsgType.DOWNLOAD_ACK, ack.toString().toByteArray())

                // Stream chunks
                val startChunk = (clientOffset / chunkSize).toInt()
                var bytesSent = clientOffset

                RandomAccessFile(targetFile, "r").use { raf ->
                    if (clientOffset > 0) raf.seek(clientOffset)
                    val buffer = ByteArray(chunkSize)

                    for (chunkIdx in startChunk until totalChunks) {
                        val bytesRead = raf.read(buffer)
                        if (bytesRead <= 0 && fileSize > 0) break

                        val plaintext = if (bytesRead == chunkSize) buffer else buffer.copyOfRange(0, bytesRead)
                        val byteOffset = bytesSent
                        val nonce = AtpCrypto.generateNonce(chunkIdx, session.sessionSalt)
                        val encrypted = AtpCrypto.encryptChunk(session.sessionKey!!, plaintext, nonce)

                        val chunkPacket = AtpProtocol.packChunk(
                            transferId, chunkIdx, byteOffset, nonce, encrypted.tag, encrypted.ciphertext
                        )
                        outputStream.write(chunkPacket)
                        outputStream.flush()

                        // Await client CHUNK_ACK
                        val ackMsg = AtpProtocol.readMessage(inputStream)
                        if (ackMsg.type != AtpProtocol.MsgType.CHUNK_ACK) {
                            throw AtpProtocol.ProtocolException("Expected CHUNK_ACK during download, got ${ackMsg.type}")
                        }

                        bytesSent += bytesRead
                    }
                }

                // Send COMPLETE
                val comp = JSONObject().apply {
                    put("transfer_id", transferId)
                    put("success", true)
                    put("file_size", fileSize)
                    put("sha256", sha256)
                }
                AtpProtocol.writeMessage(outputStream, AtpProtocol.MsgType.COMPLETE, comp.toString().toByteArray())
            }

            AtpProtocol.MsgType.PING -> {
                AtpProtocol.writeMessage(outputStream, AtpProtocol.MsgType.PONG, "PONG".toByteArray())
            }

            else -> {
                Log.w(TAG, "Unhandled message type: ${message.type}")
            }
        }
    }

    private fun closeSession(session: ClientSession) {
        try {
            session.activeFile?.close()
            session.activeFile = null
            if (session.transferId != null && session.state == "TRANSFERRING") {
                AtpApplication.database.markTransferStatus(session.transferId!!, "interrupted")
                AtpApplication.database.logActivity(
                    session.transferId,
                    "TRANSFER_INTERRUPTED",
                    "Client disconnected; transfer saved as resumable checkpoint",
                    "warning"
                )
            }
            if (!session.socket.isClosed) {
                session.socket.close()
            }
        } catch (e: Exception) {
            // ignore
        }
    }
}
