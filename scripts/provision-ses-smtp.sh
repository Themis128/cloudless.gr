#!/usr/bin/env bash
#
# Provision SES SMTP credentials for SES transactional email and store them
# in SSM, for SES SMTP-using workloads.
#
# Runs in CI under the OIDC deploy role (AWS_DEPLOY_ROLE_ARN) — no static keys,
# no PAT. It:
#   1. Ensures a dedicated IAM user (cloudless-ses-smtp) with a minimal
#      ses:SendRawEmail / ses:SendEmail inline policy.
#   2. Creates an access key and derives the region-specific SES SMTP password
#      from the secret (AWS's documented SigV4-based algorithm).
#   3. Writes /cloudless/production/SES_SMTP_USER (String),
#      /cloudless/production/SES_SMTP_PASSWORD (SecureString), and
#      /cloudless/production/SES_FROM_EMAIL (String, only if absent).
#
# Idempotent: if SES_SMTP_USER + SES_SMTP_PASSWORD already exist in SSM, it
# exits early without minting a new key. Fails cleanly (non-zero) with a precise
# message if the deploy role lacks the required IAM permissions.
set -uo pipefail

REGION="${AWS_REGION:-us-east-1}"
IAM_USER="${SES_SMTP_IAM_USER:-cloudless-ses-smtp}"
FROM_DEFAULT="${SES_FROM_DEFAULT:-noreply@cloudless.gr}"
P_USER="/cloudless/production/SES_SMTP_USER"
P_PASS="/cloudless/production/SES_SMTP_PASSWORD"
P_FROM="/cloudless/production/SES_FROM_EMAIL"

ssm_get() { aws ssm get-parameter --name "$1" ${2:+--with-decryption} --query 'Parameter.Value' --output text 2>/dev/null || true; }

# 1) Idempotency — skip if creds already provisioned.
EXISTING_USER="$(ssm_get "$P_USER")"
EXISTING_PASS="$(ssm_get "$P_PASS" decrypt)"
if [ -n "$EXISTING_USER" ] && [ -n "$EXISTING_PASS" ]; then
  echo "✓ SES SMTP credentials already present in SSM (user=${EXISTING_USER}). Nothing to do."
  exit 0
fi

# 1b) Path-push trigger with no manual credentials → fall through to IAM
# auto-provisioning. The OIDC role may or may not have iam:CreateUser;
# the script exits with a clear error if the permission is missing.
TRIGGERED_BY="${TRIGGERED_BY:-}"
MANUAL_USER="${SES_SMTP_USER_INPUT:-}"
MANUAL_PASS="${SES_SMTP_PASSWORD_INPUT:-}"
MANUAL_FROM="${SES_FROM_INPUT:-}"
if [ "$TRIGGERED_BY" = "push" ] && [ -z "$MANUAL_USER" ] && [ -z "$MANUAL_PASS" ]; then
  echo "Path-push trigger with no manual credentials — attempting IAM auto-provisioning..."
  echo "(If the OIDC role lacks iam:CreateUser the run will fail with a clear error.)"
fi

# 1c) Manual-bypass path: use pre-created credentials from workflow_dispatch inputs.
#     This works without iam:CreateUser — only ssm:PutParameter is required.
#     Run the workflow via dispatch with the credentials obtained from:
#       AWS Console → SES → SMTP Settings → Create SMTP credentials
if [ -n "$MANUAL_USER" ] && [ -n "$MANUAL_PASS" ]; then
  echo "→ Using pre-created SMTP credentials from workflow_dispatch inputs (skipping IAM)"
  echo "::add-mask::$MANUAL_PASS"
  aws ssm put-parameter --name "$P_USER" --type String --overwrite --value "$MANUAL_USER" \
    --description "SES SMTP username — manually provisioned" >/dev/null
  aws ssm put-parameter --name "$P_PASS" --type SecureString --overwrite --value "$MANUAL_PASS" \
    --description "SES SMTP password (derived) — manually provisioned" >/dev/null
  if [ -n "$MANUAL_FROM" ]; then
    aws ssm put-parameter --name "$P_FROM" --type String --overwrite --value "$MANUAL_FROM" \
      --description "SES verified From address — manually provisioned" >/dev/null
    echo "  • set ${P_FROM}=${MANUAL_FROM}"
  elif [ -z "$(ssm_get "$P_FROM")" ]; then
    aws ssm put-parameter --name "$P_FROM" --type String --overwrite --value "$FROM_DEFAULT" \
      --description "SES verified From address — default" >/dev/null
    echo "  • set ${P_FROM}=${FROM_DEFAULT} (default)"
  fi
  echo "✓ SES SMTP credentials written to SSM (user=${MANUAL_USER}). Wire to consumers as needed."
  exit 0
