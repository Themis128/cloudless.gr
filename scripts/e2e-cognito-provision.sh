#!/usr/bin/env bash
#
# e2e-cognito-provision.sh — provision the two E2E test users in AWS Cognito.
#
#   e2e-user@cloudless.gr   — regular user (no group)
#   e2e-admin@cloudless.gr  — member of the "admin" group → isAdmin() returns true
#
# Cognito provisioning for e2e users. Both users get
# a PERMANENT password (admin-set-user-password --permanent) so Playwright can
# drive the Cognito Hosted UI login directly — no FORCE_CHANGE_PASSWORD step.
#
# Idempotent: an existing user is reused; only the password and group membership
# are (re)applied. Writes the resulting creds into .env.e2e for Playwright.
#
# Usage:
#   bash scripts/e2e-cognito-provision.sh            # provision + write .env.e2e
#   bash scripts/e2e-cognito-provision.sh --dry-run  # show what would happen
#
# Requires: aws CLI + AWS creds with cognito-idp admin permissions.
# Pool/client are discovered by name (POOL_NAME=cloudless-auth) — no hard IDs.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.e2e"
POOL_NAME="${POOL_NAME:-cloudless-auth}"
ADMIN_GROUP="${ADMIN_GROUP:-admin}"
export AWS_REGION="${AWS_REGION:-us-east-1}"

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '1,20p' "$0"; exit 0 ;;
  esac
done

log()  { printf "\033[1;36m[cognito]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[cognito]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[cognito]\033[0m %s\n" "$*" >&2; }

command -v aws >/dev/null 2>&1 || { err "aws CLI not found"; exit 1; }

# ─── resolve pool by name ────────────────────────────────────
log "Resolving Cognito pool '$POOL_NAME' in $AWS_REGION"
POOL_ID=$(aws cognito-idp list-user-pools --max-results 60 \
  --query "UserPools[?Name=='$POOL_NAME'].Id" --output text 2>/dev/null)
if [ -z "$POOL_ID" ] || [ "$POOL_ID" = "None" ]; then
  err "pool '$POOL_NAME' not found — is the SST deploy complete?"; exit 1
fi
log "  pool: $POOL_ID"

# ─── ensure the admin group exists ───────────────────────────
if ! aws cognito-idp get-group --user-pool-id "$POOL_ID" --group-name "$ADMIN_GROUP" \
       >/dev/null 2>&1; then
  if [ "$DRY_RUN" = "1" ]; then
    log "  (dry-run) would create group '$ADMIN_GROUP'"
  else
    aws cognito-idp create-group --user-pool-id "$POOL_ID" --group-name "$ADMIN_GROUP" \
      >/dev/null 2>&1 && log "  + created group '$ADMIN_GROUP'" \
      || warn "  ! could not create group '$ADMIN_GROUP' (may already exist)"
  fi
else
  log "  = group '$ADMIN_GROUP' exists"
fi

# ─── provision a single user ─────────────────────────────────
provision_user() {
  local email="$1" password="$2" add_to_admin="$3"
  log "Provisioning $email"

  if [ "$DRY_RUN" = "1" ]; then
    log "  (dry-run) would admin-create-user + set permanent password" \
        "${add_to_admin:++ add to $ADMIN_GROUP}"
    return
  fi

  # Create (idempotent — ignore UsernameExistsException)
  local create_err
  create_err=$(aws cognito-idp admin-create-user \
    --user-pool-id "$POOL_ID" --username "$email" \
    --user-attributes "Name=email,Value=$email" "Name=email_verified,Value=true" \
    --message-action SUPPRESS --output text 2>&1 >/dev/null) || true
  if echo "$create_err" | grep -q "UsernameExistsException"; then
    log "  = user exists"
  elif [ -n "$create_err" ]; then
    err "  create failed: $create_err"; return 1
  else
    log "  + created user"
  fi

  # Permanent password → direct Hosted UI login works for Playwright
  aws cognito-idp admin-set-user-password \
    --user-pool-id "$POOL_ID" --username "$email" \
    --password "$password" --permanent >/dev/null \
    && log "  ✓ permanent password set"

  if [ "$add_to_admin" = "1" ]; then
    aws cognito-idp admin-add-user-to-group \
      --user-pool-id "$POOL_ID" --username "$email" --group-name "$ADMIN_GROUP" \
      >/dev/null 2>&1 && log "  ✓ added to $ADMIN_GROUP group" \
      || warn "  ! could not add to $ADMIN_GROUP"
  fi
}

# Strong random passwords (Cognito default policy: ≥8 chars; complexity tail added)
USER_PASS="$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 24)Aa1!"
ADMIN_PASS="$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 24)Aa1!"
echo "::add-mask::$USER_PASS"; echo "::add-mask::$ADMIN_PASS"

provision_user "e2e-user@cloudless.gr"  "$USER_PASS"  0
provision_user "e2e-admin@cloudless.gr" "$ADMIN_PASS" 1

if [ "$DRY_RUN" = "1" ]; then
  log ""
  log "Dry-run complete — no changes written."
  exit 0
fi

# ─── write to .env.e2e ───────────────────────────────────────
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
log "  e2e-user@cloudless.gr   (regular user)"
log "  e2e-admin@cloudless.gr  ($ADMIN_GROUP group)"
log ""
log "Next: pnpm e2e:setup:ssm   # pull CRON_SECRET"
log "      pnpm test:e2e         # run full suite"
