#!/usr/bin/env python3
"""Cloudflare Worker Health Monitor — continuously monitors
cloudless.gr service status every 60s."""

import json
import time
import urllib.request
from datetime import UTC, datetime

ENDPOINTS = [
    "https://cloudless.gr/api/health",
    "https://cloudless.gr/api/services",
]


def fetch(url: str) -> dict | None:
    try:
        return json.loads(urllib.request.urlopen(url, timeout=5).read())
    except Exception:
        return None


while True:
    print(f"=== {datetime.now(UTC):%Y-%m-%dT%H:%M:%SZ} ===")
    for endpoint in ENDPOINTS:
        data = fetch(endpoint)
        if data is not None:
            status = data.get("status") or data.get("services") or "ok"
            print(f"✓ {endpoint}: {status}")
        else:
            print(f"✗ {endpoint}: failed")

    services = fetch("https://cloudless.gr/api/services")
    if services and isinstance(services.get("services"), dict):
        missing = [k for k, v in services["services"].items() if v is False]
        if missing:
            print(f"Missing services: {missing}")

    print()
    time.sleep(60)
