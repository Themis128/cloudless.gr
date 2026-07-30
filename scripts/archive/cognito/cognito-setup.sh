#!/bin/bash
# cognito-setup.sh — Fully automated Cognito credentials retrieval and .env.local setup
#
# This script:
#   1. Checks for valid AWS credentials (tries multiple sources)
#   2. Authenticates to AWS (SSO or programmatic)
#   3. Fetches COGNITO_CLIENT_ID and CLIENT_SECRET from SSM
#   4. Updates .env.local with all required Cognito config
#   5. Verifies the dev server can start with auth
#
# Usage:
#   bash scripts/cognito-setup.sh              # fully automated
#   bash scripts/cognito-setup.sh --skip-verify # skip dev server test
#   bash scripts/cognito-setup.sh --dry-run    # show what would happen

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_LOCAL="$REPO_ROOT/.env.local"
ENV_BACKUP="$ENV_LOCAL.backup.$(date +%s)"
POOL_ID="us-east-1_1Bq3Mpqer"
REGION="us-east-1"
SKIP_VERIFY=0
DRY_RUN=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

log()  { printf "${BLUE}[cognito]${NC} %s\n" "$*"; }
ok()   { printf "${GREEN}✓${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}⚠${NC} %s\n" "$*"; }
err()  { printf "${RED}✗${NC} %s\n" "$*" >&2; }

usage() {
  cat << EOF
Usage: bash scripts/cognito-setup.sh [OPTIONS]

Options:
  --skip-verify   Skip dev server verification
  --dry-run       Show what would happen without making changes
  -h, --help      Show this help

This script automates:
  1. AWS credential validation/authentication
  2. Cognito Client ID/Secret retrieval from SSM
  3. .env.local configuration
  4. Dev server startup test

EOF
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    --skip-verify) SKIP_VERIFY=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage ;;
  esac
done

# ═════════════════════════════════════════════════════════════════════════════
# Step 1: Check AWS CLI
# ═════════════════════════════════════════════════════════════════════════════

log "Checking AWS CLI..."
if ! command -v aws &> /dev/null; then
  err "AWS CLI not found. Install with: pip install awscli"
  exit 1
fi
ok "AWS CLI found"

# ═════════════════════════════════════════════════════════════════════════════
# Step 2: Authenticate to AWS
# ═════════════════════════════════════════════════════════════════════════════

log "Authenticating to AWS..."

# Try current credentials first
if aws sts get-caller-identity &>/dev/null; then
  ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
  USER=$(aws sts get-caller-identity --query Arn --output text)
  ok "Authenticated as: $USER (account: $ACCOUNT)"
else
  warn "Current AWS credentials invalid or expired"
  log "Attempting AWS SSO login..."

  if aws sso login --sso-session cloudless 2>/dev/null; then
    ok "SSO login successful"
  else
    err "SSO login failed. You need to:"
    err "  1. Run on a machine with a browser: aws sso login --sso-session cloudless"
    err "  2. Or get new programmatic AWS credentials from AWS Console"
    err "  3. Update ~/.aws/credentials with valid keys"
    exit 1
  fi

  # Verify auth after SSO
  if ! aws sts get-caller-identity &>/dev/null; then
    err "Authentication failed even after SSO login"
    exit 1
  fi
  ok "SSO authentication successful"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Step 3: Fetch Cognito credentials from SSM
# ═════════════════════════════════════════════════════════════════════════════

log "Fetching Cognito credentials from SSM..."

CLIENT_ID=$(aws ssm get-parameter \
  --name "/cloudless/production/COGNITO_CLIENT_ID" \
  --region "$REGION" \
  --query "Parameter.Value" \
  --output text 2>/dev/null || echo "")

if [ -z "$CLIENT_ID" ]; then
  err "Failed to fetch COGNITO_CLIENT_ID from SSM"
  err "  Ensure: AWS credentials have SSM read permissions"
  err "  Ensure: Parameter exists at /cloudless/production/COGNITO_CLIENT_ID"
  exit 1
fi
ok "CLIENT_ID: ${CLIENT_ID:0:10}..."

