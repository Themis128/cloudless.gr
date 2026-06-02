#!/usr/bin/env bash
#
# keycloak-finalize-admin.sh — set a permanent admin password, bypassing the
# UPDATE_PASSWORD required action that a previous bootstrap-admin run created.
#
# Uses the Keycloak pod's own KEYCLOAK_ADMIN/KEYCLOAK_ADMIN_PASSWORD env vars
# (the internal service admin — credentials never leave the pod) to authenticate
# via kcadm, then:
#   1. Generates a strong random permanent password
#   2. Sets it on ADMIN_EMAIL (no --temporary flag — no forced change on login)
#   3. Clears any UPDATE_PASSWORD required action on the user
#   4. Posts the new credentials to issue #382 so the human can log in and use them
#
# After this runs, the admin can log into auth.cloudless.gr immediately without
# being forced to change the password.

set -uo pipefail

NAMESPACE="${NAMESPACE:-keycloak}"
DEPLOYMENT="${DEPLOYMENT:-keycloak}"
REALM="${REALM:-master}"
ADMIN_EMAIL="${ADMIN_EMAIL:-tbaltzakis@cloudless.gr}"
ISSUE="${ISSUE:-382}"

command -v kubectl >/dev/null 2>&1 || { echo "error: kubectl not found"; exit 1; }
POD=$(kubectl -n "$NAMESPACE" get pod -l app="$DEPLOYMENT" \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -n "$POD" ] || { echo "error: no $DEPLOYMENT pod in ns/$NAMESPACE"; exit 1; }

# Generate permanent password. Print it FIRST (same pattern as bootstrap-admin)
# so it appears in the log captured by the workflow and posted to issue #382.
# This is a private repo / private issue — acceptable security model.
PERM_PASSWORD="Cld-$(head -c 16 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 14)-Zz9!"
echo "PERM_LOGIN email=${ADMIN_EMAIL} password=${PERM_PASSWORD}"
echo "pod=${POD} realm=${REALM}"

kubectl -n "$NAMESPACE" exec -i "$POD" -- \
  env NU="$ADMIN_EMAIL" NP="$PERM_PASSWORD" RL="$REALM" bash -s <<'EOS'
set -u
K=/opt/keycloak/bin/kcadm.sh

# Authenticate using the pod's own internal admin (not the user's password)
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user "$AU" \
  --password "$AP" >/dev/null 2>&1 || { echo "ADMIN_AUTH=failed"; exit 1; }
echo "ADMIN_AUTH=ok"

# Get user ID
USERID=$(  $K get users -r "$RL" -q username="$NU" --format csv --noquotes 2>/dev/null \
         | head -1 | cut -d, -f1)
[ -n "$USERID" ] || { echo "USER_NOT_FOUND=$NU"; exit 1; }
echo "USER_FOUND=$USERID"

# Set PERMANENT password (--temporary=false → no forced change on login)
$K set-password -r "$RL" --userid "$USERID" \
  --new-password "$NP" --temporary=false >/dev/null 2>&1 \
  && echo "PASSWORD=set_permanent" || echo "PASSWORD=failed"

# Clear UPDATE_PASSWORD required action if present
$K update "users/$USERID" -r "$RL" -s 'requiredActions=[]' >/dev/null 2>&1 \
  && echo "REQUIRED_ACTIONS=cleared" || echo "REQUIRED_ACTIONS=clear_failed"

# Confirm user state
$K get "users/$USERID" -r "$RL" --format csv --noquotes 2>/dev/null \
  | head -1 | grep -oE 'emailVerified=\w+|enabled=\w+' || true

echo "DONE"
EOS

echo ""
echo "=== keycloak-finalize-admin complete ==="
echo "PERMANENT_CREDENTIALS email=${ADMIN_EMAIL}"
echo "(password masked — check issue #${ISSUE} for login details)"
