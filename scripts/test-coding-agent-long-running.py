#!/usr/bin/env python3
"""CodingAgent lifecycle test — hits the coding-agent endpoints
with the bearer token from .env.local.

Usage: python3 scripts/test-coding-agent-long-running.py \
    [BASE_URL]   (default http://localhost:8787)"""

import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8787"
BASE = "/api/agents/coding-agent/default"

token = ""
env_file = Path("/home/tbaltzakis/cloudless.gr/.env.local")
if env_file.is_file():
    for line in env_file.read_text().splitlines():
        if line.startswith("AGENT_AUTH_TOKEN="):
            token = line.split("=", 1)[1].strip()
if not token:
    sys.exit("Missing AGENT_AUTH_TOKEN in .env.local")


def show(path: str, method: str = "GET", auth: bool = False, body: str = "") -> None:
    headers = {}
    if auth:
        headers["Authorization"] = f"Bearer {token}"
    if body:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        f"{BASE_URL}{BASE}{path}",
        method=method,
        data=body.encode() if body else None,
        headers=headers,
    )
    try:
        r = urllib.request.urlopen(req, timeout=30)
        status, text = r.status, r.read().decode(errors="replace")
    except Exception as e:
        if isinstance(e, urllib.error.HTTPError):
            status = e.code
            text = e.read().decode(errors="replace")
        else:
            status, text = "ERR", str(e)
    print(f"HTTP {status}\n{text}")


print(f"==> Testing CodingAgent lifecycle at: {BASE_URL}\n")

print("==> 1. Unauthenticated status should return 401")
show("/status")

print("\n==> 2. Authenticated status")
show("/status", auth=True)

print("\n==> 3. Submit coding task")
show(
    "/task",
    method="POST",
    auth=True,
    body='{"prompt":"Review my Cloudflare Worker routing, '
    "/api/agents prefix rewrite, Bearer auth, Workers AI "
    'binding, and static assets fallback."}',
)

print("\n==> 4. Status after task")
show("/status", auth=True)

print("\n==> 5. Result after task")
show("/result", auth=True)

print("\n✅ CodingAgent lifecycle test complete.")
