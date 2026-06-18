# ArgoCD — this folder as the source of truth

After this layer is installed, every change to the manifests in this folder gets reconciled into the cluster automatically. No more `helm upgrade` / `kubectl apply` cycles.

## Architecture

```
                    GitHub (this folder)
                          │
                          ▼
                ┌──────────────────┐
                │     ArgoCD       │  watches the repo
                └──────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
  postiz-helm-apps   postiz-raw-apps   n8n-helm-app
  (Helm sources)   (directory source)   (Helm source)
        │                 │                 │
        ▼                 ▼                 ▼
   chart releases   Cluster CRs,       n8n release
   (postiz, redis,  Tenants, Ingress,
   minio-operator,  CronJobs,
   cnpg, …)         ScheduledBackup
```

One root **AppOfApps** Application installs every child Application. Sync waves keep ordering correct (operators install before their CRs).

## Repo prerequisite

ArgoCD needs to be able to read this folder from a Git URL.

1. Push this folder to a Git repo (GitHub / GitLab / Gitea — anything). The repo can be public or private (instructions for both below).
2. Update `apps/_repo-config.yaml` and every `apps/*.yaml` with your repo URL. Search-and-replace `REPLACE_WITH_REPO_URL` once.

```bash
REPO=https://github.com/baltzakis/cloudless.gr   # or wherever you push it
grep -rl REPLACE_WITH_REPO_URL 08-gitops/ \
  | xargs sed -i "s|REPLACE_WITH_REPO_URL|${REPO}|g"
```

## Install

```bash
chmod +x install-gitops.sh
./install-gitops.sh
```

After ~2 minutes, open https://argocd.cloudless.gr. Initial admin password:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
```

You'll see the **postiz-platform** AppOfApps with every child Application syncing.

## Private repo

If your repo is private, add an SSH deploy key or a PAT after install:
```bash
kubectl apply -f 08-gitops/argocd/repo-creds.yaml          # filled from .example
```

## Drift detection

Every Application is set to `syncPolicy.automated.prune=true` and `selfHeal=true`. Any manual `kubectl edit` will be reverted within ~3 minutes. If you need to test something out-of-band, disable auto-sync on that Application first.

## Files

```
08-gitops/
├── argocd/
│   ├── values.yaml                  # argo-cd helm chart values
│   ├── ingress.yaml                 # argocd.cloudless.gr
│   └── repo-creds.yaml.example      # private-repo credentials (optional)
└── apps/
    ├── _project.yaml                # AppProject `postiz-platform`
    ├── _app-of-apps.yaml            # Root Application that installs the rest
    ├── cert-manager.yaml
    ├── cnpg-operator.yaml
    ├── minio-operator.yaml
    ├── postiz-pg-cluster.yaml       # directory source -> 02-cnpg
    ├── postiz-redis.yaml            # helm source -> 03-redis/values.yaml
    ├── postiz-minio-tenant.yaml     # directory source -> 04-minio
    ├── postiz.yaml                  # helm source -> 05-postiz/values.yaml
    ├── postiz-ingress.yaml          # directory source -> 05-postiz/ingress.yaml
    ├── postiz-automation.yaml       # directory source -> 06-automation/postiz-agent
    ├── postiz-backups.yaml          # directory source -> 07-backups
    └── n8n.yaml                     # helm source -> 06-automation/n8n/values.yaml
```
