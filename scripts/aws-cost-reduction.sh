#!/usr/bin/env bash
#
# aws-cost-reduction.sh — execute the cost cuts from docs/aws-cost-reduction.md
# against AWS account 278585680617 (us-east-1).
#
# Source bill: VAT invoice EUINGR26-58586, May 2026 — USD 18.19 net / 22.56 incl.
# The web-app runtime (Lambda+CloudFront+APIGW+DynamoDB+ECR) is ~$0.50/mo; the
# rest is peripheral services. This script targets the peripheral spend ONLY —
# it never touches the Next.js site, its CloudFront/Lambda, DynamoDB, or SES.
#
# DESIGN: audit-first and safe by default.
#   - With no flags it ONLY AUDITS: prints current state + estimated savings.
#   - Each reversible cut is gated by its own DO_* flag.
#   - Nothing destructive (mailbox/key/secret deletion) ever runs automatically;
#     those print the exact command for a human to run with CONFIRM_DELETE=1.
#   - DRY_RUN=1 (default) prints mutating commands instead of running them.
#
# Requirements: awscli v2, credentials with read + the relevant write perms,
# `jq`. Run from a machine/CI that can reach the AWS API (this repo's cloud
# Claude sessions CANNOT — the network policy blocks it).
#
# Usage:
#   ./scripts/aws-cost-reduction.sh                 # audit only (no changes)
#   DRY_RUN=0 DO_CLOUDTRAIL=1 ./scripts/aws-cost-reduction.sh   # apply trail cut
#   DRY_RUN=0 DO_CONFIG=1     ./scripts/aws-cost-reduction.sh   # stop Config recorder
#   DRY_RUN=0 DO_SECRETS=1    ./scripts/aws-cost-reduction.sh   # copy secrets -> SSM
#   DRY_RUN=0 DO_SSM=1        ./scripts/aws-cost-reduction.sh   # downgrade advanced params
#   DO_KMS=1 DO_WORKMAIL=1 DO_R53=1 ./scripts/aws-cost-reduction.sh  # audit-only items
#
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT="278585680617"
DRY_RUN="${DRY_RUN:-1}"
SSM_MIGRATE_PREFIX="${SSM_MIGRATE_PREFIX:-/cloudless/production/migrated}"
# Route 53
ZONE_ID="Z079608614L53CC4EAZM3"

c_hdr() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
c_ok()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
c_warn(){ printf '\033[0;33m%s\033[0m\n' "$*"; }
c_run() {
  # Run a mutating aws command, honoring DRY_RUN.
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '  \033[0;90m[dry-run] %s\033[0m\n' "$*"
  else
    printf '  \033[0;35m[apply] %s\033[0m\n' "$*"
    "$@"
  fi
}

require() { command -v "$1" >/dev/null 2>&1 || { echo "FATAL: '$1' not found"; exit 1; }; }
require aws
require jq

acct_check() {
  local got
  got="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
  if [[ "$got" != "$ACCOUNT" ]]; then
    c_warn "Caller account is '$got', expected $ACCOUNT. Set the right profile/role before applying."
    [[ "$DRY_RUN" == "1" ]] || { echo "Refusing to mutate the wrong account."; exit 1; }
  else
    c_ok "Authenticated to account $ACCOUNT."
  fi
}

# --------------------------------------------------------------------------
# 1. WorkMail  ($4.00/mo) — KEEP (required mailbox tbaltzakis@cloudless.gr)
# --------------------------------------------------------------------------
do_workmail() {
  c_hdr "WorkMail (\$4.00/mo) — audit"
  # WorkMail lives in specific regions; try the common one + the configured one.
  local wm_region="${WORKMAIL_REGION:-us-east-1}"
  local orgs
  orgs="$(aws workmail list-organizations --region "$wm_region" --output json 2>/dev/null || echo '{}')"
  if [[ "$(echo "$orgs" | jq -r '.OrganizationSummaries // [] | length')" == "0" ]]; then
    c_warn "No WorkMail orgs in $wm_region (try WORKMAIL_REGION=eu-west-1, etc.). If the \$4 line persists, find the region in the console."
    return
  fi
  echo "$orgs" | jq -r '.OrganizationSummaries[] | "  org \(.OrganizationId) \(.Alias) state=\(.State)"'
  echo "$orgs" | jq -r '.OrganizationSummaries[].OrganizationId' | while read -r org; do
    local users
    users="$(aws workmail list-users --organization-id "$org" --region "$wm_region" --output json 2>/dev/null || echo '{}')"
    echo "$users" | jq -r '.Users[]? | "    user \(.Email // .Name) state=\(.State) enabled=\(.UserRole // "?")"'
  done
  c_ok "KEEP: tbaltzakis@cloudless.gr is a required mailbox. WorkMail is a flat"
  c_ok "      \$4/user/mo with no usage component — nothing to trim without dropping"
  c_ok "      the mailbox. Treat the \$4.00 as fixed cost. No action taken."
}

