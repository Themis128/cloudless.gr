#!/usr/bin/env bash
# Seed LocalStack with the SSM parameters + DynamoDB tables the test suite
# expects. Idempotent — safe to re-run.
set -euo pipefail

ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"
REGION="${AWS_REGION:-us-east-1}"
PREFIX="${SSM_PREFIX:-/cloudless/test}"

echo "Seeding LocalStack at $ENDPOINT ($PREFIX)"

# Use aws CLI if present; otherwise install via pip (lightweight).
if ! command -v aws >/dev/null 2>&1; then
  pip install --quiet awscli-local
  alias aws='awslocal'
fi

# Helper for SSM put-parameter (String type, overwrite if exists)
put_param() {
  local name="$1"
  local value="$2"
  aws --endpoint-url "$ENDPOINT" --region "$REGION" ssm put-parameter \
    --name "${PREFIX}/${name}" \
    --value "$value" \
    --type String \
    --overwrite \
    >/dev/null
}

# Test values — non-secret placeholders so the AppConfig type fills out
put_param "SES_FROM_EMAIL"        "noreply@cloudless.test"
put_param "SES_TO_EMAIL"          "team@cloudless.test"
put_param "AWS_SES_REGION"        "us-east-1"
put_param "NEWSLETTER_SEND_SECRET" "test-newsletter-secret"
put_param "STRIPE_SECRET_KEY"     "sk_test_localstack"
put_param "STRIPE_PUBLISHABLE_KEY" "pk_test_localstack"
put_param "STRIPE_WEBHOOK_SECRET" "whsec_test_localstack"
put_param "AUTH_SECRET"           "test-auth-secret-32-chars-minimum-xxxx"
put_param "ESPOCRM_BASE_URL"      "https://espocrm.cloudless.test"
put_param "ESPOCRM_API_KEY"       "test-espocrm-key"
put_param "ESPOCRM_WEBHOOK_SECRET" "test-espocrm-webhook-secret"
put_param "NOTION_API_KEY"        "secret_test_notion"
put_param "NOTION_BLOG_DB_ID"     "00000000-0000-0000-0000-000000000001"
put_param "NOTION_WEBHOOK_SECRET" "test-notion-webhook-secret"
put_param "SLACK_SIGNING_SECRET"  "test-slack-signing-secret"
put_param "GSC_SITE_URL"          "sc-domain:cloudless.test"

echo "SSM params seeded."

# Create DynamoDB table for stripe-transactions
TABLE_NAME="${STRIPE_TRANSACTIONS_TABLE:-cloudless-test-StripeTransactions}"

aws --endpoint-url "$ENDPOINT" --region "$REGION" dynamodb describe-table \
  --table-name "$TABLE_NAME" >/dev/null 2>&1 || \
aws --endpoint-url "$ENDPOINT" --region "$REGION" dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions AttributeName=eventId,AttributeType=S \
  --key-schema AttributeName=eventId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  >/dev/null

echo "DynamoDB table $TABLE_NAME ready."
echo "Seed complete."
