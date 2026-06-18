#!/usr/bin/env bash
# Walks every secret file in this repo and produces a `*.sealed.yaml` counterpart
# next to it. The sealed files are safe to commit; the originals stay gitignored.
#
# Requires: kubectl, kubeseal (https://github.com/bitnami-labs/sealed-secrets/releases),
# and the sealed-secrets controller already running in kube-system.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Every secret file that the rest of the stack expects. Add to this list when
# you introduce new secret-bearing manifests.
SECRETS=(
  "$ROOT/01-cert-manager/cloudflare-api-token-secret.yaml"
  "$ROOT/02-cnpg/postiz-db-secret.yaml"
  "$ROOT/07-backups/cnpg/r2-creds.yaml"
  "$ROOT/07-backups/minio/r2-creds.yaml"
  "$ROOT/06-automation/postiz-agent/secret.yaml"
  "$ROOT/08-gitops/argocd/repo-creds.yaml"
  # Notes:
  #  - 04-minio/tenant.yaml contains inline Secrets — seal those by hand
  #    (or split them out to their own file and add here).
  #  - 05-postiz/secrets-overrides.yaml is a Helm values file, NOT a K8s Secret.
  #    Use a different approach (sops + helm-secrets) for that one.
)

if ! command -v kubeseal >/dev/null; then
  echo "ERROR: kubeseal binary not found. Install from https://github.com/bitnami-labs/sealed-secrets/releases" >&2
  exit 1
fi

if ! kubectl -n kube-system get deploy sealed-secrets-controller >/dev/null 2>&1; then
  echo "ERROR: sealed-secrets controller not installed. Run install-security.sh first." >&2
  exit 1
fi

for SRC in "${SECRETS[@]}"; do
  if [[ ! -f "$SRC" ]]; then
    echo "skip: $SRC (not present — fine if you don't use this layer)"
    continue
  fi
  DST="${SRC%.yaml}.sealed.yaml"
  echo "==> sealing $SRC -> $DST"
  kubeseal --format yaml --controller-namespace kube-system \
           --controller-name sealed-secrets-controller \
           < "$SRC" > "$DST"
done

echo
echo "DONE. Commit the .sealed.yaml files. The originals stay gitignored."
echo "When ArgoCD syncs the .sealed.yaml, the controller automatically"
echo "produces a plain Secret with the same name in the same namespace."
