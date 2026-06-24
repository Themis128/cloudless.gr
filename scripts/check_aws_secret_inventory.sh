#!/usr/bin/env bash
set -euo pipefail

ok=0
warn=0
fail=0

pass() {
  printf '✅ %s\n' "$*"
  ok=$((ok+1))
}

warning() {
  printf '⚠️  %s\n' "$*"
  warn=$((warn+1))
}

missing() {
  printf '❌ %s\n' "$*"
  fail=$((fail+1))
}

echo "== AWS secret inventory check =="
echo "Mode: metadata only; secret values are not printed"
echo

if ! command -v aws >/dev/null 2>&1; then
  missing "aws CLI is not installed"
  exit 1
fi

identity="$(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null || true)"
if [[ -n "$identity" ]]; then
  pass "AWS identity available: $identity"
else
  missing "AWS identity unavailable"
  exit 1
fi

known_params=(
  "/cloudless/production/CLOUDFLARE_API_TOKEN"
  "/cloudless/production/CLOUDFLARE_ZONE_ID"
  "/cloudless/production/CLOUDFLARE_AUTH_RECORD_ID"
  "/cloudless/production/CLOUDFLARE_DDNS_RECORD_ID"
)

echo
echo "Known Cloudflare/DDNS SSM parameter checks:"

for name in "${known_params[@]}"; do
  result="$(
    aws ssm get-parameter \
      --name "$name" \
      --with-decryption \
      --query 'join(`|`, [Parameter.Name, Parameter.Type, to_string(Parameter.Version), to_string(length(Parameter.Value))])' \
      --output text 2>/dev/null || true
  )"

  if [[ -n "$result" ]]; then
    IFS='|' read -r param_name param_type param_version value_length <<<"$result"
    pass "$param_name exists type=$param_type version=$param_version value_length=$value_length"
  else
    warning "$name missing"
  fi
done

echo
echo "Cloudflare/DDNS-related SSM candidates:"
ssm_names="$(
  aws ssm describe-parameters \
    --query "Parameters[?contains(Name, 'cloudflare') || contains(Name, 'Cloudflare') || contains(Name, 'CLOUDFLARE') || contains(Name, 'ddns') || contains(Name, 'DDNS') || contains(Name, 'CF_')].[Name]" \
    --output text 2>/dev/null || true
)"

if [[ -n "$ssm_names" ]]; then
  printf '%s\n' "$ssm_names" | tr '\t' '\n' | sed '/^$/d' | sort
  pass "Found Cloudflare/DDNS SSM parameter candidates"
else
  warning "No Cloudflare/DDNS SSM parameter candidates found"
fi

echo
printf 'Summary: %s passed, %s warnings, %s failures\n' "$ok" "$warn" "$fail"

[[ "$fail" -eq 0 ]]
