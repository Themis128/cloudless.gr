#!/usr/bin/env bash
# Observability stack: kube-prometheus-stack + Loki + Alloy + dashboards + alerts.
# Prereqs: install.sh has been run; cluster is healthy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Helm repos"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null || true
helm repo add grafana              https://grafana.github.io/helm-charts              >/dev/null || true
helm repo update

echo "==> kube-prometheus-stack"
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f "$ROOT/09-observability/kube-prometheus-stack/values.yaml"
kubectl -n monitoring rollout status deploy/kube-prometheus-stack-grafana --timeout=300s

echo "==> Grafana + Alertmanager Ingresses"
kubectl apply -f "$ROOT/09-observability/kube-prometheus-stack/ingress.yaml"

echo "==> Loki (single-binary)"
helm upgrade --install loki grafana/loki \
  --namespace monitoring \
  -f "$ROOT/09-observability/loki/values.yaml"

echo "==> Alloy (log collector)"
helm upgrade --install alloy grafana/alloy \
  --namespace monitoring \
  -f "$ROOT/09-observability/loki/alloy-values.yaml"

echo "==> Enable metrics on CNPG, Redis, n8n"
kubectl -n postiz patch cluster postiz-pg --type merge \
  --patch-file "$ROOT/09-observability/enable-metrics/cnpg-cluster-patch.yaml" || true
helm upgrade --install postiz-redis bitnami/redis \
  --namespace postiz \
  -f "$ROOT/03-redis/values.yaml" \
  -f "$ROOT/09-observability/enable-metrics/redis-values-override.yaml"
kubectl apply -f "$ROOT/09-observability/enable-metrics/n8n-servicemonitor.yaml" || true

echo "==> Download community dashboards (CNPG/Redis/MinIO/ArgoCD/n8n)"
if command -v jq >/dev/null && command -v curl >/dev/null; then
  chmod +x "$ROOT/09-observability/dashboards/download-dashboards.sh"
  "$ROOT/09-observability/dashboards/download-dashboards.sh"
  kubectl apply -f "$ROOT/09-observability/dashboards/" || true
else
  echo "    (skipped — install jq + curl, then run 09-observability/dashboards/download-dashboards.sh manually)"
fi

echo "==> Custom Postiz dashboard"
kubectl apply -f "$ROOT/09-observability/dashboards/postiz.yaml"

echo "==> Critical alerts"
kubectl apply -f "$ROOT/09-observability/alerts/prometheusrule.yaml"

GRAFANA_PW=$(kubectl -n monitoring get secret kube-prometheus-stack-grafana \
  -o jsonpath='{.data.admin-password}' | base64 -d)

echo
echo "DONE."
echo "  Grafana:       https://grafana.cloudless.gr (admin / $GRAFANA_PW)"
echo "  Alertmanager:  https://alertmanager.cloudless.gr"
echo "  Dashboards:    Postiz Platform folder in Grafana"
echo
echo "Verify metrics flowing:"
echo "  kubectl -n monitoring port-forward svc/kube-prometheus-stack-prometheus 9090 &"
echo "  open http://localhost:9090/targets   # every job should be UP"
