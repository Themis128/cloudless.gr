#!/usr/bin/env bash
#
# One-shot helper to store a GitHub PAT into Cloudflare (Wrangler secret + D1 config)
#   - Wrangler secret: GITHUB_DISPATCH_TOKEN (primary) + GITHUB_TOKEN (legacy compat)
#   - D1 app_config:   github_dispatch_token + github_token
#
# How to mint the PAT:
#
#   https://github.com/settings/personal-access-tokens/new
#
#   - Token name        : cloudless-dispatch
#   - Resource owner    : Themis128
#   - Repository access : Only select repositories → cloudless.gr
#   - Expiration        : 90 days (or your preference)
#   - Repository perms  : Actions = Read and write
#                         Contents = Read-only
#                         Metadata = Read-only
#
# Copy the token (starts with `github_pat_...`), then run:
#
#   bash scripts/store-github-dispatch-token.sh
#
# This script reads the token from stdin once (no echo), verifies it against
# the GitHub /user endpoint, then writes both Cloudflare secrets and D1 config.

set -euo pipefail

source "$(dirname "$0")/lib/cf-secrets.sh"

if ! command -v jq >/dev/null; then
  echo "ERROR: jq not found." >&2; exit 1
fi

# --- Verify Cloudflare auth ---
cf_verify_auth || exit 1

# --- Read the token ---
if [ -t 0 ]; then
  read -r -s -p "Paste GitHub PAT (input hidden): " TOKEN
  echo
else
  TOKEN=$(cat)
fi

if [ -z "$TOKEN" ]; then
  echo "ERROR: empty token." >&2; exit 1
fi
case "$TOKEN" in
  github_pat_*|ghp_*) : ;;
  *) echo "WARN: token prefix is not github_pat_ or ghp_ — continuing anyway." >&2 ;;
esac

# --- Verify against GitHub ---
echo -n "Verifying token against api.github.com/user ... "
HTTP=$(curl -s -o /tmp/.gh-probe.json -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/user)
if [ "$HTTP" != "200" ]; then
  echo "FAILED (HTTP $HTTP)"
  cat /tmp/.gh-probe.json >&2 || true
  rm -f /tmp/.gh-probe.json
  exit 1
fi
LOGIN=$(jq -r .login /tmp/.gh-probe.json)
rm -f /tmp/.gh-probe.json
echo "ok (login: $LOGIN)"

# --- Probe actions:write by attempting a dry rerun listing on the target repo ---
echo -n "Verifying repo access for Themis128/cloudless.gr ... "
HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/Themis128/cloudless.gr/actions/workflows)
if [ "$HTTP" != "200" ]; then
  echo "FAILED (HTTP $HTTP) — token has /user access but cannot read workflows. Check repo + Actions permissions." >&2
  exit 1
fi
echo "ok"

# --- Write to Cloudflare (Wrangler secrets + D1 config) ---
for NAME in GITHUB_DISPATCH_TOKEN GITHUB_TOKEN; do
  echo -n "Writing $NAME to Cloudflare... "
  cf_secret_set "$NAME" "$TOKEN" && echo -n "Wrangler ok " || echo -n "Wrangler failed "
  cf_config_set "$NAME" "$TOKEN" && echo "D1 ok" || echo "D1 failed"
done

echo
echo "Done. The Worker picks up secrets at deploy; D1 config is live immediately."
echo "Manual test once active:"
echo "   /cloudless-draft rerun     (in any Slack channel where the bot is)"