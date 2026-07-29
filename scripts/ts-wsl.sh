#!/usr/bin/env bash
# Start Tailscale in WSL userspace mode (no sudo / no TUN device).
# Exposes SOCKS5 + HTTP proxy on localhost:1055 for apps that must dial 100.x.
set -euo pipefail
BIN="${HOME}/bin"
STATE="${HOME}/.local/tailscale"
SOCK="${STATE}/tailscaled.sock"
SOCKS_ADDR="${TS_SOCKS_ADDR:-localhost:1055}"
mkdir -p "$STATE" "$BIN"
export PATH="$BIN:$PATH"

if ! command -v tailscaled >/dev/null; then
  echo "tailscaled missing in ~/bin — see docs/kubectl-tailscale.md"
  exit 1
fi

is_running() {
  pgrep -f "${BIN}/tailscaled" >/dev/null 2>&1
}

if ! is_running; then
  nohup "$BIN/tailscaled" \
    --tun=userspace-networking \
    --socks5-server="$SOCKS_ADDR" \
    --outbound-http-proxy-listen="$SOCKS_ADDR" \
    --state="$STATE/tailscaled.state" \
    --socket="$SOCK" \
    --statedir="$STATE" \
    >"$STATE/tailscaled.log" 2>&1 &
  echo "tailscaled started pid $! (SOCKS5 $SOCKS_ADDR)"
  sleep 2
fi

exec "$BIN/tailscale" --socket="$SOCK" "$@"
