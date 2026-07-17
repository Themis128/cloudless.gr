#!/bin/bash
# AWS Cleanup Script - Deletes migrated resources while preserving core Lambda functions
# Core Lambda functions preserved: SES-to-EspoCRM, pi-proxy
# Resources to delete: DynamoDB tables, Athena workgroup, Cognito, Bedrock IAM, S3 buckets, SSM parameters, etc.

set -euo pipefail

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-278585680617}"

echo "=== AWS Migrated Resources Cleanup ==="
echo "Region: $AWS_REGION"
echo "Account: $AWS_ACCOUNT_ID"
echo ""
echo "⚠️  PRESERVED: Core Lambda functions (SES-to-EspoCRM, pi-proxy)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to confirm action
confirm() {
    local message="$1"
    read -p "$message [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipped."
        return 1
    fi
    return 0
}

# 1. Delete DynamoDB tables (migrated to D1)
echo -e "\n${YELLOW}=== Step 1: DynamoDB Tables ===${NC}"
echo "Tables migrated to D1 database (user-auth-db):"

TABLES=(
    "cloudless-production-UserProfileTable-bctubzrn"
    "cloudless-production-SessionTokenStoreTable-mrbwcwzt"
    "cloudless-production-StripeTransactionsTable-nhtvnuew"
    "cloudless-production-AdminNotificationsTable-uuhacatu"
    "cloudless-production-AnalyticsCacheTable-fneaemkr"
    "cloudless-production-CloudlessSiteRevalidationTable-srcdceah"
)

for table in "${TABLES[@]}"; do
    echo "  - $table"
done

if confirm "Delete all 6 DynamoDB tables above?"; then
    for table in "${TABLES[@]}"; do
        echo "Processing table: $table"
        # Disable deletion protection if enabled (requires --cli-input-json for AWS CLI 2.x)
        aws dynamodb update-table --table-name "$table" --region "$AWS_REGION" --cli-input-json '{"DeletionProtectionEnabled": false}' 2>/dev/null || true
        aws dynamodb delete-table --table-name "$table" --region "$AWS_REGION" 2>&1 || echo "Table $table may not exist or already deleted"
    done
    echo -e "${GREEN}✓ DynamoDB tables deletion initiated${NC}"
fi

# 2. Delete Athena workgroup (replaced by DuckDB-Wasm on Pi)
echo -e "\n${YELLOW}=== Step 2: Athena Workgroup ===${NC}"
echo "Workgroup: cloudless-analytics-workgroup"

if confirm "Delete Athena workgroup?"; then
    aws athena delete-work-group --work-group "cloudless-analytics-workgroup" --recursive-delete-option --region "$AWS_REGION" 2>&1 || echo "Workgroup may not exist or already deleted"
    echo -e "${GREEN}✓ Athena workgroup deletion initiated${NC}"
fi

# 3. Delete Cognito resources (replaced by D1 auth)
echo -e "\n${YELLOW}=== Step 3: Cognito User Pool ===${NC}"
echo "User Pool ID from SSM: ~~/cloudless/production~~"

