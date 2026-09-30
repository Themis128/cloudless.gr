#!/usr/bin/env python3
"""Back-compat wrapper — `pnpm dev` now auto-heals; this forwards
to dev-server.py --restart."""

import os
import subprocess
import sys
from pathlib import Path

server = Path(__file__).resolve().parent / "dev-server.py"
if server.exists():
    os.execvp(sys.executable,
              [sys.executable, str(server), "--restart",
               *sys.argv[1:]])
os.execvp("bash", ["bash",
                   str(Path(__file__).resolve().parent
                       / "dev-server.sh"),
                   "--restart", *sys.argv[1:]])