# --------------------------------------------------------------------------
# 2. CloudTrail  (~$2.31/mo) — keep ONE free management trail, drop the rest
# --------------------------------------------------------------------------
do_cloudtrail() {
  c_hdr "CloudTrail (~\$2.31/mo) — keep one free management trail"
  local trails
  trails="$(aws cloudtrail list-trails --region "$REGION" --output json | jq -r '.Trails[].TrailARN')"
  if [[ -z "$trails" ]]; then c_warn "No trails found."; return; fi
  local keep=""
  while read -r arn; do
    [[ -z "$arn" ]] && continue
    local name insight selectors datacount
    name="$(aws cloudtrail get-trail --name "$arn" --region "$REGION" --query 'Trail.Name' --output text 2>/dev/null || echo '?')"
    insight="$(aws cloudtrail get-insight-selectors --trail-name "$arn" --region "$REGION" --output json 2>/dev/null | jq -r '.InsightSelectors // [] | length' || echo 0)"
    selectors="$(aws cloudtrail get-event-selectors --trail-name "$arn" --region "$REGION" --output json 2>/dev/null || echo '{}')"
    datacount="$(echo "$selectors" | jq '[(.EventSelectors // [])[].DataResources // [] | length] | add // 0' 2>/dev/null || echo 0)"
    datacount=$(( datacount + $(echo "$selectors" | jq '[(.AdvancedEventSelectors // [])[] | select(any(.FieldSelectors[]?; .Field=="resources.type"))] | length' 2>/dev/null || echo 0) ))
    echo "  trail $name  insights=$insight  data-event-rules=$datacount"
    if [[ -z "$keep" ]]; then
      keep="$arn"
      c_ok "  -> keeping '$name' as the free management-events trail"
    fi
    # Drop CloudTrail Insights (billed per event analyzed) on every trail.
    if [[ "$insight" != "0" ]]; then
      c_run aws cloudtrail put-insight-selectors --trail-name "$arn" --region "$REGION" --insight-selectors '[]'
    fi
    # Strip data-event logging (the main cost driver) — revert management events to the free default.
    if [[ "$datacount" != "0" ]]; then
      c_run aws cloudtrail put-event-selectors --trail-name "$arn" --region "$REGION" \
        --event-selectors '[{"ReadWriteType":"All","IncludeManagementEvents":true,"DataResources":[]}]'
    fi
  done <<< "$trails"
  c_warn "Note: a 2nd+ trail (beyond the one kept) is itself billable. Review and delete extras manually:"
  echo "    #   aws cloudtrail delete-trail --name <ARN> --region $REGION"
}

# --------------------------------------------------------------------------
# 3. Secrets Manager  ($1.20/mo) — copy each secret to free SSM SecureString
#    (additive + reversible; deletion only with CONFIRM_DELETE=1)
# --------------------------------------------------------------------------
do_secrets() {
  c_hdr "Secrets Manager (\$1.20/mo) — migrate to SSM SecureString (free)"
  local secrets
  secrets="$(aws secretsmanager list-secrets --region "$REGION" --output json | jq -r '.SecretList[].Name')"
  if [[ -z "$secrets" ]]; then c_warn "No secrets found."; return; fi
  while read -r name; do
    [[ -z "$name" ]] && continue
    local target
    target="${SSM_MIGRATE_PREFIX}/$(basename "$name")"
    echo "  secret '$name' -> SSM SecureString '$target'"
    if [[ "$DRY_RUN" == "1" ]]; then
      printf '    \033[0;90m[dry-run] copy value to %s\033[0m\n' "$target"
    else
      local val
      val="$(aws secretsmanager get-secret-value --secret-id "$name" --region "$REGION" --query SecretString --output text)"
      aws ssm put-parameter --name "$target" --type SecureString --value "$val" --overwrite --region "$REGION" >/dev/null
      c_ok "    copied."
    fi
    if [[ "${CONFIRM_DELETE:-0}" == "1" ]]; then
      c_run aws secretsmanager delete-secret --secret-id "$name" --region "$REGION" --recovery-window-in-days 30
    else
      echo "    (kept; re-run with CONFIRM_DELETE=1 to schedule 30-day-recoverable deletion)"
    fi
  done <<< "$secrets"
  c_warn "After migrating: update any external consumer to read SSM '$SSM_MIGRATE_PREFIX/*' (the app already reads SSM)."
}