if confirm "Delete Cognito User Pool and Client?"; then
    # Get actual pool ID from SSM
    POOL_ID=$(aws ssm get-parameter --name "/cloudless/production/COGNITO_USER_POOL_ID" --region "$AWS_REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "")
    if [[ -n "$POOL_ID" ]]; then
        echo "Deleting user pool: $POOL_ID"
        # Delete all app clients first
        CLIENTS=$(aws cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" --region "$AWS_REGION" --query "UserPoolClients[].ClientId" --output text 2>/dev/null || echo "")
        for client in $CLIENTS; do
            aws cognito-idp delete-user-pool-client --user-pool-id "$POOL_ID" --client-id "$client" --region "$AWS_REGION" 2>/dev/null || true
        done
        aws cognito-idp delete-user-pool --user-pool-id "$POOL_ID" --region "$AWS_REGION" 2>/dev/null || echo "Pool may already be deleted"
    fi
    echo -e "${GREEN}✓ Cognito cleanup completed${NC}"
fi

# 4. Revoke Bedrock IAM permissions
echo -e "\n${YELLOW}=== Step 4: Bedrock IAM Permissions ===${NC}"
echo "Policy: cloudless-bedrock-access"

if confirm "Delete Bedrock IAM policy?"; then
    POLICY_ARN=$(aws iam list-policies --scope Local --region "$AWS_REGION" --query "Policies[?contains(PolicyName, 'bedrock')].Arn" --output text 2>/dev/null || echo "")
    if [[ -n "$POLICY_ARN" ]]; then
        # Detach from all roles first
        ROLES=$(aws iam list-entities-for-policy --policy-arn "$POLICY_ARN" --region "$AWS_REGION" --query "PolicyRoles[].RoleName" --output text 2>/dev/null || echo "")
        for role in $ROLES; do
            aws iam detach-role-policy --role-name "$role" --policy-arn "$POLICY_ARN" --region "$AWS_REGION" 2>/dev/null || true
        done
        aws iam delete-policy --policy-arn "$POLICY_ARN" --region "$AWS_REGION" 2>/dev/null || echo "Policy may already be deleted"
    fi
    echo -e "${GREEN}✓ Bedrock IAM policy cleanup completed${NC}"
fi

# 5. Delete S3 buckets (migrated to R2)
echo -e "\n${YELLOW}=== Step 5: S3 Buckets ===${NC}"
echo "Buckets migrated to R2:"

BUCKETS=(
    "cloudless-production-assets"
    "cloudless-production-analytics"
    "cloudless-production-backups"
)

for bucket in "${BUCKETS[@]}"; do
    echo "  - $bucket"
done

if confirm "Delete S3 buckets and all contents?"; then
    for bucket in "${BUCKETS[@]}"; do
        echo "Emptying and deleting bucket: $bucket"
        aws s3 rm "s3://$bucket" --recursive --region "$AWS_REGION" 2>/dev/null || echo "Bucket $bucket may not exist"
        aws s3api delete-bucket --bucket "$bucket" --region "$AWS_REGION" 2>/dev/null || echo "Bucket may already be deleted"
    done
    echo -e "${GREEN}✓ S3 buckets cleanup completed${NC}"
fi

# 6. Clean up CloudWatch alarms
echo -e "\n${YELLOW}=== Step 6: CloudWatch Alarms ===${NC}"
echo "Monitoring alarms to be deleted:"

ALARMS=$(aws cloudwatch describe-alarms --region "$AWS_REGION" --query "MetricAlarms[?contains(AlarmName, 'cloudless') || contains(AlarmName, 'Cloudless')].AlarmName" --output text 2>/dev/null || echo "")
if [[ -n "$ALARMS" ]]; then
    for alarm in $ALARMS; do
        echo "  - $alarm"
    done
    if confirm "Delete CloudWatch alarms?"; then
        for alarm in $ALARMS; do
            aws cloudwatch delete-alarms --alarm-names "$alarm" --region "$AWS_REGION" 2>/dev/null || true
        done
        echo -e "${GREEN}✓ CloudWatch alarms cleanup completed${NC}"
    fi
else
    echo "  No cloudless-related alarms found"
fi

# 7. Clean up SSM parameters (non-critical)
echo -e "\n${YELLOW}=== Step 7: SSM Parameters ===${NC}"
echo "SSM parameters to review for cleanup:"

SSM_PARAMS=$(aws ssm describe-parameters --region "$AWS_REGION" --parameter-filters "Key=Path,Option=Recursive,Values=/cloudless/production" --query "Parameters[?contains(Name, 'DYNAMODB') || contains(Name, 'ATHENA') || contains(Name, 'COGNITO') || contains(Name, 'BEDROCK') || contains(Name, 'S3')].Name" --output text 2>/dev/null || echo "")

if [[ -n "$SSM_PARAMS" ]]; then
    for param in $SSM_PARAMS; do
        echo "  - $param"
    done
    echo ""
    echo "⚠️  MANUAL REVIEW REQUIRED: Some SSM parameters may still be needed for Lambda functions"
    echo "    The pi-proxy Lambda uses: FUNNEL_HOST_PARAM, PI_HOST_HEADER, BACKEND_TTL_SEC, UPSTREAM_TIMEOUT_SEC"
    if confirm "Delete these SSM parameters? (Review carefully first!)"; then
        for param in $SSM_PARAMS; do
            aws ssm delete-parameter --name "$param" --region "$AWS_REGION" 2>/dev/null || true
        done
        echo -e "${GREEN}✓ SSM parameters cleanup completed${NC}"
    fi
else
    echo "  No migrated SSM parameters found"
fi

# 8. Summary - Lambda functions preserved
echo -e "\n${GREEN}=== Summary ===${NC}"
echo "The following Lambda functions were ${RED}PRESERVED${NC}:"
echo "  - pi-proxy (Lambda: cloudless-pi-proxy) - HA failover proxy"
echo "  - SES-to-EspoCRM (email webhook handler) - Application logic"
echo ""
echo "These handle ${GREEN}application logic${NC}, not monitoring."
echo ""

echo -e "\n${YELLOW}Manual verification steps:${NC}"
echo "1. Verify DynamoDB tables are deleted (check AWS console)"
echo "2. Verify Athena workgroup is deleted"
echo "3. Verify Cognito resources are deleted"
echo "4. Verify Bedrock IAM policy is removed"
echo "5. Verify S3 buckets are empty and deleted"
echo "6. Verify pi-proxy Lambda still functions for HA failover"
echo "7. Verify SES-to-EspoCRM Lambda still processes webhooks"