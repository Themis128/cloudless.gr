#!/bin/bash
# Session-start hook for Claude Code on the web.
# - Installs Tailscale and joins the tailnet so omv-main (100.113.41.119) is reachable.
# - Exports OMV_SSH_KEY_CONTENTS so the cloudless-infra MCP server can SSH to the Pi.
# Requires two session secrets:
#   TAILSCALE_AUTH_KEY   — ephemeral Tailscale auth key (generate at tailscale.com/admin/settings/keys)
#   OMV_SSH_KEY_CONTENTS — base64-encoded SSH private key (run: base64 -w0 ~/.ssh/id_ed25519)

set -euo pipefail

# Only run in remote (cloud) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PI_IP="100.113.41.119"

# ── Tailscale ──────────────────────────────────────────────────────────────────

if [ -z "${TAILSCALE_AUTH_KEY:-}" ]; then
  echo "[session-start] TAILSCALE_AUTH_KEY not set — skipping Tailscale setup." >&2
  exit 0
fi

# Install Tailscale if not already present
if ! command -v tailscale &>/dev/null; then
  echo "[session-start] Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | sh
fi

# Start tailscaled daemon if not running
if ! pgrep -x tailscaled &>/dev/null; then
  echo "[session-start] Starting tailscaled..."
  tailscaled --state=mem: &>/tmp/tailscaled.log &
  sleep 2
fi

# Authenticate and bring the interface up
echo "[session-start] Joining tailnet..."
tailscale up \
  --authkey="${TAILSCALE_AUTH_KEY}" \
  --hostname="claude-cloud-$(hostname -s)" \
  --accept-routes \
  --timeout=30s

# Wait for the Pi to be reachable (up to 30 s)
echo "[session-start] Waiting for Pi at ${PI_IP}..."
for i in $(seq 1 30); do
  if timeout 2 bash -c "echo >/dev/tcp/${PI_IP}/22" 2>/dev/null; then
    echo "[session-start] Pi reachable after ${i}s."
    break
  fi
  sleep 1
done

if ! timeout 2 bash -c "echo >/dev/tcp/${PI_IP}/22" 2>/dev/null; then
  echo "[session-start] Warning: Pi still unreachable — SSH tools may fail." >&2
fi

# ── SSH key ────────────────────────────────────────────────────────────────────

if [ -n "${OMV_SSH_KEY_CONTENTS:-}" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "[session-start] Exporting OMV_SSH_KEY_CONTENTS for MCP server..."
  printf 'export OMV_SSH_KEY_CONTENTS="%s"\n' "${OMV_SSH_KEY_CONTENTS}" >> "${CLAUDE_ENV_FILE}"
fi

echo "[session-start] Done."
