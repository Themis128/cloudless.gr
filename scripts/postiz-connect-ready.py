#!/usr/bin/env python3
"""postiz-connect-ready.py — verify OAuth env + Integration row count.
Does not print secret values. Exit 0 when at least one channel is
connected OR when --env-only (providers present enough to start UI
OAuth)."""

import os
import subprocess
import sys

NS = os.environ.get("POSTIZ_NAMESPACE", "postiz")
ENV_ONLY = "--env-only" in sys.argv


def bold(m):
    print(f"\033[1m{m}\033[0m")


def ok(m):
    print(f"  OK  {m}")


def miss(m):
    print(f"  MISSING {m}")


bold("==> Postiz OAuth env (pod)")
keys = (
    "LINKEDIN_CLIENT_ID",
    "LINKEDIN_CLIENT_SECRET",
    "X_API_KEY",
    "X_API_SECRET",
    "TIKTOK_CLIENT_ID",
    "TIKTOK_CLIENT_SECRET",
    "FACEBOOK_APP_ID",
    "FACEBOOK_APP_SECRET",
    "POSTIZ_API_KEY",
    "API_LIMIT",
)
check = "; ".join(
    f"v=$(printenv {k} 2>/dev/null || true); "
    f'if [ -n "$v" ]; then echo "OK {k}"; '
    f'else echo "MISSING {k}"; fi'
    for k in keys
)
subprocess.run(["kubectl", "-n", NS, "exec", "deploy/postiz", "--", "sh", "-c", check])

bold("==> Integration count (Postgres)")
r = subprocess.run(
    [
        "kubectl",
        "-n",
        NS,
        "exec",
        "deploy/postiz-postgres",
        "--",
        "psql",
        "-U",
        "postiz",
        "-d",
        "postiz",
        "-tAc",
        'SELECT count(*) FROM "Integration";',
    ],
    capture_output=True,
    text=True,
)
count = r.stdout.strip()
print(f"  Integration rows: {count or '?'}")

if ENV_ONLY:
    bold("Env-only check done (channels still require UI OAuth).")
    sys.exit(0)

try:
    n = int(count)
except ValueError:
    n = 0
if n > 0:
    ok(f"channels connected ({count})")
    sys.exit(0)

miss(
    "no integrations — connect in https://postiz.cloudless.gr "
    "(see docs/integrations/POSTIZ-CONNECT.md)"
)
sys.exit(1)
