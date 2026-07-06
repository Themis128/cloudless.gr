#!/bin/bash
# Tailscale Operator Deployment Script for K3S
# Requires: kubectl, helm, Tailscale OAuth credentials
set -e

echo "🚀 Deploying Tailscale Operator to K3S cluster..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Add Tailscale Helm Repository
echo -e "${YELLOW}Step 1: Adding Tailscale Helm repository...${NC}"
helm repo add tailscale https://pkgs.tailscale.com/helmcharts
helm repo update

# Step 2: Create tailscale-operator namespace
echo -e "${YELLOW}Step 2: Creating tailscale-operator namespace...${NC}"
kubectl create namespace tailscale-operator --dry-run=client -o yaml | kubectl apply -f -

# Step 3: Apply namespace and RBAC (credentials from SSM)
echo -e "${YELLOW}Step 3: Applying namespace configuration...${NC}"
kubectl apply -f infrastructure/tailscale/namespace.yaml

# Step 4: Get credentials from SSM (if available)
echo -e "${YELLOW}Step 4: Loading credentials...${NC}"
if command -v aws &> /dev/null; then
  echo "Loading Tailscale OAuth credentials from AWS SSM..."
  CLIENT_ID=$(aws ssm get-parameter --name /cloudless/production/TAILSCALE_CLIENT_ID --with-decryption --query Parameter.Value --output text 2>/dev/null || echo "")
  CLIENT_SECRET=$(aws ssm get-parameter --name /cloudless/production/TAILSCALE_CLIENT_SECRET --with-decryption --query Parameter.Value --output text 2>/dev/null || echo "")
  
  if [ -n "$CLIENT_ID" ] && [ -n "$CLIENT_SECRET" ]; then
    echo "Credentials loaded from SSM successfully"
    kubectl patch secret tailscale-operator-secrets -n tailscale-operator --type merge -p "{\"stringData\":{\"TS_CLIENT_ID\":\"$CLIENT_ID\",\"TS_CLIENT_SECRET\":\"$CLIENT_SECRET\"}}"
  else
    echo -e "${RED}Warning: Could not load credentials from SSM. Using existing secret or .env.local${NC}"
  fi
fi

# Step 5: Install Tailscale Operator
echo -e "${YELLOW}Step 5: Installing Tailscale Operator...${NC}"
helm install tailscale-operator tailscale/tailscale-operator \
  --namespace tailscale-operator \
  --create-namespace \
  --set-string oauth.clientID="${CLIENT_ID:-}" \
  --set-string oauth.clientSecret="${CLIENT_SECRET:-}" \
  --set operatorLogLevel=info \
  --wait

# Step 6: Deploy Subnet Router
echo -e "${YELLOW}Step 6: Deploying K3S subnet router...${NC}"
kubectl apply -f infrastructure/tailscale/subnet-router.yaml

# Step 7: Deploy ProxyGroup for monitoring
echo -e "${YELLOW}Step 7: Deploying monitoring proxies...${NC}"
kubectl apply -f infrastructure/tailscale/proxygroup-monitoring.yaml

# Step 8: Create Tailscale Ingress Class
echo -e "${YELLOW}Step 8: Creating Tailscale ingress class...${NC}"
kubectl apply -f infrastructure/tailscale/ingress-class.yaml 2>/dev/null || true

# Step 9: Verify deployment
echo -e "${YELLOW}Step 9: Verifying deployment...${NC}"
echo "Pods in tailscale-operator namespace:"
kubectl get pods -n tailscale-operator
echo ""
echo "Subnet router status:"
kubectl get proxysgroup -n tailscale-operator 2>/dev/null || kubectl get ProxyGroup -n tailscale-operator

echo ""
echo -e "${GREEN}✅ Tailscale Operator deployed successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Configure Tailscale ACLs to allow subnet access"
echo "  2. Enable MagicDNS in Tailscale admin console"
echo "  3. Add Tailscale ingress to services:"
echo "     kubectl annotate svc <service> -n <namespace> tailscale.com/hostname=<name>"
echo "  4. Access services via: https://<service>.ts.cloudless.gr"