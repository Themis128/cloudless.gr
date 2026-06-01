#!/usr/bin/env bash
#
# keycloak-smoke.sh — read-only, credential-free smoke test of the live
# login + registration surface for cloudless.gr.
#
# Verifies, end to end, that the Keycloak IdP and the next-auth handoff are
# healthy enough for a user to log in and to register:
#
#   1. OIDC discovery document                 (realm is up)
#   2. JWKS endpoint                           (token signature keys served)
#   3. authorization_endpoint / hosted login   (login screen renders)
#   4. registration endpoint                   (self-service signup enabled)
#   5. token endpoint liveness                 (accepts grants — 400 on bad input)
#   6. app next-auth providers                 (keycloak provider wired)
#   7. app signin handoff                      (302 to Keycloak, NOT error=Configuration)
#
# No admin password or browser needed — every check is an unauthenticated HTTP
# probe, so it is safe to run from CI, a laptop, or a cloud session.
#
# Usage:
#   bash scripts/keycloak-smoke.sh                 # defaults to production
#   ISSUER=https://auth.cloudless.gr/realms/master \
#   BASE_URL=https://cloudless.gr \
#   CLIENT_ID=cloudless-app  bash scripts/keycloak-smoke.sh
#
# Exit code: 0 if all critical checks pass, 1 otherwise.

set -uo pipefail

ISSUER="${ISSUER:-https://auth.cloudless.gr/realms/master}"
BASE_URL="${BASE_URL:-https://cloudless.gr}"
CLIENT_ID="${CLIENT_ID:-cloudless-app}"
REDIRECT_URI="${REDIRECT_URI:-${BASE_URL}/api/auth/callback/keycloak}"
TIMEOUT="${TIMEOUT:-10}"

pass=0; fail=0; warn=0
ok()   { printf "  \033[1;32m✓\033[0m %s\n" "$*"; pass=$((pass+1)); }
no()   { printf "  \033[1;31m✗\033[0m %s\n" "$*"; fail=$((fail+1)); }
note() { printf "  \033[1;33m!\033[0m %s\n" "$*"; warn=$((warn+1)); }
head() { printf "\n\033[1m%s\033[0m\n" "$*"; }

# code <url> [curl-args...] -> echoes HTTP status, body saved to $BODY
BODY=$(mktemp)
code() { local url="$1"; shift; curl -sS -m "$TIMEOUT" -o "$BODY" -w '%{http_code}' "$@" "$url" 2>/dev/null || echo 000; }

head "Keycloak smoke test"
printf "  issuer:    %s\n  app:       %s\n  client_id: %s\n" "$ISSUER" "$BASE_URL" "$CLIENT_ID"

# 1. OIDC discovery ----------------------------------------------------------
head "1. OIDC discovery"
c=$(code "$ISSUER/.well-known/openid-configuration")
if [ "$c" = "200" ]; then
  AUTH_EP=$(grep -o '"authorization_endpoint":"[^"]*"' "$BODY" | cut -d'"' -f4)
  TOKEN_EP=$(grep -o '"token_endpoint":"[^"]*"'         "$BODY" | cut -d'"' -f4)
  JWKS_EP=$(grep -o '"jwks_uri":"[^"]*"'                "$BODY" | cut -d'"' -f4)
  REG_EP=$(grep -o '"registration_endpoint":"[^"]*"'    "$BODY" | cut -d'"' -f4)
  ok "discovery 200 (issuer reachable)"
else
  no "discovery HTTP $c — realm is DOWN (login & registration impossible)"
  echo; printf "Result: \033[1;31mFAIL\033[0m — Keycloak unreachable. Aborting remaining checks.\n"
  rm -f "$BODY"; exit 1
fi

# 2. JWKS --------------------------------------------------------------------
head "2. JWKS (token signing keys)"
c=$(code "${JWKS_EP:-$ISSUER/protocol/openid-connect/certs}")
if [ "$c" = "200" ] && grep -q '"keys"' "$BODY"; then ok "JWKS 200 with keys"; else no "JWKS HTTP $c"; fi

