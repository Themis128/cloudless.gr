#!/usr/bin/env bash
#
# keycloak-configure-email.sh — configure Keycloak realm SMTP (AWS SES) and
# enable email verification for new registrations.
#
# What this does:
#   1. Sets the realm smtpServer block to use AWS SES SMTP
#   2. Enables verifyEmail on the realm (new users must verify before signing in)
#   3. Ensures the VERIFY_EMAIL required action is enabled + set as default
#      (so it applies automatically to every new registration)
#
# Credentials are read from env vars. The CI workflow reads them from SSM or
# from workflow_dispatch inputs and injects them before calling this script.
#
# Required env:
#   SMTP_USER      — SES SMTP username (= IAM access key ID for the SES SMTP user)
#   SMTP_PASSWORD  — SES SMTP password (derived SES SMTP credential, NOT the IAM secret key)
#   FROM_EMAIL     — from address, e.g. noreply@cloudless.gr
#
# Optional env:
#   SMTP_HOST      — default email-smtp.us-east-1.amazonaws.com
#   SMTP_PORT      — default 587
#   FROM_NAME      — display name, default "Cloudless"
#   NAMESPACE, DEPLOYMENT, REALM

set -uo pipefail

NAMESPACE="${NAMESPACE:-keycloak}"
DEPLOYMENT="${DEPLOYMENT:-keycloak}"
REALM="${REALM:-master}"
SMTP_HOST="${SMTP_HOST:-email-smtp.us-east-1.amazonaws.com}"
SMTP_PORT="${SMTP_PORT:-587}"
FROM_NAME="${FROM_NAME:-Cloudless}"

# --- validate required vars ---
: "${SMTP_USER:?SMTP_USER is required (SES SMTP IAM access key ID)}"
: "${SMTP_PASSWORD:?SMTP_PASSWORD is required (derived SES SMTP credential)}"
: "${FROM_EMAIL:?FROM_EMAIL is required (e.g. noreply@cloudless.gr)}"

command -v kubectl >/dev/null 2>&1 || { echo "error: kubectl not found / no cluster access"; exit 1; }
POD=$(kubectl -n "$NAMESPACE" get pod -l app="$DEPLOYMENT" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -n "$POD" ] || { echo "error: no $DEPLOYMENT pod in ns/$NAMESPACE"; exit 1; }
echo "== keycloak-configure-email $(date -u '+%F %T')Z =="
echo "pod=$POD realm=$REALM smtp_host=$SMTP_HOST:$SMTP_PORT from=$FROM_EMAIL"

kubectl -n "$NAMESPACE" exec -i "$POD" -- \
  env RL="$REALM" \
      SH="$SMTP_HOST" SP="$SMTP_PORT" SU="$SMTP_USER" SW="$SMTP_PASSWORD" \
      FE="$FROM_EMAIL" FN="$FROM_NAME" \
  bash -s <<'EOS'
set -uo pipefail
K=/opt/keycloak/bin/kcadm.sh
AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"
AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"
$K config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1 \
  || { echo "ADMIN_AUTH=failed"; exit 1; }
echo "ADMIN_AUTH=ok"

# Build the SMTP JSON block (Python to handle any special chars in the password)
SMTP_JSON=$(python3 - "$SH" "$SP" "$SU" "$SW" "$FE" "$FN" <<'PY'
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

# Apply the smtpServer block + enable verifyEmail
$K update "realms/$RL" -s "smtpServer=$SMTP_JSON" >/dev/null 2>&1 \
  && echo "SMTP=configured" || { echo "SMTP=failed"; exit 1; }

$K update "realms/$RL" -s verifyEmail=true >/dev/null 2>&1 \
  && echo "VERIFY_EMAIL=enabled" || echo "VERIFY_EMAIL=failed (non-fatal)"

# Ensure VERIFY_EMAIL required action is enabled and set as default
# (default=true means it's automatically assigned to new registrations)
$K update "realms/$RL/authentication/required-actions/VERIFY_EMAIL" \
  -s enabled=true -s defaultAction=true >/dev/null 2>&1 \
  && echo "REQUIRED_ACTION=enabled+default" || echo "REQUIRED_ACTION=update failed (non-fatal)"

echo "DONE"
EOS

echo "=== email verification configured ==="
echo ""
echo "What happens now:"
echo "  1. New users who register at cloudless.gr will receive a verification email"
echo "  2. The email contains a link — clicking it verifies their account"
echo "  3. Until verified, users cannot sign in to the application"
echo ""
echo "Test: register at https://cloudless.gr/auth/register with a real email address"
echo "To test SMTP only: ./tools/keycloak-cli/keycloak.sh smtp-test"
