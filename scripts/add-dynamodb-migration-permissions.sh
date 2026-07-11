#!/bin/bash
# Add IAM permissions for DynamoDB migration to D1

set -e

echo "Adding DynamoDB migration permissions to cloudless-ops user..."

aws iam create-policy \
  --policy-name cloudless-dynamodb-migration \
  --policy-document file://scripts/dynamodb-migration-policy.json || echo "Policy may already exist"

aws iam attach-user-policy \
  --user-name cloudless-ops \
  --policy-arn arn:aws:iam::278585680617:policy/cloudless-dynamodb-migration || true

echo "✅ DynamoDB migration permissions added"