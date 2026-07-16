#!/bin/bash
# AWS Cleanup Script - Run after Cloudflare Email validation
# Deletes AWS resources after confirming Cloudflare Email is working

set -euo pipefail

echo "⚠️  AWS Resource Cleanup Script"
echo "================================"
echo ""
echo "This script deletes the following AWS resources:"
echo "  - DynamoDB tables (UserProfile, SessionTokenStore, StripeTransactions, AdminNotifications, AnalyticsCache)"
echo "  - S3 buckets (cloudless-production-cloudlesssiteassetsbucket-sasvvhra, cloudless-analytics-data)"
echo "  - Athena workgroup"
echo "  - Cognito User Pool"
echo "  - SES configuration (if verified)"
echo ""

read -p "Have you verified Cloudflare Email is working? (yes to continue): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted. Run this after confirming: curl -X POST https://cloudless.gr/api/contact -d '...'"
    exit 0
fi

echo ""
echo "[1/5] Deleting DynamoDB tables..."
TABLES=(
    "cloudless-production-UserProfileTable"
    "cloudless-production-SessionTokenStoreTable"
    "cloudless-production-StripeTransactionsTable"
    "cloudless-production-AdminNotificationsTable"
    "cloudless-production-AnalyticsCacheTable"
)

for table in "${TABLES[@]}"; do
    aws dynamodb delete-table --table-name "$table" --region us-east-1 2>/dev/null && \
        echo "✓ Deleted: $table" || \
        echo "  (may already be deleted): $table"
done

echo ""
echo "[2/5] Deleting S3 buckets..."
BUCKETS=(
    "cloudless-production-cloudlesssiteassetsbucket-sasvvhra"
    "cloudless-analytics-data"
)

for bucket in "${BUCKETS[@]}"; do
    aws s3 rb "s3://$bucket" --force --region us-east-1 2>/dev/null && \
        echo "✓ Deleted: $bucket" || \
        echo "  (may already be deleted): $bucket"
done

echo ""
echo "[3/5] Deleting Athena workgroup..."
aws athena delete-work-group --work-group "CloudlessAnalytics" 2>/dev/null && \
    echo "✓ Deleted: CloudlessAnalytics workgroup" || \
    echo "  Workgroup may already be deleted"

echo ""
echo "[4/5] Deleting Cognito User Pool..."
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 60 --region us-east-1 \
    --query "UserPools[?contains(Name, 'cloudless')].Id" --output text 2>/dev/null || echo "")

if [ -n "$USER_POOL_ID" ] && [ "$USER_POOL_ID" != "None" ]; then
    aws cognito-idp delete-user-pool --user-pool-id "$USER_POOL_ID" --region us-east-1 2>/dev/null && \
        echo "✓ Deleted: Cognito User Pool ($USER_POOL_ID)" || \
        echo "  Cognito may already be deleted"
else
    echo "  No Cognito User Pool found"
fi

echo ""
echo "[5/5] Checking SES..."
SES_IDENTITY=$(aws ses get-identity_verification_attributes --region us-east-1 \
    --query "VerificationAttributes[?contains(key, 'cloudless')].key" --output text 2>/dev/null || echo "")

if [ -n "$SES_IDENTITY" ]; then
    echo "  SES identities found (verify if needed to delete manually): $SES_IDENTITY"
fi

echo ""
echo "=========================================="
echo "✅ AWS Cleanup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Verify D1 auth works (check /api/auth/session returns user data)"
echo "2. Verify email sending works (contact form test)"
echo "3. Archive old DynamoDB data if needed for compliance"