#!/usr/bin/env bash
# pod-restart-investigator.sh — Investigate high-restart pods in the k3s cluster
# Created: 2026-07-31
# Usage: bash tools/pod-restart-investigator.sh [namespace] [pod_name]
#
# If no args provided, lists all pods with >2 restarts across all namespaces.
# If namespace+pod provided, does a deep dive on that specific pod.
#
# Checks:
#   1. List all high-restart pods (>2 restarts)
#   2. For a specific pod: last termination reason, exit code, OOMKilled check
#   3. Pod resource limits/requests
#   4. Node memory pressure context
#   5. Recent events for the pod
#   6. Last 50 log lines

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Pod Restart Investigator — $(date -u +%Y-%m-%dT%H:%M:%SZ)${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"

# ─── Mode 1: List all high-restart pods ───
if [[ $# -eq 0 ]]; then
  echo -e "\n${CYAN}── High-Restart Pods (>2 restarts) ──${NC}"
  echo ""
  
  # Get all pods with restart count > 2
  kubectl get pods --all-namespaces -o json 2>/dev/null | jq -r '
    .items[]
    | select(.status.containerStatuses != null)
    | . as $pod
    | .status.containerStatuses[]
    | select(.restartCount > 2)
    | "\($pod.metadata.namespace)\t\($pod.metadata.name)\t\(.restartCount)\t\(.lastState.terminated.reason // "none")\t\(.lastState.terminated.exitCode // 0)"
  ' 2>/dev/null | while IFS=$'\t' read -r ns name restarts reason exitcode; do
    if [[ "$reason" == "OOMKilled" ]]; then
      echo -e "${RED}✗${NC} $ns/$name — $restarts restarts, last: $reason (exit $exitcode)"
    elif [[ "$reason" == "Error" ]]; then
      echo -e "${YELLOW}⚠${NC} $ns/$name — $restarts restarts, last: $reason (exit $exitcode)"
    elif [[ "$reason" == "Completed" ]]; then
      echo -e "${GREEN}○${NC} $ns/$name — $restarts restarts, last: $reason (exit $exitcode) [normal job behavior]"
    else
      echo -e "${YELLOW}?${NC} $ns/$name — $restarts restarts, last: ${reason:-unknown} (exit $exitcode)"
    fi
  done

  echo ""
  echo -e "${CYAN}── Exit Code Reference ──${NC}"
  echo "  0   = Completed (normal)"
  echo "  143 = SIGTERM (pod was terminated by kubelet/controller)"
  echo "  137 = SIGKILL (OOMKilled or force-killed)"
  echo "  1   = Application error"
  echo ""
  echo -e "To deep-dive a specific pod: ${CYAN}bash tools/pod-restart-investigator.sh <namespace> <pod_name>${NC}"
  exit 0
fi

# ─── Mode 2: Deep dive on a specific pod ───
NS="${1:-default}"
POD_NAME="${2:-}"

if [[ -z "$POD_NAME" ]]; then
  echo -e "${RED}Error: Pod name required${NC}"
  echo "Usage: bash tools/pod-restart-investigator.sh <namespace> <pod_name>"
  exit 1
fi

echo -e "\n${CYAN}── Deep Dive: $NS/$POD_NAME ──${NC}"

# 1. Pod status
echo -e "\n${CYAN}1. Pod Status${NC}"
kubectl get pod -n "$NS" "$POD_NAME" -o wide 2>&1

# 2. Container status with restart info
echo -e "\n${CYAN}2. Container Status (restart details)${NC}"
kubectl get pod -n "$NS" "$POD_NAME" -o json 2>/dev/null | jq '{
  restartCount: .status.containerStatuses[0].restartCount,
  lastState: .status.containerStatuses[0].lastState,
  state: .status.containerStatuses[0].state,
  ready: .status.containerStatuses[0].ready,
  started: .status.containerStatuses[0].started
}' 2>/dev/null

# 3. Resource limits/requests
echo -e "\n${CYAN}3. Resource Limits & Requests${NC}"
kubectl get pod -n "$NS" "$POD_NAME" -o json 2>/dev/null | jq '.spec.containers[0].resources' 2>/dev/null

# 4. Node context
echo -e "\n${CYAN}4. Node Context${NC}"
NODE=$(kubectl get pod -n "$NS" "$POD_NAME" -o jsonpath='{.spec.nodeName}' 2>/dev/null)
echo "Pod is on node: $NODE"
if [[ -n "$NODE" ]]; then
  echo -e "\nNode $NODE conditions:"
  kubectl get node "$NODE" -o json 2>/dev/null | jq '.status.conditions[] | {type, status, reason, message}' 2>/dev/null
  echo -e "\nNode $NODE memory:"
  kubectl describe node "$NODE" 2>/dev/null | grep -A5 "Allocated resources" | head -10
fi

# 5. Recent events
echo -e "\n${CYAN}5. Recent Events (last 20)${NC}"
kubectl get events -n "$NS" --field-selector involvedObject.name="$POD_NAME" --sort-by='.lastTimestamp' 2>&1 | tail -20

# 6. Logs
echo -e "\n${CYAN}6. Last 50 Log Lines${NC}"
kubectl logs -n "$NS" "$POD_NAME" --tail=50 2>&1 || echo "(logs unavailable)"

# 7. Previous container logs (if restarted)
echo -e "\n${CYAN}7. Previous Container Logs (if available)${NC}"
kubectl logs -n "$NS" "$POD_NAME" --previous --tail=30 2>&1 || echo "(no previous logs available)"

echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"