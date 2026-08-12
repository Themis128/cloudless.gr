#!/usr/bin/env bash
# pi-connectivity-heal.sh — keep Tailscale + classic OpenSSH reachable on a Pi.
#
# Problem modes this addresses:
#   1. tailscaled dead / logged out → no MagicDNS / no 100.x path
#   2. Tailscale SSH (RunSSH) re-enabled → interactive "check" breaks BatchMode
#   3. sshd down or not listening on :22 → LAN + TS SSH fail
#   4. After reboot, services need a nudge once network is up
#
# Policy: classic OpenSSH owns port 22. Tailscale provides the mesh only
# (`tailscale set --ssh=false`). Do not re-enable Tailscale SSH on these hosts.
#
# Usage (root):
#   pi-connectivity-heal.sh --boot|--check
set -euo pipefail

MODE="${1:---check}"
LOG_TAG="pi-connectivity-heal"
PEER_TS_IPS_DEFAULT="100.74.191.58 100.95.117.84"

log() { echo "[$LOG_TAG] $*"; logger -t "$LOG_TAG" "$*" 2>/dev/null || true; }

have() { command -v "$1" >/dev/null 2>&1; }

ensure_sshd() {
  local unit=""
  if systemctl list-unit-files ssh.service >/dev/null 2>&1 && systemctl cat ssh.service >/dev/null 2>&1; then
    unit=ssh.service
  elif systemctl list-unit-files sshd.service >/dev/null 2>&1; then
    unit=sshd.service
  fi
  if [[ -z "$unit" ]]; then
    log "WARN: no ssh/sshd unit found"
    return 1
  fi
  systemctl enable "$unit" >/dev/null 2>&1 || true
  if ! systemctl is-active --quiet "$unit"; then
    log "starting $unit"
    systemctl start "$unit" || log "WARN: start $unit failed"
  fi
  # Must listen on :22 (all interfaces — includes Tailscale)
  if ! ss -ltn 2>/dev/null | grep -qE ':22\s'; then
    log "sshd not listening on :22 — restarting $unit"
    systemctl restart "$unit" || true
    sleep 1
  fi
  if ss -ltn 2>/dev/null | grep -qE ':22\s'; then
    log "sshd listening on :22"
  else
    log "ERROR: sshd still not on :22"
    return 1
  fi
}

ensure_tailscale() {
  if ! have tailscale || ! have tailscaled; then
    log "WARN: tailscale not installed"
    return 1
  fi
  systemctl enable tailscaled >/dev/null 2>&1 || true
  if ! systemctl is-active --quiet tailscaled; then
    log "starting tailscaled"
    systemctl start tailscaled || log "WARN: start tailscaled failed"
    sleep 2
  fi

  # Classic SSH only — Tailscale SSH "check" breaks automation / BatchMode.
  local run_ssh
  run_ssh="$(tailscale debug prefs 2>/dev/null | grep -E '"RunSSH"' | head -1 || true)"
  if echo "$run_ssh" | grep -q 'true'; then
    log "disabling Tailscale SSH (RunSSH=true → false)"
    tailscale set --ssh=false || log "WARN: tailscale set --ssh=false failed"
  fi

  # Backend state
  local state
  state="$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys
try:
  d=json.load(sys.stdin)
  print(d.get("BackendState") or "")
except Exception:
  print("")
' 2>/dev/null || true)"
  if [[ "$state" != "Running" ]]; then
    log "tailscale BackendState=${state:-unknown} — restarting tailscaled"
    systemctl restart tailscaled || true
    sleep 5
    # Best-effort re-auth if a reusable key file exists (operator-managed).
    if [[ -f /etc/cloudless/tailscale-authkey ]]; then
      # shellcheck disable=SC1091
      key="$(tr -d '\n' </etc/cloudless/tailscale-authkey)"
      if [[ -n "$key" ]]; then
        log "tailscale up with /etc/cloudless/tailscale-authkey"
        tailscale up --auth-key="$key" --ssh=false --accept-routes --reset=false \
          || log "WARN: tailscale up failed"
      fi
    fi
  fi

  local ip
  ip="$(tailscale ip -4 2>/dev/null || true)"
  if [[ -z "$ip" ]]; then
    log "ERROR: no Tailscale IPv4"
    return 1
  fi
  log "tailscale ok ip=$ip state=$(tailscale status --json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("BackendState",""))' 2>/dev/null || echo '?')"
}

ping_peers() {
  local peers="${PI_CONNECTIVITY_PEERS:-$PEER_TS_IPS_DEFAULT}"
  local self
  self="$(tailscale ip -4 2>/dev/null || true)"
  local p
  for p in $peers; do
    [[ -z "$p" || "$p" == "$self" ]] && continue
    if tailscale ping -c 1 -timeout 3s "$p" >/dev/null 2>&1; then
      log "peer $p reachable"
    else
      log "WARN: peer $p unreachable via tailscale ping"
    fi
  done
}

case "$MODE" in
  --boot)
    log "boot heal"
    sleep 8
    ensure_tailscale || true
    ensure_sshd || true
    ping_peers || true
    ;;
  --check)
    ensure_tailscale || true
    ensure_sshd || true
    # Peer ping only every check (cheap); failures are logged, not fatal.
    ping_peers || true
    ;;
  *)
    echo "Usage: $0 --boot|--check" >&2
    exit 2
    ;;
esac
