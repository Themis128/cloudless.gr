#!/usr/bin/env python3
"""Create / migrate the wrangler local user-auth-db sqlite used by
`next dev`. AUTH_DB must be bound for local health to be "ok"
(dbConnected: true)."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
import os
os.chdir(ROOT)

WRANGLER = ROOT / "node_modules" / ".bin" / "wrangler"
if not WRANGLER.exists():
    sys.exit(f"[d1] missing {WRANGLER} — run pnpm install")

print("[d1] applying local migrations for user-auth-db")
r = subprocess.run(
    [str(WRANGLER), "d1", "migrations", "apply", "user-auth-db",
     "--local", "--config", "wrangler.jsonc"])
if r.returncode != 0:
    sys.exit("[d1] wrangler d1 migrations apply --local failed")

found = []
for d in (ROOT / ".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
          ROOT / ".wrangler/state/d1"):
    if not d.is_dir():
        continue
    for p in d.glob("*.sqlite"):
        if p.name != "metadata.sqlite":
            found.append((p.stat().st_size, p))
if not found:
    sys.exit("[d1] no local user-auth-db sqlite after migrations")
found.sort(reverse=True)
print(f"[d1] local sqlite ready: {found[0][1]} "
      f"({found[0][0]} bytes)")