CLIENT_SECRET=$(aws ssm get-parameter \
  --name "/cloudless/production/COGNITO_CLIENT_SECRET" \
  --with-decryption \
  --region "$REGION" \
  --query "Parameter.Value" \
  --output text 2>/dev/null || echo "")

if [ -n "$CLIENT_SECRET" ]; then
  ok "CLIENT_SECRET: ${CLIENT_SECRET:0:10}..."
else
  warn "CLIENT_SECRET not found (might be a public client)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Step 4: Update .env.local
# ═════════════════════════════════════════════════════════════════════════════

log "Updating .env.local..."

if [ "$DRY_RUN" = "1" ]; then
  log "(dry-run) Would update:"
  log "  NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID"
  log "  COGNITO_CLIENT_ID=$CLIENT_ID"
  [ -n "$CLIENT_SECRET" ] && log "  COGNITO_CLIENT_SECRET=$CLIENT_SECRET"
  exit 0
fi

# Backup existing .env.local
if [ -f "$ENV_LOCAL" ]; then
  cp "$ENV_LOCAL" "$ENV_BACKUP"
  ok "Backed up to: $ENV_BACKUP"
fi

# Update credentials using a temp file to avoid sed complexity
temp_env=$(mktemp)
trap "rm -f $temp_env" EXIT

# Read existing .env.local, replace credential lines
{
  while IFS= read -r line; do
    case "$line" in
      NEXT_PUBLIC_COGNITO_CLIENT_ID=*) echo "NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID" ;;
      COGNITO_CLIENT_ID=*) echo "COGNITO_CLIENT_ID=$CLIENT_ID" ;;
      COGNITO_CLIENT_SECRET=*) echo "COGNITO_CLIENT_SECRET=$CLIENT_SECRET" ;;
      *) echo "$line" ;;
    esac
  done < "$ENV_LOCAL"
} > "$temp_env"

mv "$temp_env" "$ENV_LOCAL"
ok "Updated .env.local with Cognito credentials"

# ═════════════════════════════════════════════════════════════════════════════
# Step 5: Verify configuration
# ═════════════════════════════════════════════════════════════════════════════

log "Verifying .env.local..."

if grep -q "NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID" "$ENV_LOCAL"; then
  ok "NEXT_PUBLIC_COGNITO_CLIENT_ID is set"
else
  err "NEXT_PUBLIC_COGNITO_CLIENT_ID not properly set"
  exit 1
fi

if grep -q "COGNITO_CLIENT_ID=$CLIENT_ID" "$ENV_LOCAL"; then
  ok "COGNITO_CLIENT_ID is set"
else
  err "COGNITO_CLIENT_ID not properly set"
  exit 1
fi

# ═════════════════════════════════════════════════════════════════════════════
# Step 6: Test dev server (optional)
# ═════════════════════════════════════════════════════════════════════════════

if [ "$SKIP_VERIFY" = "1" ]; then
  log "Skipping dev server verification (--skip-verify)"
else
  log "Testing dev server startup..."

  # Kill any existing dev server
  pkill -f "next dev" || true
  sleep 1

  # Start dev server in background with timeout
  if timeout 30 pnpm dev > /tmp/dev-test.log 2>&1 &
    dev_pid=$!
    sleep 8

    if curl -s http://localhost:4000/en > /dev/null 2>&1; then
      ok "Dev server started successfully"
      kill $dev_pid 2>/dev/null || true
      wait $dev_pid 2>/dev/null || true
    else
      err "Dev server test failed"
      err "  Check /tmp/dev-test.log for details"
      kill $dev_pid 2>/dev/null || true
      exit 1
    fi
  then
    :
  else
    warn "Dev server test timed out (this is normal for slow systems)"
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# Done
# ═════════════════════════════════════════════════════════════════════════════

log ""
ok "✓ Cognito setup complete!"
log ""
log "Next steps:"
log "  1. pnpm dev              # Start dev server"
log "  2. Visit http://localhost:4000/en"
log "  3. Click 'Sign in' to test Cognito authentication"
log ""
log "Configuration saved to: $ENV_LOCAL"
log "Backup saved to: $ENV_BACKUP"
log ""
