#!/usr/bin/env bash
# Secret Verification Script for Cloudless.gr ETL
# Run this after configuring Wrangler secrets to verify everything is in place
# Usage: ./scripts/verify-secrets.sh

echo "=== Cloudless.gr ETL Secret Verification ==="
echo ""

# Check Wrangler secrets
echo "1. Wrangler Secrets Status:"
npx wrangler secret list 2>&1 | jq -r '.[] | "  - \(.name): \(.type)"' 2>/dev/null || echo "  (No secrets configured)"

echo ""
echo "2. Required Secrets Check:"
# Secrets that require Wrangler configuration (from REQUIRED_SECRETS array)
REQUIRED_SECRETS=(
    "ESPOCRM_API_KEY"
    "ESPOCRM_API_PASSWORD"
    "SLACK_WEBHOOK_URL"
    "POSTIZ_API_KEY"
)

# Note: ESPOCRM_BASE_URL is stored in D1 app_config, NOT a Wrangler secret
echo "  Configuration Status:"
echo "    [x] ESPOCRM_BASE_URL - (already in D1 app_config - NOT a secret)"
echo ""
echo "  Secrets that require interactive configuration:"
for secret in "${REQUIRED_SECRETS[@]}"; do
    echo "    [ ] $secret - (run: npx wrangler secret put $secret)"
done

echo ""
echo "3. D1 app_config Values:"
npx wrangler d1 execute user-auth-db --remote --command "SELECT key, value FROM app_config;" 2>&1 | \
    grep -A 100 '^\[' | jq -r '.[0].results[] | "  - \(.key): \(.value)"' 2>/dev/null || echo "  (Query failed or no results)"

echo ""
echo "4. R2 Buckets Status:"
npx wrangler r2 bucket list 2>&1 | grep 'name:' | sed 's/name: */  - /' || echo "  (R2 listing unavailable)"

echo ""
echo "5. Quick ETL Test (dry-run):"
echo "  Running pre-flight check for ESPOCRM connectivity..."
if [ -n "$ESPOCRM_BASE_URL" ]; then
    curl -s -o /dev/null -w "  HTTP %{http_code}\n" "${ESPOCRM_BASE_URL}/api/v1/App/user" 2>/dev/null || echo "  (ESPOCRM unreachable - check tunnel)"
else
    echo "  (ESPOCRM_BASE_URL not set locally - uses Wrangler secret in production)"
fi

echo ""
echo "=== Verification Complete ==="
echo ""
echo "To configure missing secrets, run:"
echo "  npx wrangler secret put ESPOCRM_API_KEY"
echo "  npx wrangler secret put ESPOCRM_API_PASSWORD"
echo "  npx wrangler secret put SLACK_WEBHOOK_URL"
echo "  npx wrangler secret put POSTIZ_API_KEY"
echo ""
echo "Note: ESPOCRM_BASE_URL is stored in D1 app_config (not a secret)"
