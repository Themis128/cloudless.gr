#!/usr/bin/env bash
# ssh-pi.sh — SSH to omv / omv-ha preferring Tailscale, falling back to LAN.
#
# Usage:
#   scripts/ssh-pi.sh omv 'hostname'
#   scripts/ssh-pi.sh omv-ha
#   scripts/ssh-pi.sh github-omv uptime
set -euo pipefail

TARGET="${1:?usage: $0 omv|omv-ha|github-omv [remote-cmd...]}"
shift || true

case "$TARGET" in
  omv|github-omv|OMV)
    TS_HOST=100.74.191.58
    LAN_HOST=192.168.1.128
    ;;
  omv-ha|OMV-HA|ha)
    TS_HOST=100.95.117.84
    LAN_HOST=192.168.1.130
    ;;
  *)
    echo "unknown host: $TARGET (expected omv|omv-ha)" >&2
    exit 2
    ;;
esac

USER_NAME="${PI_SSH_USER:-tbaltzakis}"
IDENTITY="${PI_SSH_IDENTITY:-$HOME/.ssh/id_rsa}"
SSH_BASE=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new
  -o IdentitiesOnly=yes -i "$IDENTITY" -o ConnectTimeout=8)

try() {
  local host="$1"
  "${SSH_BASE[@]}" "${USER_NAME}@${host}" "$@"
}

if try "$TS_HOST" true 2>/dev/null; then
  exec "${SSH_BASE[@]}" "${USER_NAME}@${TS_HOST}" "$@"
fi
echo "[ssh-pi] Tailscale $TS_HOST failed — trying LAN $LAN_HOST" >&2
exec "${SSH_BASE[@]}" "${USER_NAME}@${LAN_HOST}" "$@"
