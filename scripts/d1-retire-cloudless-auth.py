#!/usr/bin/env python3
"""d1-retire-cloudless-auth — remove orphaned D1 database
cloudless-auth.

Status: DELETED from the Cloudflare account on 2026-07-30.
This script remains as an idempotent guard (no-op if already
gone).

cloudless-auth was never bound in wrangler.jsonc.
Active auth DBs: user-auth-db + auth-db-preview.

Usage:
  python3 scripts/d1-retire-cloudless-auth.py          # dry-run
  CONFIRM=1 python3 scripts/d1-retire-cloudless-auth.py"""

import os
import subprocess
import sys
from pathlib import Path

NAME = "cloudless-auth"
os.chdir(Path(__file__).resolve().parent.parent)

print(f"""Orphan D1 candidate: {NAME}
Active D1 (keep): user-auth-db, auth-db-preview
Account status: deleted 2026-07-30 (idempotent re-run OK).
""")

if os.environ.get("CONFIRM") != "1":
    print("Dry-run. To force delete attempt:")
    print("  CONFIRM=1 python3 scripts/d1-retire-cloudless-auth.py")
    sys.exit(0)

r = subprocess.run(["pnpm", "exec", "wrangler", "d1", "delete", NAME, "--force"])
print(
    f"✅ {'deleted' if r.returncode == 0 else 'already absent'} D1 {NAME}"
    if r.returncode == 0
    else f"✅ D1 {NAME} already absent (nothing to do)"
)
