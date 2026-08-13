# PVC daily backup to Cloudflare R2 — R10

Closes the 8-SPOF gap from `docs/optimal-architecture-assessment.md`.
Each stateful self-hosted app's canonical state lands in
`r2://datalake-bucket/pvc-backups/<app>/<date>` daily via **rclone**
(S3-compatible API). **No AWS CLI / AWS S3.**

## What's backed up

| App | DB | Pod | Backup tool | Schedule (UTC) | R2 prefix |
|-----|-----|-----|-------------|----------------|-----------|
| AppFlowy | Postgres | `appflowy/postgres` | `pg_dump --format=custom` | 03:30 | `pvc-backups/appflowy/daily/` |
| EspoCRM | MariaDB | `espocrm/espocrm-mariadb` | `mariadb-dump` + gzip | 03:45 | `pvc-backups/espocrm/daily/` |
| Postiz | Postgres | `postiz/postiz-postgres` | `pg_dump --format=custom` | 04:00 | `pvc-backups/postiz/daily/` |
| n8n | SQLite | `n8n/n8n` (PVC `n8n-data`) | `sqlite3 .backup` + gzip | 04:15 | `pvc-backups/n8n/daily/` |
| AppFlowy MinIO | S3 blobs | `appflowy/minio` | `rclone sync` bucket `appflowy` | 04:30 | `pvc-backups/appflowy-minio/daily/` |
| Uptime Kuma | SQLite | PVC `uptime-kuma-data` | `sqlite3 .backup` + gzip | 04:45 | `pvc-backups/uptime-kuma/daily/` |

Schedules staggered 15 min apart.

**Still out of scope:** Mosquitto, ntfy, Meilisearch (rebuildable), Redis (ephemeral/AOF-local).

## Credentials (Cloudflare R2)

Account ID: `fb7dc7b69b662480cd5961a4d1913c78`  
Endpoint: `https://fb7dc7b69b662480cd5961a4d1913c78.r2.cloudflarestorage.com`  
Bucket: `datalake-bucket`

**Preferred (API):** dispatch `create-r2-credentials.yml` with `confirm=create`.
It mints a User API token with R2 Storage R/W and derives S3 keys as
`Access Key ID = token id`, `Secret = SHA-256(token value)` (Cloudflare R2 docs).

**Dashboard:** R2 → Manage API Tokens → Object Read & Write on `datalake-bucket`,
then `store-r2-backup-credentials.yml` or:

```bash
# From a machine with kubectl (no AWS CLI):
for ns in appflowy espocrm postiz n8n uptime-kuma; do
  kubectl -n "$ns" create secret generic pvc-backup-r2 \
    --from-literal=ACCESS_KEY_ID='…' \
    --from-literal=SECRET_ACCESS_KEY='…' \
    --dry-run=client -o yaml | kubectl apply -f -
done

kubectl -n appflowy create secret generic appflowy-walg-r2 \
  --from-literal=AWS_ACCESS_KEY_ID='…' \
  --from-literal=AWS_SECRET_ACCESS_KEY='…' \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f infrastructure/appflowy/walg-sidecar.yaml
```

## Deploy CronJobs

```bash
for f in cronjob-appflowy.yaml cronjob-espocrm.yaml cronjob-postiz.yaml cronjob-n8n.yaml cronjob-appflowy-minio.yaml cronjob-uptime-kuma.yaml; do
  kubectl apply -f infrastructure/backup/$f
done
kubectl get cronjob -A | grep pvc-backup
```

## Manual test

Each CronJob lives in the **same namespace as its target pods**. Use the helper
so `-n` always matches (avoids `No resources found in <wrong-ns>`):

```bash
pnpm db:backup:test list
pnpm db:backup:test appflowy   # -n appflowy
pnpm db:backup:test minio      # -n appflowy  (MinIO pods)
pnpm db:backup:test kuma       # -n uptime-kuma
pnpm db:backup:test n8n        # -n n8n
# equivalent: bash scripts/pvc-backup-test.sh <target>
```

| Target | Namespace | CronJob |
|--------|-----------|---------|
| `appflowy` | `appflowy` | `pvc-backup-appflowy` |
| `minio` | `appflowy` | `pvc-backup-appflowy-minio` |
| `espocrm` | `espocrm` | `pvc-backup-espocrm` |
| `postiz` | `postiz` | `pvc-backup-postiz` |
| `n8n` | `n8n` | `pvc-backup-n8n` |
| `kuma` | `uptime-kuma` | `pvc-backup-uptime-kuma` |

Expect a success line and exit 0. Empty MinIO is OK (writes `.backup-ok.txt` marker).

### Find backup pods (correct NS)

```bash
# All pvc-backup CronJobs
kubectl get cronjob -A -l app.kubernetes.io/name=pvc-backup

# Running/finished backup pods in a namespace (labels propagate from CronJob)
kubectl -n appflowy get pods -l app.kubernetes.io/name=pvc-backup
kubectl -n uptime-kuma get pods -l app.kubernetes.io/name=pvc-backup

# Or by Job name after pvc-backup-test.sh prints it
kubectl -n appflowy get pods -l job-name=test-minio-…
```

## DevOps conventions

| Practice | How we apply it |
|----------|-----------------|
| Co-locate CronJob with workload | Same NS as target pods/PVC/Secrets (Service DNS stays in-cluster) |
| Stable labels | `app.kubernetes.io/name=pvc-backup` + `backup.cloudless.gr/target=…` on CronJob, Job, Pod |
| Job cleanup | `ttlSecondsAfterFinished: 86400` on CronJob Jobs; test helper patches 3600s |
| Concurrency | `Forbid` + `startingDeadlineSeconds: 600` |
| Image hygiene | MinIO job uses `rclone/rclone` (no `apk` each run); Kuma needs sqlite → alpine |
| Secrets | `pvc-backup-r2` per NS; never in git; mint via `store-r2-backup-credentials.yml` |
| Failure signal | Non-zero exit + size/object guards; Kuma already monitors the original four CronJobs |

## Grafana persistence (related)

`infrastructure/monitoring/kube-prom-stack-values.yaml` enables a 2Gi `local-path` PVC for Grafana. Apply with your usual Helm upgrade of kube-prometheus-stack (does not auto-apply from this backup folder).

## Legacy

Previous design used AWS S3 + `apk add aws-cli` + `pvc-backup-aws`. Those
secrets/CronJob variants are superseded. S3 lifecycle JSON under
`lifecycle-policy.json` applies only if you still keep objects in AWS S3;
R2 object lifecycle is configured in the Cloudflare dashboard.
