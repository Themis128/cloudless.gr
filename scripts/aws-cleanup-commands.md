# AWS Credentials Setup & Monitoring Cleanup Commands

# For cloudless.gr migration to Cloudflare

## Using Your Credential File

The `rootkey.csv` file likely contains GCP credentials (not AWS). To use it with AWS:

### Option 1: If rootkey.csv is AWS credentials (CSV format)

```bash
# Extract credentials from CSV (Linux/WSL/macOS)
export AWS_ACCESS_KEY_ID=$(awk -F',' 'NR==2 {print $1}' /mnt/c/Users/baltz/Downloads/rootkey.csv)
export AWS_SECRET_ACCESS_KEY=$(awk -F',' 'NR==2 {print $2}' /mnt/c/Users/baltz/Downloads/rootkey.csv)
export AWS_DEFAULT_REGION=us-east-1
```

### Option 2: If rootkey.csv is GCP credentials

```bash
# For GCP, install gcloud CLI and use:
gcloud auth activate-service-account --key-file=/mnt/c/Users/baltz/Downloads/rootkey.csv
```

## AWS Monitoring Cleanup Commands

### 1. Preview Current Resources (Safe - Read Only)

```bash
# List all CloudFront distributions with cloudless alias
aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Aliases.Items, 'cloudless') || contains(Aliases.Items, 'cloudless.gr')].[Id,Status,Aliases.Items]" \
  --output table

# List CloudWatch log groups for cloudless services
aws logs describe-log-groups \
  --query "logGroups[?starts_with(logGroupName, '/aws/lambda/cloudless') || starts_with(logGroupName, '/aws/monitoring/')].[logGroupName,storedBytes]" \
  --output table

# List SSM parameters
aws ssm describe-parameters \
  --parameter-filters "Key=Name,Option=BeginsWith,Values=/cloudless/" \
  --query "Parameters[*].{Name:Name}" \
  --output table

# List Lambda functions
aws lambda list-functions \
  --query "Functions[?starts_with(FunctionName, 'cloudless')].[FunctionName,State]" \
  --output table
```

### 2. Delete CloudFront Distribution (WARNING: Requires disabling first)

```bash
# Steps to delete CloudFront distribution:
# 1. Get distribution ID
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Aliases.Items, 'cloudless')].[Id]" \
  --output text)

# 2. Get current config and ETag
aws cloudfront get-distribution-config --id $DISTRIBUTION_ID > dist-config.json

# 3. Edit dist-config.json - change "Enabled": true to "Enabled": false
# 4. Update distribution (disables it)
ETAG=$(jq -r '.ETag' dist-config.json)
aws cloudfront update-distribution \
  --id $DISTRIBUTION_ID \
  --if-match $ETAG \
  --distribution-config file://dist-config.json

# 5. Wait ~15-20 minutes for deployment status to be "Deployed"
# 6. Then delete
aws cloudfront delete-distribution --id $DISTRIBUTION_ID --if-match $ETAG
```

### 3. Delete CloudWatch Log Groups

```bash
# Delete Lambda logs
aws logs delete-log-group --log-group-name /aws/lambda/cloudless-app-production

# Delete monitoring logs
aws logs delete-log-group --log-group-name /aws/monitoring/cloudless-alerts

# Delete all cloudless-related logs (batch)
aws logs describe-log-groups \
  --query "logGroups[?starts_with(logGroupName, '/aws/lambda/cloudless')].logGroupName" \
  --output text | while read lg; do
    aws logs delete-log-group --log-group-name "$lg"
  done
```

### 4. Delete SSM Parameters

```bash
# Delete specific parameters (only after confirming Cloudflare is primary)
aws ssm delete-parameter --name /cloudless/production/AUTH_SECRET
aws ssm delete-parameter --name /cloudless/production/SLACK_BOT_TOKEN
aws ssm delete-parameter --name /cloudless/production/STRIPE_SECRET_KEY

# Batch delete
aws ssm describe-parameters \
  --parameter-filters "Key=Name,Option=BeginsWith,Values=/cloudless/" \
  --query "Parameters[].Name" \
  --output text | while read param; do
    aws ssm delete-parameter --name "$param"
  done
```

### 5. Delete Lambda Functions

```bash
# Remove provisioned concurrency first
aws lambda delete-provisioned-concurrency-config \
  --function-name cloudless-app-production \
  --qualifier 1

# Remove function URL
aws lambda delete-function-url-config \
  --function-name cloudless-app-production

# Delete function
aws lambda delete-function --function-name cloudless-app-production

# Batch delete
aws lambda list-functions \
  --query "Functions[?starts_with(FunctionName, 'cloudless')].FunctionName" \
  --output text | while read func; do
    aws lambda delete-provisioned-concurrency-config --function-name "$func" --qualifier 1 2>/dev/null || true
    aws lambda delete-function-url-config --function-name "$func" 2>/dev/null || true
    aws lambda delete-function --function-name "$func"
  done
```

## Verification Checklist

- [ ] Cloudflare Worker deployed and healthy (`wrangler deploy` completed)
- [ ] R2 buckets contain all migrated data
- [ ] D1 database has all user/auth data (55 users, 54 roles verified)
- [ ] Metabase/Grafana accessible via Cloudflare Tunnel
- [ ] All DNS records migrated to Cloudflare

## Run Order (Important!)

1. Run preview commands first (read-only)
2. Delete CloudWatch log groups (safe - just logs)
3. Delete SSM parameters (secrets cleanup)
4. Disable and delete CloudFront distribution (takes 15-20 min)
5. Delete Lambda functions (final step)
