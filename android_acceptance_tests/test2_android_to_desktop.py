import os
import sys
import time
import hashlib
from pathlib import Path
import requests

PHONE_IP = "192.168.1.6"
PHONE_HTTP_PORT = 8000
DESKTOP_IP = "192.168.1.4"
DESKTOP_TCP_PORT = 9000

DESKTOP_RECEIVED_DIR = Path(__file__).resolve().parent / "data" / "received"

def main():
    print("=== TEST 2: ANDROID TO DESKTOP TRANSFER ===")
    test_file = Path("from_android_file.bin")
    file_size = 2 * 1024 * 1024 # 2.0 MB

    data = os.urandom(file_size)
    test_file.write_bytes(data)
    expected_hash = hashlib.sha256(data).hexdigest()
    print(f"Generated test file '{test_file.name}' ({file_size / (1024*1024):.2f} MB)")
    print(f"Expected SHA-256: {expected_hash}")

    url = f"http://{PHONE_IP}:{PHONE_HTTP_PORT}/api/transfers/send-client?target_host={DESKTOP_IP}&target_port={DESKTOP_TCP_PORT}"
    print(f"Uploading file to Android bridging engine: {url}...")

    start_time = time.time()
    with open(test_file, "rb") as f:
        resp = requests.post(url, files={"file": (test_file.name, f, "application/octet-stream")})
    elapsed = time.time() - start_time
    speed_mbps = (file_size / (1024*1024)) / elapsed if elapsed > 0 else 0

    print(f"HTTP Status: {resp.status_code}")
    print(f"Response: {resp.text}")

    # Check that desktop received and reconstructed the file
    desktop_file = DESKTOP_RECEIVED_DIR / test_file.name
    print(f"Checking desktop received file at: {desktop_file}")
    assert desktop_file.exists(), f"File {desktop_file} does not exist on desktop!"

    desktop_hash = hashlib.sha256(desktop_file.read_bytes()).hexdigest()
    print(f"Desktop File SHA-256: {desktop_hash}")
    assert desktop_hash == expected_hash, f"Hash mismatch: desktop={desktop_hash} vs expected={expected_hash}"

    print(f"[PASS] Android to Desktop transfer verified! {file_size/(1024*1024):.2f} MB in {elapsed:.2f}s ({speed_mbps:.2f} MB/s)")

    # Cleanup
    if test_file.exists(): test_file.unlink()
    if desktop_file.exists(): desktop_file.unlink()

if __name__ == "__main__":
    main()
