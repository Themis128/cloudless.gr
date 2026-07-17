#!/bin/bash
# Use GCP service account (rootkey.csv) to check/remove AWS monitoring services
# This script assumes you're running in WSL/Linux with GCP SDK available

# === SETUP CREDENTIALS FROM rootkey.csv ===
# The rootkey.csv from Google Cloud contains: project_id,private_key_id,private_key,...
# For AWS CLI operations, you'll need AWS-specific credentials instead

# If you have BOTH AWS and GCP credentials in CSV format:
# AWS CSV format: AWS_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY
# GCP format: project_id,private_key_id,private_key,...

# === CHECK WHAT TYPE OF CREDENTIAL FILE THIS IS ===
if [ -f "/mnt/c/Users/baltz/Downloads/rootkey.csv" ]; then
    echo "Found credential file at /mnt/c/Users/baltz/Downloads/rootkey.csv"
    head -1 /mnt/c/Users/baltz/Downloads/rootkey.csv
    
    # Check if it's AWS or GCP format
    if head -1 /mnt/c/Users/baltz/Downloads/rootkey.csv | grep -q "AWS_ACCESS_KEY_ID"; then
        echo "Detected AWS credentials format"
        export AWS_ACCESS_KEY_ID=$(awk -F',' 'NR==2 {print $1}' /mnt/c/Users/baltz/Downloads/rootkey.csv)
        export AWS_SECRET_ACCESS_KEY=$(awk -F',' 'NR==2 {print $2}' /mnt/c/Users/baltz/Downloads/rootkey.csv)
    else
        echo "Detected GCP credentials format - AWS CLI will need separate AWS credentials"
    fi
fi

# === AWS MONITORING SERVICES TO REMOVE ===
# Run these commands after AWS credentials are configured:

cat << 'EOF'

# Commands to remove AWS monitoring services:

# 1. List and remove CloudWatch log groups
aws logs describe-log-groups --query "logGroups[?starts_with(logGroupName, '/aws/lambda/cloudless')].[logGroupName]" --output text | while read lg; do
    aws logs delete-log-group --log-group-name "$lg"
done

# 2. List and remove SSM parameters
aws ssm describe-parameters --parameter-filters "Key=Name,Option=BeginsWith,Values=/cloudless/" --query "Parameters[].Name" --output text | while read p; do
    aws ssm delete-parameter --name "$p"
done

# 3. List and remove Lambda functions
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'cloudless')].FunctionName" --output text | while read f; do
    aws lambda delete-provisioned-concurrency-config --function-name "$f" --qualifier 1 2>/dev/null || true
    aws lambda delete-function-url-config --function-name "$f" 2>/dev/null || true
    aws lambda delete-function --function-name "$f"
done

# 4. List and disable CloudFront distribution
aws cloudfront list-distributions --query "DistributionList.Items[?contains(Aliases.Items, 'cloudless')].[Id,Status]" --output table

EOF