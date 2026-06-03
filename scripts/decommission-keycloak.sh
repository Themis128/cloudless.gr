#!/usr/bin/env bash
#
# decommission-keycloak.sh — remove Keycloak from the k3s cluster.
#
# Deletes:
#   - The "keycloak-autoheal" CronJob + RBAC in ns/keycloak (the in-cluster
#     self-healer from k8s/cluster-protection/keycloak-autoheal.yaml, deployed by
#     keycloak-autoheal-deploy.yml) — removed FIRST so it can't re-size or
#     un-delete Keycloak mid-decommission.
#   - The "keycloak" namespace (keycloak + postgres pods, services, PVCs, secrets)
#
# Note: the GitHub-layer self-heal must also be wound down so it doesn't
# resurrect Keycloak — keycloak-ensure.yml (cron disabled) and
# keycloak-autoheal-deploy.yml (push trigger disabled) are both manual-only.
#
# This operation is IRREVERSIBLE. Run migrate-keycloak-to-cognito.sh first
# to preserve user accounts, and confirm Cognito sign-in works before proceeding.
#
# Requires: kubectl with cluster-admin permissions.

set -uo pipefail

echo "=== Keycloak decommission starting ==="
echo "Time: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

# ── 1. Remove the in-cluster keycloak-autoheal CronJob ───────────────────────
# It runs every 5 min (on the cluster's own scheduler) and would re-size /
# un-delete Keycloak if left running. Delete the CronJob + its RBAC + any
# in-flight heal jobs before touching the deployment/namespace.
echo "step 1: deleting keycloak-autoheal CronJob + RBAC from ns/keycloak..."
kubectl -n keycloak delete cronjob keycloak-autoheal --ignore-not-found=true \
  && echo "  keycloak-autoheal CronJob deleted (or was not present)"

# Remove its least-privilege RBAC (Role, RoleBinding, ServiceAccount)
kubectl -n keycloak delete rolebinding keycloak-autoheal --ignore-not-found=true 2>/dev/null || true
kubectl -n keycloak delete role keycloak-autoheal --ignore-not-found=true 2>/dev/null || true
kubectl -n keycloak delete serviceaccount keycloak-autoheal --ignore-not-found=true 2>/dev/null || true

# Delete any completed/failed keycloak-autoheal jobs lingering in the namespace
echo "  cleaning up keycloak-autoheal job pods..."
kubectl -n keycloak delete jobs -l "job-name" --ignore-not-found=true 2>/dev/null || true

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

# The keycloak-autoheal CronJob lived in ns/keycloak, so the namespace delete
# above removed it; this is a belt-and-braces check in case the ns lingers.
kubectl -n keycloak get cronjob keycloak-autoheal 2>/dev/null \
  && echo "WARNING: keycloak-autoheal CronJob still present" \
  || echo "keycloak-autoheal CronJob: gone ✓"

echo ""
echo "=== Keycloak decommission complete ==="
echo "Reminder: keycloak-autoheal-deploy.yml is now manual-only (push trigger"
echo "          removed) and keycloak-ensure.yml's cron is disabled — neither"
echo "          will resurrect Keycloak. The wire-pi-cognito step (run next in"
echo "          decommission-keycloak.yml) swaps the cloudless-app-auth secret"
echo "          from Keycloak to Cognito values."
