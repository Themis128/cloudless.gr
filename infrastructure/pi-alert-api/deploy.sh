#!/usr/bin/env bash
# Deploy Alert API v3.0 components to the Pi cluster.
# Run from the repo root on a machine that can SSH to 192.168.1.128.
#
# What this deploys:
#   1. mqtt_publish.py       — MQTT publisher module (paho-mqtt)
#   2. esp32_command_routes.py — LED command + config + OTA routes
#   3. Patches main.py to wire both modules (idempotent)
#   4. Rebuilds and rolls out the alert-api Docker image
#   5. Verifies the command endpoint is live
#
# Prerequisites:
#   - SSH access to tbaltzakis@192.168.1.128 with key-based auth
#   - Mosquitto already running: kubectl -n monitoring get svc mosquitto
#   - paho-mqtt in the alert-api image requirements.txt
#
# Usage:
#   bash infrastructure/pi-alert-api/deploy.sh [--mqtt-only] [--routes-only]
set -euo pipefail

PI="tbaltzakis@192.168.1.128"
ALERT_API_DIR="~/alert-api"
MQTT_ONLY=false
ROUTES_ONLY=false

for arg in "$@"; do
  case $arg in
    --mqtt-only)   MQTT_ONLY=true ;;
    --routes-only) ROUTES_ONLY=true ;;
  esac
done

# ── 1. Copy Python modules ────────────────────────────────────────────────────
# main.py and slack_notify.py are now also tracked in the repo as of v3.3 —
# they used to live only on the Pi, which made the verbose-alert-message
# patch invisible to git. Always overwrite from the repo (with a .bak.<ts>
# safety copy on the Pi before replacing).
if [[ "$ROUTES_ONLY" != "true" ]]; then
  echo "==> Backing up + copying main.py, slack_notify.py, mqtt_publish.py, tls_check.py to Pi..."
  ssh "${PI}" bash -s <<'REMOTE'
set -euo pipefail
ts=$(date +%s)
for f in main.py slack_notify.py; do
  if [[ -f "${HOME}/alert-api/${f}" ]]; then
    cp "${HOME}/alert-api/${f}" "${HOME}/alert-api/${f}.bak.${ts}"
  fi
done
REMOTE
  scp infrastructure/pi-alert-api/main.py \
      infrastructure/pi-alert-api/slack_notify.py \
      infrastructure/pi-alert-api/mqtt_publish.py \
      infrastructure/pi-alert-api/tls_check.py \
      "${PI}:${ALERT_API_DIR}/"
fi

if [[ "$MQTT_ONLY" != "true" ]]; then
  echo "==> Copying esp32_command_routes.py to Pi..."
  scp infrastructure/pi-alert-api/esp32_command_routes.py \
      "${PI}:${ALERT_API_DIR}/esp32_command_routes.py"
fi

# ── 3. Check paho-mqtt is in requirements.txt ─────────────────────────────────
echo "==> Checking paho-mqtt in requirements.txt..."
ssh "${PI}" bash -s <<'REMOTE'
set -euo pipefail
REQ="${HOME}/alert-api/requirements.txt"
if grep -qi "paho-mqtt" "${REQ}" 2>/dev/null; then
  echo "  paho-mqtt already in requirements.txt."
else
  echo "paho-mqtt>=1.6" >> "${REQ}"
  echo "  Added paho-mqtt to requirements.txt."
fi
REMOTE

# ── 4. Rebuild and roll out ───────────────────────────────────────────────────
echo "==> Rebuilding alert-api image on Pi..."
ssh "${PI}" bash -s <<'REMOTE'
set -euo pipefail
cd ~/alert-api
docker build -t alert-api:v3.4 -t alert-api:v3 .
docker save alert-api:v3.4 | sudo k3s ctr images import -
kubectl -n alert-manager set image deployment/alert-api alert-api=docker.io/library/alert-api:v3.4
kubectl -n alert-manager rollout status deployment/alert-api --timeout=120s
REMOTE

# ── 5. Verify command endpoint ────────────────────────────────────────────────
echo "==> Verifying /api/esp32/{device_id}/command..."
sleep 3
RESULT=$(curl -s --max-time 10 -X POST http://192.168.1.128:30800/api/esp32/esp32-leds/command \
  -H "Content-Type: application/json" \
  -d '{"action":"led_test"}')
echo "  Response: ${RESULT}"

if echo "${RESULT}" | grep -q '"ok":true'; then
  echo "==> SUCCESS — all components deployed."
else
  echo "==> WARNING — command endpoint may not be ready. Check logs:"
  echo "    kubectl -n alert-manager logs -l app=alert-api --tail=40"
  exit 1
fi

# ── 6. Verify MQTT is publishing ──────────────────────────────────────────────
echo "==> Checking MQTT retained status..."
MQTT_PAYLOAD=$(python3 -c "
import socket, struct
s = socket.socket(); s.settimeout(5)
s.connect(('192.168.1.128', 31883))
cid = b'deploy-check'
payload = b'\x00\x04MQTT\x04\x02\x00\x3c' + struct.pack('>H', len(cid)) + cid
s.send(bytes([0x10, len(payload)]) + payload); s.recv(4)
topic = b'homelab/alerts/status'
sub = b'\x00\x01' + struct.pack('>H', len(topic)) + topic + b'\x01'
s.send(bytes([0x82, len(sub)]) + sub); s.recv(5)
s.settimeout(3)
try:
    data = s.recv(256)
    tl = struct.unpack('>H', data[2:4])[0]
    ms = 4 + tl + (2 if data[0] in (0x32, 0x33) else 0)
    print(data[ms:1+data[1]+1].decode(errors='replace'))
except: print('no retained message')
s.close()
" 2>/dev/null)
echo "  MQTT status: ${MQTT_PAYLOAD}"
