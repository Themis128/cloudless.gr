#!/usr/bin/env bash
# Installs the automation layer on top of an already-running Postiz stack.
# Prereqs:
#   - install.sh has been run and https://postiz.cloudless.gr is up
#   - You created a Postiz API key (Settings -> Developers -> Public API)
#   - You filled 06-automation/postiz-agent/secret.yaml from .example
#   - DNS record n8n.cloudless.gr -> cluster IP exists
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

confirm_file_exists() {
  if [[ ! -f "$1" ]]; then
    echo "ERROR: $1 missing. Copy it from $1.example and fill in real values." >&2
    exit 1
  fi
}

echo "==> Pre-flight"
confirm_file_exists "$ROOT/06-automation/postiz-agent/secret.yaml"

echo "==> Postiz Agent (API key Secret + CronJob)"
kubectl apply -f "$ROOT/06-automation/postiz-agent/secret.yaml"
kubectl apply -f "$ROOT/06-automation/postiz-agent/cronjob.yaml"

echo "==> n8n (8gears chart + community-node-enabled values)"
helm repo add open-8gears https://8gears.container-registry.com/chartrepo/library >/dev/null || true
helm repo update
helm upgrade --install n8n open-8gears/n8n \
  --namespace n8n --create-namespace \
  -f "$ROOT/06-automation/n8n/values.yaml"

echo "==> n8n Ingress"
kubectl apply -f "$ROOT/06-automation/n8n/ingress.yaml"

echo
echo "DONE."
echo "  - MCP endpoint:  https://postiz.cloudless.gr/mcp (Bearer <API key>)"
echo "  - Agent CronJob: kubectl -n postiz get cronjob postiz-agent-daily-list"
echo "  - n8n:           https://n8n.cloudless.gr  (Settings -> Community Nodes -> install n8n-nodes-postiz)"
