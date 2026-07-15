#!/usr/bin/env bash
# audit-pi-ssm-scope.sh — assert the Pi IAM user can read every SSM key.
#
# Closes pi-cloud-sync.md gap #2 / master-todo R18.
#
# Walks /cloudless/production/* in SSM, uses
# `iam:SimulatePrincipalPolicy` to check whether
# `cloudless-pi-standby` is allowed the runtime SSM read actions on each key.
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
ACTIONS=("ssm:GetParameter" "ssm:GetParameters" "ssm:GetParametersByPath")

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

# 2. Batch-simulate all runtime SSM read actions against all keys.
#    simulate-principal-policy accepts up to 32 ResourceArns per call.
#    With ~50-200 SSM keys, serial calls hit the 5-min workflow timeout
#    (v1 of this script was sequential and timed out — verified
#    2026-06-22 run 27924648322). Batch by 32 → 7 calls for 200 keys.
DENIED=()
ARNS=()
for key in "${KEYS[@]}"; do
  [ -z "$key" ] && continue
  arn_path="${key#/}"
  ARNS+=("arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/${arn_path}")
done

BATCH_SIZE=32
TOTAL_ARNS=${#ARNS[@]}
i=0
while [ "$i" -lt "$TOTAL_ARNS" ]; do
  end=$((i + BATCH_SIZE))
  [ "$end" -gt "$TOTAL_ARNS" ] && end="$TOTAL_ARNS"
  BATCH=("${ARNS[@]:$i:$((end - i))}")

  # Simulate this batch. Returns one EvaluationResult per ResourceArn,
  # in the same order. We pair them back up via the ARN field.
  result=$(aws iam simulate-principal-policy \
    --policy-source-arn "$USER_ARN" \
    --action-names "${ACTIONS[@]}" \
    --resource-arns "${BATCH[@]}" \
    --query 'EvaluationResults[].[EvalActionName,EvalResourceName,EvalDecision]' \
    --output text 2>&1) || {
      echo "::warning::simulate-principal-policy batch failed (i=$i): $result"
      # Mark this whole batch as denied so the alert surfaces it.
      for arn in "${BATCH[@]}"; do
        DENIED+=("simulate-failed:${arn##*:parameter}")
      done
      i="$end"
      continue
    }

  # Parse "action\tARN\tdecision\n..." per line.
  while IFS=$'\t' read -r action arn decision; do
    [ -z "$arn" ] && continue
    case "$decision" in
      allowed) ;;
      *)
        # Strip "arn:aws:ssm:REGION:ACCT:parameter" prefix to recover key.
        key_name="${arn##*:parameter}"
        DENIED+=("${action}:${key_name}")
        ;;
    esac
  done <<< "$result"

  i="$end"
done

# 3. Report.
KEYS_TOTAL=${#KEYS[@]}
DENIED_COUNT=${#DENIED[@]}

if [ "$JSON_OUT" -eq 1 ]; then
  # Build JSON manually (no jq dep). Avoid [""] when DENIED is empty.
  if [ "$DENIED_COUNT" -gt 0 ]; then
    denied_json=$(printf '"%s",' "${DENIED[@]}" | sed 's/,$//')
  else
    denied_json=""
  fi

  cat <<EOF
{"keys_total":${KEYS_TOTAL},"keys_denied_count":${DENIED_COUNT},"keys_denied":[${denied_json}],"pi_user":"${PI_USER}","action":"$( [ "$DENIED_COUNT" -gt 0 ] && echo "Grant SSM read actions on the denied resources to ${PI_USER}" || echo "ok" )"}
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
    echo "Fix: extend ${PI_USER}'s SSM read statement to cover these action/resource pairs."
    echo "Typical inline policy (replace existing statement Resource:):"
    echo '    "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
    "Resource": "arn:aws:ssm:'"${REGION}"':'"${ACCOUNT_ID}"':parameter'"${PREFIX}"'*"'
  else
    echo
    echo "All ${KEYS_TOTAL} SSM keys are readable by ${PI_USER}."
  fi
fi

if [ "$DENIED_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
