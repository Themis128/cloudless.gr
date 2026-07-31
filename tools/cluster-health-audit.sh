#!/usr/bin/env bash
# cluster-health-audit.sh — One-shot comprehensive health audit for the cloudless.gr k3s cluster
# Created: 2026-07-31
# Usage: bash tools/cluster-health-audit.sh [--json]
#
# Checks:
#   1. Node conditions (Ready, MemoryPressure, DiskPressure, PIDPressure)
#   2. Node resource usage (kubectl top nodes)
#   3. Pod status (all namespaces, flag non-Running and high-restart)
#   4. PVC status (all namespaces, flag non-Bound)
#   5. Recent events (Warnings and Unhealthy)
#   6. Internal service health (NodePort HTTP checks)
#   7. External web endpoint health (via Cloudflare Tunnel)
#   8. Cloudless-app API health endpoint
#   9. OOMKilled pod detection
#  10. Memory pressure risk assessment (nodes near capacity)

set -euo pipefail

JSON_MODE=false
[[ "${1:-}" == "--json" ]] && JSON_MODE=true

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# NodePort → service mapping (from infrastructure/cloudflare-tunnels/cloudflared-config.yml)
declare -A NODEPORTS=(
  ["cloudless-app"]="30300"
  ["grafana"]="30850"
  ["kuma"]="32501"
  ["n8n"]="30900"
  ["ntfy"]="30080"
  ["espocrm"]="30700"
  ["meilisearch"]="30902"
  ["postiz"]="30500"
  ["appflowy"]="30810"
  ["docs"]="30901"
  ["alert-api"]="30820"
)

# External endpoints (via Cloudflare Tunnel)
EXTERNAL_HOSTS=(
  "cloudless.gr"
  "grafana.cloudless.gr"
  "kuma.cloudless.gr"
  "n8n.cloudless.gr"
  "ntfy.cloudless.gr"
  "espocrm.cloudless.gr"
  "meili.cloudless.gr"
  "postiz.cloudless.gr"
  "docs.cloudless.gr"
  "appflowy.cloudless.gr"
)

OMV_IP="192.168.1.128"
ISSUES=0
WARNINGS=0

if [[ "$JSON_MODE" == "true" ]]; then
  echo '{'
  echo '  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",'
  echo '  "checks": {'
