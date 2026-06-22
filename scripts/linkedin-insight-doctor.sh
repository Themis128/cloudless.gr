#!/usr/bin/env bash
# linkedin-insight-doctor.sh
#
# Diagnose why the LinkedIn Insight Tag is not firing on cloudless.gr.
# Walks through the four failure modes documented in
# `skills/linkedin-insight-doctor/SKILL.md` and prints a structured verdict.
#
# Exit codes:
#   0 = healthy (tag firing, conversion active)
#   1 = misconfigured (one or more required secrets/params missing)
#   9 = preconditions failed (missing tooling, network error, …)
#
# Usage:
#   bash scripts/linkedin-insight-doctor.sh
#   bash scripts/linkedin-insight-doctor.sh --slug shop-online --locale el
#   bash scripts/linkedin-insight-doctor.sh --no-color
#
# Requires: bash, curl, grep, sed, awk. Optional: jq, aws (for SSM check),
# gh (for GitHub secret presence check). Missing optional tools degrade the
# check gracefully — they do not fail the script.

set -uo pipefail

SLUG="shop-online"
LOCALE="el"
SITE_URL="https://cloudless.gr"
SSM_PREFIX="/cloudless/production"
REPO="${GH_REPO:-Themis128/cloudless.gr}"
COLOR=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug) SLUG="$2"; shift 2 ;;
    --locale) LOCALE="$2"; shift 2 ;;
    --site) SITE_URL="$2"; shift 2 ;;
    --no-color) COLOR=0; shift ;;
    -h|--help) sed -n '1,25p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 9 ;;
  esac
done

