#!/usr/bin/env bash
set -uo pipefail
COG="https://cloudless-auth.auth.us-east-1.amazoncognito.com"
echo "--- Cognito hosted UI reachability ($COG) ---"
curl -s -o /tmp/cog.json -w 'HTTP %{http_code}  ttotal=%{time_total}s\n' "$COG/.well-known/openid-configuration"
echo "  fields:"
jq -r '"    issuer=" + .issuer, "    authorization_endpoint=" + .authorization_endpoint, "    token_endpoint=" + .token_endpoint, "    jwks_uri=" + .jwks_uri' /tmp/cog.json 2>&1 | head -5
echo
echo "--- JWKS reachability ---"
JWKS=$(jq -r .jwks_uri /tmp/cog.json 2>/dev/null)
curl -s -o /tmp/jwks.json -w 'HTTP %{http_code}  ttotal=%{time_total}s\n' "$JWKS"
echo "  keys count:"
jq -r '"    " + (.keys | length | tostring) + " keys"' /tmp/jwks.json 2>&1

echo
echo "--- /api/auth/csrf returns Set-Cookie correctly ---"
curl -s -D - -o /dev/null "https://cloudless.gr/api/auth/csrf" 2>&1 | grep -iE 'set-cookie|HTTP/' | head -6

echo
echo "--- Direct hit on Cognito /oauth2/authorize (sample request) ---"
curl -s -o /dev/null -w 'HTTP %{http_code}\n' "$COG/oauth2/authorize?response_type=code&client_id=31iek3vteo5di9us6gi2h9tvbp&redirect_uri=https%3A%2F%2Fcloudless.gr%2Fapi%2Fauth%2Fcallback%2Fcognito&scope=openid+profile+email&state=test"

rm -f /tmp/cog.json /tmp/jwks.json .login-test2.sh