else
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║  Cloudless.gr Cluster Health Audit — $(date -u +%Y-%m-%dT%H:%M:%SZ)${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
fi

# ─── 1. Node Conditions ───
if [[ "$JSON_MODE" == "false" ]]; then
  echo -e "\n${CYAN}── 1. Node Conditions ──${NC}"
fi
NODE_OUTPUT=$(kubectl get nodes -o json 2>&1)
NODE_READY=$(echo "$NODE_OUTPUT" | jq -r '.items[].status.conditions[] | select(.type=="Ready") | .status' 2>/dev/null | head -1)
if [[ "$NODE_READY" == "True" ]]; then
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${GREEN}✓${NC} All nodes Ready"; fi
else
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${RED}✗${NC} Node not Ready!"; fi
  ((ISSUES++))
fi

# Check for MemoryPressure, DiskPressure, PIDPressure
PRESSURE=$(echo "$NODE_OUTPUT" | jq -r '.items[].status.conditions[] | select(.type!="Ready" and .status=="True") | .type' 2>/dev/null)
if [[ -n "$PRESSURE" ]]; then
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${RED}✗${NC} Pressure condition: $PRESSURE"; fi
  ((ISSUES++))
else
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${GREEN}✓${NC} No MemoryPressure/DiskPressure/PIDPressure"; fi
fi

# ─── 2. Node Resource Usage ───
if [[ "$JSON_MODE" == "false" ]]; then
  echo -e "\n${CYAN}── 2. Node Resource Usage ──${NC}"
fi
TOP_NODES=$(kubectl top nodes 2>&1)
if [[ "$JSON_MODE" == "false" ]]; then
  echo "$TOP_NODES"
fi

# Check for high memory usage (>85%)
HIGH_MEM=$(echo "$TOP_NODES" | awk 'NR>1 && $NF ~ /[0-9]+%/ {gsub(/%/,"",$NF); if ($NF+0 > 85) print $1": "$NF"%"}')
if [[ -n "$HIGH_MEM" ]]; then
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${YELLOW}⚠${NC} High memory usage: $HIGH_MEM"; fi
  ((WARNINGS++))
fi

# ─── 3. Pod Status ───
if [[ "$JSON_MODE" == "false" ]]; then
  echo -e "\n${CYAN}── 3. Pod Status (non-Running or high-restart) ──${NC}"
fi
NOT_RUNNING=$(kubectl get pods --all-namespaces --field-selector status.phase!=Running,status.phase!=Succeeded 2>&1)
if [[ "$NOT_RUNNING" == "No resources found" ]] || [[ -z "$NOT_RUNNING" ]]; then
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${GREEN}✓${NC} All pods Running or Succeeded"; fi
else
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${YELLOW}⚠${NC} Non-Running pods:"; echo "$NOT_RUNNING"; fi
  ((WARNINGS++))
fi

# High-restart pods (>2 restarts)
HIGH_RESTART=$(kubectl get pods --all-namespaces -o json 2>&1 | jq -r '.items[] | select(.status.containerStatuses != null) | . as $pod | .status.containerStatuses[] | select(.restartCount > 2) | "\($pod.metadata.namespace)/\($pod.metadata.name) restarts=\(.restartCount)"' 2>/dev/null)
if [[ -n "$HIGH_RESTART" ]]; then
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${YELLOW}⚠${NC} High-restart pods:"; echo "$HIGH_RESTART"; fi
  ((WARNINGS++))
else
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${GREEN}✓${NC} No pods with >2 restarts"; fi
fi

# ─── 4. PVC Status ───
if [[ "$JSON_MODE" == "false" ]]; then
  echo -e "\n${CYAN}── 4. PVC Status ──${NC}"
fi
PENDING_PVC=$(kubectl get pvc --all-namespaces 2>&1 | grep -v Bound | grep -v NAME)
if [[ -z "$PENDING_PVC" ]]; then
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${GREEN}✓${NC} All PVCs Bound"; fi
else
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${RED}✗${NC} Non-Bound PVCs:"; echo "$PENDING_PVC"; fi
  ((ISSUES++))
fi

# ─── 5. Recent Events ───
if [[ "$JSON_MODE" == "false" ]]; then
  echo -e "\n${CYAN}── 5. Recent Warning Events ──${NC}"
fi
WARN_EVENTS=$(kubectl get events --all-namespaces --field-selector type=Warning 2>&1 | tail -10)
if [[ "$WARN_EVENTS" == "" ]] || [[ "$WARN_EVENTS" == "No resources found" ]]; then
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${GREEN}✓${NC} No warning events"; fi
else
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${YELLOW}⚠${NC} Recent warnings:"; echo "$WARN_EVENTS"; fi
  ((WARNINGS++))
fi

# ─── 6. Internal Service Health (NodePorts) ───
if [[ "$JSON_MODE" == "false" ]]; then
  echo -e "\n${CYAN}── 6. Internal Service Health (NodePorts on $OMV_IP) ──${NC}"
fi
for name in "${!NODEPORTS[@]}"; do
  port="${NODEPORTS[$name]}"
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "http://${OMV_IP}:${port}" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "000" ]]; then
    if [[ "$JSON_MODE" == "false" ]]; then echo -e "${RED}✗${NC} $name (port $port): TIMEOUT"; fi
    ((ISSUES++))
  elif [[ "$HTTP_CODE" =~ ^[23] ]]; then
    if [[ "$JSON_MODE" == "false" ]]; then echo -e "${GREEN}✓${NC} $name (port $port): HTTP $HTTP_CODE"; fi
  else
    if [[ "$JSON_MODE" == "false" ]]; then echo -e "${YELLOW}⚠${NC} $name (port $port): HTTP $HTTP_CODE"; fi
    ((WARNINGS++))
  fi
done

# ─── 7. External Web Endpoints ───
if [[ "$JSON_MODE" == "false" ]]; then
  echo -e "\n${CYAN}── 7. External Web Endpoints (Cloudflare Tunnel) ──${NC}"
fi
for host in "${EXTERNAL_HOSTS[@]}"; do
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "https://${host}" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "000" ]]; then
    if [[ "$JSON_MODE" == "false" ]]; then echo -e "${RED}✗${NC} $host: DNS/timeout"; fi
    ((ISSUES++))
  elif [[ "$HTTP_CODE" =~ ^[23] ]]; then
    if [[ "$JSON_MODE" == "false" ]]; then echo -e "${GREEN}✓${NC} $host: HTTP $HTTP_CODE"; fi
  else
    if [[ "$JSON_MODE" == "false" ]]; then echo -e "${YELLOW}⚠${NC} $host: HTTP $HTTP_CODE"; fi
    ((WARNINGS++))
  fi
