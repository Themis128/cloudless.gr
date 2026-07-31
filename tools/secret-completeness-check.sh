#!/usr/bin/env bash
# secret-completeness-check.sh — Check for missing secrets/env vars across all services
# Created: 2026-07-31
# Usage: bash tools/secret-completeness-check.sh
#
# Checks:
#   1. Kubernetes secrets referenced by pods but missing
#   2. Cloudless-app logs for missing env var warnings
#   3. Known required secrets per service (from AGENTS.md integrations table)
#   4. Slack signing secrets (NEWSLETTER_SLACK_SIGNING_SECRET, SLACK_SIGNING_SECRET)
#   5. D1/Cloudflare API connectivity (EAI_AGAIN DNS errors)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Secret Completeness Check — $(date -u +%Y-%m-%dT%H:%M:%SZ)${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"

ISSUES=0
WARNINGS=0

# ─── 1. Check for missing Kubernetes secrets ───
echo -e "\n${CYAN}── 1. Kubernetes Secret References ──${NC}"
# Get all pods and check their secret references
kubectl get pods --all-namespaces -o json 2>/dev/null | jq -r '
  .items[]
  | . as $pod
  | .spec.volumes[]?
  | select(.secret != null)
  | "\($pod.metadata.namespace)\t\($pod.metadata.name)\t\(.secret.secretName)"
' 2>/dev/null | sort -u | while IFS=$'\t' read -r ns pod secret; do
  if [[ -z "$secret" ]]; then continue; fi
  EXISTS=$(kubectl get secret -n "$ns" "$secret" -o name 2>/dev/null || echo "")
  if [[ -z "$EXISTS" ]]; then
    echo -e "${RED}✗${NC} $ns/$pod references secret '$secret' — NOT FOUND"
  fi
done

# Also check envFrom and env.valueFrom.secretKeyRef
kubectl get pods --all-namespaces -o json 2>/dev/null | jq -r '
  .items[]
  | . as $pod
  | .spec.containers[].env[]?
  | select(.valueFrom.secretKeyRef != null)
  | "\($pod.metadata.namespace)\t\($pod.metadata.name)\t\(.valueFrom.secretKeyRef.name)"
' 2>/dev/null | sort -u | while IFS=$'\t' read -r ns pod secret; do
  if [[ -z "$secret" ]]; then continue; fi
  EXISTS=$(kubectl get secret -n "$ns" "$secret" -o name 2>/dev/null || echo "")
  if [[ -z "$EXISTS" ]]; then
    echo -e "${RED}✗${NC} $ns/$pod references secret '$secret' in env — NOT FOUND"
  fi
done

echo -e "${GREEN}✓${NC} Secret reference check complete"

# ─── 2. Cloudless-app log analysis for missing env vars ───
echo -e "\n${CYAN}── 2. Cloudless-App Log Analysis ──${NC}"
CLOUDLESS_LOGS=$(kubectl logs -n cloudless cloudless-app-6f67d7c95-9644s --tail=200 2>/dev/null || echo "")

# Check for DNS resolution failures
DNS_ERRORS=$(echo "$CLOUDLESS_LOGS" | grep -i "EAI_AGAIN\|getaddrinfo\|ENOTFOUND" | head -5)
if [[ -n "$DNS_ERRORS" ]]; then
  echo -e "${RED}✗${NC} DNS resolution failures found in cloudless-app logs:"
  echo "$DNS_ERRORS"
  ((ISSUES++))
else
  echo -e "${GREEN}✓${NC} No DNS resolution errors in recent logs"
fi

# Check for missing secrets warnings
MISSING_SECRETS=$(echo "$CLOUDLESS_LOGS" | grep -i "not set\|not configured\|missing" | grep -v "node_modules" | head -10)
if [[ -n "$MISSING_SECRETS" ]]; then
  echo -e "${YELLOW}⚠${NC} Missing config warnings in cloudless-app logs:"
  echo "$MISSING_SECRETS"
  ((WARNINGS++))
else
  echo -e "${GREEN}✓${NC} No missing config warnings in recent logs"
fi

# Check for Slack signature verification failures
SLACK_FAILS=$(echo "$CLOUDLESS_LOGS" | grep -i "Signature verification failed\|Missing x-slack" | head -5)
if [[ -n "$SLACK_FAILS" ]]; then
  echo -e "${YELLOW}⚠${NC} Slack signature verification failures detected:"
  echo "$SLACK_FAILS"
  echo "  → Likely from e2e tests or health checks without proper Slack headers"
  ((WARNINGS++))
else
  echo -e "${GREEN}✓${NC} No Slack signature verification failures"
fi

