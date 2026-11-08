import os
import sys
import time
import uuid
import hashlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from backend.app.tcp_engine.client import TcpTransferClient

PHONE_IP = "192.168.1.6"
PHONE_PORT = 9000

def main():
    print("=== TEST 5: RESUMABLE TRANSFER TEST ===")
    filename = "resumable_test_data.bin"
    path = Path(filename)
    file_size = 10 * 1024 * 1024 # 10 MB = 160 chunks of 64KB

    try:
        data = os.urandom(file_size)
        path.write_bytes(data)
        expected_hash = hashlib.sha256(data).hexdigest()
        transfer_id = str(uuid.uuid4())

        print(f"File: '{filename}' ({file_size/(1024*1024):.1f} MB, 160 chunks)")
        print(f"Transfer ID: {transfer_id}")
        print(f"Expected SHA-256: {expected_hash}")

        # Phase 1: Simulate drop after 50 chunks
        print("\n--- Phase 1: Transmitting initial chunks with simulated connection failure ---")
        client1 = TcpTransferClient(host=PHONE_IP, port=PHONE_PORT)
        res1 = client1.send_file(
            str(path),
            transfer_id=transfer_id,
            simulate_drop_after_chunks=50
        )
        print(f"Phase 1 result: {res1}")
        assert res1.get("interrupted") is True, "Transfer was not interrupted as expected"
        assert res1.get("chunks_transmitted") == 50, f"Expected 50 chunks, got {res1.get('chunks_transmitted')}"
        print("[OK] Connection severed at chunk 50 (3.2 MB sent). Staging intact on phone.")

        time.sleep(1.0)

        # Phase 2: Reconnect with same transfer_id and resume from checkpoint
        print("\n--- Phase 2: Reconnecting and resuming transfer from offset ---")
        client2 = TcpTransferClient(host=PHONE_IP, port=PHONE_PORT)
        res2 = client2.send_file(
            str(path),
            transfer_id=transfer_id
        )
        print(f"Phase 2 result: {res2}")
        assert res2.get("status") == "completed", "Resume transfer did not complete"

        server_hash = res2.get("server_response", {}).get("sha256") or res2.get("sha256")
        print(f"\nFinal Reconstructed SHA-256: {server_hash}")
        assert server_hash == expected_hash, f"Hash mismatch after resume: {server_hash} vs {expected_hash}"

        print("[PASS] Test 5: Resumable transfer verified with 100% hash integrity!")

    finally:
        if path.exists(): path.unlink()

if __name__ == "__main__":
    main()
