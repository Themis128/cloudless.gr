#!/usr/bin/env bash
# audit-pi-ssm-scope.sh — assert the Pi IAM user can read every SSM key.
#
# Closes pi-cloud-sync.md gap #2 / master-todo R18.
#
# Walks /cloudless/production/* in SSM, uses
# `iam:SimulatePrincipalPolicy` to check whether
# `cloudless-pi-standby` is allowed `ssm:GetParameter` on each key.
# Prints a summary; exits 1 if any key is denied.
#
# Wired into .github/workflows/probe-pi-ssm-scope.yml (daily 06:00 UTC).
# Drift triggers a /api/webhooks/admin-alert ping → Slack + ntfy.
#
# Usage:
#   bash scripts/audit-pi-ssm-scope.sh                  # human output
#   bash scripts/audit-pi-ssm-scope.sh --json           # machine-readable
#   PI_USER=other-user bash scripts/audit-pi-ssm-scope.sh   # override
#
# Required IAM (for the caller running this script):
#   - ssm:DescribeParameters
#   - iam:SimulatePrincipalPolicy
#
# Required AWS env:
#   - AWS_REGION (defaults to us-east-1)
#   - Standard SDK creds (env / OIDC / instance profile)

set -uo pipefail

PI_USER="${PI_USER:-cloudless-pi-standby}"
PREFIX="${PREFIX:-/cloudless/production/}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${ACCOUNT_ID:-}"
JSON_OUT=0

for arg in "$@"; do
  case "$arg" in
    --json) JSON_OUT=1 ;;
  esac
done

if [ -z "$ACCOUNT_ID" ]; then
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) || {
    echo "::error::Unable to determine AWS account id (aws sts get-caller-identity failed)"
    exit 2
  }
fi

USER_ARN="arn:aws:iam::${ACCOUNT_ID}:user/${PI_USER}"

# 1. List all SSM parameters under PREFIX.
mapfile -t KEYS < <(
  aws ssm describe-parameters \
    --region "$REGION" \
    --parameter-filters "Key=Name,Option=BeginsWith,Values=${PREFIX}" \
    --query 'Parameters[].Name' \
    --output text 2>/dev/null | tr '\t' '\n' | sort -u
)

if [ "${#KEYS[@]}" -eq 0 ]; then
  if [ "$JSON_OUT" -eq 1 ]; then
    echo '{"keys_total":0,"keys_denied":[],"action":"no SSM params under prefix — nothing to assert"}'
  else
    echo "No SSM parameters found under ${PREFIX} — nothing to assert."
  fi
  exit 0
fi

# 2. For each key, build its ARN and simulate ssm:GetParameter.
#    Iterate one at a time (simulate-principal-policy accepts up to 32 ResourceArns
#    per call but the per-resource decision is simpler to read).
DENIED=()
for key in "${KEYS[@]}"; do
  [ -z "$key" ] && continue
  # Strip leading slash for ARN
  arn_path="${key#/}"
  param_arn="arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/${arn_path}"

  decision=$(aws iam simulate-principal-policy \
    --policy-source-arn "$USER_ARN" \
    --action-names "ssm:GetParameter" \
    --resource-arns "$param_arn" \
    --query 'EvaluationResults[0].EvalDecision' \
    --output text 2>/dev/null) || decision="ERROR"

  case "$decision" in
    allowed) ;;
    *)       DENIED+=("$key") ;;
  esac
done

# 3. Report.
KEYS_TOTAL=${#KEYS[@]}
DENIED_COUNT=${#DENIED[@]}

if [ "$JSON_OUT" -eq 1 ]; then
  # Build JSON manually (no jq dep)
  denied_json=$(printf '"%s",' "${DENIED[@]}" | sed 's/,$//')
  cat <<EOF
{"keys_total":${KEYS_TOTAL},"keys_denied_count":${DENIED_COUNT},"keys_denied":[${denied_json}],"pi_user":"${PI_USER}","action":"$( [ "$DENIED_COUNT" -gt 0 ] && echo "Grant ssm:GetParameter on the denied resources to ${PI_USER}" || echo "ok" )"}
EOF
else
  echo "=== Pi SSM scope audit ==="
  echo "Pi user:    ${PI_USER}"
  echo "User ARN:   ${USER_ARN}"
  echo "Prefix:     ${PREFIX}"
  echo "Total keys: ${KEYS_TOTAL}"
  echo "Denied:     ${DENIED_COUNT}"
  if [ "$DENIED_COUNT" -gt 0 ]; then
    echo
    echo "Keys NOT readable by ${PI_USER}:"
    for k in "${DENIED[@]}"; do
      echo "  - ${k}"
    done
    echo
    echo "Fix: extend ${PI_USER}'s SSM read statement to cover these resources."
    echo "Typical inline policy (replace existing statement Resource:):"
    echo '    "Resource": "arn:aws:ssm:'"${REGION}"':'"${ACCOUNT_ID}"':parameter'"${PREFIX}"'*"'
  else
    echo
    echo "All ${KEYS_TOTAL} SSM keys are readable by ${PI_USER}."
  fi
fi

if [ "$DENIED_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
