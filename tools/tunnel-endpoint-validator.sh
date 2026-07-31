#!/usr/bin/env bash
# tunnel-endpoint-validator.sh — Validate Cloudflare Tunnel config against actual k3s services
# Created: 2026-07-31
# Usage: bash tools/tunnel-endpoint-validator.sh
#
# Cross-references:
#   1. infrastructure/cloudflare-tunnels/cloudflared-config.yml (tunnel ingress rules)
#   2. Actual k3s NodePort services (kubectl get svc)
#   3. External DNS resolution (dig/curl)
#   4. Internal service health (curl NodePort)
#
# Detects:
#   - Tunnel rules pointing to non-existent NodePorts
#   - NodePort services not exposed via tunnel
#   - DNS records that don't resolve
#   - Domain mismatches (e.g., cloudflow.gr vs cloudless.gr)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

OMV_IP="192.168.1.128"
CONFIG_FILE="infrastructure/cloudflare-tunnels/cloudflared-config.yml"

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Tunnel Endpoint Validator — $(date -u +%Y-%m-%dT%H:%M:%SZ)${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"

# ─── 1. Parse tunnel config ───
echo -e "\n${CYAN}── 1. Tunnel Config Ingress Rules ──${NC}"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo -e "${RED}✗${NC} Config file not found: $CONFIG_FILE"
  exit 1
fi

# Extract hostname → service:port pairs from the config
declare -A TUNNEL_RULES
CURRENT_HOST=""
while IFS= read -r line; do
  if [[ "$line" =~ hostname:\ (.+) ]]; then
    CURRENT_HOST="${BASH_REMATCH[1]}"
  elif [[ "$line" =~ service:\ http://.+:([0-9]+) ]] && [[ -n "$CURRENT_HOST" ]]; then
    PORT="${BASH_REMATCH[1]}"
    TUNNEL_RULES["$CURRENT_HOST"]="$PORT"
    echo -e "  $CURRENT_HOST → port $PORT"
  elif [[ "$line" =~ service:\ http://localhost:([0-9]+) ]] && [[ -n "$CURRENT_HOST" ]]; then
    PORT="${BASH_REMATCH[1]}"
    TUNNEL_RULES["$CURRENT_HOST"]="$PORT"
    echo -e "  $CURRENT_HOST → localhost:$PORT"
  fi
done < "$CONFIG_FILE"

# ─── 2. Get actual k3s NodePort services ───
echo -e "\n${CYAN}── 2. Actual k3s NodePort Services ──${NC}"
kubectl get svc --all-namespaces -o json 2>/dev/null | jq -r '
  .items[]
  | select(.spec.type == "NodePort")
  | .metadata.namespace + "/" + .metadata.name + "\t" + 
    (.spec.ports | map(.nodePort|tostring) | join(","))
' 2>/dev/null | while IFS=$'\t' read -r svc ports; do
  echo -e "  $svc → NodePort(s): $ports"
done

# ─── 3. Validate each tunnel rule ───
echo -e "\n${CYAN}── 3. Tunnel Rule Validation ──${NC}"
ISSUES=0
for host in "${!TUNNEL_RULES[@]}"; do
  port="${TUNNEL_RULES[$host]}"
  
  # Skip localhost services (OMV web UI, FTP)
  if [[ "$port" == "80" ]] || [[ "$port" == "21" ]]; then
    echo -e "${GREEN}✓${NC} $host → localhost:$port (host-level service, skip NodePort check)"
    continue
  fi
  
  # Check if the NodePort is actually defined in k8s
  PORT_EXISTS=$(kubectl get svc --all-namespaces -o json 2>/dev/null | jq -r --arg p "$port" '
    .items[]
    | select(.spec.type == "NodePort")
    | select(.spec.ports[].nodePort == ($p|tonumber))
    | .metadata.namespace + "/" + .metadata.name
  ' 2>/dev/null | head -1)
  
  if [[ -z "$PORT_EXISTS" ]]; then
    echo -e "${RED}✗${NC} $host → port $port — NO NodePort service found!"
    ((ISSUES++))
  else
    # Check internal health
    HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "http://${OMV_IP}:${port}" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "000" ]]; then
      echo -e "${RED}✗${NC} $host → port $port ($PORT_EXISTS) — TIMEOUT on internal curl"
      ((ISSUES++))
    elif [[ "$HTTP_CODE" =~ ^[23] ]]; then
      echo -e "${GREEN}✓${NC} $host → port $port ($PORT_EXISTS) — internal HTTP $HTTP_CODE"
    else
      echo -e "${YELLOW}⚠${NC} $host → port $port ($PORT_EXISTS) — internal HTTP $HTTP_CODE"
    fi
  fi
  
  # Check external DNS resolution
  DNS_RESULT=$(dig +short "$host" 2>/dev/null || echo "")
  if [[ -z "$DNS_RESULT" ]]; then
    echo -e "${RED}✗${NC}   DNS: $host does NOT resolve!"
    ((ISSUES++))
  else
    echo -e "${GREEN}✓${NC}   DNS: $host → $DNS_RESULT"
  fi
  
  # Check external HTTP
  EXT_HTTP=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "https://$host" 2>/dev/null || echo "000")
  if [[ "$EXT_HTTP" == "000" ]]; then
    echo -e "${RED}✗${NC}   Web: https://$host — TIMEOUT/UNREACHABLE"
    ((ISSUES++))
  elif [[ "$EXT_HTTP" =~ ^[23] ]]; then
    echo -e "${GREEN}✓${NC}   Web: https://$host — HTTP $EXT_HTTP"
  else
    echo -e "${YELLOW}⚠${NC}   Web: https://$host — HTTP $EXT_HTTP"
  fi
  echo ""
done

# ─── 4. Check for NodePort services NOT in tunnel config ───
echo -e "${CYAN}── 4. NodePort Services NOT in Tunnel Config ──${NC}"
kubectl get svc --all-namespaces -o json 2>/dev/null | jq -r '
  .items[]
  | select(.spec.type == "NodePort")
  | . as $svc
  | .spec.ports[]
  | "\($svc.metadata.namespace)/\($svc.metadata.name)\t\(.nodePort)"
' 2>/dev/null | while IFS=$'\t' read -r svc port; do
  FOUND=false
  for h in "${!TUNNEL_RULES[@]}"; do
    if [[ "${TUNNEL_RULES[$h]}" == "$port" ]]; then
      FOUND=true
      break
    fi
  done
  if [[ "$FOUND" == "false" ]]; then
    echo -e "${YELLOW}⚠${NC} $svc (NodePort $port) — not exposed via tunnel"
  fi
done

# ─── 5. Known domain mismatch check ───
echo -e "\n${CYAN}── 5. Known Domain Issues ──${NC}"
# Check for the cloudflow.gr vs cloudless.gr typo
if grep -q "cloudflow.gr" "$CONFIG_FILE" 2>/dev/null; then
  echo -e "${RED}✗${NC} Found 'cloudflow.gr' in tunnel config — should be 'cloudless.gr'"
  ((ISSUES++))
else
  echo -e "${GREEN}✓${NC} No 'cloudflow.gr' domain typo in config"
fi

# Check .clinerules docs for stale domain references
STALE_REFS=$(grep -r "cloudflow.gr" .clinerules/ docs/ 2>/dev/null | head -5)
if [[ -n "$STALE_REFS" ]]; then
  echo -e "${YELLOW}⚠${NC} Stale 'cloudflow.gr' references found in docs:"
  echo "$STALE_REFS"
  echo "  → These should be updated to 'cloudless.gr'"
else
  echo -e "${GREEN}✓${NC} No stale 'cloudflow.gr' references in docs"
fi

# ─── Summary ───
echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
if [[ "$ISSUES" -eq 0 ]]; then
  echo -e "${GREEN}  All tunnel endpoints valid ✓${NC}"
else
  echo -e "${RED}  $ISSUES issue(s) found${NC}"
fi
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"