#!/usr/bin/env bash
# Source this file before using the Postiz Agents CLI against our self-host.
#   source scripts/postiz-cli-env.sh
#
# Does NOT print or commit secrets. Prefers an already-exported POSTIZ_API_KEY;
# otherwise reads from the environment only (never from .env.local).

set -euo pipefail

# Tailscale NodePort → postiz Service (bypasses Cloudflare Access).
# Override with POSTIZ_API_URL if you use a CF Access service token against
# https://postiz.cloudless.gr instead.
export POSTIZ_API_URL="${POSTIZ_API_URL:-http://100.74.191.58:30500}"

if [[ -z "${POSTIZ_API_KEY:-}" ]]; then
  echo "POSTIZ_API_KEY is unset. Export it (Postiz → Settings → Developers → Public API), then re-source." >&2
  return 1 2>/dev/null || exit 1
fi

if ! command -v postiz >/dev/null 2>&1; then
  echo "postiz CLI not found. Install: pnpm add -g postiz" >&2
fi

echo "POSTIZ_API_URL=$POSTIZ_API_URL"
command -v postiz >/dev/null 2>&1 && postiz auth:status || true
