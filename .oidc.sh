#!/usr/bin/env bash
URL="https://cognito-idp.us-east-1.amazonaws.com/us-east-1_1Bq3Mpqer/.well-known/openid-configuration"
echo "  $URL"
curl -s -o /tmp/o.json -w "    HTTP %{http_code}  ttotal=%{time_total}s\n" "$URL"
jq -r '"    issuer  = " + .issuer, "    jwks    = " + .jwks_uri, "    authz   = " + .authorization_endpoint, "    token   = " + .token_endpoint' /tmp/o.json 2>&1 | head -4
JWKS=$(jq -r .jwks_uri /tmp/o.json 2>/dev/null)
if [ -n "$JWKS" ] && [ "$JWKS" != "null" ]; then
  curl -s -o /tmp/j.json -w "    jwks HTTP %{http_code}, " "$JWKS"
  jq -r '"keys=" + (.keys|length|tostring)' /tmp/j.json 2>&1
fi
rm -f /tmp/o.json /tmp/j.json .oidc.sh .login-test.sh .login-test2.sh .auth-tests.sh
