import asyncio
import os
import time
import threading
import tempfile
from pathlib import Path
from backend.app.database import init_db
from backend.app.tcp_engine.server import TcpTransferServer
from backend.app.tcp_engine.client import TcpTransferClient
from backend.app.tcp_engine.crypto import CryptographyEngine
from backend.app.config import RECEIVED_DIR

BENCH_PORT = 9009

def run_benchmarks():
    init_db()
    server = TcpTransferServer(host="127.0.0.1", port=BENCH_PORT)
    loop = asyncio.new_event_loop()

    def run_loop():
        asyncio.set_event_loop(loop)
        loop.run_until_complete(server.start())
        loop.run_forever()

    t = threading.Thread(target=run_loop, daemon=True)
    t.start()
    time.sleep(0.5)

    print("=" * 70)
    print("ATP PROTOCOL PERFORMANCE BENCHMARKS (AES-256-GCM + TCP)")
    print("=" * 70)

    test_sizes_mb = [1, 5, 20]
    results = []

    for size_mb in test_sizes_mb:
        size_bytes = size_mb * 1024 * 1024
        print(f"\n[BENCHMARK] Generating {size_mb} MB test payload ({size_bytes:,} bytes)...")
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(os.urandom(size_bytes))
            tmp_path = tmp.name

        try:
            expected_sha = CryptographyEngine.compute_sha256_file(tmp_path)
            client = TcpTransferClient(host="127.0.0.1", port=BENCH_PORT)

            start_t = time.perf_counter()
            res = client.send_file(tmp_path, chunk_size=64 * 1024)
            elapsed = time.perf_counter() - start_t

            throughput_mbps = (size_mb * 8) / elapsed
            throughput_mbs = size_mb / elapsed

            received_file = RECEIVED_DIR / Path(tmp_path).name
            actual_sha = CryptographyEngine.compute_sha256_file(str(received_file))
            sha_matched = (expected_sha == actual_sha)

            print(f"  -> Transferred in: {elapsed:.2f} seconds")
            print(f"  -> Throughput: {throughput_mbs:.2f} MB/s ({throughput_mbps:.2f} Mbps)")
            print(f"  -> SHA-256 Digest Match: {'PASSED [OK]' if sha_matched else 'FAILED'}")

            results.append({
                "size_mb": size_mb,
                "elapsed_s": round(elapsed, 2),
                "throughput_mb_s": round(throughput_mbs, 2),
                "throughput_mbps": round(throughput_mbps, 2),
                "integrity_verified": sha_matched
            })
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    # Resumption Recovery Benchmark
    print("\n[BENCHMARK] Testing Resumption Recovery Latency...")
    resume_size_mb = 10
    resume_bytes = resume_size_mb * 1024 * 1024
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(os.urandom(resume_bytes))
        tmp_path = tmp.name

    try:
        client = TcpTransferClient(host="127.0.0.1", port=BENCH_PORT)
        drop_res = client.send_file(tmp_path, chunk_size=64 * 1024, simulate_drop_after_chunks=50)
        transfer_id = drop_res["transfer_id"]

        time.sleep(0.3)

        resume_client = TcpTransferClient(host="127.0.0.1", port=BENCH_PORT)
        resume_start = time.perf_counter()
        resume_res = resume_client.resume_transfer(tmp_path, transfer_id=transfer_id)
        resume_elapsed = time.perf_counter() - resume_start

        print(f"  -> Dropped after 50 chunks (3.2 MB)")
        print(f"  -> Resumption & remaining {resume_size_mb - 3.2:.1f} MB completed in: {resume_elapsed:.2f}s")
        print(f"  -> Status: {resume_res['status'].upper()}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    loop.call_soon_threadsafe(loop.stop)
    t.join(timeout=2.0)

    print("\n" + "=" * 70)
    print("ALL BENCHMARKS COMPLETED SUCCESSFULLY.")
    print("=" * 70)
    return results

if __name__ == "__main__":
    run_benchmarks()
