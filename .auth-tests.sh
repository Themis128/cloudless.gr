#!/usr/bin/env bash
cd /home/tbaltzakis/code/cloudless.gr
echo "=== find auth tests ==="
find __tests__ -type f \( -name '*auth*' -o -name '*login*' -o -name '*cognito*' -o -name '*session*' \) 2>/dev/null
find e2e -type f \( -name '*auth*' -o -name '*login*' -o -name '*cognito*' \) 2>/dev/null | head -10
echo
echo "=== existing src auth files ==="
ls src/lib/auth* src/lib/api-auth* src/lib/cognito-* 2>/dev/null
echo
echo "=== run all auth-related unit tests ==="
pnpm test:ci --reporter=dot __tests__/ -t auth 2>&1 | grep -E '(Test Files|Tests|PASS|FAIL|describe)' | head -10
echo
echo "=== OIDC discovery via the correct Cognito IDP endpoint ==="
POOL_ID=$(curl -s https://cloudless.gr/api/health.json 2>/dev/null | jq -r .pool 2>/dev/null)
# Check both common pool IDs from CLAUDE.md / scripts/etl
for POOL in us-east-1_1Bq3Mpqer; do
  URL="https://cognito-idp.us-east-1.amazonaws.com/$POOL/.well-known/openid-configuration"
  printf '  %s\n' "$URL"
  curl -s -o /tmp/oidc.json -w '    HTTP %{http_code}\n' "$URL"
  jq -r '"      issuer=" + .issuer, "      jwks=" + .jwks_uri' /tmp/oidc.json 2>&1 | head -2
  JWKS=$(jq -r .jwks_uri /tmp/oidc.json 2>/dev/null)
  if [ -n "$JWKS" ] && [ "$JWKS" != "null" ]; then
    curl -s -o /tmp/jwks.json -w '      jwks HTTP %{http_code}, ' "$JWKS"
    jq -r '"keys=" + (.keys|length|tostring)' /tmp/jwks.json 2>&1
  fi
done
rm -f /tmp/oidc.json /tmp/jwks.json .auth-tests.sh
