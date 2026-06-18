# Postiz on K3s — cloudless.gr

Production-grade self-hosted Postiz, wired to:

| Layer | Tech | Why |
|---|---|---|
| App | [postiz-helmchart](https://github.com/gitroomhq/postiz-helmchart) (OCI) | Official chart |
| Postgres | [CloudNativePG](https://cloudnative-pg.io) | Backups, PITR, ops-friendly |
| Redis | [Bitnami Redis](https://artifacthub.io/packages/helm/bitnami/redis) | BullMQ queue backend |
| Object storage | [MinIO Operator](https://min.io/docs/minio/kubernetes/upstream/) | In-cluster S3 (`postiz-uploads` bucket) |
| TLS | [cert-manager](https://cert-manager.io) + Let's Encrypt | DNS-01 via Cloudflare |
| Ingress | Traefik (K3s built-in) | No extra controller |

## Repo layout
```
00-namespace.yaml                          # postiz + minio-operator namespaces
01-cert-manager/
  cloudflare-api-token-secret.yaml.example # Cloudflare API token for DNS-01
  clusterissuer.yaml                       # Let's Encrypt issuers (prod + staging)
02-cnpg/
  cluster.yaml                             # Postgres cluster definition
  postiz-db-secret.yaml.example            # App + superuser passwords
  README.md
03-redis/
  values.yaml                              # Bitnami Redis chart values
04-minio/
  tenant.yaml                              # MinIO tenant + app user
  README.md
05-postiz/
  values.yaml                              # Helm values (external PG/Redis/MinIO, no secrets)
  secrets-overrides.yaml.example           # Helm values overlay with all secret env vars
  ingress.yaml                             # Traefik Ingress + cert-manager annotation
install.sh                                 # Idempotent installer
```

## Quick start

1. **Prereqs.** K3s up, `kubectl` + `helm` on your machine, Cloudflare account with `cloudless.gr` zone.
2. **Cloudflare DNS record.** Create an `A` record `postiz.cloudless.gr` → your cluster's public IP (proxied off for DNS-01 to work cleanly, or use any IP — DNS-01 doesn't need ingress reachable).
3. **Cloudflare API token.** [Create one](https://developers.cloudflare.com/api/tokens/create/) with `Zone:Read` + `DNS:Edit` for `cloudless.gr`.
4. **Fill secrets** (rename `.yaml.example` → `.yaml`, replace `REPLACE_*`):
   - `01-cert-manager/cloudflare-api-token-secret.yaml`
   - `02-cnpg/postiz-db-secret.yaml` — strong passwords (`openssl rand -base64 32`)
   - `04-minio/tenant.yaml` — replace the two `REPLACE_*` strings (root password + app secret key)
   - `05-postiz/secrets-overrides.yaml` — `JWT_SECRET`, paste the same PG password into `DATABASE_URL`, MinIO app secret into `CLOUDFLARE_SECRET_ACCESS_KEY`. Leave `REDIS_URL` as placeholder for now.
5. **Run.**
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
6. **Patch in the Redis password** (Bitnami auto-generates one on first install), then re-run `./install.sh`:
   ```bash
   PW=$(kubectl -n postiz get secret postiz-redis -o jsonpath='{.data.redis-password}' | base64 -d)
   sed -i "s|REPLACE_WITH_REDIS_PASSWORD|${PW}|" 05-postiz/secrets-overrides.yaml
   ./install.sh   # idempotent — re-run picks up the new value
   ```
7. **Watch cert issuance.** Should be Ready in 1–2 minutes:
   ```bash
   kubectl -n postiz describe certificate postiz-tls
   ```
8. **Open** https://postiz.cloudless.gr and create the first user.

## Notes & gotchas

- **`STORAGE_PROVIDER: cloudflare` for MinIO?** Yes. Postiz only ships two providers (`local` / `cloudflare`); the cloudflare path is just an S3 client, so we point `CLOUDFLARE_BUCKET_URL` at MinIO. The `CLOUDFLARE_ACCOUNT_ID` value is unused but the env var must be non-empty.
- **No Temporal.** The current `postiz-helmchart` doesn't deploy Temporal even though the latest docker-compose includes it. If you hit features that require it, deploy [temporalio/helm-charts](https://github.com/temporalio/helm-charts) into the same namespace and set `TEMPORAL_ADDRESS` in `postiz-secrets`.
- **Single-node K3s.** Replica counts are 1, CNPG `instances: 1`. Bump to 3 on a multi-node cluster.
- **Secrets injection** uses the chart's native `secrets:` block, fed by `secrets-overrides.yaml` (gitignored). Don't put secrets in `values.yaml`.
- **Pin the image tag.** `latest` is convenient but not reproducible. After first install, pin `image.tag` to the running release.

## Automation layer (optional second stage)

Installs the MCP / agent / n8n integration on top of the core stack. See `06-automation/README.md`.

```bash
# After install.sh and after creating a Postiz API key in the UI:
cp 06-automation/postiz-agent/secret.yaml.example 06-automation/postiz-agent/secret.yaml
$EDITOR 06-automation/postiz-agent/secret.yaml
chmod +x install-automation.sh
./install-automation.sh
```

What you get:
- **MCP at `/mcp`** on the existing Postiz Ingress (built into Postiz — no extra deployment).
- **postiz-agent CronJob** (`06-automation/postiz-agent/cronjob.yaml`) — daily CLI tasks via the official `postiz` npm package.
- **n8n at `n8n.cloudless.gr`** with the `n8n-nodes-postiz` community node ready to install via the UI.

## Backups layer (third stage)

Sends CNPG + MinIO backups off-cluster to Cloudflare R2. See `07-backups/README.md` and the **mandatory** `07-backups/verify-restore.md`.

```bash
# After creating two R2 buckets + an R2 API token:
cp 07-backups/cnpg/r2-creds.yaml.example   07-backups/cnpg/r2-creds.yaml
cp 07-backups/minio/r2-creds.yaml.example  07-backups/minio/r2-creds.yaml
$EDITOR 07-backups/cnpg/r2-creds.yaml
$EDITOR 07-backups/minio/r2-creds.yaml
sed -i "s/<ACCOUNT_ID>/<your-cloudflare-account-id>/" 07-backups/cnpg/cluster-patch.yaml
chmod +x install-backups.sh
./install-backups.sh
```

## GitOps layer (fourth stage)

Makes this folder the source of truth via ArgoCD. See `08-gitops/README.md`.

```bash
# After pushing this folder to a git repo:
REPO=https://github.com/<you>/cloudless.gr
grep -rl REPLACE_WITH_REPO_URL 08-gitops/ | xargs sed -i "s|REPLACE_WITH_REPO_URL|$REPO|g"
chmod +x install-gitops.sh
./install-gitops.sh
```

## Observability layer (fifth stage)

Metrics + logs + dashboards + alerts. See `09-observability/README.md`.

```bash
chmod +x install-observability.sh
./install-observability.sh
```

Lands on:
- `grafana.cloudless.gr` — dashboards (Postiz, CNPG, Redis, MinIO, ArgoCD, n8n) under the **Postiz Platform** folder
- `alertmanager.cloudless.gr` — fires `PrometheusRule` alerts for app/PG/Redis/MinIO/cert/disk failures

## Security hardening (sixth stage)

Adds NetworkPolicies (default-deny + targeted allows), PodSecurity admission, Sealed Secrets (so secrets can live in git), and an RBAC audit. See `10-security/README.md`.

```bash
chmod +x install-security.sh
./install-security.sh
# Then install kubeseal locally and back up the master key — README says how.
```

## Workflow recipes (using the stack)

Ready-to-import n8n workflows + CronJobs that actually USE everything you just built. See `11-workflows/README.md`. Highlights:

- **RSS → Claude → multi-platform post** (n8n) — automated content pipeline
- **Google Drive → IG/TikTok** (n8n) — image/video flow
- **Weekly analytics digest → Slack** (n8n) — leadership report
- **Daily brand-voice review** (CronJob) — Claude flags off-brand drafts
- **PVC folder watcher → IG drafts** (CronJob) — K8s-native alternative to the Drive flow

## DR drills + CI (eighth piece)

Proves the backups actually restore + guards every PR. See `12-dr-and-ci/README.md`.

```bash
# DR drill — runs automatically every quarter; one-time install:
kubectl apply -f 12-dr-and-ci/dr-drill/rbac.yaml
kubectl apply -f 12-dr-and-ci/dr-drill/cronjob.yaml

# CI — GitHub Actions in .github/workflows/ trigger on every PR
# Local pre-commit:
pip install pre-commit && pre-commit install
```

What runs:
- **Quarterly:** restore drill spins up `postiz-pg-restore-test` from R2, asserts row counts, tears down, alerts to Slack on failure.
- **Every PR:** yamllint, shellcheck, detect-secrets, kubeconform against all manifests + CRDs, `helm template` + re-validate for chart values changes.

## You're done (for real this time).

Eight pieces: 6 infrastructure layers + workflow recipes + DR/CI. The stack is built, deployed, automated, observed, secured, recipe-equipped, and verified. Nothing material is missing.
