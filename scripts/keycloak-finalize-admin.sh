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
#
# Fix vs v1: uses separate non-interactive kubectl exec calls (no -i + heredoc)
# to avoid websocket close 1006 (abnormal closure) that killed v1.

set -uo pipefail

NAMESPACE="${NAMESPACE:-keycloak}"
DEPLOYMENT="${DEPLOYMENT:-keycloak}"
REALM="${REALM:-master}"
ADMIN_EMAIL="${ADMIN_EMAIL:-tbaltzakis@cloudless.gr}"
ISSUE="${ISSUE:-382}"
K=/opt/keycloak/bin/kcadm.sh

command -v kubectl >/dev/null 2>&1 || { echo "error: kubectl not found"; exit 1; }
POD=$(kubectl -n "$NAMESPACE" get pod -l app="$DEPLOYMENT" \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -n "$POD" ] || { echo "error: no $DEPLOYMENT pod in ns/$NAMESPACE"; exit 1; }
echo "POD=$POD"

# Generate permanent password and print it first so it appears in the GitHub
# Actions log (captured and posted to issue #382 by the workflow).
# Private repo / private issue — acceptable security model.
PERM_PASSWORD="Cld-$(head -c 16 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 14)-Zz9!"
echo "PERM_LOGIN email=${ADMIN_EMAIL} password=${PERM_PASSWORD}"
echo "realm=${REALM}"

# Step 1 — authenticate kcadm using the pod's own service-admin credentials.
# No -i flag: non-interactive exec, no stdin, no websocket issue.
kubectl -n "$NAMESPACE" exec "$POD" -- bash -c \
  'AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"; AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"; '"$K"' config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1 && echo "ADMIN_AUTH=ok" || { echo "ADMIN_AUTH=failed"; exit 1; }'

# Step 2 — look up the target user's ID.
USERID=$(kubectl -n "$NAMESPACE" exec "$POD" -- \
  "$K" get users -r "$REALM" -q "username=${ADMIN_EMAIL}" \
  --format csv --noquotes 2>/dev/null \
  | head -1 | cut -d, -f1)
[ -n "$USERID" ] || { echo "USER_NOT_FOUND=${ADMIN_EMAIL}"; exit 1; }
echo "USER_FOUND=$USERID"

# Step 3 — set permanent password (--temporary=false → no forced change on login).
kubectl -n "$NAMESPACE" exec "$POD" -- \
  "$K" set-password -r "$REALM" --userid "$USERID" \
  --new-password "$PERM_PASSWORD" --temporary=false \
  && echo "PASSWORD=set_permanent" || { echo "PASSWORD=failed"; exit 1; }

# Step 4 — clear UPDATE_PASSWORD required action.
kubectl -n "$NAMESPACE" exec "$POD" -- \
  "$K" update "users/$USERID" -r "$REALM" -s 'requiredActions=[]' \
  && echo "REQUIRED_ACTIONS=cleared" || echo "REQUIRED_ACTIONS=clear_failed"

# Step 5 — grant realm-admin role so the user can access the Keycloak Admin Console.
# Without this the user sees "You do not have permission" at auth.cloudless.gr/admin.
kubectl -n "$NAMESPACE" exec "$POD" -- \
  "$K" add-roles -r "$REALM" --uusername "$ADMIN_EMAIL" \
  --cclientid realm-management --rolename realm-admin 2>/dev/null \
  && echo "REALM_ADMIN=granted" || echo "REALM_ADMIN=grant_failed_or_already_set"

echo ""
echo "=== keycloak-finalize-admin complete ==="
echo "PERMANENT_CREDENTIALS email=${ADMIN_EMAIL}"
echo "(password logged above — check issue #${ISSUE} comment)"
