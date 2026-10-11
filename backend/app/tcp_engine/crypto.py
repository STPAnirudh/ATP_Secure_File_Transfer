import os
import hashlib
from typing import Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.asymmetric import x25519
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidTag

HKDF_INFO = b"ATP-v1-session-key-derivation"
HKDF_SALT = b"ATP-v1-salt-2026-secure-transfer"

class CryptographyEngine:
    """
    Cryptographic Engine for the Agnos Transfer Protocol (ATP).
    Implements:
    - X25519 Ephemeral Key Exchange (RFC 7748)
    - HKDF-SHA256 Session Key Derivation (RFC 5869)
    - AES-256-GCM Authenticated Encryption (RFC 5116)
    - SHA-256 End-to-End File Integrity Verification
    """

    @staticmethod
    def generate_keypair() -> Tuple[x25519.X25519PrivateKey, bytes]:
        """Generate ephemeral X25519 private key and 32-byte public key."""
        priv_key = x25519.X25519PrivateKey.generate()
        pub_bytes = priv_key.public_key().public_bytes_raw()
        return priv_key, pub_bytes

    @staticmethod
    def derive_session_key(
        private_key: x25519.X25519PrivateKey,
        peer_public_bytes: bytes,
        salt: bytes = HKDF_SALT,
        info: bytes = HKDF_INFO
    ) -> bytes:
        """
        Compute shared secret via ECDH over Curve25519 and derive
        a 256-bit AES session key using HKDF-SHA256.
        """
        peer_public_key = x25519.X25519PublicKey.from_public_bytes(peer_public_bytes)
        shared_secret = private_key.exchange(peer_public_key)
        
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,  # 256-bit AES key
            salt=salt,
            info=info,
        )
        session_key = hkdf.derive(shared_secret)
        return session_key

    @staticmethod
    def generate_nonce(chunk_index: int, session_salt: bytes = b"") -> bytes:
        """
        Generate a unique 96-bit (12-byte) IV for AES-GCM.
        Combines 4-byte session salt with 8-byte big-endian chunk index
        to guarantee strict nonce uniqueness under the same key.
        """
        if len(session_salt) < 4:
            session_salt = (session_salt + os.urandom(4))[:4]
        return session_salt[:4] + chunk_index.to_bytes(8, byteorder="big")

    @staticmethod
    def encrypt_chunk(
        key: bytes,
        plaintext: bytes,
        nonce: bytes,
        associated_data: bytes = b""
    ) -> Tuple[bytes, bytes]:
        """
        Encrypts a chunk with AES-256-GCM.
        Returns (ciphertext, 16-byte auth_tag).
        """
        aesgcm = AESGCM(key)
        # In cryptography library, encrypt returns ciphertext + 16-byte tag
        encrypted_data = aesgcm.encrypt(nonce, plaintext, associated_data)
        ciphertext = encrypted_data[:-16]
        tag = encrypted_data[-16:]
        return ciphertext, tag

    @staticmethod
    def decrypt_chunk(
        key: bytes,
        nonce: bytes,
        ciphertext: bytes,
        tag: bytes,
        associated_data: bytes = b""
    ) -> bytes:
        """
        Decrypts a chunk with AES-256-GCM and verifies the 16-byte MAC tag.
        Raises InvalidTag if ciphertext, nonce, or tag was altered.
        """
        aesgcm = AESGCM(key)
        combined = ciphertext + tag
        return aesgcm.decrypt(nonce, combined, associated_data)

    @staticmethod
    def compute_sha256_bytes(data: bytes) -> str:
        """Compute SHA-256 hex digest for memory buffer."""
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def compute_sha256_file(filepath: str) -> str:
        """Compute SHA-256 hex digest of a file by streaming in 64KB blocks."""
        hasher = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()
