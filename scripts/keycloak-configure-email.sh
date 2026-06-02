#!/usr/bin/env bash
#
# keycloak-configure-email.sh — configure Keycloak realm SMTP (AWS SES) and
# enable email verification for new registrations.
#
# Uses the Keycloak REST admin API directly (no kubectl / no k3s API server
# required). Works even when the cluster API server is down or flapping.
#
# What this does:
#   1. Authenticates to the Keycloak admin REST API
#   2. Sets the realm smtpServer block to use AWS SES SMTP
#   3. Enables verifyEmail on the realm (new users must verify before signing in)
#   4. Enables the VERIFY_EMAIL required action as the default (auto-assigned to
#      every new registration)
#
# Required env:
#   SMTP_USER             — SES SMTP username (IAM access key ID)
#   SMTP_PASSWORD         — SES SMTP password (derived SES credential)
#   FROM_EMAIL            — from address, e.g. noreply@cloudless.gr
#   KEYCLOAK_ADMIN_PASSWORD — Keycloak admin password
#
# Optional env:
#   KEYCLOAK_ADMIN        — admin username (default: admin)
#   KEYCLOAK_URL          — base URL (default: https://auth.cloudless.gr)
#   SMTP_HOST             — default email-smtp.us-east-1.amazonaws.com
#   SMTP_PORT             — default 587
#   FROM_NAME             — display name, default "Cloudless"
#   REALM                 — default master

set -uo pipefail

REALM="${REALM:-master}"
KEYCLOAK_URL="${KEYCLOAK_URL:-https://auth.cloudless.gr}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
SMTP_HOST="${SMTP_HOST:-email-smtp.us-east-1.amazonaws.com}"
SMTP_PORT="${SMTP_PORT:-587}"
FROM_NAME="${FROM_NAME:-Cloudless}"

# --- validate required vars ---
: "${SMTP_USER:?SMTP_USER is required (SES SMTP IAM access key ID)}"
: "${SMTP_PASSWORD:?SMTP_PASSWORD is required (derived SES SMTP credential)}"
: "${FROM_EMAIL:?FROM_EMAIL is required (e.g. noreply@cloudless.gr)}"
: "${KEYCLOAK_ADMIN_PASSWORD:?KEYCLOAK_ADMIN_PASSWORD is required}"

echo "== keycloak-configure-email $(date -u '+%F %T')Z =="
echo "url=$KEYCLOAK_URL realm=$REALM smtp_host=$SMTP_HOST:$SMTP_PORT from=$FROM_EMAIL"

# --- 1) Obtain admin access token ---
TOKEN=$(curl -sf --max-time 15 \
  -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "client_id=admin-cli" \
  --data-urlencode "username=${KEYCLOAK_ADMIN}" \
  --data-urlencode "password=${KEYCLOAK_ADMIN_PASSWORD}" \
  --data-urlencode "grant_type=password" \
  2>&1) || { echo "ADMIN_AUTH=failed (curl error: $TOKEN)"; exit 1; }
TOKEN=$(printf '%s' "$TOKEN" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("access_token",""))' 2>/dev/null || true)
[ -n "$TOKEN" ] || { echo "ADMIN_AUTH=failed (empty token — wrong password or Keycloak unreachable)"; exit 1; }
echo "ADMIN_AUTH=ok"

# --- 2) Build smtpServer JSON ---
SMTP_JSON=$(python3 - "$SMTP_HOST" "$SMTP_PORT" "$SMTP_USER" "$SMTP_PASSWORD" "$FROM_EMAIL" "$FROM_NAME" <<'PY'
import sys, json
host, port, user, pw, from_email, from_name = sys.argv[1:]
print(json.dumps({
  "host": host,
  "port": port,
  "ssl": "false",
  "starttls": "true",
  "auth": "true",
  "user": user,
  "password": pw,
  "from": from_email,
  "fromDisplayName": from_name,
  "replyTo": "",
  "replyToDisplayName": "",
  "envelopeFrom": ""
}))
PY
)

# --- 3) Apply smtpServer config to realm ---
HTTP=$(curl -sf --max-time 15 -o /dev/null -w "%{http_code}" \
  -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"smtpServer\": ${SMTP_JSON}}")
[ "$HTTP" = "204" ] && echo "SMTP=configured (HTTP 204)" \
  || { echo "SMTP=failed (HTTP ${HTTP})"; exit 1; }

# --- 4) Enable verifyEmail on the realm ---
HTTP=$(curl -sf --max-time 15 -o /dev/null -w "%{http_code}" \
  -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"verifyEmail": true}')
[ "$HTTP" = "204" ] && echo "VERIFY_EMAIL=enabled" \
  || echo "VERIFY_EMAIL=failed (HTTP ${HTTP}) — non-fatal"

# --- 5) Enable VERIFY_EMAIL required action as default ---
# GET current state first so we preserve all existing fields
RA=$(curl -sf --max-time 15 \
  "${KEYCLOAK_URL}/admin/realms/${REALM}/authentication/required-actions/VERIFY_EMAIL" \
  -H "Authorization: Bearer ${TOKEN}" 2>/dev/null || true)
if [ -n "$RA" ]; then
  PATCHED=$(printf '%s' "$RA" | python3 -c \
    'import sys,json; d=json.load(sys.stdin); d["enabled"]=True; d["defaultAction"]=True; print(json.dumps(d))')
  HTTP=$(curl -sf --max-time 15 -o /dev/null -w "%{http_code}" \
    -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM}/authentication/required-actions/VERIFY_EMAIL" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$PATCHED")
  [ "$HTTP" = "204" ] && echo "REQUIRED_ACTION=enabled+default" \
    || echo "REQUIRED_ACTION=update failed (HTTP ${HTTP}) — non-fatal"
else
  echo "REQUIRED_ACTION=skipped (could not fetch current state)"
fi

echo ""
echo "=== email verification configured ==="
echo ""
echo "What happens now:"
echo "  1. New users who register at cloudless.gr receive a verification email"
echo "  2. The email contains a link — clicking it verifies their account"
echo "  3. Until verified, users cannot sign in to the application"
echo ""
echo "Test: register at https://cloudless.gr/auth/register with a real email"
