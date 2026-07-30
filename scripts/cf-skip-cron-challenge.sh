#!/usr/bin/env bash
# Unblock GitHub Actions cron callers from Cloudflare Bot Fight Mode.
#
# Free Bot Fight Mode cannot be skipped via WAF custom rules. See:
#   https://developers.cloudflare.com/bots/get-started/bot-fight-mode/#limitations
#
# Tries zone setting bot_fight_mode=off. If the API rejects the setting
# (dashboard-only on some Free plans), exits 0 with a warning so the
# workflow verify step can still report whether challenges remain.
#
# Auth: CLOUDFLARE_API_TOKEN with Zone:Read + Zone Settings:Edit
set -euo pipefail

DOMAIN="${DOMAIN:-cloudless.gr}"
ZONE_ID="${CLOUDFLARE_ZONE_ID:-${CF_ZONE_ID:-}}"
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
API="https://api.cloudflare.com/client/v4"

if [[ -z "$TOKEN" ]]; then
  echo "::error::CLOUDFLARE_API_TOKEN is required (Zone:Read + Zone Settings:Edit)"
  exit 1
fi

if [[ -z "$ZONE_ID" ]]; then
  echo "==> resolving zone for ${DOMAIN}"
  ZRESP=$(curl -fsS -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "${API}/zones?name=${DOMAIN}")
  ZONE_ID="$(python3 -c 'import json,sys; d=json.load(sys.stdin); r=d.get("result") or []; print(r[0]["id"] if r else "")' <<<"$ZRESP")"
  [[ -n "$ZONE_ID" ]] || { echo "::error::could not resolve zone id for ${DOMAIN}"; echo "$ZRESP"; exit 1; }
fi
echo "==> zone: ${ZONE_ID}"

SETTING_URL="${API}/zones/${ZONE_ID}/settings/bot_fight_mode"

echo "==> GET bot_fight_mode"
CUR=$(curl -sS -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" "$SETTING_URL" || true)
python3 -c 'import json,sys
raw=sys.argv[1]
try:
  d=json.loads(raw)
except Exception:
  print("    (unparseable)"); raise SystemExit(0)
print("    success:", d.get("success"), "value:", (d.get("result") or {}).get("value"))
if d.get("errors"): print("    errors:", d.get("errors"))
' "$CUR" || true

echo "==> PATCH bot_fight_mode=off"
RESP=$(curl -sS -X PATCH "$SETTING_URL" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"value":"off"}' || true)

python3 -c 'import json,sys
resp=json.loads(sys.argv[1])
if resp.get("success"):
  val=(resp.get("result") or {}).get("value")
  print(f"✓ bot_fight_mode={val}")
  raise SystemExit(0 if val == "off" else 1)
print("Cloudflare API error:", json.dumps(resp.get("errors"), indent=2), file=sys.stderr)
print(
  "::warning::API cannot toggle bot_fight_mode (often dashboard-only on Free). "
  "Disable manually: Dashboard → cloudless.gr → Security → Bots → Bot Fight Mode OFF",
  file=sys.stderr,
)
raise SystemExit(0)
' "$RESP"

echo "==> done — re-check cron path for Just a moment…"
