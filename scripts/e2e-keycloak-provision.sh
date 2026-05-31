#!/usr/bin/env bash
#
# Provision two Keycloak test users for the E2E suite:
#   e2e-user@cloudless.gr   — regular user (no admin group)
#   e2e-admin@cloudless.gr  — member of "admin" group, so isAdmin() returns true
#
# Reads Keycloak admin password interactively (or KEYCLOAK_ADMIN_PASSWORD env).
# Writes the resulting credentials into .env.e2e so Playwright picks them up.
#
# Idempotent: if a user already exists, only resets the password and group membership.
#
# Usage:
#   bash scripts/e2e-keycloak-provision.sh                  # interactive
#   KEYCLOAK_ADMIN_PASSWORD=... bash scripts/e2e-keycloak-provision.sh
#   bash scripts/e2e-keycloak-provision.sh --dry-run        # show what would happen
#
# Required env (auto-loaded from .env.local):
#   KEYCLOAK_ISSUER        — e.g. https://auth.cloudless.gr/realms/master
#   KEYCLOAK_ADMIN_CLIENT_ID — usually "admin-cli"

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.e2e"
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '1,30p' "$0"; exit 0 ;;
  esac
done

log()  { printf "\033[1;36m[kc]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[kc]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[kc]\033[0m %s\n" "$*" >&2; }

# ─── load Keycloak config from .env.local ────────────────────
if [ -f "$REPO_ROOT/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_ROOT/.env.local"
  set +a
fi

KEYCLOAK_ISSUER="${KEYCLOAK_ISSUER:-https://auth.cloudless.gr/realms/master}"
KEYCLOAK_ADMIN_CLIENT_ID="${KEYCLOAK_ADMIN_CLIENT_ID:-admin-cli}"

# Derive base URL + realm
REALM="${KEYCLOAK_ISSUER##*/realms/}"
BASE_URL="${KEYCLOAK_ISSUER%/realms/*}"
ADMIN_API="$BASE_URL/admin/realms/$REALM"
TOKEN_URL="$KEYCLOAK_ISSUER/protocol/openid-connect/token"

log "Realm:    $REALM"
log "Base:     $BASE_URL"
log "Client:   $KEYCLOAK_ADMIN_CLIENT_ID"

# ─── prompt for admin credentials ────────────────────────────
KEYCLOAK_ADMIN_USERNAME="${KEYCLOAK_ADMIN_USERNAME:-admin}"
SSM_PREFIX="${SSM_PREFIX:-/cloudless/production}"
AWS_REGION_FOR_SSM="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"

# Try AWS SSM first
if [ -z "$KEYCLOAK_ADMIN_PASSWORD" ] && command -v aws >/dev/null 2>&1; then
  log "Trying to load Keycloak admin creds from SSM ($SSM_PREFIX)"
  V="$(aws ssm get-parameter --name "$SSM_PREFIX/KEYCLOAK_ADMIN_USER" --with-decryption --region "$AWS_REGION_FOR_SSM" --query Parameter.Value --output text 2>/dev/null || true)"
  [ -n "$V" ] && [ "$V" != "None" ] && KEYCLOAK_ADMIN_USERNAME="$V"
  V="$(aws ssm get-parameter --name "$SSM_PREFIX/KEYCLOAK_ADMIN_PASSWORD" --with-decryption --region "$AWS_REGION_FOR_SSM" --query Parameter.Value --output text 2>/dev/null || true)"
  [ -n "$V" ] && [ "$V" != "None" ] && KEYCLOAK_ADMIN_PASSWORD="$V"
  if [ -n "$KEYCLOAK_ADMIN_PASSWORD" ]; then
    log "  ✓ pulled Keycloak admin creds from SSM"
  fi
fi

# Fallback: interactive prompt
if [ -z "$KEYCLOAK_ADMIN_PASSWORD" ]; then
  read -r -p "Keycloak admin username [$KEYCLOAK_ADMIN_USERNAME]: " input_user
  [ -n "$input_user" ] && KEYCLOAK_ADMIN_USERNAME="$input_user"
  read -r -s -p "Keycloak admin password: " KEYCLOAK_ADMIN_PASSWORD
  echo
fi

if [ -z "$KEYCLOAK_ADMIN_PASSWORD" ]; then
  err "Admin password is required."
  exit 1
fi

# ─── get admin token ─────────────────────────────────────────
log "Fetching admin access token from $TOKEN_URL"
TOKEN_JSON="$(curl -sf -m 15 -X POST "$TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=$KEYCLOAK_ADMIN_CLIENT_ID" \
  -d "username=$KEYCLOAK_ADMIN_USERNAME" \
  -d "password=$KEYCLOAK_ADMIN_PASSWORD" 2>&1)"

if [ -z "$TOKEN_JSON" ] || ! echo "$TOKEN_JSON" | grep -q 'access_token'; then
  err "Admin auth failed. Response:"
  echo "$TOKEN_JSON" | head -5
  exit 1
fi

ADMIN_TOKEN="$(echo "$TOKEN_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")"
log "✓ Got admin token (len=${#ADMIN_TOKEN})"

# Helper: authenticated request
kc() {
  local method="$1"
  local path="$2"
  shift 2
  curl -sf -m 15 -X "$method" "$ADMIN_API$path" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    "$@"
}

# ─── ensure "admin" group exists ─────────────────────────────
log "Ensuring admin group exists"
ADMIN_GROUP_ID="$(kc GET "/groups?search=admin" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for g in data:
    if g.get('name') == 'admin':
        print(g['id']); break
" 2>/dev/null)"

if [ -z "$ADMIN_GROUP_ID" ]; then
  if [ "$DRY_RUN" = "1" ]; then
    log "  (dry-run) would create group 'admin'"
  else
    kc POST "/groups" -d '{"name":"admin"}' >/dev/null || true
    ADMIN_GROUP_ID="$(kc GET "/groups?search=admin" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for g in data:
    if g.get('name') == 'admin':
        print(g['id']); break
")"
    log "  + created group 'admin' ($ADMIN_GROUP_ID)"
  fi
else
  log "  = group 'admin' already exists ($ADMIN_GROUP_ID)"
fi

# ─── provision a user ────────────────────────────────────────
provision_user() {
  local username="$1" email="$2" password="$3" add_to_admin="$4"

  log "Provisioning $email"

  # Look up existing user
  local user_id
  user_id="$(kc GET "/users?email=$email&exact=true" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data[0]['id'] if data else '')
")"

  if [ -z "$user_id" ]; then
    if [ "$DRY_RUN" = "1" ]; then
      log "  (dry-run) would create user $email"
      user_id="<would-be-created>"
    else
      kc POST "/users" -d "{
        \"username\": \"$username\",
        \"email\": \"$email\",
        \"emailVerified\": true,
        \"enabled\": true,
        \"firstName\": \"E2E\",
        \"lastName\": \"Test\",
        \"attributes\": {\"e2e\": [\"true\"]}
      }" >/dev/null
      user_id="$(kc GET "/users?email=$email&exact=true" | python3 -c "
import sys, json
print(json.load(sys.stdin)[0]['id'])
")"
      log "  + created user (id=$user_id)"
    fi
  else
    log "  = user already exists (id=$user_id)"
  fi

  if [ "$DRY_RUN" = "1" ]; then return; fi

  # Set / reset password
  kc PUT "/users/$user_id/reset-password" -d "{
    \"type\": \"password\",
    \"value\": \"$password\",
    \"temporary\": false
  }" >/dev/null
  log "  ✓ password set"

  # Add to admin group?
  if [ "$add_to_admin" = "1" ] && [ -n "$ADMIN_GROUP_ID" ]; then
    kc PUT "/users/$user_id/groups/$ADMIN_GROUP_ID" >/dev/null 2>&1 || true
    log "  ✓ added to admin group"
  fi
}

