#!/usr/bin/env bash
# Wait for a usable tailnet path to a peer before a workflow touches it.
#
# Why: tailscale/github-action reports "connected" as soon as tailscaled is
# up, but (a) new ephemeral nodes take a while to propagate through the
# tailnet — peers reject traffic until then — and (b) a known action bug can
# leave the runner with missing tailscale0 routes, where `tailscale ping`
# works but TCP to the peer times out forever (tailscale/github-action#266).
#
# This step: TCP-probes each requested port with retries; if probes fail it
# remediates once with `tailscale down && tailscale up` (re-syncs routes),
# then probes again. Fails the step only if a port stays unreachable.
#
# Usage: tailscale-wait.sh <peer-ip> [tcp-port ...]
set -u

PEER="${1:?peer ip required}"
shift || true

probe_ports() {
  local failed=0 port i
  for port in "$@"; do
    for i in $(seq 1 12); do
      if nc -zv -w5 "$PEER" "$port" >/dev/null 2>&1; then
        echo "ok: ${PEER}:${port} reachable (attempt ${i})"
        break
      fi
      echo "tcp ${PEER}:${port} attempt ${i}/12 failed — retrying in 10s"
      sleep 10
      [ "$i" = "12" ] && failed=1
    done
  done
  return "$failed"
}

echo "::group::Wait for tailnet path to ${PEER}"

# Warm the path regardless — forces DERP->direct negotiation up front.
tailscale ping --c 3 --timeout 10s "$PEER" 2>&1 | tail -3 ||
  echo "::warning::tailscale ping to ${PEER} failed — TCP probes are authoritative"

if ! probe_ports "$@"; then
  echo "::warning::TCP probes failing — re-syncing tailscale routes (down/up)"
  sudo tailscale down && sudo tailscale up
  sleep 5
  tailscale ping --c 3 --timeout 10s "$PEER" 2>&1 | tail -3 || true
  if ! probe_ports "$@"; then
    echo "::error::${PEER} still unreachable after tailscale re-sync"
    # ACL denials surface as fast RST ("connection refused"). Print self tags
    # and the peer's whois record so tag mismatches are visible in the log.
    echo "--- self ---"
    tailscale status --self --peers=false || true
    tailscale whois --json "$(tailscale ip -4 2>/dev/null)" 2>/dev/null | grep -E '"Tags"|"Name"|"PrimaryRoutes"' || true
    echo "--- peer ---"
    tailscale whois "$PEER" 2>/dev/null | grep -iE "tags:|name:|machine" || true
    tailscale status || true
    tailscale netcheck || true
    echo "::endgroup::"
    exit 1
  fi
fi

echo "::endgroup::"
