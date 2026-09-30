#!/usr/bin/env python3
"""Check Postiz CLI environment against our self-host.
The .sh original was meant to be sourced — this prints the env values
and validates them instead.

Usage:
  python3 scripts/postiz-cli-env.py
  export POSTIZ_API_URL=... POSTIZ_API_KEY=... (paste printed exports)

Does NOT print or commit secrets."""

import os
import shutil
import subprocess
import sys

POSTIZ_API_URL = os.environ.get("POSTIZ_API_URL",
                                "http://100.74.191.58:30500")

print(f"export POSTIZ_API_URL={POSTIZ_API_URL}")

if not os.environ.get("POSTIZ_API_KEY"):
    print("POSTIZ_API_KEY is unset. Export it (Postiz → Settings → "
          "Developers → Public API), then re-run.", file=sys.stderr)
    sys.exit(1)

if not shutil.which("postiz"):
    print("postiz CLI not found. Install: pnpm add -g postiz",
          file=sys.stderr)
else:
    subprocess.run(["postiz", "auth:status"])
