#!/usr/bin/env bash
#
# ses-iam-grant-report.sh — build issue comment for grant-ses-iam-permissions.yml.
# Args: STATUS ROLE ACCOUNT TIMESTAMP
set -uo pipefail

STATUS="${1:-unknown}"
ROLE="${2:-unknown}"
ACCOUNT="${3:-unknown}"
TIMESTAMP="${4:-unknown}"

echo "# SES IAM permissions grant — ${TIMESTAMP}"
echo ""
echo "**Status:** ${STATUS}"
echo "**Role:** \`${ROLE}\`"
echo ""

if [ "$STATUS" = "success" ]; then
  echo "Policy **AllowSesSmtpUserProvisioning** attached to **\`${ROLE}\`**."
  echo ""
  echo "provision-ses-smtp.yml triggered — check issue #382 in ~60s for SES provisioning result."
else
  echo "**\`iam:PutRolePolicy\` denied** — the OIDC role cannot self-grant permissions."
  echo ""
  echo "**Manual fix:** AWS Console → IAM → Roles → \`GitHubActionsOIDC\` → Add inline policy:"
  echo ""
  echo "\`\`\`json"
  python3 -c "
import json, sys
a = sys.argv[1]
print(json.dumps({
  'Version': '2012-10-17',
  'Statement': [
    {
      'Effect': 'Allow',
      'Action': ['iam:GetUser','iam:CreateUser','iam:PutUserPolicy',
                 'iam:ListAccessKeys','iam:CreateAccessKey','iam:DeleteAccessKey'],
      'Resource': 'arn:aws:iam::' + a + ':user/cloudless-ses-smtp'
    },
    {
      'Effect': 'Allow',
      'Action': ['ssm:PutParameter','ssm:GetParameter'],
      'Resource': 'arn:aws:ssm:us-east-1:' + a + ':parameter/cloudless/production/SES*'
    }
  ]
}, indent=2))
" "$ACCOUNT"
  echo "\`\`\`"
  echo ""
  echo "After adding the policy, touch \`.github/workflows/provision-ses-smtp.yml\` to re-trigger."
fi
