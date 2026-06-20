#!/usr/bin/env bash
set -uo pipefail
SITE=${SITE:-https://cloudless.gr}
COOKIE=/tmp/login-test-cookies.txt
rm -f "$COOKIE"

echo "================================================================"
echo "  LIVE LOGIN PROCESS TEST — $SITE"
echo "================================================================"

# 1. /api/health (cheapest reachability + APP_VERSION sanity)
echo
echo "--- 1. /api/health (sanity) ---"
curl -s -o /tmp/h.json -w 'HTTP %{http_code}  ttotal=%{time_total}s\n' "$SITE/api/health"
cat /tmp/h.json; echo

# 2. /api/auth/providers — should list cognito
echo
echo "--- 2. /api/auth/providers ---"
curl -s -o /tmp/p.json -w 'HTTP %{http_code}  ttotal=%{time_total}s\n' "$SITE/api/auth/providers"
cat /tmp/p.json | head -c 600; echo

# 3. /api/auth/session (anonymous) — should return {} or empty user
echo
echo "--- 3. /api/auth/session (anonymous) ---"
curl -s -c "$COOKIE" -b "$COOKIE" -o /tmp/s.json -w 'HTTP %{http_code}  ttotal=%{time_total}s\n' "$SITE/api/auth/session"
cat /tmp/s.json; echo

# 4. /api/auth/csrf — required for next-auth signin POST
echo
echo "--- 4. /api/auth/csrf (sets csrf cookie) ---"
curl -s -c "$COOKIE" -b "$COOKIE" -o /tmp/c.json -w 'HTTP %{http_code}  ttotal=%{time_total}s\n' "$SITE/api/auth/csrf"
cat /tmp/c.json | head -c 200; echo
echo "  cookies after csrf:"
grep -E 'next-auth|authjs' "$COOKIE" 2>/dev/null | awk '{print "    " $6 "=" substr($7,1,20)}'

# 5. GET /api/auth/signin/cognito — should 302 to Cognito Hosted UI
echo
echo "--- 5. /api/auth/signin/cognito (GET, expect 302 → Cognito) ---"
curl -s -c "$COOKIE" -b "$COOKIE" -o /dev/null -w 'HTTP %{http_code}  redirect=%{redirect_url}\n' "$SITE/api/auth/signin/cognito"

# 6. POST to signin with csrf token (proper next-auth start)
echo
echo "--- 6. POST /api/auth/signin/cognito with CSRF (next-auth start) ---"
CSRF=$(jq -r '.csrfToken // empty' /tmp/c.json 2>/dev/null)
if [ -n "$CSRF" ]; then
  curl -s -c "$COOKIE" -b "$COOKIE" -o /dev/null \
    -w 'HTTP %{http_code}  redirect=%{redirect_url}\n' \
    -X POST "$SITE/api/auth/signin/cognito" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "csrfToken=$CSRF" \
    --data-urlencode "callbackUrl=$SITE/admin" \
    --data-urlencode "json=true"
else
  echo "  (no CSRF — skipping POST)"
fi

# 7. Admin route — must reject without auth (401/403/302)
echo
echo "--- 7. /admin (unauthed) — must NOT serve content ---"
curl -s -o /dev/null -w 'HTTP %{http_code}  redirect=%{redirect_url}\n' -L --max-redirs 2 "$SITE/admin"
curl -s -o /dev/null -w 'GET /en/admin  HTTP %{http_code}  redirect=%{redirect_url}\n' "$SITE/en/admin"

# 8. Admin API route — must 401
echo
echo "--- 8. /api/admin/users (unauthed) — must 401 ---"
curl -s -o /tmp/a.json -w 'HTTP %{http_code}\n' "$SITE/api/admin/users"
cat /tmp/a.json | head -c 200; echo

# 9. Cognito hosted UI reachability
echo
echo "--- 9. Cognito hosted-UI well-known + JWKS ---"
ISS=$(jq -r '.cognito.issuer // empty' /tmp/p.json 2>/dev/null)
if [ -z "$ISS" ]; then
  # next-auth providers shape may differ — try .cognito.signinUrl + derive host
  ISS=$(jq -r '.cognito.signinUrl // empty' /tmp/p.json 2>/dev/null | sed -E 's|/api/auth/signin/cognito||')
fi
echo "  derived issuer: ${ISS:-<unknown — check providers payload>}"
# Try the standard Cognito hosted-UI well-known
for cand in "https://cloudless.auth.us-east-1.amazoncognito.com" "https://auth.cloudless.gr"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$cand/.well-known/openid-configuration")
  printf '    %-50s OIDC well-known → HTTP %s\n' "$cand" "$code"
done

rm -f /tmp/h.json /tmp/p.json /tmp/s.json /tmp/c.json /tmp/a.json /tmp/cookies.txt
rm -f .login-test.sh