# --------------------------------------------------------------------------
# 4. AWS Config  (~$0.84/mo) — stop the recorder (reversible)
# --------------------------------------------------------------------------
do_config() {
  c_hdr "AWS Config (~\$0.84/mo) — stop continuous recorder"
  local recorders
  recorders="$(aws configservice describe-configuration-recorders --region "$REGION" --output json | jq -r '.ConfigurationRecorders[].name')"
  if [[ -z "$recorders" ]]; then c_warn "No Config recorder in $REGION."; return; fi
  while read -r r; do
    [[ -z "$r" ]] && continue
    echo "  recorder '$r' -> stop"
    c_run aws configservice stop-configuration-recorder --configuration-recorder-name "$r" --region "$REGION"
  done <<< "$recorders"
  c_warn "Reversible: 'start-configuration-recorder' resumes it. Delete the delivery channel/recorder only if you're sure you never want the audit timeline."
}

# --------------------------------------------------------------------------
# 5. KMS  (~$2.13/mo) — AUDIT ONLY (deleting a key in use breaks encryption)
# --------------------------------------------------------------------------
do_kms() {
  c_hdr "KMS (~\$2.13/mo) — audit customer-managed keys (\$1/key/mo)"
  local key_list
  key_list="$(aws kms list-keys --region "$REGION" --output json 2>&1)" || {
    c_warn "  kms:ListKeys permission denied — add kms:ListKeys + kms:DescribeKey + kms:ListAliases to the caller role."
    c_warn "  NOTE: \$2.13 charge may be API-call volume on AWS-managed keys, not CMK monthly fees."
    c_warn "  Check: Cost Explorer → KMS → Usage Type (Request, GenerateDataKey, etc.)."
    return
  }
  local found=0
  while read -r kid; do
    [[ -z "$kid" ]] && continue
    local meta mgr state alias
    meta="$(aws kms describe-key --key-id "$kid" --region "$REGION" --output json 2>/dev/null || echo '{}')"
    mgr="$(echo "$meta" | jq -r '.KeyMetadata.KeyManager // "?"')"
    [[ "$mgr" != "CUSTOMER" ]] && continue   # AWS-managed keys are free; skip
    found=1
    state="$(echo "$meta" | jq -r '.KeyMetadata.KeyState')"
    alias="$(aws kms list-aliases --key-id "$kid" --region "$REGION" --query 'Aliases[0].AliasName' --output text 2>/dev/null || echo '-')"
    echo "  CMK $kid  state=$state  alias=$alias  (\$1/mo)"
  done <<< "$(echo "$key_list" | jq -r '.Keys[].KeyId')"
  if [[ "$found" == "0" ]]; then
    c_ok "  No customer-managed keys in $REGION."
    c_warn "  NOTE: \$2.13 KMS charge is likely API-call volume on AWS-managed keys (not \$1/CMK/mo fees)."
    c_warn "  Check Cost Explorer → KMS → Usage Type to confirm and identify the top calling service."
    return
  fi
  c_warn "For each CMK NOT referenced by SES/S3/Secrets Manager/SQS, schedule deletion (DESTRUCTIVE, 30-day window):"
  echo "    #   aws kms schedule-key-deletion --key-id <KEY> --pending-window-in-days 30 --region $REGION"
  echo "    # Prefer switching the consuming service to its free AWS-managed key first."
}

