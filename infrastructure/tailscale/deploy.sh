#!/usr/bin/env bash
# Deploy Tailscale Kubernetes Operator + fabric interconnect (free tier).
# Docs: docs/TAILSCALE-FABRIC.md
# Official: https://tailscale.com/docs/kubernetes-operator/install-operator
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NS="${TS_OPERATOR_NS:-tailscale}"

need() { command -v "$1" >/dev/null || { echo "missing $1"; exit 1; }; }
need kubectl
need helm

CLIENT_ID="${TS_CLIENT_ID:-${TAILSCALE_CLIENT_ID:-}}"
CLIENT_SECRET="${TS_CLIENT_SECRET:-${TAILSCALE_CLIENT_SECRET:-}}"
if [[ -z "$CLIENT_ID" || -z "$CLIENT_SECRET" ]]; then
  echo "Set TS_CLIENT_ID and TS_CLIENT_SECRET (OAuth client tagged tag:k8s-operator)."
  echo "Create at: https://login.tailscale.com/admin/settings/oauth"
  echo "Scopes: Devices Core write, Auth Keys write. Tags: tag:k8s-operator"
  exit 2
fi

echo "==> Helm repo"
helm repo add tailscale https://pkgs.tailscale.com/helmcharts >/dev/null
helm repo update tailscale >/dev/null

echo "==> Install/upgrade operator (ns=$NS)"
helm upgrade --install tailscale-operator tailscale/tailscale-operator \
  --namespace "$NS" \
  --create-namespace \
  --set-string oauth.clientId="$CLIENT_ID" \
  --set-string oauth.clientSecret="$CLIENT_SECRET" \
  --set operatorConfig.defaultTags="{tag:k8s-operator}" \
  --set-string proxyConfig.defaultTags="tag:k8s" \
  --set-string apiServerProxyConfig.allowImpersonation="true" \
  --wait

echo "==> IngressClass (skip if Helm already created it)"
if ! kubectl get ingressclass tailscale >/dev/null 2>&1; then
  kubectl apply -f "$ROOT/infrastructure/tailscale/ingress-class.yaml"
else
  echo "    IngressClass tailscale already exists — leaving controller field alone"
fi

echo "==> Connector/ProxyClass + ProxyGroups"
kubectl apply -f "$ROOT/infrastructure/tailscale/connector.yaml"

echo "==> ProxyGroups (ingress + kube-apiserver)"
kubectl apply -f "$ROOT/infrastructure/tailscale/proxygroup.yaml"

echo "==> Ingresses (Grafana / Loki / Meili → shared ProxyGroup)"
kubectl apply -f "$ROOT/infrastructure/tailscale/ingresses.yaml"

echo
echo "==> Status"
kubectl get connector,proxygroup,proxyclass -A 2>/dev/null || \
  kubectl get connector,proxygroup,proxyclass
kubectl get pods -n "$NS"

echo
echo "Next:"
echo "  1. Merge infrastructure/tailscale/acl-policy.example.json into Access controls"
echo "  2. Delete stale Machines (monitoring-proxies-*, old app proxies) in admin UI"
echo "  3. Approve subnet routes if autoApprovers not live yet"
echo "  4. kubectl wait connector k3s-cidrs --for=condition=ConnectorReady=true --timeout=5m"
echo "  5. kubectl wait proxygroup kube --for=condition=ProxyGroupReady=true --timeout=5m"
echo "  6. tailscale configure kubeconfig \$(kubectl get proxygroup kube -o jsonpath='{.status.url}')"
echo "  7. Add k3s tls-san for Tailscale IP (see docs/TAILSCALE-FABRIC.md) if dialing :6443 directly"
