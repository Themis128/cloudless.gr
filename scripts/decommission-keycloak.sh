#!/usr/bin/env bash
#
# decommission-keycloak.sh — remove Keycloak from the k3s cluster.
#
# Deletes:
#   - The "keycloak" namespace (keycloak + postgres pods, services, PVCs, secrets)
#   - The "auto-healer" CronJob in ns/cloudless (Keycloak autoheal, deployed by
#     keycloak-autoheal-deploy.yml) — removed first to prevent it from fighting
#     the decommission.
#
# This operation is IRREVERSIBLE. Run migrate-keycloak-to-cognito.sh first
# to preserve user accounts, and confirm Cognito sign-in works before proceeding.
#
# Requires: kubectl with cluster-admin permissions.

set -uo pipefail

echo "=== Keycloak decommission starting ==="
echo "Time: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

# ── 1. Remove the in-cluster autoheal CronJob ─────────────────────────────────
# It runs every 5 min and would re-size / un-delete Keycloak if left running.
echo "step 1: deleting auto-healer CronJob from ns/cloudless..."
kubectl -n cloudless delete cronjob auto-healer --ignore-not-found=true \
  && echo "  auto-healer CronJob deleted (or was not present)" \
  || { echo "  ERROR: failed to delete auto-healer CronJob"; exit 1; }

# Also delete any completed/failed auto-healer jobs lingering in the namespace
echo "  cleaning up auto-healer job pods..."
kubectl -n cloudless delete jobs \
  -l "job-name"  \
  --field-selector=status.successful=1 \
  --ignore-not-found=true 2>/dev/null || true

# ── 2. Scale down Keycloak before deleting the namespace ─────────────────────
echo ""
echo "step 2: scaling down keycloak deployment..."
kubectl -n keycloak scale deployment keycloak --replicas=0 \
  --ignore-not-found=true 2>/dev/null \
  && echo "  keycloak scaled to 0" \
  || echo "  (deployment not found — may already be gone)"

# ── 3. Delete the entire keycloak namespace ───────────────────────────────────
echo ""
echo "step 3: deleting keycloak namespace (all resources + PVCs)..."
kubectl delete namespace keycloak --ignore-not-found=true \
  && echo "  namespace/keycloak delete issued" \
  || { echo "  ERROR: namespace delete failed"; exit 1; }

# Wait for termination (up to 120s)
echo "  waiting for namespace to terminate..."
for i in $(seq 1 24); do
  if ! kubectl get namespace keycloak >/dev/null 2>&1; then
    echo "  namespace/keycloak gone ✓"
    break
  fi
  echo "  ${i}/24 — still terminating, waiting 5s..."
  sleep 5
done

# Final status check
echo ""
echo "=== Verification ==="
kubectl get namespace keycloak 2>/dev/null \
  && echo "WARNING: keycloak namespace still exists (may be stuck terminating)" \
  || echo "keycloak namespace: gone ✓"

kubectl -n cloudless get cronjob auto-healer 2>/dev/null \
  && echo "WARNING: auto-healer CronJob still present" \
  || echo "auto-healer CronJob: gone ✓"

echo ""
echo "=== Keycloak decommission complete ==="
echo "Next: run 'decommission-keycloak.yml' workflow with the pi-runtime step"
echo "      to also update the cloudless-app-auth secret (wire-pi-cognito.yml"
echo "      replaces the Keycloak values with Cognito values)."