done

# ─── 8. Cloudless-App API Health ───
if [[ "$JSON_MODE" == "false" ]]; then
  echo -e "\n${CYAN}── 8. Cloudless-App API Health ──${NC}"
fi
HEALTH_RESP=$(curl -sS --max-time 10 "https://cloudless.gr/api/health" 2>/dev/null || echo '{"status":"error"}')
HEALTH_STATUS=$(echo "$HEALTH_RESP" | jq -r '.status' 2>/dev/null || echo "error")
DB_CONNECTED=$(echo "$HEALTH_RESP" | jq -r '.dbConnected' 2>/dev/null || echo "false")
if [[ "$HEALTH_STATUS" == "ok" ]] && [[ "$DB_CONNECTED" == "true" ]]; then
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${GREEN}✓${NC} API healthy, D1 connected"; fi
else
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${RED}✗${NC} API health: $HEALTH_STATUS, D1: $DB_CONNECTED"; fi
  ((ISSUES++))
fi

# ─── 9. OOMKilled Detection ───
if [[ "$JSON_MODE" == "false" ]]; then
  echo -e "\n${CYAN}── 9. OOMKilled Pod Detection ──${NC}"
fi
OOM_PODS=$(kubectl get pods --all-namespaces -o json 2>&1 | jq -r '.items[] | select(.status.containerStatuses != null) | . as $pod | .status.containerStatuses[] | select(.lastState.terminated.reason == "OOMKilled") | "\($pod.metadata.namespace)/\($pod.metadata.name) OOMKilled"' 2>/dev/null)
if [[ -z "$OOM_PODS" ]]; then
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${GREEN}✓${NC} No OOMKilled pods"; fi
else
  if [[ "$JSON_MODE" == "false" ]]; then echo -e "${RED}✗${NC} OOMKilled pods:"; echo "$OOM_PODS"; fi
  ((ISSUES++))
fi

# ─── 10. Memory Pressure Risk Assessment ───
if [[ "$JSON_MODE" == "false" ]]; then
  echo -e "\n${CYAN}── 10. Memory Pressure Risk ──${NC}"
fi
for node in $(kubectl get nodes -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
  ALLOCATABLE=$(kubectl describe node "$node" 2>/dev/null | grep "Allocatable:" -A1 | grep memory | awk '{print $2}')
  REQUESTED=$(kubectl describe node "$node" 2>/dev/null | grep "memory" | grep "Requests" | head -1 | awk '{print $2}')
  if [[ -n "$ALLOCATABLE" ]] && [[ -n "$REQUESTED" ]]; then
    # Convert to Mi for comparison
    ALLOC_MIB=$(echo "$ALLOCATABLE" | sed 's/Ki//' | awk '{printf "%.0f", $1/1024}')
    REQ_MIB=$(echo "$REQUESTED" | sed 's/Mi//' | awk '{printf "%.0f", $1}')
    if [[ "$ALLOC_MIB" -gt 0 ]]; then
      PCT=$((REQ_MIB * 100 / ALLOC_MIB))
      if [[ "$PCT" -gt 90 ]]; then
        if [[ "$JSON_MODE" == "false" ]]; then echo -e "${RED}✗${NC} $node: ${REQ_MIB}Mi/${ALLOC_MIB}Mi requested (${PCT}%) — CRITICAL"; fi
        ((ISSUES++))
      elif [[ "$PCT" -gt 75 ]]; then
        if [[ "$JSON_MODE" == "false" ]]; then echo -e "${YELLOW}⚠${NC} $node: ${REQ_MIB}Mi/${ALLOC_MIB}Mi requested (${PCT}%) — HIGH"; fi
        ((WARNINGS++))
      else
        if [[ "$JSON_MODE" == "false" ]]; then echo -e "${GREEN}✓${NC} $node: ${REQ_MIB}Mi/${ALLOC_MIB}Mi requested (${PCT}%)"; fi
      fi
    fi
  fi
done

# ─── Summary ───
if [[ "$JSON_MODE" == "false" ]]; then
  echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Summary: ${RED}$ISSUES issues${NC}, ${YELLOW}$WARNINGS warnings${NC}"
  if [[ "$ISSUES" -eq 0 ]] && [[ "$WARNINGS" -eq 0 ]]; then
    echo -e "${GREEN}  All systems healthy ✓${NC}"
  else
    echo -e "  Run specific doctor skills for each issue area"
  fi
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
else
  echo "  }"
  echo "}"
fi