package com.atp.transfer.protocol

import java.io.EOFException
import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.charset.StandardCharsets
import java.util.UUID

object AtpProtocol {
    val MAGIC_HEADER = "ATP1".toByteArray(StandardCharsets.US_ASCII)
    const val HEADER_SIZE = 9
    const val CHUNK_HEADER_SIZE = 60
    const val DEFAULT_CHUNK_SIZE = 64 * 1024 // 64 KB

    enum class MsgType(val code: Int) {
        HANDSHAKE_INIT(1),
        HANDSHAKE_RESP(2),
        AUTH_REQ(3),
        AUTH_RESP(4),
        TRANSFER_INIT(5),
        TRANSFER_ACK(6),
        CHUNK_DATA(7),
        CHUNK_ACK(8),
        RESUME_REQ(9),
        RESUME_RESP(10),
        COMPLETE(11),
        ERROR(12),
        PING(13),
        PONG(14),
        DOWNLOAD_INIT(15),
        DOWNLOAD_ACK(16);

        companion object {
            fun fromCode(code: Int): MsgType {
                return entries.firstOrNull { it.code == code }
                    ?: throw ProtocolException("Unknown message type code: $code")
            }
        }
    }

    class ProtocolException(message: String) : Exception(message)

    data class Message(val type: MsgType, val body: ByteArray)

    data class ChunkData(
        val transferId: String,
        val chunkIndex: Int,
        val byteOffset: Long,
        val nonce: ByteArray,
        val tag: ByteArray,
        val ciphertext: ByteArray
    )

    fun packMessage(type: MsgType, body: ByteArray): ByteArray {
        val buffer = ByteBuffer.allocate(HEADER_SIZE + body.size)
        buffer.order(ByteOrder.BIG_ENDIAN)
        buffer.put(MAGIC_HEADER)
        buffer.put(type.code.toByte())
        buffer.putInt(body.size)
        buffer.put(body)
        return buffer.array()
    }

    fun packJson(type: MsgType, json: String): ByteArray {
        return packMessage(type, json.toByteArray(StandardCharsets.UTF_8))
    }

    fun packChunk(
        transferId: String,
        chunkIndex: Int,
        byteOffset: Long,
        nonce: ByteArray,
        tag: ByteArray,
        ciphertext: ByteArray
    ): ByteArray {
        val uuid = UUID.fromString(transferId)
        val bodyBuffer = ByteBuffer.allocate(CHUNK_HEADER_SIZE + ciphertext.size)
        bodyBuffer.order(ByteOrder.BIG_ENDIAN)

        // 16 bytes UUID
        bodyBuffer.putLong(uuid.mostSignificantBits)
        bodyBuffer.putLong(uuid.leastSignificantBits)

        // 4 bytes chunkIndex (uint32)
        bodyBuffer.putInt(chunkIndex)

        // 8 bytes byteOffset (uint64)
        bodyBuffer.putLong(byteOffset)

        // 12 bytes nonce
        bodyBuffer.put(nonce, 0, 12)

        // 16 bytes auth tag
        bodyBuffer.put(tag, 0, 16)

        // 4 bytes ciphertext length
        bodyBuffer.putInt(ciphertext.size)

        // Ciphertext
        bodyBuffer.put(ciphertext)

        return packMessage(MsgType.CHUNK_DATA, bodyBuffer.array())
    }

    fun unpackChunkBody(body: ByteArray): ChunkData {
        if (body.size < CHUNK_HEADER_SIZE) {
            throw ProtocolException("Chunk body too short: ${body.size} < $CHUNK_HEADER_SIZE bytes")
        }

        val buffer = ByteBuffer.wrap(body)
        buffer.order(ByteOrder.BIG_ENDIAN)

        val msb = buffer.long
        val lsb = buffer.long
        val transferId = UUID(msb, lsb).toString()

        val chunkIndex = buffer.int
        val byteOffset = buffer.long

        val nonce = ByteArray(12)
        buffer.get(nonce)

        val tag = ByteArray(16)
        buffer.get(tag)

        val ciphertextLen = buffer.int
        if (body.size < CHUNK_HEADER_SIZE + ciphertextLen) {
            throw ProtocolException("Truncated ciphertext: expected $ciphertextLen, available ${body.size - CHUNK_HEADER_SIZE}")
        }

        val ciphertext = ByteArray(ciphertextLen)
        buffer.get(ciphertext)

        return ChunkData(transferId, chunkIndex, byteOffset, nonce, tag, ciphertext)
    }

    fun packChunkAck(chunkIndex: Int, nextOffset: Long): ByteArray {
        val buffer = ByteBuffer.allocate(12)
        buffer.order(ByteOrder.BIG_ENDIAN)
        buffer.putInt(chunkIndex)
        buffer.putLong(nextOffset)
        return packMessage(MsgType.CHUNK_ACK, buffer.array())
    }

    fun unpackChunkAck(body: ByteArray): Pair<Int, Long> {
        val buffer = ByteBuffer.wrap(body)
        buffer.order(ByteOrder.BIG_ENDIAN)
        val chunkIndex = buffer.int
        val nextOffset = buffer.long
        return Pair(chunkIndex, nextOffset)
    }

    fun readExact(inputStream: InputStream, numBytes: Int): ByteArray {
        val data = ByteArray(numBytes)
        var totalRead = 0
        while (totalRead < numBytes) {
            val count = inputStream.read(data, totalRead, numBytes - totalRead)
            if (count == -1) {
                throw EOFException("Premature EOF while reading $numBytes bytes (got $totalRead)")
            }
            totalRead += count
        }
        return data
    }

    fun readMessage(inputStream: InputStream): Message {
        val headerBytes = readExact(inputStream, HEADER_SIZE)
        val buffer = ByteBuffer.wrap(headerBytes)
        buffer.order(ByteOrder.BIG_ENDIAN)

        val magic = ByteArray(4)
        buffer.get(magic)
        if (!magic.contentEquals(MAGIC_HEADER)) {
            throw ProtocolException("Invalid magic header: ${String(magic, StandardCharsets.US_ASCII)}")
        }

        val typeCode = buffer.get().toInt() and 0xFF
        val type = MsgType.fromCode(typeCode)
        val bodyLength = buffer.int

        if (bodyLength < 0 || bodyLength > 20 * 1024 * 1024) {
            throw ProtocolException("Message body length invalid or exceeds limit: $bodyLength")
        }

        val body = readExact(inputStream, bodyLength)
        return Message(type, body)
    }

    fun writeMessage(outputStream: OutputStream, type: MsgType, body: ByteArray) {
        val packet = packMessage(type, body)
        outputStream.write(packet)
        outputStream.flush()
    }
}
