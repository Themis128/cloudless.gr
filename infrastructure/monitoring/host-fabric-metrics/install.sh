#!/usr/bin/env bash
# Install host-side exporters for Tailscale + bind cloudflared metrics.
# Run on omv (fans out to omv-ha) or on each host with LOCAL_ONLY=1.
set -euo pipefail

SSH_USER="${SSH_USER:-tbaltzakis}"
OMV="${OMV_HOST:-192.168.1.128}"
HA="${HA_HOST:-192.168.1.130}"
LOCAL_ONLY="${LOCAL_ONLY:-0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)

wait_http() {
  local url="$1" label="$2" tries="${3:-15}"
  local i code=000
  for i in $(seq 1 "$tries"); do
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "$url" 2>/dev/null || echo 000)
    if [[ "$code" == "200" ]]; then
      echo "${label}:${code} (attempt ${i})"
      return 0
    fi
    sleep 2
  done
  echo "${label}:${code} FAILED after ${tries} attempts" >&2
  return 1
}

install_on() {
  local host="$1"
  echo "==> Installing fabric metrics on $host"
  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${host}" 'sudo mkdir -p /usr/local/lib/cloudless /etc/systemd/system/cloudflared.service.d'
  scp "${SSH_OPTS[@]}" \
    "$SCRIPT_DIR/tailscale-metrics-exporter.py" \
    "${SSH_USER}@${host}:/tmp/tailscale-metrics-exporter.py"
  scp "${SSH_OPTS[@]}" \
    "$SCRIPT_DIR/tailscale-metrics-exporter.service" \
    "${SSH_USER}@${host}:/tmp/tailscale-metrics-exporter.service"
  scp "${SSH_OPTS[@]}" \
    "$SCRIPT_DIR/cloudflared-metrics.conf" \
    "${SSH_USER}@${host}:/tmp/cloudflared-metrics.conf"

  ssh "${SSH_OPTS[@]}" "${SSH_USER}@${host}" bash -s <<'EOS'
set -euo pipefail
sudo install -m 0755 /tmp/tailscale-metrics-exporter.py /usr/local/lib/cloudless/tailscale-metrics-exporter.py
sudo install -m 0644 /tmp/tailscale-metrics-exporter.service /etc/systemd/system/tailscale-metrics-exporter.service

DROPIN=/etc/systemd/system/cloudflared.service.d/metrics.conf
NEED_CF_RESTART=0
if [[ ! -f "$DROPIN" ]] || ! cmp -s /tmp/cloudflared-metrics.conf "$DROPIN"; then
  sudo install -m 0644 /tmp/cloudflared-metrics.conf "$DROPIN"
  NEED_CF_RESTART=1
fi

sudo systemctl daemon-reload
sudo systemctl enable --now tailscale-metrics-exporter.service
sudo systemctl restart tailscale-metrics-exporter.service

# Only bounce cloudflared when the metrics drop-in changed, or metrics are down.
CF_UP=0
if curl -sS -o /dev/null --max-time 2 http://127.0.0.1:20241/metrics 2>/dev/null; then
  CF_UP=1
fi
if [[ "$NEED_CF_RESTART" -eq 1 || "$CF_UP" -eq 0 ]]; then
  echo "Restarting cloudflared (dropin_changed=${NEED_CF_RESTART} metrics_up=${CF_UP})"
  sudo systemctl restart cloudflared.service
else
  echo "cloudflared metrics already up — skip restart"
fi

systemctl is-active tailscale-metrics-exporter
systemctl is-active cloudflared

wait_http() {
  local url="$1" label="$2" tries="${3:-20}"
  local i code=000
  for i in $(seq 1 "$tries"); do
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "$url" 2>/dev/null || echo 000)
    if [[ "$code" == "200" ]]; then
      echo "${label}:${code} (attempt ${i})"
      return 0
    fi
    sleep 2
  done
  echo "${label}:${code} FAILED after ${tries} attempts" >&2
  return 1
}

wait_http http://127.0.0.1:9102/metrics tailscale-metrics 15
wait_http http://127.0.0.1:20241/metrics cloudflared-metrics 20
ss -ltn | grep -E ':9102|:20241' || true
EOS
}

if [[ "$LOCAL_ONLY" == "1" ]]; then
  HOST=$(hostname -s 2>/dev/null || hostname)
  echo "LOCAL_ONLY=1 — installing on this host ($HOST)"
  sudo mkdir -p /usr/local/lib/cloudless /etc/systemd/system/cloudflared.service.d
  sudo install -m 0755 "$SCRIPT_DIR/tailscale-metrics-exporter.py" /usr/local/lib/cloudless/tailscale-metrics-exporter.py
  sudo install -m 0644 "$SCRIPT_DIR/tailscale-metrics-exporter.service" /etc/systemd/system/tailscale-metrics-exporter.service
  DROPIN=/etc/systemd/system/cloudflared.service.d/metrics.conf
  NEED_CF_RESTART=0
  if [[ ! -f "$DROPIN" ]] || ! cmp -s "$SCRIPT_DIR/cloudflared-metrics.conf" "$DROPIN"; then
    sudo install -m 0644 "$SCRIPT_DIR/cloudflared-metrics.conf" "$DROPIN"
    NEED_CF_RESTART=1
  fi
  sudo systemctl daemon-reload
  sudo systemctl enable --now tailscale-metrics-exporter.service
  sudo systemctl restart tailscale-metrics-exporter.service
  if [[ "$NEED_CF_RESTART" -eq 1 ]] || ! curl -sS -o /dev/null --max-time 2 http://127.0.0.1:20241/metrics 2>/dev/null; then
    sudo systemctl restart cloudflared.service
  fi
  wait_http http://127.0.0.1:9102/metrics tailscale-metrics 15
  wait_http http://127.0.0.1:20241/metrics cloudflared-metrics 20
  exit 0
fi

install_on "$OMV"
install_on "$HA"
echo "==> Host fabric metrics installed on omv + omv-ha"
