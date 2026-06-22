#!/bin/bash
# Helper script to retrieve Cognito credentials from SSM for local dev

set -e

POOL_ID="us-east-1_1Bq3Mpqer"
REGION="us-east-1"

echo "🔍 Fetching Cognito credentials from AWS SSM..."
echo ""

# Try to get Client ID
if CLIENT_ID=$(aws ssm get-parameter \
  --name "/cloudless/production/COGNITO_CLIENT_ID" \
  --query "Parameter.Value" --output text 2>/dev/null); then
  echo "✅ COGNITO_CLIENT_ID: $CLIENT_ID"
else
  echo "❌ Failed to fetch COGNITO_CLIENT_ID"
  echo "   Make sure you have AWS credentials configured"
  exit 1
fi

# Try to get Client Secret
if CLIENT_SECRET=$(aws ssm get-parameter \
  --name "/cloudless/production/COGNITO_CLIENT_SECRET" \
  --query "Parameter.Value" --output text 2>/dev/null); then
  echo "✅ COGNITO_CLIENT_SECRET: $CLIENT_SECRET"
else
  echo "⚠️  COGNITO_CLIENT_SECRET not found (public client?)"
  CLIENT_SECRET=""
fi

# Generate or use existing AUTH_SECRET
if [ -f .env.local ]; then
  EXISTING_SECRET=$(grep "^AUTH_SECRET=" .env.local | cut -d= -f2)
  if [ -n "$EXISTING_SECRET" ]; then
    AUTH_SECRET="$EXISTING_SECRET"
    echo "✅ AUTH_SECRET (using existing): $AUTH_SECRET"
  fi
fi

if [ -z "$AUTH_SECRET" ]; then
  AUTH_SECRET=$(openssl rand -base64 32)
  echo "✅ AUTH_SECRET (generated): $AUTH_SECRET"
fi

echo ""
echo "📝 Update your .env.local with:"
echo ""
echo "COGNITO_CLIENT_ID=$CLIENT_ID"
echo "COGNITO_CLIENT_SECRET=$CLIENT_SECRET"
echo "COGNITO_USER_POOL_ID=$POOL_ID"
echo "COGNITO_ISSUER=https://cognito-idp.$REGION.amazonaws.com/$POOL_ID"
echo "AUTH_SECRET=$AUTH_SECRET"
echo ""
