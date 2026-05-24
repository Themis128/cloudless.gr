#!/usr/bin/env bash
# Deploy esp32_command_routes.py to the Pi alert-api and rebuild the image.
# Run from the repo root on a machine that can SSH to 192.168.1.128.
#
# Usage:
#   bash infrastructure/pi-alert-api/deploy.sh
#
set -euo pipefail

PI="tbaltzakis@192.168.1.128"
ALERT_API_DIR="~/alert-api"

echo "==> Copying esp32_command_routes.py to Pi..."
scp infrastructure/pi-alert-api/esp32_command_routes.py \
    "${PI}:${ALERT_API_DIR}/esp32_command_routes.py"

echo "==> Patching main.py (idempotent — skips if already wired)..."
ssh "${PI}" bash -s <<'REMOTE'
set -euo pipefail
MAIN="${HOME}/alert-api/main.py"

# Guard: skip if already wired in.
if grep -q "esp32_cmd_router" "${MAIN}"; then
  echo "  main.py already has esp32_command_routes wired — skipping patch."
  exit 0
fi

# Back up.
cp "${MAIN}" "${MAIN}.bak.$(date +%s)"

# Append router registration at the end of main.py.
cat >> "${MAIN}" <<'PATCH'

# ── ESP32 command + config routes (added by deploy.sh) ───────────────────────
from esp32_command_routes import router as esp32_cmd_router  # noqa: E402
app.include_router(esp32_cmd_router)
PATCH

echo "  main.py patched."
REMOTE

echo "==> Rebuilding alert-api image on Pi..."
ssh "${PI}" bash -s <<'REMOTE'
set -euo pipefail
cd ~/alert-api
docker build -t alert-api:v3.1 -t alert-api:v3 .
docker save alert-api:v3.1 | sudo k3s ctr images import -
kubectl -n alert-manager rollout restart deployment/alert-api
kubectl -n alert-manager rollout status deployment/alert-api --timeout=120s
REMOTE

echo "==> Verifying command endpoint..."
sleep 3
RESULT=$(curl -s --max-time 10 -X POST http://192.168.1.128:30800/api/esp32/esp32-leds/command \
  -H "Content-Type: application/json" \
  -d '{"action":"led_test"}')
echo "  Response: ${RESULT}"

if echo "${RESULT}" | grep -q '"ok":true'; then
  echo "==> SUCCESS — /api/esp32/{device_id}/command is live."
else
  echo "==> WARNING — endpoint may not be ready yet. Check kubectl logs:"
  echo "    kubectl -n alert-manager logs -l app=alert-api --tail=40"
  exit 1
fi
