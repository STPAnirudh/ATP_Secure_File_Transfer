#!/usr/bin/env python3
"""
ATP Server Launcher — Delegates to start.py for single-command full system startup.
"""
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from start import main

if __name__ == "__main__":
    main()
