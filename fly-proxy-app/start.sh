#!/bin/sh
set -eu

mkdir -p /var/run/tailscale /var/lib/tailscale

# Userspace networking works on Fly without /dev/net/tun privileges.
export TS_USERSPACE="${TS_USERSPACE:-true}"

if [ -n "${TS_AUTHKEY:-}" ]; then
  tailscaled \
    --state=/var/lib/tailscale/tailscaled.state \
    --socket=/var/run/tailscale/tailscaled.sock \
    --tun=userspace-networking &

  # Wait for daemon
  i=0
  while [ "$i" -lt 30 ]; do
    if tailscale --socket=/var/run/tailscale/tailscaled.sock status >/dev/null 2>&1; then
      break
    fi
    i=$((i + 1))
    sleep 0.5
  done

  tailscale --socket=/var/run/tailscale/tailscaled.sock up \
    --authkey="$TS_AUTHKEY" \
    --hostname="${TS_HOSTNAME:-cloudless-fly-proxy}" \
    --accept-dns=false \
    --accept-routes=true \
    --ssh=false || echo "warn: tailscale up failed (fallback may be unreachable)" >&2
else
  echo "warn: TS_AUTHKEY unset — Tailscale fallback disabled" >&2
fi

exec python -m uvicorn proxy:app --host 0.0.0.0 --port 8080
