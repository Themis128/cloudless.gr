#!/usr/bin/env bash
# Unblock GitHub Actions cron callers from Cloudflare Bot Fight Mode.
#
# Bot Fight Mode (free) cannot be skipped via WAF custom rules — Skip/Allow
# have no effect on that pipeline. See:
#   https://developers.cloudflare.com/bots/get-started/bot-fight-mode/#limitations
#
# This script turns Bot Fight Mode OFF zone-wide so Bearer CRON_SECRET polls
# (linkedin-poll, postiz-crons, etc.) reach the Worker. Auth remains CRON_SECRET.
#
# Auth: CLOUDFLARE_API_TOKEN with Zone:Read + Zone Settings:Edit
# Zone: CLOUDFLARE_ZONE_ID / CF_ZONE_ID, else resolve DOMAIN (default cloudless.gr)
set -euo pipefail

DOMAIN="${DOMAIN:-cloudless.gr}"
ZONE_ID="${CLOUDFLARE_ZONE_ID:-${CF_ZONE_ID:-}}"
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
API="https://api.cloudflare.com/client/v4"

if [[ -z "$TOKEN" ]]; then
  echo "::error::CLOUDFLARE_API_TOKEN is required (Zone:Read + Zone Settings:Edit)"
  exit 1
fi

cf() {
  local method="$1" url="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -fsS -X "$method" "$url" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$body"
  else
    curl -fsS -X "$method" "$url" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json"
  fi
}

if [[ -z "$ZONE_ID" ]]; then
  echo "==> resolving zone for ${DOMAIN}"
  ZRESP="$(cf GET "${API}/zones?name=${DOMAIN}")"
  ZONE_ID="$(python3 -c 'import json,sys; d=json.load(sys.stdin); r=d.get("result") or []; print(r[0]["id"] if r else "")' <<<"$ZRESP")"
  [[ -n "$ZONE_ID" ]] || { echo "::error::could not resolve zone id for ${DOMAIN}"; echo "$ZRESP"; exit 1; }
fi
echo "==> zone: ${ZONE_ID}"

SETTING_URL="${API}/zones/${ZONE_ID}/settings/bot_fight_mode"
echo "==> current bot_fight_mode"
CUR="$(cf GET "$SETTING_URL" || true)"
python3 - "$CUR" <<'PY' || true
import json, sys
try:
    d = json.loads(sys.argv[1])
except Exception:
    print("    (could not parse current setting)")
    raise SystemExit(0)
if not d.get("success"):
    print("    API:", json.dumps(d.get("errors"), indent=2))
    raise SystemExit(0)
print("    value:", (d.get("result") or {}).get("value"))
PY

echo "==> setting bot_fight_mode=off"
RESP="$(cf PATCH "$SETTING_URL" '{"value":"off"}')"
python3 - "$RESP" <<'PY'
import json, sys
resp = json.loads(sys.argv[1])
if not resp.get("success"):
    print("Cloudflare API error:", json.dumps(resp.get("errors"), indent=2), file=sys.stderr)
    print(
        "::error::Failed to disable bot_fight_mode — token needs Zone Settings:Edit "
        "(or disable Bot Fight Mode manually in CF dashboard → Security → Bots).",
        file=sys.stderr,
    )
    sys.exit(1)
val = (resp.get("result") or {}).get("value")
print(f"✓ bot_fight_mode={val}")
if val != "off":
    print(f"::error::expected off, got {val}", file=sys.stderr)
    sys.exit(1)
PY

echo "==> done — GHA cron polls should no longer see Just a moment…"
