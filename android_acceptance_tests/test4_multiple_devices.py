import os
import sys
import time
import hashlib
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from backend.app.tcp_engine.client import TcpTransferClient

PHONE_IP = "192.168.1.6"
PHONE_PORT = 9000

def client_worker(client_id: int, file_size: int, results: dict):
    filename = f"multi_client_{client_id}.bin"
    path = Path(filename)
    try:
        data = os.urandom(file_size)
        path.write_bytes(data)
        expected_hash = hashlib.sha256(data).hexdigest()

        print(f"[Client {client_id}] Starting transfer of '{filename}' ({file_size/(1024*1024):.1f} MB)...")
        client = TcpTransferClient(host=PHONE_IP, port=PHONE_PORT)

        start = time.time()
        res = client.send_file(str(path))
        elapsed = time.time() - start
        speed = (file_size / (1024*1024)) / elapsed if elapsed > 0 else 0

        server_hash = res.get("server_response", {}).get("sha256") or res.get("sha256")
        passed = (server_hash == expected_hash)
        print(f"[Client {client_id}] Finished in {elapsed:.2f}s ({speed:.2f} MB/s) | Match: {passed}")

        results[client_id] = {
            "passed": passed,
            "filename": filename,
            "size": file_size,
            "elapsed": elapsed,
            "speed": speed,
            "expected_hash": expected_hash,
            "server_hash": server_hash
        }
    except Exception as e:
        print(f"[Client {client_id}] Error: {e}")
        results[client_id] = {"passed": False, "error": str(e)}
    finally:
        if path.exists(): path.unlink()

def main():
    print("=== TEST 4: MULTIPLE CONCURRENT CLIENT TRANSFERS ===")
    file_size = 5 * 1024 * 1024 # 5 MB per client

    results = {}
    t1 = threading.Thread(target=client_worker, args=(1, file_size, results))
    t2 = threading.Thread(target=client_worker, args=(2, file_size, results))

    start_all = time.time()
    t1.start()
    t2.start()

    t1.join()
    t2.join()
    total_elapsed = time.time() - start_all

    print(f"\nAll concurrent transfers completed in {total_elapsed:.2f}s")
    for cid, r in results.items():
        print(f"Client {cid}: {r['filename']} | Status: {'PASS' if r.get('passed') else 'FAIL'} | SHA256: {r.get('server_hash')}")
        assert r.get("passed") is True, f"Client {cid} failed verification!"

    print("[PASS] Test 4: Multiple simultaneous clients verified successfully!")

if __name__ == "__main__":
    main()
