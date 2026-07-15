#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${DDNS_UPDATE_AUTH_CONFIG:-/etc/cloudless/ddns-update-auth.env}"
STATE_DIR="${DDNS_UPDATE_AUTH_STATE_DIR:-/var/lib/cloudless}"
STATE_FILE="${STATE_DIR}/ddns-update-auth.last-ip"
LOG_PREFIX="[ddns-update-auth]"

log() {
  printf '%s %s\n' "$LOG_PREFIX" "$*" >&2
}

if [[ ! -f "$CONFIG_FILE" ]]; then
  # Quiet success: cron should not email when DDNS is intentionally not configured.
  exit 0
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"

: "${DDNS_ENABLED:=false}"

if [[ "$DDNS_ENABLED" != "true" ]]; then
  # Quiet success: installed but disabled until Cloudflare config is provided.
  exit 0
fi

: "${CF_API_TOKEN:=}"
: "${CF_ZONE_ID:=}"
: "${CF_RECORD_ID:=}"
: "${CF_RECORD_NAME:=}"
: "${CF_RECORD_TYPE:=A}"
: "${CF_PROXIED:=false}"
: "${DDNS_IP_URL:=https://api.ipify.org}"
: "${DDNS_TTL:=120}"

if [[ -z "$CF_API_TOKEN" || -z "$CF_ZONE_ID" ]]; then
  log "CF_API_TOKEN or CF_ZONE_ID missing in $CONFIG_FILE"
  exit 0
fi

if [[ -z "$CF_RECORD_ID" && -z "$CF_RECORD_NAME" ]]; then
  log "set either CF_RECORD_ID or CF_RECORD_NAME in $CONFIG_FILE"
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  log "curl is required"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  log "python3 is required"
  exit 1
fi

current_ip="$(curl -fsS --max-time 20 "$DDNS_IP_URL" | tr -d '[:space:]')"

if [[ ! "$current_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  log "could not determine public IPv4 from $DDNS_IP_URL: $current_ip"
  exit 1
fi

mkdir -p "$STATE_DIR"

if [[ -f "$STATE_FILE" ]] && [[ "$(cat "$STATE_FILE")" == "$current_ip" ]]; then
  # Quiet success: avoids cron email spam.
  exit 0
fi

api_base="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records"

if [[ -z "$CF_RECORD_ID" ]]; then
  lookup_json="$(curl -fsS --max-time 30 \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "${api_base}?type=${CF_RECORD_TYPE}&name=${CF_RECORD_NAME}")"

  CF_RECORD_ID="$(python3 - <<'PY' "$lookup_json"
import json
import sys

payload = json.loads(sys.argv[1])
records = payload.get("result") or []
if not records:
    raise SystemExit(1)
print(records[0]["id"])
PY
)"
fi

payload="$(python3 - <<'PY' "$CF_RECORD_TYPE" "$CF_RECORD_NAME" "$current_ip" "$DDNS_TTL" "$CF_PROXIED"
import json
import sys

record_type, name, content, ttl, proxied = sys.argv[1:]
print(json.dumps({
    "type": record_type,
    "name": name,
    "content": content,
    "ttl": int(ttl),
    "proxied": proxied.lower() == "true",
}))
PY
)"

response="$(curl -fsS --max-time 30 -X PUT \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$payload" \
  "${api_base}/${CF_RECORD_ID}")"

success="$(python3 - <<'PY' "$response"
import json
import sys

payload = json.loads(sys.argv[1])
print("true" if payload.get("success") else "false")
PY
)"

if [[ "$success" != "true" ]]; then
  log "Cloudflare update failed"
  python3 - <<'PY' "$response" >&2
import json
import sys

payload = json.loads(sys.argv[1])
for error in payload.get("errors", []):
    print(error)
PY
  exit 1
fi

printf '%s\n' "$current_ip" > "$STATE_FILE"
log "updated ${CF_RECORD_NAME:-$CF_RECORD_ID} to $current_ip"
