#!/usr/bin/env bash
# Security hardening: NetworkPolicies + PodSecurity + Sealed Secrets.
# Run AFTER the rest of the stack is installed (so the namespaces exist
# and the workloads are running — the policies will then constrain them
# rather than block their boot).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Helm repos"
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets >/dev/null || true
helm repo update

echo "==> 1/4 Sealed Secrets controller"
helm upgrade --install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system \
  -f "$ROOT/10-security/sealed-secrets/values.yaml"
kubectl -n kube-system rollout status deploy/sealed-secrets-controller --timeout=180s

cat <<'EOF'

    ──────────────────────────────────────────────────────────────────
    IMPORTANT: back up the controller's master key NOW.
    Without it, every SealedSecret in git becomes unrecoverable on disaster.

      kubectl -n kube-system get secret \
        -l sealedsecrets.bitnami.com/sealed-secrets-key \
        -o yaml > sealed-secrets-master-key.yaml

    Store sealed-secrets-master-key.yaml in 1Password / Bitwarden / Vault.
    ──────────────────────────────────────────────────────────────────
EOF

echo "==> 2/4 PodSecurity admission labels on namespaces"
kubectl apply -f "$ROOT/10-security/pod-security/namespace-labels.yaml"

echo "==> 3/4 NetworkPolicies"
# Default-deny FIRST, then allow rules. Order matters because an existing pod's
# traffic gets cut the moment the default-deny lands.
kubectl apply -f "$ROOT/10-security/networkpolicies/00-default-deny.yaml"
for f in "$ROOT"/10-security/networkpolicies/*.yaml; do
  [[ "$(basename "$f")" == "00-default-deny.yaml" ]] && continue
  kubectl apply -f "$f"
done

echo "==> 4/4 Seal existing secret files (if any present)"
if command -v kubeseal >/dev/null; then
  chmod +x "$ROOT/10-security/sealed-secrets/seal-all-secrets.sh"
  "$ROOT/10-security/sealed-secrets/seal-all-secrets.sh" || true
else
  echo "    skipped — install kubeseal then run 10-security/sealed-secrets/seal-all-secrets.sh"
  echo "    https://github.com/bitnami-labs/sealed-secrets/releases"
fi

echo
echo "DONE. Verification (see 10-security/README.md for full list):"
echo "  kubectl -n n8n run probe --image=curlimages/curl --restart=Never --rm -it -- \\"
echo "    curl --max-time 3 http://postiz-pg-rw.postiz:5432   # → blocked (timeout)"
echo "  kubectl -n postiz run rooty --image=busybox --restart=Never -- sleep 1"
echo "    # → error: PodSecurity \"restricted\" violation"
