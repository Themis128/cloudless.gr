#!/usr/bin/env bash
# Retag Pi hosts to tag:pi and ensure ACL grants classic SSH (tcp:22).
# Auth: same as scripts/tailscale-admin-api.sh (OAuth or API key).
#
# Usage:
#   bash scripts/tailscale-retag-pi-hosts.sh
#   DRY_RUN=1 bash scripts/tailscale-retag-pi-hosts.sh
set -euo pipefail

TAILNET="${TAILSCALE_TAILNET:-tail4ecae1.ts.net}"
API="${TAILSCALE_API_BASE:-https://api.tailscale.com/api/v2}"
DRY_RUN="${DRY_RUN:-0}"
case "${DRY_RUN}" in 1|true|TRUE|yes|YES) DRY_RUN=1 ;; *) DRY_RUN=0 ;; esac

# hostname short → desired tags (replaces previous tag set)
declare -A WANT_TAGS=(
  [github-omv]='["tag:pi"]'
  [omv-ha]='["tag:pi"]'
)

need() { command -v "$1" >/dev/null || { echo "missing $1"; exit 1; }; }
need curl
need jq

auth_header() {
  if [[ -n "${TS_API_KEY:-}" ]]; then
    echo "Authorization: Basic $(printf '%s:' "$TS_API_KEY" | base64 -w0 2>/dev/null || printf '%s:' "$TS_API_KEY" | base64)"
    return
  fi
  local id="${TS_CLIENT_ID:-${TAILSCALE_OAUTH_CLIENT_ID:-}}"
  local secret="${TS_CLIENT_SECRET:-${TAILSCALE_OAUTH_CLIENT_SECRET:-${TAILSCALE_OAUTH_SECRET:-}}}"
  if [[ -z "$id" || -z "$secret" ]]; then
    echo "Set TS_API_KEY or TS_CLIENT_ID+TS_CLIENT_SECRET" >&2
    exit 2
  fi
  local tok
  tok=$(curl -fsS -u "${id}:${secret}" \
    -d grant_type=client_credentials \
    "$API/oauth/token" | jq -r .access_token)
  [[ -n "$tok" && "$tok" != null ]] || { echo "OAuth failed" >&2; exit 2; }
  echo "Authorization: Bearer $tok"
}

AUTH="$(auth_header)"
echo "==> Listing devices on $TAILNET"
DEVICES=$(curl -fsS -H "$AUTH" -H 'Accept: application/json' "$API/tailnet/$TAILNET/devices")

for short in "${!WANT_TAGS[@]}"; do
  tags_json="${WANT_TAGS[$short]}"
  row=$(echo "$DEVICES" | jq -c --arg h "$short" '
    .devices[] | select((.hostname|split(".")[0]) == $h or (.name|split(".")[0]) == $h) | {id,hostname,tags}
  ' | head -1)
  if [[ -z "$row" ]]; then
    echo "WARN: device $short not found"
    continue
  fi
  did=$(echo "$row" | jq -r .id)
  cur=$(echo "$row" | jq -c .tags)
  echo "DEVICE $short id=$did current_tags=$cur → $tags_json"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "  DRY_RUN skip POST tags"
    continue
  fi
  HTTP=$(curl -sS -o /tmp/ts-tags-out.json -w '%{http_code}' \
    -X POST -H "$AUTH" -H 'Content-Type: application/json' \
    "$API/device/$did/tags" \
    --data-binary "{\"tags\": $tags_json}")
  echo "  POST tags HTTP $HTTP $(head -c 200 /tmp/ts-tags-out.json)"
  [[ "$HTTP" == "200" ]] || exit 1
done

echo "==> Done"