# Generate strong random passwords
USER_PASS="$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 24)Aa1!"
ADMIN_PASS="$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 24)Aa1!"

provision_user "e2e-user"  "e2e-user@cloudless.gr"  "$USER_PASS"  0
provision_user "e2e-admin" "e2e-admin@cloudless.gr" "$ADMIN_PASS" 1

# ─── write to .env.e2e ───────────────────────────────────────
if [ "$DRY_RUN" = "1" ]; then
  log ""
  log "Dry-run complete — no changes written."
  exit 0
fi

upsert() {
  local key="$1" value="$2"
  touch "$ENV_FILE"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i.bak -E "s|^${key}=.*$|${key}=${value//|/\\|}|" "$ENV_FILE" 2>/dev/null \
      || sed -i '' -E "s|^${key}=.*$|${key}=${value//|/\\|}|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak" 2>/dev/null || true
  else
    printf "%s=%s\n" "$key" "$value" >> "$ENV_FILE"
  fi
}

upsert "E2E_USER_EMAIL"     "e2e-user@cloudless.gr"
upsert "E2E_USER_PASSWORD"  "$USER_PASS"
upsert "E2E_ADMIN_EMAIL"    "e2e-admin@cloudless.gr"
upsert "E2E_ADMIN_PASSWORD" "$ADMIN_PASS"
chmod 600 "$ENV_FILE"

log ""
log "✓ Wrote credentials to $ENV_FILE"
log ""
log "Test users provisioned:"
log "  e2e-user@cloudless.gr   (regular user)"
log "  e2e-admin@cloudless.gr  (admin group)"
log ""
log "Next: pnpm e2e:setup:ssm    # pull CRON_SECRET"
log "      pnpm test:e2e          # run full suite"
