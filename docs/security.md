# Security Architecture & Cryptographic Specification

## 1. Cryptographic Suite

ATP implements defense-in-depth through standard, peer-reviewed cryptographic primitives:

| Component | Standard | Parameter | Role |
|---|---|---|---|
| **Symmetric Cipher** | AES-GCM (RFC 5116) | 256-bit key, 128-bit MAC | Authenticated chunk encryption & confidentiality |
| **Key Exchange** | X25519 (RFC 7748) | Curve25519 (256-bit) | Ephemeral Diffie-Hellman key exchange |
| **Key Derivation** | HKDF-SHA256 (RFC 5869) | SHA-256, 32-byte output | Derives symmetric AES key from ECDH shared secret |
| **Nonce Policy** | NIST SP 800-38D | 96-bit unique IV | Strictly monotonic chunk index + session salt |
| **Integrity Digest** | FIPS 180-4 | SHA-256 (256-bit) | End-to-end file digest verification post reassembly |

---

## 2. Distinction of Security Layers

A common misunderstanding in network design is conflating encryption, authentication, key exchange, and file hashing. In ATP, each layer addresses a distinct threat:

### 2.1 Ephemeral Key Establishment vs Hardcoded Secrets
- **Threat Addressed**: Key leakage and retrospective decryption.
- **Mechanism**: Raw symmetric keys are **never** transmitted across the wire or stored in configuration files. Client and server generate single-use Curve25519 keypairs per session and compute a temporary shared secret. If an attacker records traffic and compromises past long-term keys, they cannot decrypt recorded sessions (Perfect Forward Secrecy).

### 2.2 AES-GCM Authenticated Encryption vs Simple Stream Encryption
- **Threat Addressed**: Man-in-the-Middle (MITM) ciphertext tampering and bit-flipping attacks.
- **Mechanism**: Stream ciphers (e.g. AES-CTR or AES-CBC) without an authentication tag only provide confidentiality; an adversary can flip bits in transit without knowing the plaintext. AES-GCM generates a 128-bit authentication tag over the ciphertext and header. The server verifies this tag **prior to writing any plaintext to disk**. If even a single bit is modified, decryption immediately raises a fatal `InvalidTag` exception and terminates the connection.

### 2.3 User Authentication & Authorization vs Transport Encryption
- **Threat Addressed**: Unauthorized access to file transmission nodes.
- **Mechanism**: Cryptographic channel encryption protects bytes in flight; user authentication (passwords, salted SHA-256 hashes, JWTs) verifies the identity of the human or agent initiating the stream and enforces permission boundaries on the storage vault.

### 2.4 End-to-End SHA-256 Digest vs Per-Chunk GCM MAC Tags
- **Threat Addressed**: Reassembly reordering, missing chunks, and disk storage corruption.
- **Mechanism**: While AES-GCM ensures that each individual 64 KB chunk was authentic when received over the network, SHA-256 is computed across the **entire finalized file on disk**. This guarantees that the final file is bit-for-bit identical to the source file and was assembled in the correct offset sequence without missing or corrupt bytes.

---

## 3. Nonce Uniqueness Guarantee

AES-GCM catastrophic failure occurs if the same nonce is ever used twice with the same key. ATP prevents nonce reuse through a deterministic scheme:
- A 4-byte random session salt is generated per connection.
- An 8-byte big-endian chunk sequence counter (`0, 1, 2, ...`) is appended to the salt.
- This creates a strictly monotonically increasing 12-byte (96-bit) nonce per chunk.

---

## 4. Trust Assumptions & Threat Model

1. **Endpoint Integrity**: The client and server operating environments are assumed to be trusted. Cryptographic keys stored in ephemeral process memory are protected by the OS kernel.
2. **Key Exchange Trust**: The initial X25519 exchange in the base profile is unauthenticated Diffie-Hellman, providing confidentiality and forward secrecy against passive network observers. In production environments with active adversarial network infrastructure, endpoints should authenticate ephemeral public keys using pre-shared certificates or Ed25519 digital signatures.
3. **Storage Vault Isolation**: Received files are stored in `data/received/`. Path traversal sanitization rejects filenames containing directory separators (`../` or `..\\`), preventing overwriting system files.
