#!/usr/bin/env bash
#
# One-shot helper to store a GitHub PAT into SSM as both
#   /cloudless/production/GITHUB_DISPATCH_TOKEN  (new, primary)
#   /cloudless/production/GITHUB_TOKEN           (refresh — the existing
#                                                 entry is an expired gho_
#                                                 OAuth token returning 401)
#
# How to mint the PAT (open in any browser — handler defaults shown):
#
#   https://github.com/settings/personal-access-tokens/new
#
#   - Token name        : cloudless-dispatch
#   - Resource owner    : Themis128
#   - Repository access : Only select repositories → cloudless.gr
#   - Expiration        : 90 days (or your preference)
#   - Repository perms  : Actions = Read and write
#                         Contents = Read-only           (needed by gh CLI parts)
#                         Metadata = Read-only           (automatically added)
#
# Copy the token (starts with `github_pat_...`), then run:
#
#   bash scripts/store-github-dispatch-token.sh
#
# This script reads the token from stdin once (no echo), verifies it against
# the GitHub /user endpoint, then writes both SSM parameters as SecureString.
# Nothing is logged to disk or stdout — pipe-from-clipboard works fine.

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PREFIX="/cloudless/production"

if ! command -v aws >/dev/null; then
  echo "ERROR: aws CLI not found." >&2; exit 1
fi
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "ERROR: AWS credentials not configured. Run 'aws configure' first." >&2; exit 1
fi

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

# --- Write to SSM ---
for NAME in GITHUB_DISPATCH_TOKEN GITHUB_TOKEN; do
  echo -n "Writing $PREFIX/$NAME ... "
  aws ssm put-parameter \
    --region "$REGION" \
    --name "$PREFIX/$NAME" \
    --type SecureString \
    --value "$TOKEN" \
    --overwrite >/dev/null
  echo "ok"
done

# --- Confirm what landed (length + last-modified, never the value) ---
echo "Final SSM state:"
for NAME in GITHUB_DISPATCH_TOKEN GITHUB_TOKEN; do
  aws ssm get-parameter --region "$REGION" --name "$PREFIX/$NAME" --with-decryption \
    --output json | jq -r "\"  \(.Parameter.Name)  length=\(.Parameter.Value | length)  modified=\(.Parameter.LastModifiedDate)\""
done

echo
echo "Done. The Lambda picks up SSM at module load (5-min cache); a redeploy"
echo "or 5-minute wait makes the new token effective. Manual test once active:"
echo "   /cloudless-draft rerun     (in any Slack channel where the bot is)"
