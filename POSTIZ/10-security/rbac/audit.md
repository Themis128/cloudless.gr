# RBAC audit

## What each ServiceAccount can do

| ServiceAccount | Namespace | Permissions | Justified? |
|---|---|---|---|
| `default` | postiz | none | yes (Postiz pod doesn't talk to k8s API) |
| `postiz` (chart-created) | postiz | none beyond `default` | yes |
| `postiz-pg` | postiz | namespace-scoped CRUD on its own pods (CNPG-managed) | yes |
| `cnpg-cloudnative-pg` | cnpg-system | **cluster-wide** read of PG-related CRs; CRUD inside watched namespaces | yes (operator) |
| `cert-manager` | cert-manager | **cluster-wide** read/write of certificates, challenges, secrets | yes (operator) |
| `minio-operator` | minio-operator | **cluster-wide** Tenant CRUD; cross-namespace Secret CRUD | yes (operator) |
| `argo-cd-application-controller` | argocd | **cluster-admin** | **inspect periodically** — needed for AppOfApps to manage all namespaces |
| `argo-cd-server` | argocd | namespace-scoped read of Applications | yes |
| `n8n` (chart) | n8n | none | yes |
| `kube-prometheus-stack-prometheus` | monitoring | cluster-wide read of pods/services/endpoints | yes (must discover all targets) |
| `kube-prometheus-stack-grafana` | monitoring | none (talks only to Prometheus/Loki via in-cluster service) | yes |
| `alloy` | monitoring | cluster-wide read of pods + node logs | yes (log collector) |
| `sealed-secrets-controller` | kube-system | cluster-wide write of Secrets | yes (purpose) — protect controller pod access |

## How to audit

```bash
# Every ClusterRoleBinding granting cluster-admin
kubectl get clusterrolebinding -o json \
  | jq -r '.items[]
      | select(.roleRef.name == "cluster-admin")
      | .subjects[]?
      | "\(.kind)/\(.namespace // "-")/\(.name)"'

# All RoleBindings + ClusterRoleBindings, grouped by SA
kubectl get rolebinding,clusterrolebinding -A -o json \
  | jq -r '.items[]
      | .subjects[]?
      | select(.kind == "ServiceAccount")
      | "\(.namespace)/\(.name)"' \
  | sort | uniq -c | sort -rn
```

## Tightening rules of thumb

- **App pods rarely need k8s API access.** If you see a Postiz/n8n pod authenticating to the API, treat it as a finding.
- **Watch for `automountServiceAccountToken: true`** on app pods that don't need it. Override in the chart values or with a kustomize patch:
  ```yaml
  serviceAccount:
    automountServiceAccountToken: false
  podAnnotations:
    eks.amazonaws.com/skip-containers: "*"   # if on EKS
  ```
- **ArgoCD's cluster-admin can be scoped down** via `repoServer.serviceAccount.create=true` + explicit RBAC per managed namespace. We use the broad scope here for simplicity; revisit if you ever expose this cluster to multiple teams.

## Mitigations for the highest-risk SAs

| SA | Mitigation |
|---|---|
| `argocd-application-controller` | NetworkPolicy already restricts egress to git + apiserver only. Auth to Web UI via SSO when you set it up (Dex disabled by default). |
| `sealed-secrets-controller` | Run the deployment with `replicas: 1`, restrict who can `exec` into kube-system. Periodically rotate the master key (`kubectl delete secret -l sealedsecrets.bitnami.com/sealed-secrets-key`, controller generates a new one; re-seal everything). |
| `cnpg-cloudnative-pg` | Operator only watches the `postiz` namespace — confirmed by `kubectl -n cnpg-system describe deploy cnpg-cloudnative-pg \| grep WATCH_NAMESPACES`. |
