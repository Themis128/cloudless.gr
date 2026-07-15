#!/usr/bin/env bash
# Audit the production Lambda's env vars vs. expected post-Keycloak baseline.
# Flags missing/stale vars that cause 500s on /api/auth/*.
#
# Usage: bash scripts/lambda-env-audit.sh

set -uo pipefail

REGION="us-east-1"

# Find the Server Lambda by tag (function name suffix is random)
LAMBDA_FN=$(aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=cloudless \
  --resource-type-filters "lambda:function" \
  --region "$REGION" 2>/dev/null \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d.get('ResourceTagMappingList', []):
    arn = r.get('ResourceARN', '')
    if 'Server' in arn and 'Server' in arn.split(':')[-1]:
        print(arn.split(':')[-1])
        break
")

if [[ -z "$LAMBDA_FN" ]]; then
  echo "✗ Could not find Server Lambda. Aborting."
  exit 1
fi

echo "═══════════════════════════════════════════════════════════════"
echo "  LAMBDA ENV AUDIT: $LAMBDA_FN"
echo "═══════════════════════════════════════════════════════════════"

ENV_JSON=$(aws lambda get-function-configuration \
  --function-name "$LAMBDA_FN" \
  --region "$REGION" \
  --query "Environment.Variables" 2>/dev/null)

if [[ -z "$ENV_JSON" ]] || [[ "$ENV_JSON" == "null" ]]; then
  echo "✗ Could not read env. IAM permissions?"
  exit 1
fi

check() {
  local key="$1" required="$2" hint="$3"
  local value
  value=$(echo "$ENV_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$key',''))" 2>/dev/null)
  if [[ -z "$value" ]]; then
    if [[ "$required" == "required" ]]; then
      printf "  ✗  %-35s MISSING — %s\n" "$key" "$hint"
    else
      printf "  ⚠  %-35s not set — %s\n" "$key" "$hint"
    fi
  else
    # Mask only true secrets; show others as plain
    # Exclude ISSUER URL keys even though they contain "_KEY" technically (they don't)
    if [[ "$key" == "AUTH_SECRET" ]] || [[ "$key" == *"PASSWORD"* ]] || [[ "$key" == *"_API_KEY"* ]] || [[ "$key" == "ANTHROPIC_API_KEY" ]] || [[ "$key" == *"WEBHOOK_SECRET"* ]] || [[ "$key" == "NEWSLETTER_SEND_SECRET" ]] || [[ "$key" == "CRON_SECRET" ]]; then
      printf "  ✓  %-35s [%d chars]\n" "$key" "${#value}"
    else
      # Truncate long values
      if [[ ${#value} -gt 60 ]]; then
        printf "  ✓  %-35s %s...\n" "$key" "${value:0:60}"
      else
        printf "  ✓  %-35s %s\n" "$key" "$value"
      fi
    fi
  fi
}

echo ""
echo "▸ Required for next-auth (Cognito):"
check "AUTH_SECRET" required "next-auth JWT encryption — 500 if missing"
check "AUTH_TRUST_HOST" required "must be 'true' behind CloudFront"
check "AUTH_URL" required "callback URL construction"
check "COGNITO_USER_POOL_ID" required "server-side JWT verify (proxy.ts + api-auth.ts)"
check "COGNITO_CLIENT_ID" required "next-auth Cognito provider"
check "NEXT_PUBLIC_COGNITO_USER_POOL_ID" required "client OIDC init + USE_HOSTED_UI gate"
check "NEXT_PUBLIC_COGNITO_CLIENT_ID" required "client OIDC init"
check "NEXT_PUBLIC_COGNITO_DOMAIN" required "Hosted UI signup / forgot-password redirects"

echo ""
echo "▸ Required for SSM-loaded secrets:"
check "SSM_PREFIX" required "where ssm-config.ts looks"
check "NEXT_PUBLIC_SITE_URL" required "Stripe/HubSpot callback URLs"

echo ""
echo "▸ Deploy traceability:"
check "APP_VERSION" optional "shows in /api/health"
check "NODE_ENV" required "should be 'production'"

echo ""
echo "▸ Stale Cognito (should be REMOVED after Cognito deletion 2026-05-30):"
COG_POOL=$(echo "$ENV_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('NEXT_PUBLIC_COGNITO_USER_POOL_ID',''))" 2>/dev/null)
if [[ -n "$COG_POOL" ]]; then
  printf "  ⚠  NEXT_PUBLIC_COGNITO_USER_POOL_ID  stale: %s — remove from sst.config.ts\n" "$COG_POOL"
else
  printf "  ✓  NEXT_PUBLIC_COGNITO_USER_POOL_ID  not set (correct)\n"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "▸ Live smoke (current behaviour):"
for ep in "/api/health|200" "/api/auth/session|200" "/api/auth/providers|200"; do
  IFS='|' read -r path expected <<< "$ep"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://cloudless.gr${path}" 2>/dev/null)
  if [[ "$code" == "$expected" ]]; then
    printf "  ✓  %-30s %s\n" "$path" "$code"
  else
    printf "  ✗  %-30s expected %s, got %s\n" "$path" "$expected" "$code"
  fi
done
