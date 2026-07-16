#!/usr/bin/env bash
# Fix IAM permissions for DynamoDB migration
# Usage: AWS_PROFILE=default bash scripts/fix-dynamodb-migration-permissions.sh

set -euo pipefail

POLICY_NAME="DynamoDBMigrationAccess"
POLICY_FILE="scripts/dynamodb-migration-policy.json"

echo "=== Fixing DynamoDB Migration Permissions ==="

# Check if policy file exists
if [ ! -f "$POLICY_FILE" ]; then
    echo "Creating IAM policy file..."
    cat > "$POLICY_FILE" << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBMigrationReadOnly",
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:ListTables",
        "dynamodb:DescribeTable"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DynamoDBMigrationLogging",
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:DescribeContinuousBackups",
        "dynamodb:DescribeTimeToLive"
      ],
      "Resource": "*"
    }
  ]
}
EOF
    echo "Created $POLICY_FILE"
fi

# Check if policy exists
EXISTING_ARN=$(aws iam list-policies --scope Local --query "Policies[?PolicyName=='$POLICY_NAME'].Arn" --output text 2>/dev/null || echo "")

if [ -z "$EXISTING_ARN" ]; then
    echo "Creating new IAM policy: $POLICY_NAME"
    POLICY_ARN=$(aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document file://"$POLICY_FILE" \
        --description "Permissions for DynamoDB to D1 migration" \
        --query "Policy.Arn" --output text)
    echo "Created policy: $POLICY_ARN"
else
    echo "Policy already exists: $EXISTING_ARN"
    POLICY_ARN="$EXISTING_ARN"
fi

# Get the user/role that needs the policy
# This should be adapted for your specific IAM user/role
echo ""
echo "To attach this policy to a user or role, run:"
echo "aws iam attach-user-policy --user-name cloudless-ops --policy-arn $POLICY_ARN"
echo "Or for a role:"
echo "aws iam attach-role-policy --role-name cloudless-migration-role --policy-arn $POLICY_ARN"
echo ""
echo "After attaching, verify with:"
echo "aws dynamodb scan --table-name cloudless-production-UserProfileTable-bctubzrn --select COUNT"