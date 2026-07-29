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

Schedules staggered 15 min apart.

**Not yet covered (lower priority):** AppFlowy MinIO blobs (R10b), Kuma SQLite (R10c), Grafana plugins, Mosquitto, ntfy.

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
for ns in appflowy espocrm postiz n8n; do
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
for f in cronjob-appflowy.yaml cronjob-espocrm.yaml cronjob-postiz.yaml cronjob-n8n.yaml; do
  kubectl apply -f infrastructure/backup/$f
done
kubectl get cronjob -A | grep pvc-backup
```

## Manual test

```bash
kubectl -n appflowy create job --from=cronjob/pvc-backup-appflowy test-r2-$(date +%s)
kubectl -n appflowy logs -f job/test-r2-…
# Expect: remote size … bytes and exit 0
```

## Legacy

Previous design used AWS S3 + `apk add aws-cli` + `pvc-backup-aws`. Those
secrets/CronJob variants are superseded. S3 lifecycle JSON under
`lifecycle-policy.json` applies only if you still keep objects in AWS S3;
R2 object lifecycle is configured in the Cloudflare dashboard.
