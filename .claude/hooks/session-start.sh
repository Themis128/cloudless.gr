#!/bin/bash
# Session-start hook for Claude Code on the web.
#
# Required session secrets (set in Claude Code web UI → session settings → Secrets):
#   GITHUB_PAT           — GitHub Personal Access Token for git push/PR operations
#   TAILSCALE_AUTH_KEY   — ephemeral Tailscale auth key (tailscale.com/admin/settings/keys)
#   OMV_SSH_KEY_CONTENTS — base64-encoded SSH private key (base64 -w0 ~/.ssh/id_ed25519)

set -euo pipefail

# Only run in remote (cloud) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# ── GitHub PAT ─────────────────────────────────────────────────────────────────
# Auto-configure git credentials so every git push works without embedding
# the token in remote URLs or being prompted for a password.

if [ -n "${GITHUB_PAT:-}" ]; then
  echo "[session-start] Configuring git auth with GITHUB_PAT..."
  cat > /tmp/gh-cred-helper.sh << CRED_EOF
#!/bin/bash
echo "username=x-access-token"
echo "password=${GITHUB_PAT}"
CRED_EOF
  chmod +x /tmp/gh-cred-helper.sh
  git config --global credential.helper "/tmp/gh-cred-helper.sh"
  echo "[session-start] Git auth ready — git push will use GITHUB_PAT automatically."
else
  echo "[session-start] GITHUB_PAT not set — git push will require manual auth." >&2
fi

# ── Tailscale ──────────────────────────────────────────────────────────────────

if [ -z "${TAILSCALE_AUTH_KEY:-}" ]; then
  echo "[session-start] TAILSCALE_AUTH_KEY not set — skipping Tailscale setup." >&2
else
  PI_IP="100.113.41.119"

  if ! command -v tailscale &>/dev/null; then
    echo "[session-start] Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
  fi

  if ! pgrep -x tailscaled &>/dev/null; then
    echo "[session-start] Starting tailscaled..."
    tailscaled --state=mem: &>/tmp/tailscaled.log &
    sleep 2
  fi

  echo "[session-start] Joining tailnet..."
  tailscale up \
    --authkey="${TAILSCALE_AUTH_KEY}" \
    --hostname="claude-cloud-$(hostname -s)" \
    --accept-routes \
    --timeout=30s

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
fi

# ── SSH key ────────────────────────────────────────────────────────────────────

if [ -n "${OMV_SSH_KEY_CONTENTS:-}" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "[session-start] Exporting OMV_SSH_KEY_CONTENTS for MCP server..."
  printf 'export OMV_SSH_KEY_CONTENTS="%s"\n' "${OMV_SSH_KEY_CONTENTS}" >> "${CLAUDE_ENV_FILE}"
fi

echo "[session-start] Done."
