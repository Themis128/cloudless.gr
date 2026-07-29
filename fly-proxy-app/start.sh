#!/bin/sh
set -eu

mkdir -p /var/run/tailscale /var/lib/tailscale

SOCKS="127.0.0.1:1055"

if [ -n "${TS_AUTHKEY:-}" ]; then
  # Userspace mode: no /dev/net/tun. Fallback HTTP uses TS_SOCKS_PROXY only.
  tailscaled \
    --state=/var/lib/tailscale/tailscaled.state \
    --socket=/var/run/tailscale/tailscaled.sock \
    --tun=userspace-networking \
    --socks5-server="${SOCKS}" \
    --outbound-http-proxy-listen="${SOCKS}" &

  i=0
  while [ "$i" -lt 40 ]; do
    if tailscale --socket=/var/run/tailscale/tailscaled.sock version >/dev/null 2>&1; then
      break
    fi
    i=$((i + 1))
    sleep 0.25
  done

  if ! tailscale --socket=/var/run/tailscale/tailscaled.sock up \
    --authkey="$TS_AUTHKEY" \
    --hostname="${TS_HOSTNAME:-cloudless-fly-proxy}" \
    --accept-dns=false \
    --accept-routes=true \
    --ssh=false; then
    echo "warn: tailscale up failed (fallback may be unreachable)" >&2
  else
    j=0
    while [ "$j" -lt 30 ]; do
      state="$(tailscale --socket=/var/run/tailscale/tailscaled.sock status --json 2>/dev/null \
        | python -c 'import sys,json; print(json.load(sys.stdin).get("BackendState",""))' 2>/dev/null || true)"
      if [ "$state" = "Running" ]; then
        echo "tailscale: Running"
        break
      fi
      j=$((j + 1))
      sleep 0.5
    done
  fi

  # Do NOT set HTTP(S)_PROXY globally — that breaks workers.dev primary.
  # httpx wants socks5:// (not socks5h://)
  export TS_SOCKS_PROXY="socks5://${SOCKS}"
else
  echo "warn: TS_AUTHKEY unset — Tailscale fallback disabled" >&2
fi

exec python -m uvicorn proxy:app --host 0.0.0.0 --port 8080
