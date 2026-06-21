#!/usr/bin/env bash
# espocrm-smtp-bootstrap.sh
# ─────────────────────────
# Configures EspoCRM outbound SMTP via the API (PHP config, not env vars).
# Pulls SES_SMTP_* from SSM and POSTs to the EspoCRM Settings API.
#
# Why not env vars: EspoCRM reads SMTP config from data/config.php (PHP
# array), not from process.env. The Settings API is the right knob; it
# writes back to data/config.php transactionally + invalidates the
# in-process cache.
#
# Prereq: SES_SMTP_USER + SES_SMTP_PASSWORD in SSM. Provision once with:
#   pnpm ses:provision
#
# Run from anywhere with kubectl context + AWS creds (operator laptop OR
# the omv Pi runner).

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ESPOCRM_BASE_URL="${ESPOCRM_BASE_URL:-https://espocrm.cloudless.gr}"

ssm_get() {
  local key="$1"  default="${2:-}"
  local v
  v=$(aws ssm get-parameter --region "$REGION" --name "/cloudless/production/$key" \
        --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || echo "")
  if [[ -z "$v" || "$v" == "None" ]]; then v="$default"; fi
  echo "$v"
}

USER=$(ssm_get SES_SMTP_USER "")
PASS=$(ssm_get SES_SMTP_PASSWORD "")
FROM=$(ssm_get SES_FROM_EMAIL "noreply@cloudless.gr")
HOST=$(ssm_get SES_SMTP_HOST "email-smtp.${REGION}.amazonaws.com")

# Admin auth — HTTP Basic with the unified admin user. Avoids the
# `ESPOCRM_API_KEY` SSM dependency (the API key was provisioned for the
# cloudless-app SDK user with a non-admin role; Settings PATCH needs
# admin privileges so we use the unified human admin instead).
# Per project_unified_admin_creds: tbaltzakis / TH!123789th!
ADMIN_USER="${ESPOCRM_ADMIN_USER:-tbaltzakis}"
ADMIN_PASS="${ESPOCRM_ADMIN_PASSWORD:-}"

if [[ -z "$ADMIN_PASS" ]]; then
  ADMIN_PASS=$(ssm_get ESPOCRM_ADMIN_PASSWORD "")
fi

for v in USER PASS ADMIN_PASS; do
  if [[ -z "${!v}" ]]; then
    echo "✗ Missing required value: $v"
    if [[ "$v" == "USER" || "$v" == "PASS" ]]; then
      echo "  Run \`pnpm ses:provision\` first to populate SES_SMTP_USER/PASSWORD."
    else
      echo "  Set ESPOCRM_ADMIN_PASSWORD env var OR put it in SSM at"
      echo "  /cloudless/production/ESPOCRM_ADMIN_PASSWORD"
    fi
    exit 1
  fi
done

echo "→ PATCHing EspoCRM SMTP settings at $ESPOCRM_BASE_URL"
echo "  as admin: $ADMIN_USER  via HTTP basic"

# EspoCRM PATCH /api/v1/Settings accepts a JSON body matching the keys
# in data/config.php. Admin-only operation; the API key user (non-admin)
# would get 403. HTTP Basic with admin creds works.
HTTP=$(curl -sS -o /tmp/espo-smtp.resp -w '%{http_code}' \
  -X PUT "$ESPOCRM_BASE_URL/api/v1/Settings" \
  -u "$ADMIN_USER:$ADMIN_PASS" \
  -H 'Content-Type: application/json' \
  --data @<(cat <<JSON
{
  "outboundEmailFromAddress": "$FROM",
  "outboundEmailFromName": "Cloudless",
  "smtpServer": "$HOST",
  "smtpPort": 587,
  "smtpAuth": true,
  "smtpSecurity": "TLS",
  "smtpUsername": "$USER",
  "smtpPassword": "$PASS"
}
JSON
))

if [[ "$HTTP" =~ ^2 ]]; then
  echo "  ✓ EspoCRM SMTP configured (HTTP $HTTP)"
else
  echo "  ✗ HTTP $HTTP"; cat /tmp/espo-smtp.resp; exit 1
fi
rm -f /tmp/espo-smtp.resp

# Send a test email to confirm
echo "→ Sending test email to tbaltzakis@cloudless.gr"
TEST=$(curl -sS -o /tmp/espo-test.resp -w '%{http_code}' \
  -X POST "$ESPOCRM_BASE_URL/api/v1/Email/sendTest" \
  -u "$ADMIN_USER:$ADMIN_PASS" \
  -H 'Content-Type: application/json' \
  -d "{\"server\":\"$HOST\",\"port\":587,\"auth\":true,\"security\":\"TLS\",\"username\":\"$USER\",\"password\":\"$PASS\",\"fromAddress\":\"$FROM\",\"emailAddress\":\"tbaltzakis@cloudless.gr\"}")
echo "  test HTTP $TEST"; cat /tmp/espo-test.resp; echo; rm -f /tmp/espo-test.resp
