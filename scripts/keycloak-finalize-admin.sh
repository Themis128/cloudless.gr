#!/usr/bin/env bash
#
# keycloak-finalize-admin.sh — set permanent admin password and grant realm-admin
# via the Keycloak REST admin API.
#
# No kubectl / kcadm / Tailscale required. Works even when the k3s apiserver or
# the kubelet proxy is returning 502 Bad Gateway — auth.cloudless.gr only needs
# to be publicly reachable (it always is).
#
# What this does:
#   1. Authenticates to the Keycloak admin REST API using KEYCLOAK_ADMIN_PASSWORD
#   2. Generates and sets a strong permanent password on ADMIN_EMAIL
#   3. Clears the UPDATE_PASSWORD required action (no forced change on login)
#   4. Grants realm-management:realm-admin so the user can access /admin console
#
# Required env:
#   KEYCLOAK_ADMIN_PASSWORD   — Keycloak internal admin password (ADMIN_BOOTSTRAP_PASSWORD secret)
#
# Optional env:
#   ADMIN_EMAIL               — target user (default: tbaltzakis@cloudless.gr)
#   REALM                     — default: master
#   KEYCLOAK_URL              — default: https://auth.cloudless.gr
#   KEYCLOAK_ADMIN            — internal admin username (default: admin)

set -uo pipefail

REALM="${REALM:-master}"
KEYCLOAK_URL="${KEYCLOAK_URL:-https://auth.cloudless.gr}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
ADMIN_EMAIL="${ADMIN_EMAIL:-tbaltzakis@cloudless.gr}"

: "${KEYCLOAK_ADMIN_PASSWORD:?KEYCLOAK_ADMIN_PASSWORD is required (ADMIN_BOOTSTRAP_PASSWORD secret)}"

echo "== keycloak-finalize-admin $(date -u '+%F %T')Z =="
echo "url=$KEYCLOAK_URL realm=$REALM target=$ADMIN_EMAIL"

# --- 1) Authenticate ---
TOKEN=$(curl -sf --max-time 15 \
  -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "client_id=admin-cli" \
  --data-urlencode "username=${KEYCLOAK_ADMIN}" \
  --data-urlencode "password=${KEYCLOAK_ADMIN_PASSWORD}" \
  --data-urlencode "grant_type=password" \
  2>&1) || { echo "ADMIN_AUTH=failed (curl error: $TOKEN)"; exit 1; }
TOKEN=$(printf '%s' "$TOKEN" | python3 -c \
  'import sys,json; d=json.load(sys.stdin); print(d.get("access_token",""))' 2>/dev/null || true)
[ -n "$TOKEN" ] || { echo "ADMIN_AUTH=failed (empty token — wrong password or Keycloak unreachable)"; exit 1; }
echo "ADMIN_AUTH=ok"

# --- 2) Generate and announce the permanent password ---
PERM_PASSWORD="Cld-$(head -c 16 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 14)-Zz9!"
echo "PERM_LOGIN email=${ADMIN_EMAIL} password=${PERM_PASSWORD}"
echo "realm=${REALM}"

# --- 3) Find the target user by email ---
USERID=$(curl -sf --max-time 15 -G \
  --data-urlencode "email=${ADMIN_EMAIL}" \
  --data-urlencode "exact=true" \
  "${KEYCLOAK_URL}/admin/realms/${REALM}/users" \
  -H "Authorization: Bearer ${TOKEN}" 2>/dev/null \
  | python3 -c 'import sys,json; u=json.load(sys.stdin); print(u[0]["id"] if u else "")' 2>/dev/null || true)
[ -n "$USERID" ] || { echo "USER_NOT_FOUND=${ADMIN_EMAIL}"; exit 1; }
echo "USER_FOUND=$USERID"

# --- 4) Set permanent password ---
HTTP=$(curl -sf --max-time 15 -o /dev/null -w "%{http_code}" \
  -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${USERID}/reset-password" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "import json; print(json.dumps({'type':'password','value':'${PERM_PASSWORD}','temporary':False}))")")
[ "$HTTP" = "204" ] && echo "PASSWORD=set_permanent" \
  || { echo "PASSWORD=failed (HTTP ${HTTP})"; exit 1; }

# --- 5) Clear UPDATE_PASSWORD required action ---
HTTP=$(curl -sf --max-time 15 -o /dev/null -w "%{http_code}" \
  -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${USERID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"requiredActions":[]}')
[ "$HTTP" = "204" ] && echo "REQUIRED_ACTIONS=cleared" \
  || echo "REQUIRED_ACTIONS=clear_failed (HTTP ${HTTP}) — non-fatal"

# --- 6) Find realm-management client ---
CLIENT_ID=$(curl -sf --max-time 15 -G \
  --data-urlencode "clientId=realm-management" \
  "${KEYCLOAK_URL}/admin/realms/${REALM}/clients" \
  -H "Authorization: Bearer ${TOKEN}" 2>/dev/null \
  | python3 -c 'import sys,json; c=json.load(sys.stdin); print(c[0]["id"] if c else "")' 2>/dev/null || true)
[ -n "$CLIENT_ID" ] || { echo "REALM_ADMIN=realm-management_client_not_found (non-fatal)"; exit 0; }

# --- 7) Get realm-admin role representation ---
ROLE_JSON=$(curl -sf --max-time 15 \
  "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${CLIENT_ID}/roles/realm-admin" \
  -H "Authorization: Bearer ${TOKEN}" 2>/dev/null || true)
ROLE_ID=$(printf '%s' "$ROLE_JSON" | python3 -c \
  'import sys,json; d=json.load(sys.stdin); print(d["id"])' 2>/dev/null || true)
[ -n "$ROLE_ID" ] || { echo "REALM_ADMIN=realm-admin_role_not_found (non-fatal)"; exit 0; }

# --- 8) Assign realm-admin to the user ---
HTTP=$(curl -sf --max-time 15 -o /dev/null -w "%{http_code}" \
  -X POST "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${USERID}/role-mappings/clients/${CLIENT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "[{\"id\":\"${ROLE_ID}\",\"name\":\"realm-admin\"}]")
case "$HTTP" in
  204) echo "REALM_ADMIN=granted" ;;
  409) echo "REALM_ADMIN=already_granted" ;;
  *)   echo "REALM_ADMIN=grant_failed (HTTP ${HTTP})" ;;
esac

echo ""
echo "=== keycloak-finalize-admin complete ==="
echo "Login at https://auth.cloudless.gr/admin — credentials above."
