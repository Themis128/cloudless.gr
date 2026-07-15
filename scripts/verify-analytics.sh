#!/bin/bash
# Analytics verification script - checks all analytics-related services
# Usage: ./scripts/verify-analytics.sh [--watch]

set -e

WATCH_MODE=false
if [[ "$1" == "--watch" ]]; then
  WATCH_MODE=true
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Cloudless Analytics Stack Verification ==="
echo "Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""

# Function to check pod status
check_pods() {
  local namespace=$1
  local expected=$2
  local running=$(kubectl get pods -n "$namespace" --no-headers 2>/dev/null | grep -c "Running" || echo "0")
  local ready=$(kubectl get pods -n "$namespace" --no-headers 2>/dev/null | grep -c "1/1" || echo "0")
  
  if [[ "$running" -ge "$expected" ]]; then
    echo -e "${GREEN}✓${NC} $namespace: $running/$expected pods running"
  else
    echo -e "${RED}✗${NC} $namespace: $running/$expected pods running (expected $expected)"
  fi
}

# Function to check PVC status
check_pvcs() {
  local namespace=$1
  local pvcs=$(kubectl get pvc -n "$namespace" --no-headers 2>/dev/null | wc -l || echo "0")
  echo -e "${GREEN}✓${NC} $namespace: $pvcs PVCs provisioned"
}

# Function to check service endpoints
check_service() {
  local service=$1
  local expected_port=$2
  
  if kubectl get svc -n "$namespace" "$service" --no-headers 2>/dev/null | grep -q "$expected_port"; then
    echo -e "${GREEN}✓${NC} Service $service: NodePort $expected_port configured"
  else
    echo -e "${YELLOW}?${NC} Service $service: check NodePort configuration"
  fi
}

# Phase 1: AppFlowy Stack
echo "--- Phase 1: AppFlowy Stack ---"
check_pods "appflowy" 9
check_pvcs "appflowy"
echo ""

# Checking specific pods by label
for label in "app=postgres" "app=redis" "app=gotrue" "app=appflowy-cloud" "app=appflowy-web" "app=nginx"; do
  if kubectl get pods -n appflowy -l "$label" --no-headers 2>/dev/null | grep -q "Running"; then
    echo -e "${GREEN}✓${NC} AppFlowy pod $label: running"
  else
    echo -e "${RED}✗${NC} AppFlowy pod $label: not running"
  fi
done
echo ""

# Phase 2: n8n
echo "--- Phase 2: n8n ---"
check_pods "n8n" 1
check_pvcs "n8n"
echo ""

# Phase 3: EspoCRM
echo "--- Phase 3: EspoCRM ---"
check_pods "espocrm" 2
check_pvcs "espocrm"
echo ""

# Phase 4: Analytics Stack (monitoring namespace)
echo "--- Phase 4: Analytics Stack ---"
# Check if DuckDB pod exists (would be in a dedicated namespace or monitoring)
if kubectl get pods -n monitoring -l "app=duckdb" --no-headers 2>/dev/null | grep -q "Running"; then
  echo -e "${GREEN}✓${NC} DuckDB: running in monitoring namespace"
else
  echo -e "${YELLOW}?${NC} DuckDB: not deployed yet (Phase 3.5) or in different namespace"
fi

# Check Metabase
if kubectl get pods -n monitoring -l "app=metabase" --no-headers 2>/dev/null | grep -q "Running"; then
  echo -e "${GREEN}✓${NC} Metabase: running in monitoring namespace"
else
  echo -e "${YELLOW}?${NC} Metabase: not deployed yet (Phase 4) or in analytics namespace"
fi
echo ""

# Phase 5: Postiz
echo "--- Phase 5: Postiz ---"
check_pods "postiz" 3
check_pvcs "postiz"
echo ""

# Resource usage
echo "--- Resource Usage ---"
kubectl top nodes 2>/dev/null || echo "Metrics not available (metrics-server may be pending)"
echo ""

# ETL Script Status
echo "--- ETL Script Status ---"
for script in stripe-to-lake.mjs clients-to-lake.mjs compute-rfm-churn.mjs espocrm-to-lake.mjs gsc-to-lake.mjs; do
  if [[ -f "scripts/etl/$script" ]]; then
    echo -e "${GREEN}✓${NC} $script exists"
  else
    echo -e "${RED}✗${NC} $script missing"
  fi
done
echo ""

if [[ "$WATCH_MODE" == "true" ]]; then
  echo "Watching mode enabled - press Ctrl+C to exit"
  while true; do
    sleep 30
    echo ""
    echo "=== Refresh: $(date -u '+%Y-%m-%d %H:%M:%S UTC') ==="
    check_pods "appflowy" 9
    check_pods "n8n" 1
    check_pods "espocrm" 2
  done
else
  echo "Done. Run with --watch for continuous monitoring."
fi
