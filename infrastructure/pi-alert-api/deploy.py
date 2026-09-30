#!/usr/bin/env python3
"""Deploy Alert API v3.0 components to the Pi cluster.

Port of deploy.sh.
Run from the repo root on a machine that can SSH to 192.168.1.128.

What this deploys:
  1. mqtt_publish.py        — MQTT publisher module (paho-mqtt)
  2. esp32_command_routes.py — LED command + config + OTA routes
  3. Patches main.py to wire both modules (idempotent)
  4. Rebuilds and rolls out the alert-api Docker image
  5. Verifies the command endpoint is live

Prerequisites:
  - SSH access to tbaltzakis@192.168.1.128 with key-based auth
  - Mosquitto already running: kubectl -n monitoring get svc mosquitto
  - paho-mqtt in the alert-api image requirements.txt

Usage:
  python3 infrastructure/pi-alert-api/deploy.py [--mqtt-only] [--routes-only]
"""

import argparse
import json
import socket
import struct
import subprocess
import sys
import time
import urllib.request

PI = "tbaltzakis@192.168.1.128"
ALERT_API_DIR = "~/alert-api"

parser = argparse.ArgumentParser()
parser.add_argument("--mqtt-only", action="store_true")
parser.add_argument("--routes-only", action="store_true")
args = parser.parse_args()


def ssh(script: str) -> None:
    subprocess.run(["ssh", PI, "bash", "-s"], input=script.encode(), check=True)


def scp(*srcs: str, dest: str) -> None:
    subprocess.run(["scp", *srcs, f"{PI}:{dest}"], check=True)


# ── 1. Copy Python modules ────────────────────────────────────────────────────
# main.py and slack_notify.py are now also tracked in the repo as of v3.3 —
# they used to live only on the Pi. Always overwrite from the repo (with a
# .bak.<ts> safety copy on the Pi before replacing).
if not args.routes_only:
    print("==> Backing up + copying main.py, slack_notify.py, mqtt_publish.py, tls_check.py to Pi...")
    ssh("""\
set -euo pipefail
ts=$(date +%s)
for f in main.py slack_notify.py; do
  if [[ -f "${HOME}/alert-api/${f}" ]]; then
    cp "${HOME}/alert-api/${f}" "${HOME}/alert-api/${f}.bak.${ts}"
  fi
done
""")
    scp(
        "infrastructure/pi-alert-api/main.py",
        "infrastructure/pi-alert-api/slack_notify.py",
        "infrastructure/pi-alert-api/mqtt_publish.py",
        "infrastructure/pi-alert-api/tls_check.py",
        dest=f"{ALERT_API_DIR}/",
    )

if not args.mqtt_only:
    print("==> Copying esp32_command_routes.py to Pi...")
    scp("infrastructure/pi-alert-api/esp32_command_routes.py",
        dest=f"{ALERT_API_DIR}/esp32_command_routes.py")

# ── 3. Check paho-mqtt is in requirements.txt ─────────────────────────────────
print("==> Checking paho-mqtt in requirements.txt...")
ssh("""\
set -euo pipefail
REQ="${HOME}/alert-api/requirements.txt"
if grep -qi "paho-mqtt" "${REQ}" 2>/dev/null; then
  echo "  paho-mqtt already in requirements.txt."
else
  echo "paho-mqtt>=1.6" >> "${REQ}"
  echo "  Added paho-mqtt to requirements.txt."
fi
""")

# ── 4. Rebuild and roll out ───────────────────────────────────────────────────
print("==> Rebuilding alert-api image on Pi...")
ssh("""\
set -euo pipefail
cd ~/alert-api
docker build -t alert-api:v3.5 -t alert-api:v3.4 -t alert-api:v3 .
docker save alert-api:v3.5 | sudo k3s ctr images import -
kubectl -n alert-manager set image deployment/alert-api alert-api=docker.io/library/alert-api:v3.5
kubectl -n alert-manager rollout status deployment/alert-api --timeout=120s
""")

# ── 5. Verify command endpoint ────────────────────────────────────────────────
print("==> Verifying /api/esp32/{device_id}/command...")
time.sleep(3)
result = ""
try:
    req = urllib.request.Request(
        "http://192.168.1.128:30820/api/esp32/esp32-leds/command",
        data=json.dumps({"action": "led_test"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = resp.read().decode()
except Exception as exc:
    result = str(exc)
print(f"  Response: {result}")

if '"ok":true' in result.replace(" ", ""):
    print("==> SUCCESS — all components deployed.")
else:
    print("==> WARNING — command endpoint may not be ready. Check logs:")
    print("    kubectl -n alert-manager logs -l app=alert-api --tail=40")
    sys.exit(1)

# ── 6. Verify MQTT is publishing ──────────────────────────────────────────────
print("==> Checking MQTT retained status...")


def mqtt_retained(host: str, port: int, topic: str) -> str:
    try:
        s = socket.socket()
        s.settimeout(5)
        s.connect((host, port))
        cid = b"deploy-check"
        payload = b"\x00\x04MQTT\x04\x02\x00\x3c" + struct.pack(">H", len(cid)) + cid
        s.send(bytes([0x10, len(payload)]) + payload)
        s.recv(4)
        t = topic.encode()
        sub = b"\x00\x01" + struct.pack(">H", len(t)) + t + b"\x01"
        s.send(bytes([0x82, len(sub)]) + sub)
        s.recv(5)
        s.settimeout(3)
        data = s.recv(256)
        tl = struct.unpack(">H", data[2:4])[0]
        ms = 4 + tl + (2 if data[0] in (0x32, 0x33) else 0)
        s.close()
        return data[ms:1 + data[1] + 1].decode(errors="replace")
    except Exception:
        return "no retained message"


print(f"  MQTT status: {mqtt_retained('192.168.1.128', 31883, 'homelab/alerts/status')}")
