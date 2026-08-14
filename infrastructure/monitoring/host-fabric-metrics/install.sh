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
sudo install -m 0644 /tmp/cloudflared-metrics.conf /etc/systemd/system/cloudflared.service.d/metrics.conf
sudo systemctl daemon-reload
sudo systemctl enable --now tailscale-metrics-exporter.service
sudo systemctl restart cloudflared.service
sleep 2
systemctl is-active tailscale-metrics-exporter
systemctl is-active cloudflared
curl -sS -o /dev/null -w "tailscale-metrics:%{http_code}\n" --max-time 3 http://127.0.0.1:9102/metrics
curl -sS -o /dev/null -w "cloudflared-metrics:%{http_code}\n" --max-time 3 http://127.0.0.1:20241/metrics
# confirm LAN bind (not only loopback)
ss -ltn | grep -E ':9102|:20241' || true
EOS
}

if [[ "$LOCAL_ONLY" == "1" ]]; then
  HOST=$(hostname -s 2>/dev/null || hostname)
  echo "LOCAL_ONLY=1 — installing on this host ($HOST)"
  sudo mkdir -p /usr/local/lib/cloudless /etc/systemd/system/cloudflared.service.d
  sudo install -m 0755 "$SCRIPT_DIR/tailscale-metrics-exporter.py" /usr/local/lib/cloudless/tailscale-metrics-exporter.py
  sudo install -m 0644 "$SCRIPT_DIR/tailscale-metrics-exporter.service" /etc/systemd/system/tailscale-metrics-exporter.service
  sudo install -m 0644 "$SCRIPT_DIR/cloudflared-metrics.conf" /etc/systemd/system/cloudflared.service.d/metrics.conf
  sudo systemctl daemon-reload
  sudo systemctl enable --now tailscale-metrics-exporter.service
  sudo systemctl restart cloudflared.service
  exit 0
fi

install_on "$OMV"
install_on "$HA"
echo "==> Host fabric metrics installed on omv + omv-ha"
