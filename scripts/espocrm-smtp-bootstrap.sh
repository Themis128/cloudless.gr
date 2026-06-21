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
API_KEY=$(ssm_get ESPOCRM_API_KEY "")

for v in USER PASS API_KEY; do
  if [[ -z "${!v}" ]]; then
    echo "✗ SSM key /cloudless/production/${v#API_}... missing (resolved to empty)"
    echo "  Run \`pnpm ses:provision\` first for SES_SMTP_*."
    exit 1
  fi
done

echo "→ POSTing EspoCRM SMTP settings to $ESPOCRM_BASE_URL"

# EspoCRM Settings API accepts a JSON body of the same field names that
# live in data/config.php. Authenticated via X-Api-Key header.
HTTP=$(curl -sS -o /tmp/espo-smtp.resp -w '%{http_code}' \
  -X PATCH "$ESPOCRM_BASE_URL/api/v1/Settings" \
  -H "X-Api-Key: $API_KEY" \
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
echo "→ Sending test email"
TEST=$(curl -sS -o /tmp/espo-test.resp -w '%{http_code}' \
  -X POST "$ESPOCRM_BASE_URL/api/v1/Email/sendTest" \
  -H "X-Api-Key: $API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"to\":\"tbaltzakis@cloudless.gr\"}")
echo "  test HTTP $TEST"; cat /tmp/espo-test.resp; rm -f /tmp/espo-test.resp
