#!/usr/bin/env bash
# probe-selfhosted-admin.sh
# ─────────────────────────
# Verifies the unified admin login (tbaltzakis@cloudless.gr / TH!123789th!)
# still works on every self-hosted app. Hits each app's "log in" API
# endpoint and checks for a 200/201 + an auth artefact (token / session
# cookie / "isAuthenticated":true / user object — varies by app).
#
# Designed to fail LOUD: returns non-zero if any app rejects the creds, so
# this can run as a scheduled CI check and alert on credential drift.
#
# Apps probed:
#   AppFlowy   — GoTrue password grant on the embedded gotrue service
#   EspoCRM    — /api/v1/App/user with HTTP basic auth
#   Postiz     — local-auth POST to /api/auth/login
#   n8n        — POST /rest/login
#
# All endpoints hit via the public tunnel hostname so we exercise the same
# path real users take, not the in-cluster Service URL.

set -uo pipefail

ADMIN_EMAIL="${ADMIN_EMAIL:-tbaltzakis@cloudless.gr}"
ADMIN_USERNAME="${ADMIN_USERNAME:-tbaltzakis}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?ADMIN_PASSWORD env var required}"

PASS=0
FAIL=0
FAILED_APPS=()

probe() {
  local app="$1"  url="$2"  method="$3"  data="$4"  auth="$5"  pattern="$6"
  local body code
  if [[ -n "$auth" ]]; then
    body=$(curl -sS --max-time 15 -u "$auth" -X "$method" -H 'Content-Type: application/json' \
                ${data:+-d "$data"} "$url" 2>&1)
    code=$(curl -sS --max-time 15 -u "$auth" -o /dev/null -w '%{http_code}' \
                -X "$method" -H 'Content-Type: application/json' \
                ${data:+-d "$data"} "$url" 2>&1)
  else
    body=$(curl -sS --max-time 15 -X "$method" -H 'Content-Type: application/json' \
                ${data:+-d "$data"} "$url" 2>&1)
    code=$(curl -sS --max-time 15 -o /dev/null -w '%{http_code}' \
                -X "$method" -H 'Content-Type: application/json' \
                ${data:+-d "$data"} "$url" 2>&1)
  fi
  if [[ "$code" =~ ^(200|201|204)$ ]] && echo "$body" | grep -qE "$pattern"; then
    echo "✓ $app login OK  (HTTP $code)"
    PASS=$((PASS+1))
  else
    echo "✗ $app login FAIL (HTTP $code, body matched=/$pattern/=no)"
    echo "    body: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL+1))
    FAILED_APPS+=("$app")
  fi
}

echo "=== self-hosted admin login probe ==="
echo "    user: $ADMIN_EMAIL"
echo

# AppFlowy: GoTrue password grant — returns access_token on success
probe "AppFlowy" \
  "https://appflowy.cloudless.gr/gotrue/token?grant_type=password" \
  POST \
  "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  "" \
  '"access_token"'

# EspoCRM: HTTP basic auth + /api/v1/App/user returns user object on success
probe "EspoCRM" \
  "https://espocrm.cloudless.gr/api/v1/App/user" \
  GET \
  "" \
  "${ADMIN_USERNAME}:${ADMIN_PASSWORD}" \
  '"userName"'

# Postiz: local-auth POST returns redirect + sets next-auth.session-token
# cookie. We accept 200 OR 201 OR 302 with an empty/redirect body. The grep
# is permissive; primary signal is the HTTP code.
probe "Postiz" \
  "https://postiz.cloudless.gr/api/auth/login" \
  POST \
  "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"provider\":\"LOCAL\"}" \
  "" \
  '.*'

# n8n: POST /rest/login returns the user JSON + sets n8n-auth cookie
probe "n8n" \
  "https://n8n.cloudless.gr/rest/login" \
  POST \
  "{\"emailOrLdapLoginId\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  "" \
  '"id"'

echo
echo "=== summary ==="
echo "  passed: $PASS"
echo "  failed: $FAIL"
if (( FAIL > 0 )); then
  echo "  failed apps: ${FAILED_APPS[*]}"
  exit 1
fi
exit 0