# Check for NEWSLETTER_SLACK_SIGNING_SECRET
NEWSLETTER_WARN=$(echo "$CLOUDLESS_LOGS" | grep "NEWSLETTER_SLACK_SIGNING_SECRET" | head -3)
if [[ -n "$NEWSLETTER_WARN" ]]; then
  echo -e "${YELLOW}⚠${NC} NEWSLETTER_SLACK_SIGNING_SECRET not set — newsletter Slack requests will be rejected"
  ((WARNINGS++))
else
  echo -e "${GREEN}✓${NC} No NEWSLETTER_SLACK_SIGNING_SECRET warnings"
fi

# Check for D1 connection issues
D1_ERRORS=$(echo "$CLOUDLESS_LOGS" | grep -i "D1.*failed\|D1.*error\|fetch failed" | head -5)
if [[ -n "$D1_ERRORS" ]]; then
  echo -e "${YELLOW}⚠${NC} D1 connection issues detected:"
  echo "$D1_ERRORS"
  echo "  → May be transient DNS failures (EAI_AGAIN) when resolving api.cloudflare.com"
  ((WARNINGS++))
else
  echo -e "${GREEN}✓${NC} No D1 connection errors in recent logs"
fi

# ─── 3. Known required secrets per service ───
echo -e "\n${CYAN}── 3. Service-Specific Secret Checks ──${NC}"

# Postiz secrets
echo -e "\n${CYAN}Postiz:${NC}"
POSTIZ_SECRETS=$(kubectl get secret -n postiz postiz-secrets -o jsonpath='{.data}' 2>/dev/null | jq -r 'keys[]' 2>/dev/null || echo "")
if [[ -n "$POSTIZ_SECRETS" ]]; then
  for key in POSTGRES_PASSWORD JWT_SECRET; do
    if echo "$POSTIZ_SECRETS" | grep -q "$key"; then
      echo -e "  ${GREEN}✓${NC} $key is set"
    else
      echo -e "  ${RED}✗${NC} $key is MISSING"
      ((ISSUES++))
    fi
  done
else
  echo -e "  ${RED}✗${NC} postiz-secrets not found"
  ((ISSUES++))
fi

# Cloudless-app config (from /api/config endpoint)
echo -e "\n${CYAN}Cloudless-App (via /api/config):${NC}"
CONFIG_RESP=$(curl -sS --max-time 10 "https://cloudless.gr/api/config" 2>/dev/null || echo "{}")
echo "$CONFIG_RESP" | jq -r '.config // {} | to_entries[] | "  \(.key): \(.value)"' 2>/dev/null | head -20

# Check auth provider
AUTH_PROVIDER=$(echo "$CONFIG_RESP" | jq -r '.config.AUTH_PROVIDER // .authProvider // "unknown"' 2>/dev/null)
if [[ "$AUTH_PROVIDER" == "d1" ]]; then
  echo -e "  ${GREEN}✓${NC} AUTH_PROVIDER=d1 (correct)"
else
  echo -e "  ${YELLOW}⚠${NC} AUTH_PROVIDER=$AUTH_PROVIDER (expected 'd1')"
  ((WARNINGS++))
fi

# ─── 4. Check Wrangler secrets (if wrangler available) ───
echo -e "\n${CYAN}── 4. Wrangler Secrets (if available) ──${NC}"
if command -v npx &>/dev/null; then
  echo "Checking wrangler secrets list..."
  npx wrangler secret list --config wrangler.jsonc 2>/dev/null | head -20 || echo "  (wrangler not configured or not authenticated)"
else
  echo -e "${YELLOW}⚠${NC} npx not available — skip wrangler secret check"
fi

# ─── 5. Summary of known required integrations ───
echo -e "\n${CYAN}── 5. Integration Status Summary ──${NC}"
echo "Based on AGENTS.md integration table:"
echo ""
echo "| Integration     | Env vars                                   | Status |"
echo "|-----------------|--------------------------------------------|--------|"

# Check each integration via the config endpoint
for key in SLACK_WEBHOOK_URL HUBSPOT_API_KEY NOTION_API_KEY GOOGLE_CLIENT_EMAIL GOOGLE_CALENDAR_ID; do
  VAL=$(echo "$CONFIG_RESP" | jq -r --arg k "$key" '.config[$k] // "not set"' 2>/dev/null)
  if [[ "$VAL" != "not set" ]] && [[ -n "$VAL" ]] && [[ "$VAL" != "null" ]]; then
    echo -e "  ${GREEN}✓${NC} $key = ${VAL:0:20}..."
  else
    echo -e "  ${YELLOW}⚠${NC} $key = not set"
    ((WARNINGS++))
  fi
done

# ─── Summary ───
echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Summary: ${RED}$ISSUES issues${NC}, ${YELLOW}$WARNINGS warnings${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"