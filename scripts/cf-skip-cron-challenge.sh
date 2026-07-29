#!/usr/bin/env bash
# Skip Cloudflare managed challenges for /api/cron/* so GitHub Actions cron
# workflows (linkedin-poll, postiz-crons, platform-crons) can authenticate with
# Bearer CRON_SECRET instead of receiving a "Just a moment…" interstitial.
#
# Auth: CLOUDFLARE_API_TOKEN (Zone → Firewall Services Edit + Zone Read).
# Zone: CLOUDFLARE_ZONE_ID / CF_ZONE_ID, else resolve DOMAIN (default cloudless.gr).
# Idempotent: replaces the rule with the same description if present.
set -euo pipefail

DOMAIN="${DOMAIN:-cloudless.gr}"
ZONE_ID="${CLOUDFLARE_ZONE_ID:-${CF_ZONE_ID:-}}"
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
RULE_DESC="Skip Bot Fight / Managed Challenge for /api/cron/* (GHA crons)"
EXPRESSION='(starts_with(http.request.uri.path, "/api/cron/"))'
API="https://api.cloudflare.com/client/v4"

if [[ -z "$TOKEN" ]]; then
  echo "::error::CLOUDFLARE_API_TOKEN is required (Zone:Read + Zone → Firewall Services:Edit)"
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

ENTRY="${API}/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint"
echo "==> fetching custom firewall entrypoint"
CURRENT="$(cf GET "$ENTRY" || true)"

PAYLOAD_FILE="$(mktemp)"
python3 - "$CURRENT" "$RULE_DESC" "$EXPRESSION" <<'PY' > "$PAYLOAD_FILE"
import json, sys

raw, desc, expression = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    data = json.loads(raw) if raw.strip() else {}
except json.JSONDecodeError:
    data = {}

result = data.get("result") or {}
ruleset_id = result.get("id") or ""
existing = list(result.get("rules") or [])

new_rule = {
    "action": "skip",
    "description": desc,
    "enabled": True,
    "expression": expression,
    "action_parameters": {
        # Skip managed WAF + Super Bot Fight Mode phases that emit
        # "Just a moment…" challenge pages for datacenter IPs (GHA runners).
        "phases": [
            "http_request_firewall_managed",
            "http_request_sbfm",
        ],
        "products": [
            "bic",
            "hot",
            "rateLimit",
            "securityLevel",
            "uaBlock",
            "waf",
            "zoneLockdown",
        ],
    },
}

out = []
replaced = False
for r in existing:
    if r.get("description") == desc:
        if "id" in r:
            new_rule = {**new_rule, "id": r["id"]}
        out.append(new_rule)
        replaced = True
    else:
        out.append(r)
if not replaced:
    out.append(new_rule)

json.dump({"rules": out, "_ruleset_id": ruleset_id}, sys.stdout)
PY

RULESET_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("_ruleset_id",""))' "$PAYLOAD_FILE")"
python3 -c 'import json,sys; p=json.load(open(sys.argv[1])); p.pop("_ruleset_id", None); json.dump(p, open(sys.argv[1],"w"))' "$PAYLOAD_FILE"

if [[ -n "$RULESET_ID" ]]; then
  echo "==> updating ruleset ${RULESET_ID}"
  RESP="$(cf PUT "${API}/zones/${ZONE_ID}/rulesets/${RULESET_ID}" "$(cat "$PAYLOAD_FILE")")"
else
  echo "==> creating custom firewall entrypoint"
  RESP="$(cf PUT "$ENTRY" "$(cat "$PAYLOAD_FILE")")"
fi
rm -f "$PAYLOAD_FILE"

python3 - "$RESP" "$RULE_DESC" <<'PY'
import json, sys
resp = json.loads(sys.argv[1])
desc = sys.argv[2]
if not resp.get("success"):
    print("Cloudflare API error:", json.dumps(resp.get("errors"), indent=2), file=sys.stderr)
    sys.exit(1)
rules = (resp.get("result") or {}).get("rules") or []
match = [r for r in rules if r.get("description") == desc]
if not match:
    print("Rule not found after update", file=sys.stderr)
    sys.exit(1)
r = match[0]
print(f"✓ rule id={r.get('id')} enabled={r.get('enabled')}")
print(f"  expression={r.get('expression')}")
PY

echo "==> done"
