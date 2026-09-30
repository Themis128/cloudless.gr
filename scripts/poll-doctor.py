#!/usr/bin/env python3
"""Polling helper: runs the LinkedIn insight doctor every 90s until
HEALTHY or 15 polls (22.5 min)."""

import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

for i in range(1, 16):
    print(f"=== poll {i} @ "
          f"{time.strftime('%H:%M:%SZ', time.gmtime())} ===")
    script = ROOT / "scripts" / "linkedin-insight-doctor.py"
    cmd = ([sys.executable, str(script)]
           if script.exists()
           else ["bash",
                 str(ROOT / "scripts/linkedin-insight-doctor.sh")])
    r = subprocess.run(
        [*cmd, "--slug", "shop-online", "--locale", "el",
         "--no-color"], capture_output=True, text=True)
    out = r.stdout + r.stderr
    hits = [ln for ln in out.splitlines()
            if re.search(r"Partner ID literal|verdict|HEALTHY"
                         r"|DEGRADED", ln)]
    for ln in hits[:5]:
        print(ln)
    if r.returncode == 0:
        print("=== HEALTHY — stopping ===")
        sys.exit(0)
    time.sleep(90)

print("=== exhausted polls; check deploy state manually ===")
sys.exit(1)
