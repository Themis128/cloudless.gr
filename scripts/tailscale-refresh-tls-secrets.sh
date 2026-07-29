#!/usr/bin/env bash
# After enabling HTTPS Certificates in the Tailscale admin DNS UI, delete empty
# operator-managed TLS Secrets so Serve / kube-apiserver can re-provision PEMs.
set -euo pipefail
NS="${TS_NAMESPACE:-tailscale}"
TAILNET_SUFFIX="${TAILSCALE_TAILNET:-tail4ecae1.ts.net}"
HOSTS=(grafana kube meilisearch loki)

need_kubectl() { command -v kubectl >/dev/null || { echo "kubectl required" >&2; exit 1; }; }
need_kubectl

echo "== Checking TLS Secrets in $NS =="
empty=()
for h in "${HOSTS[@]}"; do
  name="${h}.${TAILNET_SUFFIX}"
  if ! kubectl get secret "$name" -n "$NS" >/dev/null 2>&1; then
    echo "  skip missing $name"
    continue
  fi
  len=$(kubectl get secret "$name" -n "$NS" -o jsonpath='{.data.tls\.crt}' | wc -c | tr -d ' ')
  # base64 of empty is empty → len 0; tiny non-empty PEM is much larger
  if [[ "${len:-0}" -lt 20 ]]; then
    echo "  EMPTY $name (tls.crt b64 len=$len)"
    empty+=("$name")
  else
    echo "  ok    $name (tls.crt b64 len=$len)"
  fi
done

if [[ ${#empty[@]} -eq 0 ]]; then
  echo "No empty TLS Secrets to delete."
  exit 0
fi

echo "== Deleting empty Secrets: ${empty[*]} =="
kubectl delete secret -n "$NS" "${empty[@]}"
echo "Done. Watch: kubectl get proxygroup,ingress -A; kubectl get secret -n $NS"
