#!/usr/bin/env bash
# Deploy / upgrade the Portal Notifications SNS infrastructure.
#
# Creates (or updates in place):
#   1. SNS topic                  cloudless-portal-notifications
#   2. Email subscription         SES_TO_EMAIL (fetched from SSM)
#   3. Lambda subscription        cloudless-portal-sns-to-slack
#   4. IAM role                   cloudless-portal-notifications-role
#   5. IAM policy                 cloudless-portal-notifications-policy
#   6. SSM parameter              /cloudless/production/SNS_PORTAL_TOPIC_ARN
#
# Idempotent — safe to re-run. Reads AWS creds from the environment.
set -euo pipefail

REGION=us-east-1
ACCOUNT=278585680617
TOPIC_NAME=cloudless-portal-notifications
FN=cloudless-portal-sns-to-slack
ROLE=cloudless-portal-notifications-role
POLICY=cloudless-portal-notifications-policy
SSM_KEY_SNS="/cloudless/production/SNS_PORTAL_TOPIC_ARN"

cd "$(dirname "$0")"
HERE=$(pwd)

echo "→ 1. Create SNS topic ${TOPIC_NAME}"
TOPIC_ARN=$(aws sns create-topic --name "$TOPIC_NAME" --region "$REGION" \
  --attributes '{"FifoTopic":"false"}' \
  --query TopicArn --output text)
echo "   Topic ARN: ${TOPIC_ARN}"

echo "→ 2. Look up SES_TO_EMAIL from SSM for the email subscription"
SES_TO_EMAIL=$(aws ssm get-parameter \
  --name "/cloudless/production/SES_TO_EMAIL" \
  --query Parameter.Value --output text 2>/dev/null || echo "")
if [[ -n "$SES_TO_EMAIL" ]]; then
  echo "   Subscribing ${SES_TO_EMAIL} to ${TOPIC_NAME}"
  aws sns subscribe \
    --topic-arn "$TOPIC_ARN" \
    --protocol email-json \
    --notification-endpoint "$SES_TO_EMAIL" \
    --region "$REGION" \
    --output text --query SubscriptionArn 2>/dev/null || \
    echo "   (subscription may already exist)"
else
  echo "   ⚠️  SES_TO_EMAIL not found in SSM — skipping email subscription"
  echo "   Create it manually: aws sns subscribe --topic-arn \"${TOPIC_ARN}\" --protocol email --notification-endpoint your@email.com"

echo "→ 3. IAM role ${ROLE}"
aws iam get-role --role-name "$ROLE" >/dev/null 2>&1 || \
  aws iam create-role --role-name "$ROLE" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }'

aws iam attach-role-policy --role-name "$ROLE" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true

echo "→ 4. IAM policy ${POLICY}"
POLICY_ARN="arn:aws:iam::${ACCOUNT}:policy/${POLICY}"
POLICY_DOC=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParametersByPath"],
      "Resource": [
        "arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/cloudless/production/SLACK_BOT_TOKEN",
        "arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/cloudless/production/SLACK_WEBHOOK_URL",
        "arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/cloudless/production/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "*",
      "Condition": {
        "StringLike": {
          "kms:EncryptionContext:PARAMETER_ARN": "arn:aws:ssm:${REGION}:${ACCOUNT}:parameter/cloudless/production/*"
        }
      }
    }
  ]
}
JSON
)

echo "→ 5. Lambda zip"
cd "$HERE/lambda"
rm -rf node_modules package-lock.json
npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1
zip -qr /tmp/portal-sns-to-slack.zip . -x "*.zip" "*.log"

echo "→ 6. Lambda function ${FN}"
ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${ROLE}"
if aws lambda get-function --function-name "$FN" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FN" --zip-file fileb:///tmp/portal-sns-to-slack.zip >/dev/null
  aws lambda update-function-configuration --function-name "$FN" \
    --runtime nodejs22.x --architectures arm64 --memory-size 256 --timeout 30 \
    --handler index.handler --role "$ROLE_ARN" >/dev/null
else
  for i in 1 2 3 4 5 6; do
    aws lambda create-function --function-name "$FN" \
      --runtime nodejs22.x --architectures arm64 --memory-size 256 --timeout 30 \
      --handler index.handler --role "$ROLE_ARN" \
      --zip-file fileb:///tmp/portal-sns-to-slack.zip && break
    echo "    (role not yet propagated, retry $i...)"
    sleep 5
  done
fi

echo "→ 7. Subscribe Lambda to SNS topic"
aws sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol lambda \
  --notification-endpoint "arn:aws:lambda:${REGION}:${ACCOUNT}:function:${FN}" \
  --region "$REGION" \
  --output text --query SubscriptionArn 2>/dev/null || true

echo "→ 8. Allow SNS to invoke Lambda"
aws lambda add-permission \
  --function-name "$FN" \
  --statement-id AllowSNSInvoke \
  --action lambda:InvokeFunction \
  --principal sns.amazonaws.com \
  --source-arn "$TOPIC_ARN" \
  --source-account "$ACCOUNT" 2>/dev/null || true

echo "→ 9. Write topic ARN to SSM"
aws ssm put-parameter \
  --name "$SSM_KEY_SNS" \
  --value "$TOPIC_ARN" \
  --type String \
  --overwrite >/dev/null

echo ""
echo "✅ Deployed portal notification infrastructure"
echo "   Topic ARN:         ${TOPIC_ARN}"
echo "   Lambda:             ${FN}"
echo "   SSM key:            ${SSM_KEY_SNS}"
echo ""
echo "   Email subscription to ${SES_TO_EMAIL:-"(not set)"} — confirm via the"
echo "   confirmation email AWS SNS sends to that address."
echo ""
echo "   To test:"
echo "     aws sns publish --topic-arn \"${TOPIC_ARN}\" --message '{\"eventType\":\"comment_added\",\"portalLabel\":\"Test\",\"clientName\":\"Test User\",\"clientEmail\":\"test@example.com\",\"title\":\"Test notification\",\"description\":\"This is a test\"}' --region ${REGION}"
echo "     aws logs tail /aws/lambda/${FN} --follow --region ${REGION}"

if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
  aws iam create-policy-version --policy-arn "$POLICY_ARN" --policy-document "$POLICY_DOC" --set-as-default
else
  aws iam create-policy --policy-name "$POLICY" --policy-document "$POLICY_DOC"
fi
aws iam attach-role-policy --role-name "$ROLE" --policy-arn "$POLICY_ARN" 2>/dev/null || true
fi