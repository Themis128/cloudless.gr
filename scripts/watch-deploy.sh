#!/usr/bin/env bash
# watch-deploy.sh
#
# Watch a Pi deploy to completion: poll the workflow run, the deployed SHA in
# SSM, and the live Insight Tag in the production bundle. Exits 0 once the
# Partner ID literal appears in the bundle (the truest signal that the new
# code is live and serving traffic). Companion to
# `scripts/linkedin-insight-doctor.sh`.
#
# Defaults (override with flags or env vars):
#   --run-id <id>      latest deploy-pi.yml run for current repo
#   --target-sha <sha> current HEAD short SHA (12 chars)
#   --interval <sec>   90
#   --max-tries <n>    20 (so up to 30 min by default)
#   --slug <slug>      shop-online
#   --locale <locale>  el
#   --no-color
#
# Exit codes:
#   0 = bundle now contains Partner ID literal (deploy effective)
#   1 = polling exhausted; deploy did not become effective in time
#   2 = preconditions failed (missing tooling, network error, …)
#
# Requires: bash, curl, grep, gh, aws.

set -uo pipefail
cd "$(dirname "$0")/.."

REPO="${GH_REPO:-Themis128/cloudless.gr}"
RUN_ID=""
TARGET_SHA=""
INTERVAL=90
MAX_TRIES=20
SLUG="shop-online"
LOCALE="el"
COLOR_FLAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-id) RUN_ID="$2"; shift 2 ;;
    --target-sha) TARGET_SHA="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --max-tries) MAX_TRIES="$2"; shift 2 ;;
    --slug) SLUG="$2"; shift 2 ;;
    --locale) LOCALE="$2"; shift 2 ;;
    --no-color) COLOR_FLAG="--no-color"; shift ;;
    -h|--help) sed -n '1,28p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

for tool in gh aws curl; do
  command -v "$tool" >/dev/null 2>&1 || { echo "missing tool: $tool" >&2; exit 2; }
done

# Default RUN_ID = latest deploy-pi.yml run.
if [[ -z "$RUN_ID" ]]; then
  RUN_ID=$(gh run list \
    --repo "$REPO" \
    --workflow deploy-pi.yml \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId' 2>/dev/null || true)
  if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
    echo "could not resolve latest deploy-pi.yml run; pass --run-id explicitly" >&2
    exit 2
  fi
fi

# Default TARGET_SHA = HEAD short SHA (12 chars — matches deploy-pi.yml's SHORT_SHA).
if [[ -z "$TARGET_SHA" ]]; then
  TARGET_SHA=$(git rev-parse HEAD 2>/dev/null | cut -c1-12 || true)
  if [[ -z "$TARGET_SHA" ]]; then
    echo "could not resolve HEAD SHA; pass --target-sha explicitly" >&2
    exit 2
  fi
fi

echo "watching run=$RUN_ID, target-sha=$TARGET_SHA, slug=$SLUG, locale=$LOCALE"
echo "interval=${INTERVAL}s, max-tries=$MAX_TRIES (~$((INTERVAL * MAX_TRIES / 60)) min ceiling)"
echo

for i in $(seq 1 "$MAX_TRIES"); do
  printf "=== try %d @ %s ===\n" "$i" "$(date -u +%H:%M:%SZ)"

  status=$(gh run view "$RUN_ID" --repo "$REPO" --json status --jq '.status' 2>/dev/null || echo "?")
  concl=$(gh run view "$RUN_ID" --repo "$REPO" --json conclusion --jq '.conclusion' 2>/dev/null || echo "?")
  echo "workflow: status=$status conclusion=$concl"

  pi_sha=$(aws ssm get-parameter \
    --name /cloudless/production/pi-sha \
    --region us-east-1 \
    --query 'Parameter.Value' \
    --output text 2>/dev/null || echo "?")
  echo "pi-sha SSM: $pi_sha"

  out=$(bash scripts/linkedin-insight-doctor.sh --slug "$SLUG" --locale "$LOCALE" $COLOR_FLAG 2>&1)
  echo "$out" | grep -E 'Partner ID literal|HEALTHY|NOT HEALTHY' | head -3

  if echo "$out" | grep -q 'Partner ID literal found in bundle'; then
    echo "=== ✓ Partner ID is in the live bundle. Deploy is effective. ==="
    exit 0
  fi

  if [[ "$pi_sha" == "$TARGET_SHA" && "$status" == "completed" && -z "$(echo "$out" | grep 'Partner ID literal found')" ]]; then
    echo "=== ! Deploy finished but live bundle still missing Partner ID. ==="
    echo "    Likely cause: Docker build cache reused stale chunks despite secret"
    echo "    being set. Bust /opt/docker-cache on the build runner and re-deploy."
  fi

  sleep "$INTERVAL"
done

echo "=== exhausted polls (~$((INTERVAL * MAX_TRIES / 60)) min). Deploy is taking longer than expected. ==="
exit 1