# --------------------------------------------------------------------------
# 6. Route 53  (~$4.22/mo) — AUDIT ONLY (health-check features are immutable;
#    changing them means recreate + edit sst.config.ts — do that in a PR)
# --------------------------------------------------------------------------
do_r53() {
  c_hdr "Route 53 (~\$4.22/mo) — audit zone + HA health checks"
  echo "  hosted zone $ZONE_ID = \$0.50/mo (unavoidable — it's your DNS)"
  local hc_json
  hc_json="$(aws route53 list-health-checks --output json 2>&1)" || true
  if echo "$hc_json" | grep -qi "AccessDenied\|not authorized\|is not authorized"; then
    c_warn "  route53:ListHealthChecks denied — add it to the caller role to audit health checks."
  elif ! echo "$hc_json" | jq -e '.HealthChecks' > /dev/null 2>&1; then
    c_warn "  list-health-checks unexpected response: $(echo "$hc_json" | grep -m1 '.' || echo '(empty)')"
  else
    local count
    count="$(echo "$hc_json" | jq -r '.HealthChecks | length')"
    if [[ "$count" == "0" ]]; then
      c_ok "  No health checks found in account (sst.config.ts HC IDs e239ad5c/30a69f1c are stale)."
    else
      while IFS= read -r hc; do
        local hc_id cfg typ interval str_match
        hc_id="$(echo "$hc" | jq -r '.Id' | sed 's|.*/||')"
        cfg="$(echo "$hc" | jq -c '.HealthCheckConfig')"
        typ="$(echo "$cfg" | jq -r '.Type // "?"')"
        interval="$(echo "$cfg" | jq -r '.RequestInterval // "?"')"
        str_match="$(echo "$cfg" | jq -r 'if .SearchString then "string-match" else "no-match" end')"
        echo "  health-check $hc_id  type=$typ interval=${interval}s $str_match"
      done < <(echo "$hc_json" | jq -c '.HealthChecks[]' 2>/dev/null)
    fi
  fi
  c_warn "Surcharges: HTTPS +\$1, string-match +\$1, fast(10s) interval +\$1 — each per check, per month."
  c_warn "Type & interval are IMMUTABLE on a health check. To drop fast-interval/string-match you must"
  c_warn "recreate the check and update its healthCheckId in sst.config.ts. Open a PR for that — do not"
  c_warn "delete a check here or the failover records (sst.config.ts) will reference a missing ID."
}

# --------------------------------------------------------------------------
# 7. Systems Manager  (~$0.33/mo) — downgrade advanced params to free standard
# --------------------------------------------------------------------------
do_ssm() {
  c_hdr "Systems Manager (~\$0.33/mo) — downgrade advanced parameters"
  local params
  params="$(aws ssm describe-parameters --region "$REGION" --parameter-filters 'Key=Tier,Values=Advanced' --output json 2>/dev/null | jq -r '.Parameters[].Name' || true)"
  if [[ -z "$params" ]]; then c_ok "No advanced-tier parameters. Nothing to do."; return; fi
  while read -r p; do
    [[ -z "$p" ]] && continue
    local size
    size="$(aws ssm get-parameter --name "$p" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null | wc -c)"
    if (( size > 4096 )); then
      c_warn "  '$p' is ${size}B (>4KB) — must stay Advanced. Skipped."
      continue
    fi
    echo "  '$p' (${size}B) -> Standard tier"
    if [[ "$DRY_RUN" == "1" ]]; then
      printf '    \033[0;90m[dry-run] put-parameter --tier Standard --overwrite\033[0m\n'
    else
      local typ val
      typ="$(aws ssm get-parameter --name "$p" --region "$REGION" --query 'Parameter.Type' --output text)"
      val="$(aws ssm get-parameter --name "$p" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text)"
      aws ssm put-parameter --name "$p" --type "$typ" --value "$val" --tier Standard --overwrite --region "$REGION" >/dev/null
      c_ok "    downgraded."
    fi
  done <<< "$params"
}

main() {
  c_hdr "AWS cost reduction — account $ACCOUNT region $REGION  (DRY_RUN=$DRY_RUN)"
  acct_check
  # Audit-only items always run (read-only). Reversible cuts run only when flagged.
  [[ "${DO_WORKMAIL:-0}"   == "1" || "${AUDIT_ALL:-1}" == "1" ]] && do_workmail   || true
  [[ "${DO_KMS:-0}"        == "1" || "${AUDIT_ALL:-1}" == "1" ]] && do_kms        || true
  [[ "${DO_R53:-0}"        == "1" || "${AUDIT_ALL:-1}" == "1" ]] && do_r53        || true
  [[ "${DO_CLOUDTRAIL:-0}" == "1" ]] && do_cloudtrail || c_warn "CloudTrail: set DO_CLOUDTRAIL=1 to apply the trail cut."
  [[ "${DO_SECRETS:-0}"    == "1" ]] && do_secrets    || c_warn "Secrets:    set DO_SECRETS=1 to migrate to SSM."
  [[ "${DO_CONFIG:-0}"     == "1" ]] && do_config     || c_warn "Config:     set DO_CONFIG=1 to stop the recorder."
  [[ "${DO_SSM:-0}"        == "1" ]] && do_ssm        || c_warn "SSM:        set DO_SSM=1 to downgrade advanced params."
  c_hdr "Done. Projected steady-state: ~\$11-12/mo net (from \$18.19, WorkMail kept). See docs/aws-cost-reduction.md."
}

main "$@"
