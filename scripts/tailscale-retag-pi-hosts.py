#!/usr/bin/env python3
"""Deprecated wrapper — use scripts/tailscale-retag-fleet.py
Kept so older docs/workflows keep working."""

import os
import sys
from pathlib import Path

script = Path(__file__).resolve().parent / "tailscale-retag-fleet.py"
os.execv(sys.executable, [sys.executable, str(script), *sys.argv[1:]])
