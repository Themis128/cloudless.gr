#!/usr/bin/env bash
#
# Bootstrap .env.e2e for Playwright E2E suite.
# - Pulls CRON_SECRET from AWS SSM at /cloudless/production/CRON_SECRET
# - Prompts for test user / admin credentials (skippable)
# - Writes a gitignored .env.e2e at repo root
#
# Idempotent: re-run any time. Existing values are preserved unless
# you choose to overwrite them.
#
# Usage:
#   bash scripts/e2e-env-bootstrap.sh           # interactive
#   bash scripts/e2e-env-bootstrap.sh --ssm-only # only refresh CRON_SECRET
#   bash scripts/e2e-env-bootstrap.sh --print    # print resolved values (redacted)

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.e2e"
EXAMPLE_FILE="$REPO_ROOT/.env.e2e.example"

SSM_PREFIX="${SSM_PREFIX:-/cloudless/production}"
AWS_REGION_FOR_SSM="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"

# ─── helpers ─────────────────────────────────────────────────
log()  { printf "\033[1;36m[e2e-env]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[e2e-env]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[e2e-env]\033[0m %s\n" "$*" >&2; }

# Read a key=value pair from the existing .env.e2e, or empty
existing() {
  local key="$1"
  [ -f "$ENV_FILE" ] || { echo ""; return; }
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1)" || true
  echo "${line#*=}"
}

# Prompt the user; preserve existing if they press Enter
prompt() {
  local key="$1" label="$2" hide="${3:-no}"
  local current="$(existing "$key")"
  local masked=""
  if [ -n "$current" ]; then
    if [ "$hide" = "yes" ]; then masked=" [********]"; else masked=" [$current]"; fi
  fi
  if [ "$hide" = "yes" ]; then
    read -r -s -p "${label}${masked}: " val; echo
  else
    read -r -p "${label}${masked}: " val
  fi
  if [ -z "$val" ]; then val="$current"; fi
  echo "$val"
}

# Write or replace a key in $ENV_FILE
upsert() {
  local key="$1" value="$2"
  touch "$ENV_FILE"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # macOS/GNU compatible
    sed -i.bak -E "s|^${key}=.*$|${key}=${value//|/\\|}|" "$ENV_FILE" 2>/dev/null \
      || sed -i '' -E "s|^${key}=.*$|${key}=${value//|/\\|}|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak" 2>/dev/null || true
  else
    printf "%s=%s\n" "$key" "$value" >> "$ENV_FILE"
  fi
}

# ─── flags ───────────────────────────────────────────────────
MODE="interactive"
for arg in "$@"; do
  case "$arg" in
    --ssm-only) MODE="ssm-only" ;;
    --print)    MODE="print" ;;
    -h|--help)
      sed -n '1,30p' "$0"; exit 0 ;;
  esac
done

# ─── seed from example if missing ────────────────────────────
if [ ! -f "$ENV_FILE" ] && [ -f "$EXAMPLE_FILE" ]; then
  log "Seeding $ENV_FILE from .env.e2e.example"
  cp "$EXAMPLE_FILE" "$ENV_FILE"
fi
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ─── print mode ──────────────────────────────────────────────
if [ "$MODE" = "print" ]; then
  log "Resolved .env.e2e values (passwords redacted):"
  while IFS='=' read -r k v; do
    case "$k" in ""|"#"*) continue ;; esac
    case "$k" in *PASSWORD*|*SECRET*) v="<redacted>" ;; esac
    printf "  %s=%s\n" "$k" "$v"
  done < "$ENV_FILE"
  exit 0
fi

# ─── SSM CRON_SECRET ─────────────────────────────────────────
log "Fetching CRON_SECRET from SSM at ${SSM_PREFIX}/CRON_SECRET"
if command -v aws >/dev/null 2>&1; then
  CRON_VAL="$(aws ssm get-parameter \
    --name "${SSM_PREFIX}/CRON_SECRET" \
    --with-decryption \
    --region "$AWS_REGION_FOR_SSM" \
    --query 'Parameter.Value' \
    --output text 2>/dev/null || true)"
  if [ -n "$CRON_VAL" ] && [ "$CRON_VAL" != "None" ]; then
    upsert "CRON_SECRET" "$CRON_VAL"
    log "✓ CRON_SECRET pulled from SSM (len=${#CRON_VAL})"
  else
    warn "Could not fetch CRON_SECRET from SSM. Cron happy-path tests will skip."
    warn "  Possible causes: AWS creds not loaded, parameter missing, wrong region."
    [ -z "$(existing CRON_SECRET)" ] && upsert "CRON_SECRET" ""
  fi
else
  warn "aws-cli not found in PATH. Cron happy-path tests will skip."
  [ -z "$(existing CRON_SECRET)" ] && upsert "CRON_SECRET" ""
fi

[ "$MODE" = "ssm-only" ] && { log "Done (ssm-only)."; exit 0; }

# ─── interactive prompts ─────────────────────────────────────
log "Configuring test user credentials"
log "  (Press Enter to keep existing; leave both blank to skip user-auth tests)"

USER_EMAIL="$(prompt E2E_USER_EMAIL "Test user email")"
USER_PASSWORD="$(prompt E2E_USER_PASSWORD "Test user password" yes)"
upsert "E2E_USER_EMAIL" "$USER_EMAIL"
upsert "E2E_USER_PASSWORD" "$USER_PASSWORD"

log "Configuring test admin credentials"
ADMIN_EMAIL="$(prompt E2E_ADMIN_EMAIL "Test admin email")"
ADMIN_PASSWORD="$(prompt E2E_ADMIN_PASSWORD "Test admin password" yes)"
upsert "E2E_ADMIN_EMAIL" "$ADMIN_EMAIL"
upsert "E2E_ADMIN_PASSWORD" "$ADMIN_PASSWORD"

# Ensure defaults exist
[ -z "$(existing PLAYWRIGHT_BASE_URL)" ] && upsert "PLAYWRIGHT_BASE_URL" "http://localhost:4000"
[ -z "$(existing NEXT_PUBLIC_E2E)" ] && upsert "NEXT_PUBLIC_E2E" "1"

log ""
log "✓ Wrote $ENV_FILE"
log ""
log "Next: pnpm test:e2e:full       # all 1000+ cases"
log "  or: pnpm test:e2e            # quick smoke"
