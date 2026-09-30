#!/usr/bin/env python3
"""ddns-update-auth.py — Cloudflare DDNS updater.

Port of ddns-update-auth.sh.

Cron-friendly: exits quietly when DDNS is not configured/disabled or when the
public IP is unchanged (no cron email spam).

Config: /etc/cloudless/ddns-update-auth.env (override via DDNS_UPDATE_AUTH_CONFIG)
State: /var/lib/cloudless/ddns-update-auth.last-ip
"""

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

CONFIG_FILE = Path(os.environ.get("DDNS_UPDATE_AUTH_CONFIG", "/etc/cloudless/ddns-update-auth.env"))
STATE_DIR = Path(os.environ.get("DDNS_UPDATE_AUTH_STATE_DIR", "/var/lib/cloudless"))
STATE_FILE = STATE_DIR / "ddns-update-auth.last-ip"
LOG_PREFIX = "[ddns-update-auth]"


def log(msg: str) -> None:
    print(f"{LOG_PREFIX} {msg}", file=sys.stderr)


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


if not CONFIG_FILE.is_file():
    # Quiet success: cron should not email when DDNS is intentionally not configured.
    sys.exit(0)

cfg = load_env(CONFIG_FILE)

if cfg.get("DDNS_ENABLED", "false") != "true":
    # Quiet success: installed but disabled until Cloudflare config is provided.
    sys.exit(0)

CF_API_TOKEN = cfg.get("CF_API_TOKEN", "")
CF_ZONE_ID = cfg.get("CF_ZONE_ID", "")
CF_RECORD_ID = cfg.get("CF_RECORD_ID", "")
CF_RECORD_NAME = cfg.get("CF_RECORD_NAME", "")
CF_RECORD_TYPE = cfg.get("CF_RECORD_TYPE", "A")
CF_PROXIED = cfg.get("CF_PROXIED", "false")
DDNS_IP_URL = cfg.get("DDNS_IP_URL", "https://api.ipify.org")
DDNS_TTL = int(cfg.get("DDNS_TTL", "120"))

if not CF_API_TOKEN or not CF_ZONE_ID:
    log(f"CF_API_TOKEN or CF_ZONE_ID missing in {CONFIG_FILE}")
    sys.exit(0)

if not CF_RECORD_ID and not CF_RECORD_NAME:
    log(f"set either CF_RECORD_ID or CF_RECORD_NAME in {CONFIG_FILE}")
    sys.exit(0)


def http(url: str, method: str = "GET", payload: dict | None = None, timeout: int = 30) -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            "Authorization": f"Bearer {CF_API_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


try:
    with urllib.request.urlopen(DDNS_IP_URL, timeout=20) as resp:
        current_ip = resp.read().decode().strip()
except Exception:
    log(f"could not reach {DDNS_IP_URL}")
    sys.exit(1)

if not re.match(r"^\d+\.\d+\.\d+\.\d+$", current_ip):
    log(f"could not determine public IPv4 from {DDNS_IP_URL}: {current_ip}")
    sys.exit(1)

STATE_DIR.mkdir(parents=True, exist_ok=True)
if STATE_FILE.is_file() and STATE_FILE.read_text().strip() == current_ip:
    # Quiet success: avoids cron email spam.
    sys.exit(0)

api_base = f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/dns_records"

if not CF_RECORD_ID:
    lookup = http(f"{api_base}?type={CF_RECORD_TYPE}&name={CF_RECORD_NAME}")
    records = lookup.get("result") or []
    if not records:
        log(f"no {CF_RECORD_TYPE} record found for {CF_RECORD_NAME}")
        sys.exit(1)
    CF_RECORD_ID = records[0]["id"]

payload = {
    "type": CF_RECORD_TYPE,
    "name": CF_RECORD_NAME,
    "content": current_ip,
    "ttl": DDNS_TTL,
    "proxied": CF_PROXIED.lower() == "true",
}

response = http(f"{api_base}/{CF_RECORD_ID}", method="PUT", payload=payload)
if not response.get("success"):
    log("Cloudflare update failed")
    for error in response.get("errors", []):
        print(error, file=sys.stderr)
    sys.exit(1)

STATE_FILE.write_text(current_ip + "\n")
log(f"updated {CF_RECORD_NAME or CF_RECORD_ID} to {current_ip}")
