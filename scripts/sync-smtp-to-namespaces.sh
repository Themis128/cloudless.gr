#!/usr/bin/env bash
# sync-smtp-to-namespaces.sh
# ─────────────────────────
# Pulls SES SMTP creds from SSM and writes a `smtp-credentials` Secret into
# every namespace that hosts a self-hosted app needing transactional email:
#
#   appflowy   — GoTrue magic links
#   espocrm    — outbound notifications + IMAP sync replies
#   postiz     — password reset, invites
#   n8n        — password reset, workflow-failure alerts
#   monitoring — Grafana alert emails (uses same Secret as Uptime Kuma if added later)
#
# Source SSM keys:
#   /cloudless/production/SES_SMTP_USER
#   /cloudless/production/SES_SMTP_PASSWORD
#   /cloudless/production/SES_FROM_EMAIL    (default noreply@cloudless.gr)
#   /cloudless/production/SES_SMTP_HOST     (default email-smtp.us-east-1.amazonaws.com)
#
# Prerequisite: SES_SMTP_USER + SES_SMTP_PASSWORD must already exist in SSM.
# Provision them once with:
#   pnpm ses:provision    # runs scripts/provision-ses-smtp.ts
#
# Usage:
#   bash scripts/sync-smtp-to-namespaces.sh             # all 5 namespaces
#   bash scripts/sync-smtp-to-namespaces.sh appflowy    # one namespace only
#
# Idempotent: kubectl apply overwrites the Secret in place. Pods restart
# automatically only if the Deployment env references the Secret AND has the
# `restartedAt` annotation refreshed — this script does both.

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
NAMESPACES=("appflowy" "espocrm" "postiz" "n8n" "monitoring")

if [[ $# -gt 0 ]]; then
  NAMESPACES=("$@")
fi

ssm_get() {
  local key="$1"  default="${2:-}"
  local v
  v=$(aws ssm get-parameter --region "$REGION" --name "/cloudless/production/$key" \
        --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || echo "")
  if [[ -z "$v" || "$v" == "None" ]]; then
    v="$default"
  fi
  echo "$v"
}

USER=$(ssm_get SES_SMTP_USER "")
PASS=$(ssm_get SES_SMTP_PASSWORD "")
FROM=$(ssm_get SES_FROM_EMAIL "noreply@cloudless.gr")
HOST=$(ssm_get SES_SMTP_HOST "email-smtp.${REGION}.amazonaws.com")
PORT="587"

if [[ -z "$USER" || -z "$PASS" ]]; then
  echo "✗ SES_SMTP_USER and/or SES_SMTP_PASSWORD missing from SSM."
  echo "  Provision them once with:  pnpm ses:provision"
  exit 1
fi

echo "→ Syncing smtp-credentials Secret to ${#NAMESPACES[@]} namespace(s)"
echo "  host=$HOST port=$PORT from=$FROM user=${USER:0:6}…"
echo

for ns in "${NAMESPACES[@]}"; do
  if ! kubectl get ns "$ns" >/dev/null 2>&1; then
    echo "  ⚠  namespace $ns not found — skipping"
    continue
  fi

  kubectl create secret generic smtp-credentials \
    --namespace="$ns" \
    --from-literal=SMTP_HOST="$HOST" \
    --from-literal=SMTP_PORT="$PORT" \
    --from-literal=SMTP_USER="$USER" \
    --from-literal=SMTP_PASSWORD="$PASS" \
    --from-literal=SMTP_FROM="$FROM" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null

  echo "  ✓ $ns/smtp-credentials applied"

  # IMPORTANT — DELETE the pod, don't `rollout restart`.
  # secretKeyRef.optional=true env vars are resolved ONCE at pod-start; if
  # the Secret didn't exist when kubelet pulled them, kubelet silently
  # OMITS the env var. `kubectl rollout restart` is often a no-op (no
  # spec change), so the new ReplicaSet's pod inherits the same missing
  # env. Deleting the pod forces a fresh kubelet env resolution AFTER
  # the Secret is in place. (Bug surfaced 2026-06-21.)
  for dep in $(kubectl -n "$ns" get deploy -o name 2>/dev/null); do
    if kubectl -n "$ns" get "$dep" -o yaml | grep -q "secretKeyRef.*smtp-credentials" 2>/dev/null; then
      dep_name="${dep#deployment.apps/}"
      for pod in $(kubectl -n "$ns" get pod -l "app=$dep_name" -o name 2>/dev/null; \
                   kubectl -n "$ns" get pod -l "app.kubernetes.io/name=$dep_name" -o name 2>/dev/null); do
        kubectl -n "$ns" delete "$pod" --wait=false >/dev/null
        echo "    ↻ deleted $pod (forces fresh env resolution)"
      done
    fi
  done
done

echo
echo "Done. To verify, send a test email from each app's admin UI."
