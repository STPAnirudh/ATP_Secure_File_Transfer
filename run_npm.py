import os
import sys
import subprocess

def run():
    env = os.environ.copy()
    node_dir = r"C:\Program Files\nodejs"
    env["PATH"] = node_dir + os.pathsep + env.get("PATH", "")
    
    args = sys.argv[1:]
    cmd = [r"C:\Program Files\nodejs\npm.cmd"] + args
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, env=env)
    sys.exit(result.returncode)

if __name__ == "__main__":
    run()
