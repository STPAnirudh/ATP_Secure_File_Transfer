package com.atp.transfer.client

import com.atp.transfer.crypto.AtpCrypto
import com.atp.transfer.protocol.AtpProtocol
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.RandomAccessFile
import java.net.InetSocketAddress
import java.net.Socket
import java.util.UUID

class AtpTcpClient(
    val host: String,
    val port: Int = 9000
) {
    private var socket: Socket? = null
    private var inputStream: BufferedInputStream? = null
    private var outputStream: BufferedOutputStream? = null
    private var sessionKey: ByteArray? = null
    private val clientSalt = AtpCrypto.generateSalt()

    fun connect(timeoutMs: Int = 10000) {
        val s = Socket()
        s.tcpNoDelay = true
        s.soTimeout = 30000
        s.connect(InetSocketAddress(host, port), timeoutMs)
        socket = s
        inputStream = BufferedInputStream(s.getInputStream(), 64 * 1024)
        outputStream = BufferedOutputStream(s.getOutputStream(), 64 * 1024)
    }

    fun close() {
        try {
            socket?.close()
        } catch (e: Exception) {
            // ignore
        }
        socket = null
        inputStream = null
        outputStream = null
    }

    fun performHandshake(): ByteArray {
        val inStream = inputStream ?: throw IllegalStateException("Not connected")
        val outStream = outputStream ?: throw IllegalStateException("Not connected")

        // 1. Generate client keypair
        val clientKeyPair = AtpCrypto.generateKeyPair()

        // 2. Send HANDSHAKE_INIT: 32 bytes pub + 4 bytes salt
        val payload = clientKeyPair.publicKeyBytes + clientSalt
        AtpProtocol.writeMessage(outStream, AtpProtocol.MsgType.HANDSHAKE_INIT, payload)

        // 3. Receive HANDSHAKE_RESP: 32 bytes server pub + 4 bytes server salt
        val resp = AtpProtocol.readMessage(inStream)
        if (resp.type != AtpProtocol.MsgType.HANDSHAKE_RESP || resp.body.size < 36) {
            throw AtpProtocol.ProtocolException("Handshake failed: expected HANDSHAKE_RESP (>=36 bytes), got ${resp.type}")
        }

        val serverPubBytes = resp.body.copyOfRange(0, 32)
        val serverSalt = resp.body.copyOfRange(32, 36)
        val combinedSalt = clientSalt + serverSalt

        // 4. Derive symmetric 256-bit AES session key via HKDF
        val key = AtpCrypto.deriveSessionKey(
            clientKeyPair.privateKey,
            serverPubBytes,
            combinedSalt
        )
        sessionKey = key
        return key
    }

    fun sendFile(
        file: File,
        transferId: String = UUID.randomUUID().toString(),
        chunkSize: Int = AtpProtocol.DEFAULT_CHUNK_SIZE,
        onProgress: ((bytesSent: Long, totalBytes: Long, percent: Float) -> Unit)? = null
    ): JSONObject {
        val inStream = inputStream ?: throw IllegalStateException("Not connected")
        val outStream = outputStream ?: throw IllegalStateException("Not connected")
        val key = sessionKey ?: throw IllegalStateException("Must perform handshake prior to transfer")

        val fileSize = file.length()
        val totalChunks = if (fileSize > 0) ((fileSize + chunkSize - 1) / chunkSize).toInt() else 1
        val sha256 = AtpCrypto.computeSha256File(file)

        // 1. Send TRANSFER_INIT
        val initJson = JSONObject().apply {
            put("transfer_id", transferId)
            put("filename", file.name)
            put("file_size", fileSize)
            put("total_chunks", totalChunks)
            put("sha256_hash", sha256)
        }
        AtpProtocol.writeMessage(outStream, AtpProtocol.MsgType.TRANSFER_INIT, initJson.toString().toByteArray())

        // 2. Await TRANSFER_ACK
        val ackMsg = AtpProtocol.readMessage(inStream)
        if (ackMsg.type != AtpProtocol.MsgType.TRANSFER_ACK) {
            throw AtpProtocol.ProtocolException("Expected TRANSFER_ACK, got ${ackMsg.type}")
        }

        val ackJson = JSONObject(String(ackMsg.body, Charsets.UTF_8))
        val resumeOffset = ackJson.optLong("resume_offset", 0L)

        val startChunk = (resumeOffset / chunkSize).toInt()
        var bytesTransferred = resumeOffset

        onProgress?.invoke(bytesTransferred, fileSize, if (fileSize > 0) (bytesTransferred.toFloat() / fileSize) * 100f else 100f)

        // 3. Stream encrypted chunks
        RandomAccessFile(file, "r").use { raf ->
            if (resumeOffset > 0) raf.seek(resumeOffset)
            val buffer = ByteArray(chunkSize)

            for (chunkIdx in startChunk until totalChunks) {
                val bytesRead = raf.read(buffer)
                if (bytesRead <= 0 && fileSize > 0) break

                val plaintext = if (bytesRead == chunkSize) buffer else buffer.copyOfRange(0, bytesRead)
                val byteOffset = bytesTransferred
                val nonce = AtpCrypto.generateNonce(chunkIdx, clientSalt)
                val encrypted = AtpCrypto.encryptChunk(key, plaintext, nonce)

                val chunkPacket = AtpProtocol.packChunk(
                    transferId, chunkIdx, byteOffset, nonce, encrypted.tag, encrypted.ciphertext
                )
                outStream.write(chunkPacket)
                outStream.flush()

                // Await CHUNK_ACK
                val chunkAckMsg = AtpProtocol.readMessage(inStream)
                if (chunkAckMsg.type == AtpProtocol.MsgType.ERROR) {
                    val errJson = JSONObject(String(chunkAckMsg.body, Charsets.UTF_8))
                    throw AtpProtocol.ProtocolException("Server error during chunk: ${errJson.optString("error")}")
                }
                if (chunkAckMsg.type != AtpProtocol.MsgType.CHUNK_ACK) {
                    throw AtpProtocol.ProtocolException("Expected CHUNK_ACK, got ${chunkAckMsg.type}")
                }

                bytesTransferred += bytesRead
                val pct = if (fileSize > 0) (bytesTransferred.toFloat() / fileSize) * 100f else 100f
                onProgress?.invoke(bytesTransferred, fileSize, pct)
            }
        }

        // 4. Send COMPLETE
        AtpProtocol.writeMessage(outStream, AtpProtocol.MsgType.COMPLETE, JSONObject().apply {
            put("transfer_id", transferId)
        }.toString().toByteArray())

        // 5. Await COMPLETE response
        val compMsg = AtpProtocol.readMessage(inStream)
        if (compMsg.type != AtpProtocol.MsgType.COMPLETE) {
            throw AtpProtocol.ProtocolException("Expected COMPLETE response, got ${compMsg.type}")
        }

        return JSONObject(String(compMsg.body, Charsets.UTF_8)).apply {
            put("transfer_id", transferId)
            put("filename", file.name)
            put("file_size", fileSize)
            put("sha256_hash", sha256)
        }
    }
}
