#!/usr/bin/env bash
#
# restore-auth.sh — restore Pi D1 authentication to a known-good working state.
#
# SYMPTOM this fixes:
#   - https://cloudless.gr/en/auth/login shows a 500 in the console
#   - POST /api/auth/login returns 500 {"error":"Login temporarily unavailable"}
#   - GET  /api/debug-db shows: "D1 HTTP query failed (401): Authentication error"
#
# ROOT CAUSE (first hit 2026-08-08):
#   The Pi Next app reaches Cloudflare D1 (user-auth-db) over the REST API and
#   needs TWO things right:
#     1. CLOUDFLARE_ACCOUNT_ID must be the account that OWNS user-auth-db
#        (fb7dc7…), NOT c6d6… (a different account → 401).
#     2. A VALID CLOUDFLARE_API_TOKEN.
#   Both must be set as EXPLICIT deployment env vars. Explicit `env` OVERRIDES
#   `envFrom: secretRef` (the cloudless-secrets Secret), so patching the Secret
#   alone does NOT work — the stale token in the deployment env keeps winning.
#   This script pins both via `kubectl set env`, which always wins.
#
# The known-good token is read from .env.local on THIS machine (never printed,
# never committed, never transmitted). D1 itself is essentially never the
# problem — it's always the Pi's creds.
#
# USAGE (run from the repo root, with kubectl pointed at the k3s cluster):
#   scripts/restore-auth.sh           # diagnose; repair only if broken
#   scripts/restore-auth.sh --check   # diagnose only, make NO changes
#   scripts/restore-auth.sh --force   # re-pin even if currently healthy
#
set -euo pipefail

# --- constants (stable; update only if the infra actually changes) ----------
NAMESPACE="cloudless"
DEPLOYMENT="cloudless-app"
ACCOUNT_ID="fb7dc7b69b662480cd5961a4d1913c78"   # account that owns user-auth-db
DB_ID="7ca74513-23c3-412a-b9ca-b0c55835973d"    # user-auth-db D1 database id
SITE="https://cloudless.gr"
ENV_FILE="${ENV_FILE:-.env.local}"

MODE="repair"
case "${1:-}" in
  --check) MODE="check" ;;
  --force) MODE="force" ;;
  "")      ;;
  *)       echo "unknown arg: $1 (use --check or --force)"; exit 2 ;;
esac

log()  { printf '\033[1m[restore-auth]\033[0m %s\n' "$*"; }
die()  { printf '\033[31m[restore-auth] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# --- 0. preconditions -------------------------------------------------------
command -v kubectl >/dev/null 2>&1 || die "kubectl not found / cluster not reachable"
command -v curl    >/dev/null 2>&1 || die "curl not found"
kubectl get "deployment/$DEPLOYMENT" -n "$NAMESPACE" >/dev/null 2>&1 \
  || die "deployment/$DEPLOYMENT not found in ns $NAMESPACE — is kubectl pointed at the k3s cluster?"

# --- 1. diagnose the live state ---------------------------------------------
# Returns 0 when D1 auth is healthy (dbConnected:true), 1 otherwise.
diagnose() {
  curl -sS --max-time 15 "$SITE/api/debug-db" 2>/dev/null | grep -q '"dbConnected":true'
}

log "Checking $SITE/api/debug-db ..."
if diagnose; then
  log "D1 auth is currently HEALTHY (dbConnected:true)."
  [ "$MODE" = "force" ] || { log "Nothing to do (use --force to re-pin anyway)."; exit 0; }
  log "--force given: re-pinning anyway."
else
  log "D1 auth is BROKEN (dbConnected:false / 401)."
  [ "$MODE" = "check" ] && { log "--check: no changes made."; exit 1; }
fi
[ "$MODE" = "check" ] && exit 0

# --- 2. load the known-good token from .env.local ---------------------------
[[ "$ENV_FILE" == */* ]] || ENV_FILE="./$ENV_FILE"
[ -f "$ENV_FILE" ] || die "$ENV_FILE not found (need CLOUDFLARE_API_TOKEN). Run from the repo root."
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
TOKEN="${CLOUDFLARE_API_TOKEN:-}"
[ -n "$TOKEN" ] || die "CLOUDFLARE_API_TOKEN is empty/unset in $ENV_FILE"

# --- 3. validate the token against D1 BEFORE pushing it ---------------------
log "Validating the $ENV_FILE token against D1 (account ${ACCOUNT_ID:0:8}…) ..."
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data '{"sql":"SELECT 1"}' \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query" 2>/dev/null || echo "000")
if [ "$code" != "200" ]; then
  die "The token in $ENV_FILE is NOT valid for D1 (HTTP $code).
       Mint a fresh D1-scoped token (Cloudflare dashboard → My Profile → API
       Tokens, D1:Edit on account fb7dc7…, or the cloudflare-token-doctor
       skill), put it in $ENV_FILE, then re-run this script."
fi
log "Token is valid (D1 query → 200)."

# --- 4. pin account + token as EXPLICIT deployment env (overrides the Secret) -
log "Pinning CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN on deployment/$DEPLOYMENT ..."
kubectl set env "deployment/$DEPLOYMENT" -n "$NAMESPACE" \
  "CLOUDFLARE_ACCOUNT_ID=$ACCOUNT_ID" \
  "CLOUDFLARE_API_TOKEN=$TOKEN" >/dev/null
log "Waiting for rollout ..."
kubectl rollout status "deployment/$DEPLOYMENT" -n "$NAMESPACE" --timeout=180s

# --- 5. verify end to end ----------------------------------------------------
log "Verifying D1 connection ..."
ok=0
for _ in $(seq 1 6); do diagnose && { ok=1; break; }; sleep 5; done
[ "$ok" = "1" ] || die "debug-db still not connected after rollout.
       Inspect: kubectl logs -n $NAMESPACE deploy/$DEPLOYMENT --tail=50"

lcode=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$SITE/api/auth/login" \
  -H 'Content-Type: application/json' \
  --data '{"email":"probe@example.com","password":"wrongpassword123"}' 2>/dev/null || echo "000")
if [ "$lcode" = "401" ]; then
  log "✅ AUTH RESTORED — dbConnected:true and /api/auth/login returns 401 for bad creds (was 500)."
else
  die "dbConnected:true but /api/auth/login returned $lcode (expected 401). Investigate."
fi