# 3. Hosted login (authorization_endpoint) -----------------------------------
head "3. Hosted login screen"
login_url="${AUTH_EP:-$ISSUER/protocol/openid-connect/auth}?client_id=${CLIENT_ID}&response_type=code&scope=openid&redirect_uri=$(printf '%s' "$REDIRECT_URI" | sed 's/:/%3A/g; s#/#%2F#g')"
c=$(code "$login_url")
if [ "$c" = "200" ]; then
  if grep -qiE "kc-form-login|password|Sign in|Invalid parameter: redirect_uri" "$BODY"; then
    if grep -qi "Invalid parameter: redirect_uri" "$BODY"; then
      note "login renders but redirect_uri '$REDIRECT_URI' is not registered on $CLIENT_ID"
    else
      ok "login screen renders (200, password form present)"
    fi
  else ok "authorization_endpoint 200"; fi
else no "authorization_endpoint HTTP $c"; fi

# 4. Registration ------------------------------------------------------------
head "4. Self-service registration"
reg_url="${REG_EP:-$ISSUER/protocol/openid-connect/registrations}?client_id=${CLIENT_ID}&response_type=code&scope=openid&redirect_uri=$(printf '%s' "$REDIRECT_URI" | sed 's/:/%3A/g; s#/#%2F#g')"
c=$(code "$reg_url")
if [ "$c" = "200" ]; then
  if grep -qiE "register|firstName|user.attributes|password-confirm" "$BODY"; then
    ok "registration page renders (signup enabled)"
  else ok "registration endpoint 200"; fi
elif [ "$c" = "400" ] || [ "$c" = "403" ]; then
  note "registration endpoint HTTP $c — self-registration may be disabled on the realm"
else no "registration endpoint HTTP $c"; fi

# 5. Token endpoint liveness -------------------------------------------------
head "5. Token endpoint liveness"
# Bad grant on purpose: a live endpoint answers 400/401 JSON, a dead one 5xx/000.
c=$(code "${TOKEN_EP:-$ISSUER/protocol/openid-connect/token}" \
      -X POST -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=password&client_id=${CLIENT_ID}&username=__smoke__&password=__smoke__")
if [ "$c" = "400" ] || [ "$c" = "401" ]; then ok "token endpoint live (rejected bad creds with $c)"
elif [ "$c" = "200" ]; then note "token endpoint returned 200 to junk creds (unexpected)"
else no "token endpoint HTTP $c"; fi

# 6. App next-auth providers -------------------------------------------------
head "6. App next-auth provider wiring"
c=$(code "$BASE_URL/api/auth/providers")
if [ "$c" = "200" ] && grep -q '"keycloak"' "$BODY"; then ok "next-auth lists the keycloak provider"
else no "providers HTTP $c (keycloak provider missing?)"; fi

# 7. App signin handoff ------------------------------------------------------
head "7. App → Keycloak signin handoff"
loc=$(curl -sS -m "$TIMEOUT" -o /dev/null -w '%{redirect_url}' "$BASE_URL/api/auth/signin/keycloak" 2>/dev/null)
case "$loc" in
  *auth.cloudless.gr*|*"/protocol/openid-connect/auth"*) ok "signin/keycloak redirects to Keycloak" ;;
  *error=Configuration*) no "signin/keycloak → error=Configuration (next-auth can't reach the IdP)" ;;
  "") note "signin/keycloak did not redirect (got empty Location)" ;;
  *) note "signin/keycloak redirected to: $loc" ;;
esac

# Summary --------------------------------------------------------------------
rm -f "$BODY"
head "Summary"
printf "  passed: %d   failed: %d   warnings: %d\n" "$pass" "$fail" "$warn"
if [ "$fail" -eq 0 ]; then
  printf "Result: \033[1;32mPASS\033[0m — login and registration paths are live.\n"; exit 0
else
  printf "Result: \033[1;31mFAIL\033[0m — %d critical check(s) failed.\n" "$fail"; exit 1
fi
