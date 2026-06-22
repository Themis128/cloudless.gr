#!/usr/bin/env bash
# Deploy / upgrade the SES → EspoCRM Case bridge.
#
# Idempotent — safe to re-run. Reads AWS creds from the env. Uses the same
# /cloudless/production/ SSM keys the rest of the app uses.
#
# Components created (or updated in place):
#   - S3 bucket           cloudless-ses-inbound
#   - IAM role            cloudless-ses-to-espocrm-role
#   - IAM policy          cloudless-ses-to-espocrm-policy
#   - Lambda function     cloudless-ses-to-espocrm  (Node.js 22, arm64)
#   - Lambda permission   AllowS3Invoke
#   - SES receipt rule    m-e5cdc97d89c94942a8354ae6c4aa4a72 (UPDATED to add S3Action)
#   - S3 notification     PUT on inbound/* → Lambda
#
# IMPORTANT: this script mutates the SES rule for cloudless.gr. After this
# runs, every inbound email is written to s3://cloudless-ses-inbound/inbound/
# BEFORE being delivered to WorkMail (the existing WorkmailAction is preserved
# so users still receive their mail).
set -euo pipefail

REGION=us-east-1
ACCOUNT=278585680617
BUCKET=cloudless-ses-inbound
ROLE=cloudless-ses-to-espocrm-role
POLICY=cloudless-ses-to-espocrm-policy
FN=cloudless-ses-to-espocrm
RULE_SET=INBOUND_MAIL
RULE_NAME=m-e5cdc97d89c94942a8354ae6c4aa4a72
WORKMAIL_ORG_ARN="arn:aws:workmail:${REGION}:${ACCOUNT}:organization/m-e5cdc97d89c94942a8354ae6c4aa4a72"

cd "$(dirname "$0")"
HERE=$(pwd)

echo "→ 1. S3 bucket ${BUCKET}"
aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null \
  || aws s3 mb "s3://${BUCKET}" --region "$REGION"

aws s3api put-bucket-policy --bucket "$BUCKET" --policy "$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowSESPuts",
    "Effect": "Allow",
    "Principal": {"Service": "ses.amazonaws.com"},
    "Action": "s3:PutObject",
    "Resource": "arn:aws:s3:::${BUCKET}/inbound/*",
    "Condition": {"StringEquals": {"AWS:SourceAccount": "${ACCOUNT}"}}
  }]
}
JSON
)"

echo "→ 2. lifecycle: auto-delete inbound/* after 90 days (kept long enough for replay)"
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration "$(cat <<JSON
{"Rules": [{
  "ID": "expire-inbound-90d",
  "Status": "Enabled",
  "Filter": {"Prefix": "inbound/"},
  "Expiration": {"Days": 90}
}]}
JSON
)"

echo "→ 3. IAM role ${ROLE}"
aws iam get-role --role-name "$ROLE" >/dev/null 2>&1 \
  || aws iam create-role --role-name "$ROLE" --assume-role-policy-document "$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
JSON
)"

aws iam attach-role-policy --role-name "$ROLE" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

echo "→ 4. IAM policy ${POLICY}"
POLICY_ARN="arn:aws:iam::${ACCOUNT}:policy/${POLICY}"
POLICY_DOC=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect": "Allow", "Action": ["s3:GetObject"], "Resource": "arn:aws:s3:::${BUCKET}/inbound/*"},
    {"Effect": "Allow", "Action": ["ssm:GetParameter"], "Resource": [
      "arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/cloudless/production/ESPOCRM_BASE_URL",
      "arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/cloudless/production/ESPOCRM_API_KEY"
    ]},
    {"Effect": "Allow", "Action": ["kms:Decrypt"], "Resource": "*",
     "Condition": {"StringLike": {"kms:EncryptionContext:PARAMETER_ARN": "arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/cloudless/production/*"}}}
  ]
}
JSON
)
if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
  aws iam create-policy-version --policy-arn "$POLICY_ARN" --policy-document "$POLICY_DOC" --set-as-default
else
  aws iam create-policy --policy-name "$POLICY" --policy-document "$POLICY_DOC"
fi
aws iam attach-role-policy --role-name "$ROLE" --policy-arn "$POLICY_ARN"

echo "→ 5. Lambda zip"
cd "$HERE/lambda"
rm -rf node_modules package-lock.json
npm install --omit=dev --no-audit --no-fund >/dev/null
zip -qr /tmp/ses-to-espocrm.zip . -x "*.zip" "*.log"

echo "→ 6. Lambda function ${FN}"
ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${ROLE}"
if aws lambda get-function --function-name "$FN" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FN" --zip-file fileb:///tmp/ses-to-espocrm.zip >/dev/null
  aws lambda update-function-configuration --function-name "$FN" \
    --runtime nodejs22.x --architectures arm64 --memory-size 256 --timeout 30 \
    --handler index.handler --role "$ROLE_ARN" >/dev/null
else
  # Role propagation takes 5-10s on first create — retry loop.
  for i in 1 2 3 4 5 6; do
    aws lambda create-function --function-name "$FN" \
      --runtime nodejs22.x --architectures arm64 --memory-size 256 --timeout 30 \
      --handler index.handler --role "$ROLE_ARN" \
      --zip-file fileb:///tmp/ses-to-espocrm.zip && break
    echo "    (role not yet propagated, retry $i...)"
    sleep 5
  done
fi

echo "→ 7. allow S3 bucket to invoke Lambda"
aws lambda add-permission --function-name "$FN" \
  --statement-id AllowS3Invoke --action lambda:InvokeFunction \
  --principal s3.amazonaws.com --source-arn "arn:aws:s3:::${BUCKET}" \
  --source-account "$ACCOUNT" 2>/dev/null || true   # already exists is fine

echo "→ 8. S3 notification: inbound/* PUT → Lambda"
aws s3api put-bucket-notification-configuration --bucket "$BUCKET" --notification-configuration "$(cat <<JSON
{
  "LambdaFunctionConfigurations": [{
    "Id": "ses-inbound-to-espocrm",
    "LambdaFunctionArn": "arn:aws:lambda:${REGION}:${ACCOUNT}:function:${FN}",
    "Events": ["s3:ObjectCreated:Put"],
    "Filter": {"Key": {"FilterRules": [{"Name": "prefix", "Value": "inbound/"}]}}
  }]
}
JSON
)"

echo "→ 9. update SES receipt rule (add S3Action BEFORE WorkmailAction)"
aws ses update-receipt-rule --rule-set-name "$RULE_SET" --rule "$(cat <<JSON
{
  "Name": "${RULE_NAME}",
  "Enabled": true,
  "TlsPolicy": "Optional",
  "Recipients": ["cloudless-org-us-east.awsapps.com", "cloudless.gr"],
  "Actions": [
    {"S3Action": {"BucketName": "${BUCKET}", "ObjectKeyPrefix": "inbound/"}},
    {"WorkmailAction": {"OrganizationArn": "${WORKMAIL_ORG_ARN}"}}
  ],
  "ScanEnabled": false
}
JSON
)"

echo
echo "✅ Deployed. Send an email to tbaltzakis@cloudless.gr and watch:"
echo "   aws logs tail /aws/lambda/${FN} --follow --region ${REGION}"
