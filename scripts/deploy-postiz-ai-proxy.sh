#!/usr/bin/env bash
# Deploy the postiz-ai-proxy Cloudflare Worker and wire its secrets.
# Run from the repo root.
#
# Usage:
#   NVIDIA_API_KEY=nvapi-... PROXY_TOKEN=<random> bash scripts/deploy-postiz-ai-proxy.sh
#
# PROXY_TOKEN is what you store in the postiz-providers k8s secret as
# POSTIZ_AI_PROXY_TOKEN. Generate one with:
#   openssl rand -hex 32
set -euo pipefail

WRANGLER_CONFIG="workers/postiz-ai-proxy/wrangler.jsonc"

if [[ -z "${NVIDIA_API_KEY:-}" ]]; then
  echo "ERROR: NVIDIA_API_KEY is not set" >&2
  exit 1
fi
if [[ -z "${PROXY_TOKEN:-}" ]]; then
  echo "ERROR: PROXY_TOKEN is not set" >&2
  exit 1
fi

echo "→ Setting Worker secrets…"
printf '%s' "$NVIDIA_API_KEY" | pnpm wrangler secret put NVIDIA_API_KEY --config "$WRANGLER_CONFIG"
printf '%s' "$PROXY_TOKEN"    | pnpm wrangler secret put PROXY_TOKEN    --config "$WRANGLER_CONFIG"

echo "→ Deploying Worker…"
pnpm wrangler deploy --config "$WRANGLER_CONFIG"

echo ""
echo "✓ Worker deployed at: https://postiz-ai-proxy.cloudless.workers.dev"
echo ""
echo "Next: add POSTIZ_AI_PROXY_TOKEN to the postiz-providers k8s secret:"
echo "  kubectl -n postiz create secret generic postiz-providers \\"
echo "    --from-literal=POSTIZ_AI_PROXY_TOKEN='$PROXY_TOKEN' \\"
echo "    --from-literal=POSTIZ_API_KEY=<existing> \\"
echo "    ... (other OAuth keys) \\"
echo "    --dry-run=client -o yaml | kubectl apply -f -"
echo ""
echo "Then restart Postiz:"
echo "  kubectl -n postiz rollout restart deploy/postiz"
