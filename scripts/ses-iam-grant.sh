#!/usr/bin/env bash
#
# ses-iam-grant.sh — attach SES SMTP provisioning policy to the OIDC role.
# Called by grant-ses-iam-permissions.yml. Sets GITHUB_OUTPUT vars.
set -uo pipefail

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="${AWS_DEPLOY_ROLE_ARN:-}"
ROLE_NAME="${ROLE_ARN##*/}"
POLICY_NAME="AllowSesSmtpUserProvisioning"

echo "Account: ${ACCOUNT_ID}"
echo "Role:    ${ROLE_NAME}"

# Build policy JSON using python one-liner to avoid shell quoting issues
python3 -c "
import json, sys
a = sys.argv[1]
print(json.dumps({
  'Version': '2012-10-17',
  'Statement': [
    {
      'Sid': 'CreateSesSmtpUser',
      'Effect': 'Allow',
      'Action': ['iam:GetUser','iam:CreateUser','iam:PutUserPolicy',
                 'iam:ListAccessKeys','iam:CreateAccessKey','iam:DeleteAccessKey'],
      'Resource': 'arn:aws:iam::' + a + ':user/cloudless-ses-smtp'
    },
    {
      'Sid': 'SsmPutSesParams',
      'Effect': 'Allow',
      'Action': ['ssm:PutParameter','ssm:GetParameter'],
      'Resource': 'arn:aws:ssm:us-east-1:' + a + ':parameter/cloudless/production/SES*'
    }
  ]
}))
" "$ACCOUNT_ID" > /tmp/ses-policy.json

echo "Policy:"
cat /tmp/ses-policy.json

if aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document file:///tmp/ses-policy.json 2>err.txt; then
  echo "status=success" >> "$GITHUB_OUTPUT"
  echo "role_name=${ROLE_NAME}" >> "$GITHUB_OUTPUT"
  echo "account_id=${ACCOUNT_ID}" >> "$GITHUB_OUTPUT"
  echo "Policy '${POLICY_NAME}' attached to role '${ROLE_NAME}'"
else
  echo "status=failed" >> "$GITHUB_OUTPUT"
  echo "role_name=${ROLE_NAME}" >> "$GITHUB_OUTPUT"
  echo "account_id=${ACCOUNT_ID}" >> "$GITHUB_OUTPUT"
  echo "::error::iam:PutRolePolicy denied — see issue #382 for manual fix"
  cat err.txt
  exit 1
fi
