import pytest
import os
from backend.app.tcp_engine.crypto import CryptographyEngine, InvalidTag

def test_x25519_key_exchange():
    """Verify ephemeral ECDH key exchange between client and server."""
    client_priv, client_pub = CryptographyEngine.generate_keypair()
    server_priv, server_pub = CryptographyEngine.generate_keypair()

    salt = b"test_salt_1234"
    client_session_key = CryptographyEngine.derive_session_key(client_priv, server_pub, salt=salt)
    server_session_key = CryptographyEngine.derive_session_key(server_priv, client_pub, salt=salt)

    assert len(client_session_key) == 32
    assert len(server_session_key) == 32
    assert client_session_key == server_session_key, "Both parties must derive identical session key"

def test_aes_gcm_encryption_decryption():
    """Verify AES-256-GCM authenticated encryption round-trip."""
    key = os.urandom(32)
    nonce = os.urandom(12)
    plaintext = b"Confidential transfer chunk payload 1234567890"

    ciphertext, tag = CryptographyEngine.encrypt_chunk(key, plaintext, nonce)
    assert len(tag) == 16
    assert ciphertext != plaintext

    decrypted = CryptographyEngine.decrypt_chunk(key, nonce, ciphertext, tag)
    assert decrypted == plaintext

def test_aes_gcm_tampering_rejected():
    """Verify that tampering with ciphertext triggers InvalidTag."""
    key = os.urandom(32)
    nonce = os.urandom(12)
    plaintext = b"Authenticated payload requiring integrity protection"

    ciphertext, tag = CryptographyEngine.encrypt_chunk(key, plaintext, nonce)

    # Tamper with 1 byte in ciphertext
    tampered_ciphertext = bytearray(ciphertext)
    tampered_ciphertext[0] ^= 0xFF

    with pytest.raises(InvalidTag):
        CryptographyEngine.decrypt_chunk(key, nonce, bytes(tampered_ciphertext), tag)

def test_aes_gcm_tag_tampering_rejected():
    """Verify that altering the authentication tag triggers InvalidTag."""
    key = os.urandom(32)
    nonce = os.urandom(12)
    plaintext = b"Authenticated payload requiring integrity protection"

    ciphertext, tag = CryptographyEngine.encrypt_chunk(key, plaintext, nonce)

    # Tamper with 1 byte in tag
    tampered_tag = bytearray(tag)
    tampered_tag[0] ^= 0x01

    with pytest.raises(InvalidTag):
        CryptographyEngine.decrypt_chunk(key, nonce, ciphertext, bytes(tampered_tag))

def test_sha256_digests():
    """Verify SHA-256 digest computation."""
    data = b"Hello world! Agnos Transfer Protocol"
    digest = CryptographyEngine.compute_sha256_bytes(data)
    assert len(digest) == 64
    assert digest == "3cd8a54eb4ed06f60d0792fd0b1e5327bfe9405a108a9912a532d6db1da4b3e1"
