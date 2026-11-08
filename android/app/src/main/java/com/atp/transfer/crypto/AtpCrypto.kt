package com.atp.transfer.crypto

import org.bouncycastle.crypto.agreement.X25519Agreement
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.generators.HKDFBytesGenerator
import org.bouncycastle.crypto.generators.X25519KeyPairGenerator
import org.bouncycastle.crypto.params.HKDFParameters
import org.bouncycastle.crypto.params.X25519KeyGenerationParameters
import org.bouncycastle.crypto.params.X25519PrivateKeyParameters
import org.bouncycastle.crypto.params.X25519PublicKeyParameters
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object AtpCrypto {
    private val HKDF_INFO = "ATP-v1-session-key-derivation".toByteArray(StandardCharsets.UTF_8)
    private val secureRandom = SecureRandom()

    data class KeyPair(
        val privateKey: X25519PrivateKeyParameters,
        val publicKeyBytes: ByteArray
    )

    data class CiphertextWithTag(
        val ciphertext: ByteArray,
        val tag: ByteArray
    )

    fun generateKeyPair(): KeyPair {
        val generator = X25519KeyPairGenerator()
        generator.init(X25519KeyGenerationParameters(secureRandom))
        val pair = generator.generateKeyPair()
        val priv = pair.private as X25519PrivateKeyParameters
        val pub = pair.public as X25519PublicKeyParameters
        return KeyPair(priv, pub.encoded)
    }

    fun deriveSessionKey(
        privateKey: X25519PrivateKeyParameters,
        peerPublicBytes: ByteArray,
        salt: ByteArray
    ): ByteArray {
        val peerPublic = X25519PublicKeyParameters(peerPublicBytes, 0)
        val agreement = X25519Agreement()
        agreement.init(privateKey)

        val sharedSecret = ByteArray(agreement.agreementSize)
        agreement.calculateAgreement(peerPublic, sharedSecret, 0)

        // HKDF-SHA256
        val hkdf = HKDFBytesGenerator(SHA256Digest())
        hkdf.init(HKDFParameters(sharedSecret, salt, HKDF_INFO))

        val sessionKey = ByteArray(32) // 256 bits AES key
        hkdf.generateBytes(sessionKey, 0, 32)
        return sessionKey
    }

    fun generateSalt(): ByteArray {
        val salt = ByteArray(4)
        secureRandom.nextBytes(salt)
        return salt
    }

    fun generateNonce(chunkIndex: Int, sessionSalt: ByteArray): ByteArray {
        val nonce = ByteBuffer.allocate(12)
        nonce.order(ByteOrder.BIG_ENDIAN)

        // 4 bytes session salt
        val saltPrefix = if (sessionSalt.size >= 4) {
            sessionSalt.copyOfRange(0, 4)
        } else {
            val padded = ByteArray(4)
            System.arraycopy(sessionSalt, 0, padded, 0, sessionSalt.size)
            padded
        }
        nonce.put(saltPrefix)

        // 8 bytes chunk index big-endian
        nonce.putLong(chunkIndex.toLong())
        return nonce.array()
    }

    fun encryptChunk(
        key: ByteArray,
        plaintext: ByteArray,
        nonce: ByteArray
    ): CiphertextWithTag {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val keySpec = SecretKeySpec(key, "AES")
        val gcmSpec = GCMParameterSpec(128, nonce)
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec)

        val encrypted = cipher.doFinal(plaintext)
        // In Java AES/GCM, cipher.doFinal returns ciphertext + 16-byte tag
        val ciphertextLen = encrypted.size - 16
        val ciphertext = ByteArray(ciphertextLen)
        val tag = ByteArray(16)

        System.arraycopy(encrypted, 0, ciphertext, 0, ciphertextLen)
        System.arraycopy(encrypted, ciphertextLen, tag, 0, 16)

        return CiphertextWithTag(ciphertext, tag)
    }

    @Throws(AEADBadTagException::class, Exception::class)
    fun decryptChunk(
        key: ByteArray,
        nonce: ByteArray,
        ciphertext: ByteArray,
        tag: ByteArray
    ): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val keySpec = SecretKeySpec(key, "AES")
        val gcmSpec = GCMParameterSpec(128, nonce)
        cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec)

        // Combine ciphertext + tag for Java GCM decryption
        val combined = ByteArray(ciphertext.size + tag.size)
        System.arraycopy(ciphertext, 0, combined, 0, ciphertext.size)
        System.arraycopy(tag, 0, combined, ciphertext.size, tag.size)

        return cipher.doFinal(combined)
    }

    fun computeSha256(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(data)
        return hash.joinToString("") { "%02x".format(it) }
    }

    fun computeSha256File(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { fis ->
            val buffer = ByteArray(64 * 1024)
            var bytesRead: Int
            while (fis.read(buffer).also { bytesRead = it } != -1) {
                digest.update(buffer, 0, bytesRead)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
