#!/usr/bin/env bash
# Downloads community Grafana dashboards and wraps each as a labelled
# ConfigMap that the Grafana sidecar auto-imports.
#
# Run once; re-run when you want to refresh to latest revisions.
# Requires `jq` and `curl`.
set -euo pipefail

OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NS=monitoring
FOLDER="Postiz Platform"

# Format: <output-file>:<grafana.com dashboard ID>:<friendly name>
DASHBOARDS=(
  "cnpg.yaml:20417:CloudNativePG"
  "redis.yaml:11835:Redis"
  "minio.yaml:13502:MinIO"
  "argocd.yaml:14584:ArgoCD"
  "n8n.yaml:11159:n8n"
)

for entry in "${DASHBOARDS[@]}"; do
  IFS=':' read -r FILE ID NAME <<< "$entry"
  echo "==> $NAME (id $ID)"
  REV=$(curl -fsSL "https://grafana.com/api/dashboards/$ID" | jq '.revision')
  JSON=$(curl -fsSL "https://grafana.com/api/dashboards/$ID/revisions/$REV/download")

  CM_NAME="dashboard-$(basename "$FILE" .yaml)"
  cat > "$OUT_DIR/$FILE" <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: $CM_NAME
  namespace: $NS
  labels:
    grafana_dashboard: "1"
  annotations:
    grafana_folder: "$FOLDER"
data:
  ${CM_NAME}.json: |-
$(echo "$JSON" | sed 's/^/    /')
EOF
  echo "    -> $FILE"
done

echo "Done. Apply with:"
echo "  kubectl apply -f $OUT_DIR/{cnpg,redis,minio,argocd,n8n}.yaml"