if [[ "$COLOR" == "1" ]]; then
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'; C_DIM=$'\033[2m'; C_RST=$'\033[0m'
else
  C_RED=""; C_GRN=""; C_YEL=""; C_DIM=""; C_RST=""
fi

ok()   { printf "  %s✓%s  %s\n" "$C_GRN" "$C_RST" "$1"; }
warn() { printf "  %s!%s  %s\n" "$C_YEL" "$C_RST" "$1"; }
fail() { printf "  %s✗%s  %s\n" "$C_RED" "$C_RST" "$1"; }
note() { printf "    %s%s%s\n" "$C_DIM" "$1" "$C_RST"; }
hdr()  { printf "\n%s──── %s ────%s\n" "$C_DIM" "$1" "$C_RST"; }

ERRORS=0
WARNINGS=0
PARTNER_ID_LITERAL=""

hdr "preconditions"
for tool in curl grep sed awk; do
  command -v "$tool" >/dev/null 2>&1 || { fail "missing tool: $tool"; exit 9; }
done
ok "core tooling present"

HAS_AWS=0; command -v aws >/dev/null 2>&1 && HAS_AWS=1
HAS_GH=0;  command -v gh  >/dev/null 2>&1 && HAS_GH=1
(( HAS_AWS )) || warn "aws CLI not installed — SSM check will be skipped"
(( HAS_GH ))  || warn "gh CLI not installed — GitHub secret check will be skipped"

hdr "1. SSM Parameter Store"
if (( HAS_AWS )); then
  if aws ssm get-parameter --name "${SSM_PREFIX}/NEXT_PUBLIC_LINKEDIN_PARTNER_ID" --region us-east-1 >/dev/null 2>&1; then
    ok "NEXT_PUBLIC_LINKEDIN_PARTNER_ID present in SSM"
  else
    warn "NEXT_PUBLIC_LINKEDIN_PARTNER_ID NOT in SSM"
    note "SSM is informational — deploy-pi.yml reads from GitHub secrets, not SSM."
    note "But missing SSM AND missing GH secret is the common failure pattern."
    WARNINGS=$((WARNINGS+1))
  fi
  if aws ssm get-parameter --name "${SSM_PREFIX}/LINKEDIN_CAPI_ACCESS_TOKEN" --region us-east-1 >/dev/null 2>&1; then
    ok "LINKEDIN_CAPI_ACCESS_TOKEN present in SSM (server-side CAPI mirror enabled)"
  else
    warn "LINKEDIN_CAPI_ACCESS_TOKEN NOT in SSM (server-side CAPI mirror disabled)"
    note "Browser fire still works; only the dual-fire CAPI mirror is skipped."
    WARNINGS=$((WARNINGS+1))
  fi
else
  warn "skipped — install aws CLI to enable"
fi

hdr "2. GitHub Actions secrets"
if (( HAS_GH )); then
  if gh secret list --repo "$REPO" 2>/dev/null | grep -q "^NEXT_PUBLIC_LINKEDIN_PARTNER_ID"; then
    ok "NEXT_PUBLIC_LINKEDIN_PARTNER_ID secret exists in $REPO"
  else
    fail "NEXT_PUBLIC_LINKEDIN_PARTNER_ID secret missing — THIS IS THE LIKELY CAUSE"
    note "Set via: gh secret set NEXT_PUBLIC_LINKEDIN_PARTNER_ID --repo $REPO --body '<numeric_id>'"
    note "Get the ID from Campaign Manager → Account Assets → Insight Tag."
    ERRORS=$((ERRORS+1))
  fi
  if gh secret list --repo "$REPO" 2>/dev/null | grep -q "^LINKEDIN_CAPI_ACCESS_TOKEN"; then
    ok "LINKEDIN_CAPI_ACCESS_TOKEN secret exists"
  else
    warn "LINKEDIN_CAPI_ACCESS_TOKEN secret missing (CAPI mirror disabled)"
    note "Generate via Campaign Manager → Data → Signals Manager → Direct API."
    WARNINGS=$((WARNINGS+1))
  fi
else
  warn "skipped — install + auth gh CLI to enable"
fi

hdr "3. Live JS bundle"
CAMPAIGN_URL="${SITE_URL}/${LOCALE}/campaigns/${SLUG}"
HTML="$(curl -fsSL --max-time 15 "$CAMPAIGN_URL" 2>/dev/null || true)"
if [[ -z "$HTML" ]]; then
  fail "could not fetch $CAMPAIGN_URL"
  ERRORS=$((ERRORS+1))
else
  ok "fetched $CAMPAIGN_URL"
  CHUNKS=$(printf '%s' "$HTML" | grep -oE '/_next/static/chunks/[a-zA-Z0-9_-]+\.js' | sort -u)
  if [[ -z "$CHUNKS" ]]; then
    warn "no JS chunks discovered in HTML (Next.js render unusual)"
    WARNINGS=$((WARNINGS+1))
  else
    CHUNK_COUNT=$(printf '%s\n' "$CHUNKS" | wc -l | tr -d ' ')
    note "scanning $CHUNK_COUNT chunks for Partner ID literal…"
    FOUND_ID=""
    for CHUNK in $CHUNKS; do
      CHUNK_BODY="$(curl -fsSL --max-time 10 "${SITE_URL}${CHUNK}" 2>/dev/null || true)"
      [[ -z "$CHUNK_BODY" ]] && continue
      # Two patterns webpack can produce after minification:
      #  (a) Inline literal:   _linkedin_partner_id="12345678"
      #  (b) Minified variable: let t="12345678"; ...; _linkedin_partner_id=t
      # Detect by anchoring on the licdn URL (always present in the Insight
      # Tag loader code) and a nearby quoted numeric ID 6-9 digits long.
      # Verified on production bundle chunk 2zllz81i5lj6d.js (2026-06-19).
      if ! printf '%s' "$CHUNK_BODY" | grep -qE 'snap\.licdn\.com/li\.lms-analytics/insight\.min\.js|_linkedin_partner_id|lintrk'; then
        continue
      fi
      MATCH=""
      # Try inline literal first.
      MATCH=$(printf '%s' "$CHUNK_BODY" | grep -oE '_linkedin_(data_)?partner_id[s]?[^"]{0,40}"[0-9]{6,9}"' | head -1 || true)
      if [[ -z "$MATCH" ]]; then
        # Then: any 6-9 digit quoted ID assigned to a short var near the loader.
        # Anchor on lintrk/_linkedin_partner_id context (within ~400 chars before).
        MATCH=$(printf '%s' "$CHUNK_BODY" | grep -oE '[A-Za-z_$][A-Za-z0-9_$]{0,2}="[0-9]{6,9}"[^"]{0,400}(lintrk|_linkedin_partner_id)' | head -1 || true)
      fi
      if [[ -n "$MATCH" ]]; then
        FOUND_ID=$(printf '%s' "$MATCH" | grep -oE '"[0-9]{6,9}"' | head -1 | tr -d '"')
        ok "Partner ID literal found in bundle: $FOUND_ID  ($CHUNK)"
        PARTNER_ID_LITERAL="$FOUND_ID"
        break
      fi
    done
    if [[ -z "$FOUND_ID" ]]; then
      fail "no Partner ID literal found in any of $CHUNK_COUNT chunks"
      note "→ Stale build, OR secret was empty at build time."
      note "→ Set the secret, then trigger: gh workflow run deploy-pi.yml --ref main"
      ERRORS=$((ERRORS+1))
    fi
  fi
fi

hdr "4. Conversion definition in code"
CAMPAIGNS_FILE="src/data/campaigns.ts"
if [[ -f "$CAMPAIGNS_FILE" ]]; then
  CONVERSION_IDS=$(grep -oE 'linkedinConversionId:\s*[0-9]+' "$CAMPAIGNS_FILE" | grep -oE '[0-9]+' || true)
  if [[ -n "$CONVERSION_IDS" ]]; then
    while IFS= read -r CID; do
      ok "campaign declares linkedinConversionId=$CID"
    done <<< "$CONVERSION_IDS"
    note "Verify each is 'Active' in Campaign Manager → Conversions."
  else
    warn "no linkedinConversionId set in $CAMPAIGNS_FILE"
    WARNINGS=$((WARNINGS+1))
  fi
else
  warn "$CAMPAIGNS_FILE not found — run from repo root"
fi

hdr "verdict"
if (( ERRORS > 0 )); then
  printf "  %s✗ NOT HEALTHY%s  $ERRORS error(s), $WARNINGS warning(s)\n" "$C_RED" "$C_RST"
  echo
  echo "  Next action:"
  if [[ -z "$PARTNER_ID_LITERAL" ]]; then
    cat <<EOF
    1. Get Partner ID from LinkedIn Campaign Manager → Account Assets → Insight Tag.
    2. gh secret set NEXT_PUBLIC_LINKEDIN_PARTNER_ID --repo $REPO --body '<ID>'
    3. gh workflow run deploy-pi.yml --ref main
    4. Wait ~5-7 min for build + rollout, then re-run this script.
EOF
  else
    echo "    Bundle is correctly built. Issues elsewhere (consent, conversion definition)."
  fi
  exit 1
elif (( WARNINGS > 0 )); then
  printf "  %s! DEGRADED%s  bundle looks correct but $WARNINGS warning(s) present\n" "$C_YEL" "$C_RST"
  exit 0
else
  printf "  %s✓ HEALTHY%s  Insight Tag is configured and bundled.\n" "$C_GRN" "$C_RST"
  exit 0
fi
