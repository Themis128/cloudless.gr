#!/usr/bin/env bash
# Harden Cloudflare zone TLS for cloudless.gr:
#   - min_tls_version = 1.2
#   - Always Use HTTPS (idempotent)
#   - Zone HSTS matching app: max-age=63072000; includeSubDomains; preload; nosniff
#
# Auth: CLOUDFLARE_API_TOKEN with Zone Settings:Edit on cloudless.gr
# Usage:
#   CLOUDFLARE_API_TOKEN=… bash scripts/cf-zone-tls-harden.sh
#   bash scripts/cf-zone-tls-harden.sh --check   # report only
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

MIN_TLS=$(get_setting min_tls_version)
HSTS=$(get_setting security_header)
HTTPS=$(get_setting always_use_https)

python3 - <<'PY' "$MIN_TLS" "$HSTS" "$HTTPS"
import json, sys
min_tls = json.loads(sys.argv[1])
hsts = json.loads(sys.argv[2])
https = json.loads(sys.argv[3])
sts = ((hsts.get("result") or {}).get("value") or {}).get("strict_transport_security") or {}
print(f"  min_tls_version: {(min_tls.get('result') or {}).get('value')}")
print(f"  always_use_https: {(https.get('result') or {}).get('value')}")
print(f"  hsts.enabled: {sts.get('enabled')}")
print(f"  hsts.max_age: {sts.get('max_age')}")
print(f"  hsts.include_subdomains: {sts.get('include_subdomains')}")
print(f"  hsts.preload: {sts.get('preload')}")
print(f"  hsts.nosniff: {sts.get('nosniff')}")
PY

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  python3 - <<'PY' "$MIN_TLS" "$HSTS" "$HTTPS"
import json, sys
min_tls = (json.loads(sys.argv[1]).get("result") or {}).get("value")
sts = ((json.loads(sys.argv[2]).get("result") or {}).get("value") or {}).get("strict_transport_security") or {}
https = (json.loads(sys.argv[3]).get("result") or {}).get("value")
ok = (
  min_tls == "1.2"
  and https == "on"
  and sts.get("enabled") is True
  and sts.get("max_age") == 63072000
  and sts.get("include_subdomains") is True
  and sts.get("preload") is True
  and sts.get("nosniff") is True
)
print("✓ zone TLS posture OK" if ok else "✗ zone TLS posture DRIFT")
raise SystemExit(0 if ok else 1)
PY
  exit $?
fi

echo "==> PATCH min_tls_version=1.2"
patch_setting min_tls_version '{"value":"1.2"}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("success"), d; print("  →", (d.get("result") or {}).get("value"))'

echo "==> PATCH always_use_https=on"
patch_setting always_use_https '{"value":"on"}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("success"), d; print("  →", (d.get("result") or {}).get("value"))'

echo "==> PATCH security_header HSTS (63072000, includeSubDomains, preload, nosniff)"
patch_setting security_header '{"value":{"strict_transport_security":{"enabled":true,"max_age":63072000,"include_subdomains":true,"preload":true,"nosniff":true}}}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("success"), d; print("  →", (d.get("result") or {}).get("value"))'

echo "==> verify"
bash "$0" --check
echo "==> done"
