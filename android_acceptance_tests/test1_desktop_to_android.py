import os
import sys
import time
import hashlib
from pathlib import Path

# Add project root
sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.app.tcp_engine.client import TcpTransferClient

PHONE_IP = "192.168.1.6"
PHONE_PORT = 9000

def generate_file(path: Path, size_bytes: int):
    print(f"Generating test file '{path.name}' ({size_bytes / (1024*1024):.2f} MB)...")
    # Generate pseudo-random chunked data
    chunk = os.urandom(1024 * 1024) # 1 MB block
    remaining = size_bytes
    hasher = hashlib.sha256()
    with open(path, "wb") as f:
        while remaining > 0:
            to_write = min(remaining, len(chunk))
            f.write(chunk[:to_write])
            hasher.update(chunk[:to_write])
            remaining -= to_write
    return hasher.hexdigest()

def test_file_transfer(filename: str, size_bytes: int):
    path = Path(filename)
    try:
        expected_hash = generate_file(path, size_bytes)
        print(f"Source SHA-256: {expected_hash}")

        client = TcpTransferClient(host=PHONE_IP, port=PHONE_PORT)
        start_time = time.time()

        res = client.send_file(str(path))
        elapsed = time.time() - start_time
        speed_mbps = (size_bytes / (1024 * 1024)) / elapsed if elapsed > 0 else 0

        print(f"Elapsed: {elapsed:.2f}s | Speed: {speed_mbps:.2f} MB/s")
        print(f"Result: {res}")

        server_hash = res.get("server_response", {}).get("sha256") or res.get("sha256")
        assert server_hash == expected_hash, f"Hash mismatch: server={server_hash} vs expected={expected_hash}"
        print(f"[PASS] {filename} verified successfully! Hash: {server_hash}\n")
        return {
            "file": filename,
            "size_bytes": size_bytes,
            "elapsed_s": elapsed,
            "speed_mbps": speed_mbps,
            "sha256": expected_hash,
            "status": "PASS"
        }
    finally:
        if path.exists():
            path.unlink()

def main():
    print("=== TEST 1: DESKTOP TO ANDROID FILE TRANSFERS ===")
    results = []

    # 1. 1 MB File
    res_1mb = test_file_transfer("test_1mb.bin", 1024 * 1024)
    results.append(res_1mb)

    # 2. 100 MB File
    res_100mb = test_file_transfer("test_100mb.bin", 100 * 1024 * 1024)
    results.append(res_100mb)

    # 3. 200 MB File
    res_200mb = test_file_transfer("test_200mb.bin", 200 * 1024 * 1024)
    results.append(res_200mb)

    print("=== TEST 1 SUMMARY ===")
    for r in results:
        print(f"File: {r['file']} | Size: {r['size_bytes']/(1024*1024):.1f} MB | Speed: {r['speed_mbps']:.2f} MB/s | SHA256: {r['sha256'][:16]}... | {r['status']}")

if __name__ == "__main__":
    main()
