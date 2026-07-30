#!/usr/bin/env bash
# Harden Cloudflare Free-plan WAF / Security posture for cloudless.gr:
#   - security_level = medium  (was essentially_off)
#   - browser_check = on
#   - email_obfuscation = off  (intentional — CF rewrite breaks React #418)
#
# Bot Fight Mode is dashboard-only on Free (API setting undefined). Keep it
# OFF so GHA can hit apex when needed; cron workflows already use
# pi-origin.cloudless.gr to bypass edge challenges.
#
# Rulesets / Firewall Services require Zone → Firewall Services → Read/Edit
# on the API token. This script reports that gap; it does not mint tokens.
#
# Auth: CLOUDFLARE_API_TOKEN with Zone Settings:Edit
# Usage:
#   CLOUDFLARE_API_TOKEN=… bash scripts/cf-zone-waf-harden.sh
#   bash scripts/cf-zone-waf-harden.sh --check
set -euo pipefail

DOMAIN="${DOMAIN:-cloudless.gr}"
ZONE_ID="${CLOUDFLARE_ZONE_ID:-${CF_ZONE_ID:-7025298073d6a5c645a6ad9add0cbf0e}}"
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
API="https://api.cloudflare.com/client/v4"
CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

if [[ -z "$TOKEN" ]]; then
  echo "error: CLOUDFLARE_API_TOKEN is required (Zone Settings:Edit)" >&2
  exit 1
fi

auth=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")

get_setting() {
  curl -fsS "${auth[@]}" "${API}/zones/${ZONE_ID}/settings/$1"
}

patch_setting() {
  local id="$1" body="$2"
  curl -fsS -X PATCH "${auth[@]}" "${API}/zones/${ZONE_ID}/settings/${id}" --data "$body"
}

echo "==> zone ${DOMAIN} (${ZONE_ID})"

SEC=$(get_setting security_level)
BC=$(get_setting browser_check)
EO=$(get_setting email_obfuscation)

python3 - <<'PY' "$SEC" "$BC" "$EO"
import json, sys
sec = (json.loads(sys.argv[1]).get("result") or {}).get("value")
bc = (json.loads(sys.argv[2]).get("result") or {}).get("value")
eo = (json.loads(sys.argv[3]).get("result") or {}).get("value")
print(f"  security_level: {sec}")
print(f"  browser_check: {bc}")
print(f"  email_obfuscation: {eo}")
PY

echo "==> rulesets probe (needs Zone Firewall Services)"
RS=$(curl -sS "${auth[@]}" "${API}/zones/${ZONE_ID}/rulesets" || true)
python3 - <<'PY' "$RS"
import json, sys
raw = sys.argv[1]
try:
  d = json.loads(raw)
except Exception:
  print("  rulesets: unparseable response"); raise SystemExit(0)
if d.get("success"):
  print(f"  rulesets: OK ({len(d.get('result') or [])} entries)")
else:
  errs = d.get("errors") or []
  print(f"  rulesets: DENIED — {errs}")
  print("  → mint token with Zone → Firewall Services → Read (and Edit to manage rules)")
  print("  → see skills/cloudflare-token-doctor/SKILL.md Stage 1")
PY

echo "==> bot_fight_mode probe (Free: often undefined / dashboard-only)"
BF=$(curl -sS "${auth[@]}" "${API}/zones/${ZONE_ID}/settings/bot_fight_mode" || true)
python3 - <<'PY' "$BF"
import json, sys
try:
  d = json.loads(sys.argv[1])
except Exception:
  print("  bot_fight_mode: unparseable"); raise SystemExit(0)
if d.get("success"):
  print(f"  bot_fight_mode: {(d.get('result') or {}).get('value')}")
else:
  print(f"  bot_fight_mode: not API-readable — {(d.get('errors') or [])}")
  print("  → Dashboard → Security → Bots: leave Bot Fight Mode OFF (cron/GHA)")
PY

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  python3 - <<'PY' "$SEC" "$BC" "$EO"
import json, sys
sec = (json.loads(sys.argv[1]).get("result") or {}).get("value")
bc = (json.loads(sys.argv[2]).get("result") or {}).get("value")
eo = (json.loads(sys.argv[3]).get("result") or {}).get("value")
ok = sec == "medium" and bc == "on" and eo == "off"
print("✓ zone WAF posture OK" if ok else "✗ zone WAF posture DRIFT")
raise SystemExit(0 if ok else 1)
PY
  exit $?
fi

echo "==> PATCH security_level=medium"
patch_setting security_level '{"value":"medium"}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("success"), d; print("  →", (d.get("result") or {}).get("value"))'

echo "==> PATCH browser_check=on"
patch_setting browser_check '{"value":"on"}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("success"), d; print("  →", (d.get("result") or {}).get("value"))'

echo "==> PATCH email_obfuscation=off"
patch_setting email_obfuscation '{"value":"off"}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("success"), d; print("  →", (d.get("result") or {}).get("value"))'

echo "==> verify"
bash "$0" --check
echo "==> done"
