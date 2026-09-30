#!/usr/bin/env python3
"""Stream live logs from the cloudless2 (production) Cloudflare Worker.

Usage:
  python3 scripts/tail-worker.py                  # production, pretty
  ENV=staging python3 scripts/tail-worker.py      # staging worker
  FORMAT=json python3 scripts/tail-worker.py      # JSON per line
  FILTER="status:5xx" python3 scripts/tail-worker.py

Requires CLOUDFLARE_API_TOKEN (Workers Scripts:Read + Tail:Read),
auto-sourced from .env.local then .env at the repo root."""

import os
import re
import subprocess
import sys
from pathlib import Path

ENV = os.environ.get("ENV", "production")
NAME_PROD = os.environ.get("NAME_PROD", "cloudless2")
NAME_STAGING = os.environ.get("NAME_STAGING", "cloudless-gr-staging")
FORMAT = os.environ.get("FORMAT", "pretty")
FILTER = os.environ.get("FILTER", "")


def repo_root() -> Path:
    r = subprocess.run(
        ["git", "-C", str(Path(__file__).resolve().parent), "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
    )
    return Path(r.stdout.strip()) if r.returncode == 0 else Path(__file__).resolve().parent.parent


ROOT = repo_root()

if not os.environ.get("CLOUDFLARE_API_TOKEN"):
    for candidate in (ROOT / ".env.local", ROOT / ".env"):
        if not candidate.is_file():
            continue
        for line in candidate.read_text().splitlines():
            m = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", line)
            if not m or m.group(1) not in ("CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"):
                continue
            key, value = m.group(1), m.group(2).strip().strip("\"'")
            if not value or value.startswith(("your-", "xxx", "CHANGE", "TODO", "<")):
                continue
            if not os.environ.get(key):
                os.environ[key] = value
                print(f"  ({candidate.name}) picked up {key}", file=sys.stderr)

if not os.environ.get("CLOUDFLARE_API_TOKEN"):
    print("❌ CLOUDFLARE_API_TOKEN not set.", file=sys.stderr)
    print("   Mint one at https://dash.cloudflare.com/profile/api-tokens with", file=sys.stderr)
    print("     Account → Workers Scripts:Read", file=sys.stderr)
    print("     Account → Workers Tail:Read", file=sys.stderr)
    print("   Then either:  export CLOUDFLARE_API_TOKEN=…", file=sys.stderr)
    print("   or add it to  .env.local  in the repo root and re-run.", file=sys.stderr)
    sys.exit(1)

os.chdir(ROOT)

# Pass the script name positionally instead of `--env` — wrangler would
# derive `<top-level>-<env>` = cloudless2-production, but the deployed
# script on this account is just `cloudless2` (error [10007] otherwise).
name = os.environ.get("NAME") or {"production": NAME_PROD, "staging": NAME_STAGING}.get(ENV, "")
if not name:
    print(
        f"❌ Cannot resolve Worker script name for ENV={ENV}. Set NAME=<script-name>.",
        file=sys.stderr,
    )
    sys.exit(1)

args = ["tail", name, "--format", FORMAT]
if FILTER:
    args += ["--search", FILTER]

print(f"→ npx wrangler {' '.join(args)}")
os.execvp("npx", ["npx", "--yes", "wrangler@latest", *args])
