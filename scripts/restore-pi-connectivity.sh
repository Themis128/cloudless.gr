#!/usr/bin/env bash
# restore-pi-connectivity.sh — operator remedy when Pi SSH / Tailscale breaks.
#
# Tries Tailscale then LAN for omv + omv-ha, runs on-box heal, forces classic
# OpenSSH (tailscale set --ssh=false), restarts sshd/tailscaled/runners, and
# prints a reachability matrix.
#
# Usage (from repo root or anywhere):
#   bash scripts/restore-pi-connectivity.sh
#   PI_SSH_IDENTITY=~/.ssh/id_rsa bash scripts/restore-pi-connectivity.sh
#
# When this host cannot reach the Pis at all, use GitHub Actions instead:
#   gh workflow run restore-pi-connectivity.yml
set -euo pipefail

USER_NAME="${PI_SSH_USER:-tbaltzakis}"
IDENTITY="${PI_SSH_IDENTITY:-$HOME/.ssh/id_rsa}"
CONNECT_TIMEOUT="${PI_SSH_TIMEOUT:-12}"

declare -A TS_IP=(
  [omv]=100.74.191.58
  [omv-ha]=100.95.117.84
)
declare -A LAN_IP=(
  [omv]=192.168.1.128
  [omv-ha]=192.168.1.130
)

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new
  -o IdentitiesOnly=yes -o ConnectTimeout="$CONNECT_TIMEOUT"
  -o ServerAliveInterval=10 -o ServerAliveCountMax=2)
if [[ -f "$IDENTITY" ]]; then
  SSH_OPTS+=(-i "$IDENTITY")
fi

log() { echo "[restore] $*"; }

ssh_to() {
  local host="$1"; shift
  ssh "${SSH_OPTS[@]}" "${USER_NAME}@${host}" "$@"
}

# Pick first working address for a logical node. Echoes the IP or empty.
pick_addr() {
  local node="$1"
  local ts="${TS_IP[$node]}"
  local lan="${LAN_IP[$node]}"
  if ssh_to "$ts" true >/dev/null 2>&1; then
    echo "$ts"
    return 0
  fi
  if ssh_to "$lan" true >/dev/null 2>&1; then
    echo "$lan"
    return 0
  fi
  echo ""
  return 1
}

REMOTE_RESTORE=$(cat <<'EOS'
set -euo pipefail
echo "=== host=$(hostname) ==="
# Prefer installed heal scripts; fall back to inline recovery.
if [ -x /usr/local/sbin/pi-connectivity-heal.sh ]; then
  sudo /usr/local/sbin/pi-connectivity-heal.sh --boot || sudo /usr/local/sbin/pi-connectivity-heal.sh --check || true
else
  sudo systemctl restart tailscaled || true
  sleep 4
  sudo tailscale set --ssh=false || true
  sudo systemctl restart ssh 2>/dev/null || sudo systemctl restart sshd 2>/dev/null || true
fi
# Never leave Tailscale SSH on (breaks BatchMode / CI).
sudo tailscale set --ssh=false || true
if [ -x /usr/local/sbin/gha-runner-heal.sh ]; then
  sudo /usr/local/sbin/gha-runner-heal.sh --boot || sudo /usr/local/sbin/gha-runner-heal.sh --check || true
else
  for u in $(systemctl list-units --type=service --all --no-legend 'actions.runner.*' 2>/dev/null | awk '{print $1}'); do
    sudo systemctl restart "$u" || true
  done
fi
# Re-assert firewall SSH allows if installer present in /tmp or repo path.
if [ -f /tmp/configure-pi-firewall.sh ]; then
  sudo bash /tmp/configure-pi-firewall.sh || true
elif [ -f "$HOME/cloudless.gr/infrastructure/omv/configure-pi-firewall.sh" ]; then
  sudo bash "$HOME/cloudless.gr/infrastructure/omv/configure-pi-firewall.sh" || true
fi
echo "--- status ---"
systemctl is-active ssh sshd tailscaled 2>/dev/null || true
tailscale ip -4 2>/dev/null || true
tailscale debug prefs 2>/dev/null | grep RunSSH || true
ss -ltn 2>/dev/null | grep ':22 ' || true
EOS
)

restore_node() {
  local node="$1"
  local addr
  addr="$(pick_addr "$node" || true)"
  if [[ -z "$addr" ]]; then
    log "FAIL $node — unreachable on Tailscale (${TS_IP[$node]}) and LAN (${LAN_IP[$node]})"
    return 1
  fi
  log "OK path $node → $addr — running restore"
  ssh_to "$addr" bash -s <<<"$REMOTE_RESTORE"
}

# If omv is down but omv-ha is up, jump ha → omv LAN (deploy-proxy pattern).
restore_omv_via_ha() {
  local ha_addr
  ha_addr="$(pick_addr omv-ha || true)"
  [[ -n "$ha_addr" ]] || return 1
  log "Trying omv restore via omv-ha jump ($ha_addr → 192.168.1.128)"
  ssh_to "$ha_addr" bash -s <<'JUMP'
set -euo pipefail
KEY=""
if [ -f "$HOME/.ssh/omv_ha" ]; then KEY="-i $HOME/.ssh/omv_ha"; fi
# shellcheck disable=SC2086
ssh $KEY -o BatchMode=yes -o ConnectTimeout=25 -o StrictHostKeyChecking=accept-new \
  tbaltzakis@192.168.1.128 bash -s <<'EOS'
set -euo pipefail
if [ -x /usr/local/sbin/pi-connectivity-heal.sh ]; then
  sudo /usr/local/sbin/pi-connectivity-heal.sh --boot || true
fi
sudo tailscale set --ssh=false || true
sudo systemctl restart ssh 2>/dev/null || sudo systemctl restart sshd 2>/dev/null || true
if [ -x /usr/local/sbin/gha-runner-heal.sh ]; then
  sudo /usr/local/sbin/gha-runner-heal.sh --boot || true
fi
hostname; tailscale ip -4; systemctl is-active ssh tailscaled 2>/dev/null || true
EOS
JUMP
}

main() {
  log "Starting Pi connectivity restore ($(date -u +%Y-%m-%dT%H:%MZ))"
  local rc=0
  restore_node omv-ha || rc=1
  if ! restore_node omv; then
    restore_omv_via_ha || rc=1
  fi

  echo
  log "=== reachability matrix ==="
  printf '%-10s %-18s %-18s\n' NODE Tailscale LAN
  for node in omv omv-ha; do
    local ts_ok=no lan_ok=no
    ssh_to "${TS_IP[$node]}" true >/dev/null 2>&1 && ts_ok=yes
    ssh_to "${LAN_IP[$node]}" true >/dev/null 2>&1 && lan_ok=yes
    printf '%-10s %-18s %-18s\n' "$node" "$ts_ok" "$lan_ok"
    if [[ "$ts_ok" != yes && "$lan_ok" != yes ]]; then
      rc=1
    fi
  done

  if [[ "$rc" -ne 0 ]]; then
    log "Incomplete restore. From any network, dispatch:"
    log "  gh workflow run restore-pi-connectivity.yml"
    log "If the Pi is powered off, power-cycle it; heal runs on boot."
    exit 1
  fi
  log "Both nodes reachable. Done."
}

main "$@"
