#!/usr/bin/env bash
# Deploy the cloudless2 pi-origin-proxy worker to Cloudflare.
#
# Two paths, in order of preference:
#   1. Direct wrangler deploy (fastest — needs CLOUDFLARE_API_TOKEN in env or ~/.wrangler)
#   2. Fall back to pushing the wrangler.jsonc bump to main, which triggers
#      .github/workflows/cloudflare-deploy.yml on GH Actions
#
# The proxy worker itself needs NO Wrangler secrets. Every real app secret
# (SESSION_SECRET, CRON_SECRET, POSTIZ_SERVICE_TOKEN, ANTHROPIC_API_KEY, etc.)
# is consumed by the Next.js app running on the Pi k3s cluster via the
# `pi-standby-aws-creds` k8s Secret and `getIntegrationsAsync()` at runtime.
# Do not push those into the proxy — they'd be dead weight and would blow
# past the Workers Free 3 MiB / secret-count envelope.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

CONFIG="workers/pi-origin-proxy/wrangler.jsonc"

echo "== cloudless2 deploy =="
echo "config: $CONFIG"

if [[ ! -f "$CONFIG" ]]; then
  echo "!! $CONFIG not found — aborting" >&2
  exit 2
fi

# --- Path 1: direct wrangler deploy ---------------------------------------
if command -v npx >/dev/null 2>&1; then
  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] \
     || [[ -n "${CF_API_TOKEN:-}" ]] \
     || [[ -f "$HOME/.wrangler/config/default.toml" ]]; then
    echo ""
    echo "-> attempting direct wrangler deploy (Path 1)"
    if npx --yes wrangler@4 deploy --config "$CONFIG" --minify; then
      echo ""
      echo "OK  direct deploy succeeded."
      echo "    verify: curl -sI https://cloudless.gr | grep -i x-served-by"
      exit 0
    fi
    echo "!! direct wrangler deploy failed — falling back to GH Actions push"
  else
    echo "-- no CLOUDFLARE_API_TOKEN in env and no ~/.wrangler config; skipping Path 1"
  fi
fi

# --- Path 2: push wrangler.jsonc bump so GH Actions deploys ---------------
echo ""
echo "-> Path 2: pushing config bump to main to trigger cloudflare-deploy.yml"

if ! command -v git >/dev/null 2>&1; then
  echo "!! git not found — install git or run wrangler directly with CLOUDFLARE_API_TOKEN set" >&2
  exit 2
fi

if [[ -n "$(git status --porcelain "$CONFIG")" ]]; then
  git add "$CONFIG"
  git commit -m "chore(cloudless2): bump wrangler compat date to trigger proxy redeploy"
else
  echo "-- no local changes to $CONFIG (compat date already committed)"
  echo "-- creating an empty commit to trigger the workflow instead"
  # Empty commits do NOT trigger workflows that use paths filters. Instead,
  # dispatch the workflow directly via gh if available.
  if command -v gh >/dev/null 2>&1; then
    echo "-> gh workflow run cloudflare-deploy.yml"
    gh workflow run cloudflare-deploy.yml --ref main
    echo "OK  workflow dispatched — watch with: gh run watch"
    exit 0
  fi
  echo "!! gh CLI not installed — install it (\`sudo apt install gh && gh auth login\`)" >&2
  echo "   or trigger the workflow from the GitHub UI:"
  echo "   https://github.com/<owner>/cloudless.gr/actions/workflows/cloudflare-deploy.yml"
  exit 3
fi

git push origin HEAD:main
echo "OK  pushed to main — cloudflare-deploy.yml will run in ~30s."
echo "    watch:  gh run watch --repo <owner>/cloudless.gr"
echo "    verify: curl -sI https://cloudless.gr | grep -i x-served-by"
