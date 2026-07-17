#!/bin/bash
# AWS Monitoring Cleanup Script
# Generated for cloudless.gr migration to Cloudflare
# Run this AFTER verifying Cloudflare services are operational

set -e  # Exit on error

# === CONFIGURATION ===
# Option 1: Use AWS credentials from environment variables
# export AWS_ACCESS_KEY_ID="YOUR_KEY"
# export AWS_SECRET_ACCESS_KEY="YOUR_SECRET"
# export AWS_DEFAULT_REGION="us-east-1"

# Option 2: Use AWS profile
# export AWS_PROFILE=cloudless-cleanup

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== AWS Monitoring Cleanup for cloudless.gr ===${NC}"
echo "Prerequisites: AWS CLI v2 installed and configured"
echo ""

# === DRY-RUN MODE ===
# Set DRY_RUN=true to preview without making changes
DRY_RUN=${DRY_RUN:-true}

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}*** DRY-RUN MODE - No changes will be made ***${NC}"
fi

# === 1. CHECK CLOUDFRONT DISTRIBUTIONS ===
echo -e "\n${GREEN}=== Checking CloudFront Distributions ===${NC}"
aws cloudfront list-distributions \
    --query "DistributionList.Items[?contains(Aliases.Items, 'cloudless') || contains(Aliases.Items, 'cloudless.gr')].[Id,Status,Aliases.Items]" \
    --output table 2>/dev/null || echo "No CloudFront distributions found or error accessing"

# To delete a distribution (must be disabled first):
# Get distribution config and ETag
# DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?contains(Aliases.Items, 'cloudless')].[Id]" --output text)
# if [ -n "$DIST_ID" ]; then
#     ETag=$(aws cloudfront get-distribution-config --id $DIST_ID --query "ETag" --output text)
#     # Download config, set Enabled=false, update, then delete
# fi

# === 2. CHECK CLOUDWATCH LOG GROUPS ===
echo -e "\n${GREEN}=== Checking CloudWatch Log Groups ===${NC}"
aws logs describe-log-groups \
    --query "logGroups[?starts_with(logGroupName, '/aws/lambda/cloudless') || starts_with(logGroupName, '/aws/apigateway/cloudless') || starts_with(logGroupName, '/aws/monitoring/cloudless')].[logGroupName,storedBytes]" \
    --output table 2>/dev/null || echo "No CloudWatch log groups found or error accessing"

# === 3. CHECK SSM PARAMETERS ===
echo -e "\n${GREEN}=== Checking SSM Parameters ===${NC}"
aws ssm describe-parameters \
    --parameter-filters "Key=Name,Option=BeginsWith,Values=/cloudless/" \
    --query "Parameters[*].{Name:Name,Type:Type}" \
    --output table 2>/dev/null || echo "No SSM parameters found or error accessing"

# === 4. CHECK LAMBDA FUNCTIONS ===
echo -e "\n${GREEN}=== Checking Lambda Functions ===${NC}"
aws lambda list-functions \
    --query "Functions[?starts_with(FunctionName, 'cloudless')].[FunctionName,Runtime,State]" \
    --output table 2>/dev/null || echo "No Lambda functions found or error accessing"

# === 5. CHECK DYNAMODB TABLES ===
echo -e "\n${GREEN}=== Checking DynamoDB Tables ===${NC}"
aws dynamodb list-tables \
    --query "TableNames[?starts_with(@, 'cloudless')]" \
    --output text 2>/dev/null || echo "No DynamoDB tables found or error accessing"

# === 6. CHECK CLOUDWATCH ALARMS ===
echo -e "\n${GREEN}=== Checking CloudWatch Alarms ===${NC}"
aws cloudwatch describe-alarms \
    --alarm-name-prefix "cloudless" \
    --query "MetricAlarms[*].{Name:AlarmName,State:StateValue}" \
    --output table 2>/dev/null || echo "No CloudWatch alarms found or error accessing"

# === CLEANUP FUNCTIONS (uncomment to execute) ===
# Only run these after verifying Cloudflare is fully operational

cleanup_cloudwatch_logs() {
    echo -e "\n${RED}Deleting CloudWatch Log Groups...${NC}"
    for log_group in $(aws logs describe-log-groups \
        --query "logGroups[?starts_with(logGroupName, '/aws/lambda/cloudless') || starts_with(logGroupName, '/aws/monitoring/cloudless')].logGroupName" \
        --output text 2>/dev/null); do
        if [ "$DRY_RUN" = true ]; then
            echo "[DRY-RUN] Would delete: $log_group"
        else
            aws logs delete-log-group --log-group-name "$log_group"
            echo "Deleted: $log_group"
        fi
    done
}

cleanup_ssm_parameters() {
    echo -e "\n${RED}Deleting SSM Parameters...${NC}"
    for param in $(aws ssm describe-parameters \
        --parameter-filters "Key=Name,Option=BeginsWith,Values=/cloudless/" \
        --query "Parameters[].Name" \
        --output text 2>/dev/null); do
        if [ "$DRY_RUN" = true ]; then
            echo "[DRY-RUN] Would delete: $param"
        else
            aws ssm delete-parameter --name "$param"
            echo "Deleted: $param"
        fi
    done
}

cleanup_lambda_functions() {
    echo -e "\n${RED}Deleting Lambda Functions...${NC}"
    for func in $(aws lambda list-functions \
        --query "Functions[?starts_with(FunctionName, 'cloudless')].FunctionName" \
        --output text 2>/dev/null); do
        if [ "$DRY_RUN" = true ]; then
            echo "[DRY-RUN] Would delete: $func"
        else
            # Remove provisioned concurrency config first
            aws lambda delete-provisioned-concurrency-config --function-name "$func" --qualifier 1 2>/dev/null || true
            # Remove function URL config
            aws lambda delete-function-url-config --function-name "$func" 2>/dev/null || true
            # Delete function
            aws lambda delete-function --function-name "$func"
            echo "Deleted: $func"
        fi
    done
}

cleanup_cloudfront_distribution() {
    echo -e "\n${RED}Deleting CloudFront Distribution...${NC}"
    DIST_ID=$(aws cloudfront list-distributions \
        --query "DistributionList.Items[?contains(Aliases.Items, 'cloudless') || contains(Aliases.Items, 'cloudless.gr')].Id" \
        --output text 2>/dev/null)
    
    if [ -n "$DIST_ID" ] && [ "$DIST_ID" != "None" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo "[DRY-RUN] Would delete CloudFront distribution: $DIST_ID"
        else
            echo "Distribution $DIST_ID needs to be disabled first (set Enabled=false in config)"
            echo "Then run: aws cloudfront delete-distribution --id $DIST_ID --if-match <ETAG>"
        fi
    fi
}

# === EXECUTE CLEANUP ===
# To run actual cleanup, set DRY_RUN=false
if [ "$DRY_RUN" = false ]; then
    echo -e "\n${RED}*** EXECUTING CLEANUP ***${NC}"
    cleanup_cloudwatch_logs
    cleanup_ssm_parameters
    cleanup_lambda_functions
    cleanup_cloudfront_distribution
fi

echo -e "\n${GREEN}=== Recommendations ===${NC}"
echo "1. Verify Cloudflare Worker is deployed and healthy first"
echo "2. Ensure R2 buckets have all migrated data"
echo "3. Confirm D1 database has all user/auth data"
echo "4. Set DRY_RUN=false only after verification"
echo "5. Consider terraform destroy if resources are Terraform-managed"