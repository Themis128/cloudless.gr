#!/usr/bin/env bash
#
# migrate-keycloak-to-cognito.sh — export Keycloak master realm users and
# import them into the Cognito User Pool.
#
# For each Keycloak user (service accounts skipped):
#   1. Checks their group membership (admin group → Cognito admin group)
#   2. Calls aws cognito-idp admin-create-user (SUPPRESS — no welcome email)
#   3. Adds to the Cognito "admin" group if they were a Keycloak admin
#   4. Skips users that already exist in Cognito
#
# Users land in FORCE_CHANGE_PASSWORD state — they must reset on first login
# via the Cognito Hosted UI "Forgot password" flow.
#
# Set DRY_RUN=1 to log what would happen without creating anything.
#
# Requires: kubectl (ns keycloak access) + aws CLI + AWS creds in env.

set -uo pipefail
NS="${NS:-keycloak}"
REALM="${REALM:-master}"
POOL_NAME="${POOL_NAME:-cloudless-auth}"
DRY_RUN="${DRY_RUN:-0}"
export AWS_REGION="${AWS_REGION:-us-east-1}"

command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "aws CLI not found"; exit 1; }

# ── 1. Find the Keycloak pod ──────────────────────────────────────────────────

POD=$(kubectl -n "$NS" get pod -l app=keycloak -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -n "$POD" ] || { echo "ERROR: no keycloak pod in ns/$NS — is the cluster reachable?"; exit 1; }
echo "keycloak pod: $POD"

# ── 2. Resolve Cognito pool ───────────────────────────────────────────────────

POOL_ID=$(aws cognito-idp list-user-pools --max-results 60 \
  --query "UserPools[?Name=='$POOL_NAME'].Id" --output text 2>/dev/null)
if [ -z "$POOL_ID" ] || [ "$POOL_ID" = "None" ]; then
  echo "ERROR: Cognito pool '$POOL_NAME' not found in $AWS_REGION"
  echo "       Has the SST deploy completed? Run 'pnpm sst:deploy' first."
  exit 1
fi
echo "Cognito pool: $POOL_ID"

# ── 3. Export users + admin membership in one exec call ──────────────────────
# Output: one line per user — "email,is_admin" (is_admin=1 if in "admin" group)
# The keycloak image has no jq/curl/awk; kcadm CSV output + grep/cut is used.

echo "exporting users from Keycloak realm '$REALM'..."
EXPORT=$(kubectl -n "$NS" exec -i "$POD" -- bash -s <<'KCSCRIPT'
set -uo pipefail
K=/opt/keycloak/bin/kcadm.sh
REALM=master
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"

$K config credentials --server http://localhost:8080 --realm "$REALM" \
  --user "$AU" --password "$AP" >/dev/null 2>&1 \
  || { echo "KEYCLOAK_AUTH_FAILED"; exit 0; }

# List all users; CSV columns: id,username,email
# (tail -n +2 strips the header row that kcadm emits with --format csv)
$K get users -r "$REALM" --format csv --noquotes --fields id,username,email 2>/dev/null \
  | tail -n +2 \
  | while IFS=',' read -r uid uname email; do
      # Skip service accounts and users without an email address
      [[ "$uname" = service-account-* ]] && continue
      [ -z "$email" ] && continue

      # Get group names for this user
      grps=$($K get "users/$uid/groups" -r "$REALM" \
             --format csv --noquotes --fields name 2>/dev/null \
             | tail -n +2 | tr '[:upper:]' '[:lower:]')
      is_admin=0
      echo "$grps" | grep -q "admin" && is_admin=1

      printf '%s,%s\n' "$email" "$is_admin"
    done
KCSCRIPT
2>/dev/null)

if echo "$EXPORT" | grep -q "KEYCLOAK_AUTH_FAILED"; then
  echo "ERROR: Keycloak admin authentication failed inside the pod"
  echo "       Check that KEYCLOAK_ADMIN / KEYCLOAK_ADMIN_PASSWORD are set in the pod env."
  exit 1
fi

if [ -z "$EXPORT" ]; then
  echo "No users found in Keycloak realm '$REALM' (empty realm or auth failure)."
  exit 0
fi

echo ""
echo "Users to migrate:"
echo "$EXPORT"
echo ""

# ── 4. Import each user to Cognito ───────────────────────────────────────────

IMPORTED=0
SKIPPED=0
FAILED=0

while IFS=',' read -r email is_admin; do
  [ -z "$email" ] && continue

  echo "--- $email (admin=$is_admin) ---"

  if [ "$DRY_RUN" = "1" ]; then
    echo "  [DRY_RUN] would admin-create-user email=$email admin=$is_admin"
    IMPORTED=$((IMPORTED + 1))
    continue
  fi

  # Temporary password — user must reset via Hosted UI "Forgot password".
  TMPPASS="Tmp$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 10)1!"
  echo "::add-mask::$TMPPASS"

  CREATE_ERR=$(aws cognito-idp admin-create-user \
    --user-pool-id "$POOL_ID" \
    --username "$email" \
    --user-attributes "Name=email,Value=$email" "Name=email_verified,Value=true" \
    --temporary-password "$TMPPASS" \
    --message-action SUPPRESS \
    --output text 2>&1 >/dev/null) || true

  if echo "$CREATE_ERR" | grep -q "UsernameExistsException"; then
    echo "  already exists in Cognito — skipping creation"
    SKIPPED=$((SKIPPED + 1))
  elif [ -n "$CREATE_ERR" ]; then
    echo "  ERROR: $CREATE_ERR"
    FAILED=$((FAILED + 1))
    continue
  else
    echo "  created (FORCE_CHANGE_PASSWORD — user must reset via Hosted UI)"
    IMPORTED=$((IMPORTED + 1))
  fi

  if [ "$is_admin" = "1" ]; then
    if aws cognito-idp admin-add-user-to-group \
      --user-pool-id "$POOL_ID" \
      --username "$email" \
      --group-name admin 2>/dev/null; then
      echo "  added to Cognito admin group"
    else
      echo "  WARN: failed to add $email to admin group"
    fi
  fi

done <<< "$EXPORT"

echo ""
echo "=== Migration complete: created=$IMPORTED skipped=$SKIPPED failed=$FAILED ==="
if [ "$DRY_RUN" = "1" ]; then
  echo "    (dry-run — no changes made; re-run with DRY_RUN=0 to apply)"
fi
