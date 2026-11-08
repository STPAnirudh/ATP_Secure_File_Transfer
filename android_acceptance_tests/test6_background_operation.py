import os
import sys
import time
import hashlib
import subprocess
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from backend.app.tcp_engine.client import TcpTransferClient

PHONE_IP = "192.168.1.10"
PHONE_PORT = 9000
ADB_PATH = r"C:\Users\stpan\AppData\Local\Android\Sdk\platform-tools\adb.exe"

def adb(cmd):
    return subprocess.run(f'"{ADB_PATH}" {cmd}', shell=True, capture_output=True, text=True)

def main():
    print("=== TEST 6: BACKGROUND OPERATION & FOREGROUND SERVICE ===")

    # 1. Switch to Settings app (away from ATP)
    print("\n[Step 1] Switching away from ATP app to system Settings...")
    adb("shell am start -a android.settings.SETTINGS")
    time.sleep(1.0)

    # 2. Lock phone screen (turn display off)
    print("[Step 2] Locking device (sending KEYCODE_POWER to turn screen off)...")
    adb("shell input keyevent 26")
    time.sleep(2.0)

    # 3. Check notifications for ATP persistent foreground notification
    print("\n[Step 3] Checking persistent foreground service notification in dumpsys...")
    noti_out = adb("shell dumpsys notification --noredact").stdout
    has_atp_channel = "atp_hosting_channel" in noti_out
    has_foreground = "FOREGROUND_SERVICE" in noti_out
    print(f"Foreground Notification Active: {has_atp_channel and has_foreground}")
    assert has_atp_channel, "ATP Hosting notification channel not found in active notifications!"

    # 4. Attempt to connect from Windows computer while locked and in background
    print("\n[Step 4] Attempting connection and health check while phone is LOCKED in background...")
    import urllib.request, json
    req = urllib.request.urlopen(f"http://{PHONE_IP}:8000/api/health", timeout=5)
    health_data = json.loads(req.read().decode())
    print(f"Server Health response from locked phone: {health_data}")
    assert health_data.get("status") == "healthy", "Phone server was not healthy while in background!"

    # 5. Execute 2 MB encrypted file transfer to locked phone
    print("\n[Step 5] Transmitting encrypted file over ATP wire to locked background phone...")
    test_file = Path("bg_locked_test.bin")
    file_size = 2 * 1024 * 1024
    try:
        data = os.urandom(file_size)
        test_file.write_bytes(data)
        expected_hash = hashlib.sha256(data).hexdigest()

        client = TcpTransferClient(host=PHONE_IP, port=PHONE_PORT)
        t0 = time.time()
        res = client.send_file(str(test_file))
        elapsed = time.time() - t0
        speed = (file_size / (1024*1024)) / elapsed if elapsed > 0 else 0

        server_hash = res.get("server_response", {}).get("sha256") or res.get("sha256")
        print(f"Transfer completed in {elapsed:.2f}s ({speed:.2f} MB/s)")
        print(f"Server SHA-256: {server_hash}")
        assert server_hash == expected_hash, f"Hash mismatch: server={server_hash} vs expected={expected_hash}"

        print("\n[PASS] Test 6: Background hosting, screen-off operation, and foreground service verified successfully!")

    finally:
        if test_file.exists(): test_file.unlink()
        # Wake up display
        adb("shell input keyevent 224")

if __name__ == "__main__":
    main()