fi

echo "→ SES SMTP creds not in SSM; provisioning via IAM user '${IAM_USER}' (region ${REGION})"

# 2) Ensure IAM user (idempotent).
if aws iam get-user --user-name "$IAM_USER" >/dev/null 2>&1; then
  echo "  • IAM user ${IAM_USER} already exists"
else
  if ! aws iam create-user --user-name "$IAM_USER" \
        --tags Key=managed-by,Value=provision-ses-smtp.yml Key=purpose,Value=ses-smtp >/dev/null 2>err.txt; then
    echo "::error::Could not create IAM user ${IAM_USER}."
    echo "The OIDC deploy role (AWS_DEPLOY_ROLE_ARN) lacks iam:CreateUser. Either grant"
    echo "iam:CreateUser/CreateAccessKey/PutUserPolicy + ssm:PutParameter to that role,"
    echo "or create the SES SMTP credential manually in AWS Console → SES → SMTP Settings."
    sed 's/^/  aws: /' err.txt >&2 || true
    exit 1
  fi
  echo "  • created IAM user ${IAM_USER}"
fi

# 3) Minimal send-only policy.
aws iam put-user-policy --user-name "$IAM_USER" --policy-name ses-send \
  --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ses:SendRawEmail","ses:SendEmail"],"Resource":"*"}]}' \
  >/dev/null 2>err.txt || { echo "::error::iam:PutUserPolicy failed"; sed 's/^/  aws: /' err.txt >&2; exit 1; }

# 4) Create an access key. (Cap at 2 keys/user; prune oldest if needed.)
KEYS_JSON="$(aws iam list-access-keys --user-name "$IAM_USER" --query 'AccessKeyMetadata[].AccessKeyId' --output text 2>/dev/null || true)"
if [ "$(printf '%s\n' "$KEYS_JSON" | wc -w)" -ge 2 ]; then
  OLDEST="$(aws iam list-access-keys --user-name "$IAM_USER" --query 'sort_by(AccessKeyMetadata,&CreateDate)[0].AccessKeyId' --output text)"
  echo "  • pruning oldest access key ${OLDEST} (2-key limit)"
  aws iam delete-access-key --user-name "$IAM_USER" --access-key-id "$OLDEST" >/dev/null 2>&1 || true
fi

CREATE_JSON="$(aws iam create-access-key --user-name "$IAM_USER" --output json 2>err.txt)" || {
  echo "::error::iam:CreateAccessKey failed"; sed 's/^/  aws: /' err.txt >&2; exit 1; }
AK_ID="$(printf '%s' "$CREATE_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["AccessKey"]["AccessKeyId"])')"
AK_SECRET="$(printf '%s' "$CREATE_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["AccessKey"]["SecretAccessKey"])')"
echo "::add-mask::$AK_SECRET"
echo "  • created access key ${AK_ID}"

# 5) Derive the SES SMTP password (AWS documented algorithm, region-specific).
SMTP_PASSWORD="$(python3 - "$AK_SECRET" "$REGION" <<'PY'
import sys, hmac, hashlib, base64
secret, region = sys.argv[1], sys.argv[2]
def sign(key, msg): return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()
sig = sign(("AWS4" + secret).encode("utf-8"), "11111111")
sig = sign(sig, region)
sig = sign(sig, "ses")
sig = sign(sig, "aws4_request")
sig = sign(sig, "SendRawEmail")
print(base64.b64encode(bytes([0x04]) + sig).decode("utf-8"))
PY
)"
echo "::add-mask::$SMTP_PASSWORD"

# 6) Write SSM params.
aws ssm put-parameter --name "$P_USER" --type String --overwrite --value "$AK_ID" \
  --description "SES SMTP username (IAM access key id) for SES SMTP — provision-ses-smtp.yml" >/dev/null
aws ssm put-parameter --name "$P_PASS" --type SecureString --overwrite --value "$SMTP_PASSWORD" \
  --description "SES SMTP password (derived) for SES SMTP — provision-ses-smtp.yml" >/dev/null
if [ -z "$(ssm_get "$P_FROM")" ]; then
  aws ssm put-parameter --name "$P_FROM" --type String --overwrite --value "$FROM_DEFAULT" \
    --description "SES verified From address for transactional emails" >/dev/null
  echo "  • set ${P_FROM}=${FROM_DEFAULT}"
fi

echo "✓ SES SMTP credentials provisioned to SSM (user=${AK_ID}). configure-email can now apply them."
