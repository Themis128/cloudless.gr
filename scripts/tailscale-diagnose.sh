#!/bin/bash
# Tailscale Diagnose and Recovery Script
# Helps diagnose Tailscale connectivity issues on the k3s cluster
# Run this on the Pi nodes or via kubectl exec

set -euo pipefail

echo "🔍 Tailscale Diagnostics Script"
echo "================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running on Pi or via kubectl
if command -v kubectl &> /dev/null; then
  PI_MODE=false
  echo "Running in kubernetes mode"
else
  PI_MODE=true
  echo "Running in direct Pi mode"
fi
echo ""

# Function to run command on Pi
run_ssh() {
  local cmd="$1"
  if [ "$PI_MODE" = true ]; then
    eval "$cmd"
  else
    echo "SSH to Pi required but not in direct mode - skipping: $cmd"
  fi
}

echo "=== 1. Check Tailscale Operator Status ==="
if [ "$PI_MODE" = true ]; then
  kubectl get pods -n tailscale-operator -o wide
else
  echo "Run on Pi to check operator status"
fi
echo ""

echo "=== 2. Check ProxyGroup Status ==="
kubectl get ProxyGroup -n tailscale-operator -o yaml 2>/dev/null || echo "ProxyGroup CRD not found"
echo ""

echo "=== 3. Check Tailscale Ingress Status ==="
kubectl get ingress -A -o wide 2>/dev/null | grep -E "(tailscale|ts\.cloudless|NAME)" || echo "No Tailscale ingresses found"
echo ""

echo "=== 4. Check Tailscale Logs ==="
kubectl logs -n tailscale-operator -l app.kubernetes.io/name=tailscale-operator --tail=50 2>/dev/null || echo "Could not get operator logs"
echo ""

echo "=== 5. Check Tailscale Node Connectivity ==="
# Get Tailscale IPs from pods
TS_IPS=$(kubectl get pods -n tailscale-operator -o jsonpath='{.items[*].status.podIPs[*].ip}' 2>/dev/null || echo "")
if [ -n "$TS_IPS" ]; then
  echo "Tailscale pod IPs: $TS_IPS"
else
  echo "No Tailscale IPs found"
fi
echo ""

echo "=== 6. Verify Tailscale Auth Status ==="
kubectl get secret tailscale-operator-secrets -n tailscale-operator -o jsonpath='{.data.TS_CLIENT_ID}' 2>/dev/null | base64 -d || echo "TS_CLIENT_ID not found in secret"
echo ""

echo "=== 7. Check Node Tailscale Reachability ==="
echo "Testing connectivity to known Tailscale nodes..."
# Check if grafana.ts.cloudless.gr is reachable via Tailscale
if command -v curl &> /dev/null; then
  curl -s -o /dev/null -w "%{http_code}" "https://grafana.ts.cloudless.gr/api/health" 2>/dev/null && echo " - grafana.ts.cloudless.gr reachable" || echo " - grafana.ts.cloudless.gr not reachable"
fi
echo ""

echo "=== 8. Check Tailscale Funnel Status ==="
kubectl get tailscaleFunnel -A 2>/dev/null || echo "Tailscale Funnel CRD not found or no resources"
echo ""

echo "=== 9. Route Advertisement Check ==="
echo "Subnet router routes (check admin panel to confirm approval):"
kubectl get ProxyGroup k3s-subnet-router -n tailscale-operator -o jsonpath='{.status.routes}' 2>/dev/null || echo "No routes advertised"
echo ""

echo "=== 10. Troubleshooting Commands ==="
echo "Run these manually if issues found:"
echo ""
echo "# Restart Tailscale operator:"
echo "kubectl rollout restart deployment -n tailscale-operator"
echo ""
echo "# Check Tailscale operator logs:"
echo "kubectl logs -n tailscale-operator -l k8s-app=tailscale-operator -f"
echo ""
echo "# Check proxy logs:"
echo "kubectl logs -n tailscale-operator -l tailscale=proxy -f"
echo ""
echo "# Force reconcile ProxyGroup:"
echo "kubectl delete pod -n tailscale-operator -l tailscale=proxy"
echo ""
echo "# Check Tailscale control plane connectivity:"
echo "kubectl exec -n tailscale-operator deploy/tailscale-operator -- wget -qO- http://localhost:8080/healthz"
echo ""

echo "=== Diagnostic Complete ==="
echo ""
echo "If nodes are offline in Tailscale admin:"
echo "  1. Check node power status (omv should be at 192.168.1.128)"
echo "  2. Verify Tailscale service is running on the node"
echo "  3. Check firewall rules for port 41641 (Tailscale)"
echo "  4. Approve route advertisements in Tailscale admin console"