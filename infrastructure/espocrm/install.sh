#!/usr/bin/env bash
# Install / upgrade EspoCRM on the k3s cluster.
# Runs on omv-main (where kubectl + helm have the cluster context).
#
# Usage:
#   bash infrastructure/espocrm/install.sh         # install or upgrade
#   bash infrastructure/espocrm/install.sh --dry   # render manifests only
#
# Prerequisites (one-time, see README.md step 1):
#   kubectl create namespace espocrm
#   kubectl -n espocrm create secret generic espocrm-mariadb ...
#   kubectl -n espocrm create secret generic espocrm-admin ...
set -euo pipefail

DRY=""
if [ "${1:-}" = "--dry" ]; then
  DRY="--dry-run --debug"
fi

REPO_NAME="twenty20"
REPO_URL="https://twenty20-contrib.github.io/twenty20-helm-charts"
CHART="${REPO_NAME}/espocrm"
RELEASE="espocrm"
NAMESPACE="espocrm"
VALUES_FILE="$(dirname "$0")/values.yaml"

if [ ! -f "$VALUES_FILE" ]; then
  echo "ERROR: values.yaml not found at $VALUES_FILE" >&2
  exit 1
fi

# Verify the required secrets exist before attempting the install — failing
# here is cheaper than watching pods CrashLoopBackOff for ten minutes.
if [ -z "$DRY" ]; then
  for secret in espocrm-mariadb espocrm-admin; do
    if ! kubectl -n "$NAMESPACE" get secret "$secret" >/dev/null 2>&1; then
      echo "ERROR: secret $NAMESPACE/$secret missing. See README.md step 1." >&2
      exit 1
    fi
  done
fi

echo "→ adding/updating Helm repo $REPO_NAME"
helm repo add "$REPO_NAME" "$REPO_URL" 2>/dev/null || true
helm repo update "$REPO_NAME"

echo "→ helm upgrade --install $RELEASE $CHART (namespace=$NAMESPACE)"
# shellcheck disable=SC2086
helm upgrade --install "$RELEASE" "$CHART" \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --values "$VALUES_FILE" \
  --wait --timeout 10m \
  $DRY

if [ -z "$DRY" ]; then
  echo
  echo "→ pods:"
  kubectl -n "$NAMESPACE" get pods
  echo
  echo "→ next steps:"
  echo "  1. Append the ingress fragment from infrastructure/espocrm/cloudflare-tunnel.yaml"
  echo "     to /etc/cloudflared/config.yml on omv-main"
  echo "  2. sudo systemctl reload cloudflared"
  echo "  3. Add DNS CNAME espocrm.cloudless.gr → e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com"
  echo "  4. Open https://espocrm.cloudless.gr/install and complete the wizard"
  echo "  5. Generate an API key in Admin → API Users; put into SSM under"
  echo "     /cloudless/production/ESPOCRM_API_KEY"
fi
