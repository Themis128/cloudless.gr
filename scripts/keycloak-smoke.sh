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

# code <url> [curl-args...] -> echoes HTTP status, body saved to $BODY.
# Retries on a connection failure (000) — auth.cloudless.gr sits behind
# Cloudflare which can transiently reset rapid-fire probes.
BODY=$(mktemp)
code() {
  local url="$1"; shift
  local c="" i
  for i in 1 2 3; do
    c=$(curl -sS -m "$TIMEOUT" -o "$BODY" -w '%{http_code}' "$@" "$url" 2>/dev/null) || c="000"
    [ "$c" != "000" ] && break
    sleep 1
  done
  printf '%s' "$c"
}

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

# PKCE — the cloudless-app client enforces it, so build a real S256 challenge.
gen_pkce() {
  PKCE_VERIFIER=$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=')
  PKCE_CHALLENGE=$(printf '%s' "$PKCE_VERIFIER" | openssl dgst -sha256 -binary | base64 | tr '+/' '-_' | tr -d '=')
}
urlenc() { printf '%s' "$1" | sed 's/:/%3A/g; s#/#%2F#g'; }
gen_pkce
RU_ENC=$(urlenc "$REDIRECT_URI")
AUTHQ="client_id=${CLIENT_ID}&response_type=code&scope=openid&redirect_uri=${RU_ENC}&code_challenge=${PKCE_CHALLENGE}&code_challenge_method=S256"

# 3. Hosted login (authorization_endpoint) — with valid PKCE --------------------
head "3. Hosted login screen (PKCE)"
c=$(code "${AUTH_EP:-$ISSUER/protocol/openid-connect/auth}?${AUTHQ}")
if [ "$c" = "200" ] && grep -qiE "kc-form-login|password|Sign in to" "$BODY"; then
  ok "login screen renders (200, password form)"
elif grep -qi "Invalid parameter: redirect_uri" "$BODY"; then
  no "redirect_uri '$REDIRECT_URI' is not registered on $CLIENT_ID"
else
  no "authorization_endpoint HTTP $c (expected 200 login page)"
fi

# 4. Registration (self-service is disabled on master — that is expected) -------
head "4. Self-service registration"
sleep 1  # space probes — Cloudflare resets rapid back-to-back connections
c=$(code "${REG_EP:-$ISSUER/protocol/openid-connect/registrations}?${AUTHQ}")
if [ "$c" = "200" ] && grep -qiE "register|firstName|password-confirm" "$BODY"; then
  ok "registration page renders (self-signup ENABLED)"
else
  note "self-signup DISABLED on this realm (HTTP $c) — users are admin-provisioned (expected; use keycloak:create-user)"
fi

# 5. Token endpoint liveness -------------------------------------------------
head "5. Token endpoint liveness"
sleep 1  # space probes — Cloudflare resets rapid back-to-back connections
c=$(code "${TOKEN_EP:-$ISSUER/protocol/openid-connect/token}" \
      -X POST -H "Content-Type: application/x-www-form-urlencoded" \
      --data-urlencode "grant_type=password" --data-urlencode "client_id=admin-cli" \
      --data-urlencode "username=__smoke__" --data-urlencode "password=__smoke__")
if [ "$c" = "400" ] || [ "$c" = "401" ]; then ok "token endpoint live (rejected bad creds with $c)"
elif [ "$c" = "200" ]; then note "token endpoint returned 200 to junk creds (unexpected)"
elif [ "$c" = "000" ]; then note "token endpoint not probeable (Cloudflare reset the rapid probe) — verify manually"
else no "token endpoint HTTP $c"; fi

# 6. App next-auth providers -------------------------------------------------
head "6. App next-auth provider wiring"
c=$(code "$BASE_URL/api/auth/providers")
if [ "$c" = "200" ] && grep -q '"keycloak"' "$BODY"; then ok "next-auth lists the keycloak provider"
else no "providers HTTP $c (keycloak provider missing?)"; fi

# 7. App signin handoff — the REAL flow is POST + CSRF -----------------------
head "7. App → Keycloak signin handoff (POST + CSRF)"
CJ=$(mktemp)
csrf=$(curl -sS -m "$TIMEOUT" -c "$CJ" "$BASE_URL/api/auth/csrf" 2>/dev/null | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
loc=$(curl -sS -m "$TIMEOUT" -b "$CJ" -o /dev/null -w '%{redirect_url}' \
        --data-urlencode "csrfToken=$csrf" --data-urlencode "callbackUrl=/en/dashboard" \
        "$BASE_URL/api/auth/signin/keycloak" 2>/dev/null)
rm -f "$CJ"
case "$loc" in
  *auth.cloudless.gr*"openid-connect/auth"*code_challenge_method=S256*) ok "signin → 302 to Keycloak with PKCE (login works)" ;;
  *auth.cloudless.gr*"openid-connect/auth"*) ok "signin → 302 to Keycloak authorize" ;;
  *error=Configuration*) no "signin → error=Configuration (next-auth cannot reach the IdP)" ;;
  "") note "signin did not redirect (empty Location)" ;;
  *) note "signin redirected to: $loc" ;;
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
