#!/usr/bin/env bash
# Installs ArgoCD and the AppOfApps that reconciles this folder.
# Prereqs: install.sh has been run; the manifests in this folder are pushed
#          to a git repo; you've sed-replaced REPLACE_WITH_REPO_URL everywhere.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Pre-flight: ensuring repo URL placeholders are gone"
if grep -rqn 'REPLACE_WITH_REPO_URL' "$ROOT/08-gitops/"; then
  echo "ERROR: REPLACE_WITH_REPO_URL still present in 08-gitops/. Run:" >&2
  echo "  REPO=https://github.com/<you>/<repo>" >&2
  echo "  grep -rl REPLACE_WITH_REPO_URL 08-gitops/ | xargs sed -i \"s|REPLACE_WITH_REPO_URL|\$REPO|g\"" >&2
  exit 1
fi

echo "==> Helm repos"
helm repo add argo https://argoproj.github.io/argo-helm >/dev/null || true
helm repo update

echo "==> ArgoCD"
helm upgrade --install argo-cd argo/argo-cd \
  --namespace argocd --create-namespace \
  -f "$ROOT/08-gitops/argocd/values.yaml"
kubectl -n argocd rollout status deploy/argo-cd-argocd-server --timeout=180s

echo "==> ArgoCD Ingress"
kubectl apply -f "$ROOT/08-gitops/argocd/ingress.yaml"

echo "==> Optional: private repo credentials"
if [[ -f "$ROOT/08-gitops/argocd/repo-creds.yaml" ]]; then
  kubectl apply -f "$ROOT/08-gitops/argocd/repo-creds.yaml"
else
  echo "    (skipped — public repo, or fill 08-gitops/argocd/repo-creds.yaml.example)"
fi

echo "==> AppProject + AppOfApps"
kubectl apply -f "$ROOT/08-gitops/apps/_project.yaml"
kubectl apply -f "$ROOT/08-gitops/apps/_app-of-apps.yaml"

echo
echo "DONE."
echo "  UI:       https://argocd.cloudless.gr"
echo "  Admin pw: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
echo "Watch sync in the UI — child Apps will appear under postiz-platform AppOfApps."
