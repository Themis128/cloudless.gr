# PVC daily backup to S3 — R10

Closes the 8-SPOF gap from `docs/optimal-architecture-assessment.md`.
Each stateful self-hosted app's canonical state lands in
`s3://cloudless-analytics-data/pvc-backups/<app>/<date>` daily, with
7-daily standard → GLACIER → expire 30d retention via S3 lifecycle.

## What's backed up

| App | DB | Pod | DB name | Backup tool | Schedule (UTC) | S3 prefix |
|-----|-----|-----|---------|-------------|----------------|-----------|
| AppFlowy | Postgres | `appflowy/postgres` | `postgres` | `pg_dump --format=custom` | 03:30 | `pvc-backups/appflowy/daily/` |
| EspoCRM | MariaDB | `espocrm/espocrm-mariadb` | `espocrm` | `mariadb-dump --single-transaction` (alpine + mariadb-client) | 03:45 | `pvc-backups/espocrm/daily/` |
| Postiz | Postgres | `postiz/postiz-postgres` | `postiz` | `pg_dump --format=custom` | 04:00 | `pvc-backups/postiz/daily/` |
| n8n | SQLite | `n8n/n8n` (PVC `n8n-data`) | `database.sqlite` | `sqlite3 .backup` + gzip | 04:15 | `pvc-backups/n8n/daily/` |

Schedules staggered 15 min apart so S3 PUT bursts don't pile up.

**Not yet covered (separate PRs, lower priority):**
- AppFlowy MinIO blobs (file attachments) — `mc mirror` based, **R10b**
- Uptime Kuma SQLite history (re-creatable from monitor config) — **R10c**
- Grafana plugins + dashboards — dashboards live in git, plugins re-installable
- Mosquitto retained messages — transient state, OK to lose
- ntfy auth.db + topics — re-creatable from `ntfy user add` runbook

## IAM + Secrets

- **IAM user `cloudless-pi-standby`** now has the `PvcBackupsWrite` statement
  on `arn:aws:s3:::cloudless-analytics-data/pvc-backups/*` (added to inline
  policy `AthenaReadAccess` during this PR).
- Each backup namespace has a `pvc-backup-aws` Secret with `AWS_ACCESS_KEY_ID`
  + `AWS_SECRET_ACCESS_KEY` from that IAM user.
- DB creds: each CronJob reads the SAME secret the app pod uses (e.g. AppFlowy
  `appflowy-secrets.POSTGRES_PASSWORD`, EspoCRM `espocrm-secrets.mariadb-root-password`,
  Postiz `postiz-secrets.POSTGRES_PASSWORD`). Credential rotations propagate
  without separate config.

## S3 lifecycle

Applied via:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket cloudless-analytics-data \
  --region us-east-1 \
  --lifecycle-configuration file://infrastructure/backup/lifecycle-policy.json
```

Rules:
- `pvc-backups/**` (default) — 7 days standard → transition to GLACIER → expire after 30 days
- `pvc-backups/weekly/**` — 28 days standard → transition to GLACIER → expire after 90 days

Standard storage at ~$0.023/GB/mo + GLACIER at ~$0.004/GB/mo for a typical
~50-100 MB daily delta keeps the bill well under $1/month.

## Deploy

All 4 CronJobs are already live in the cluster (applied during PR #1094).
To re-apply or update:

```bash
for f in cronjob-appflowy.yaml cronjob-espocrm.yaml cronjob-postiz.yaml cronjob-n8n.yaml; do
  kubectl apply -f infrastructure/backup/$f
done
```

Verify:

```bash
kubectl get cronjob -A | grep pvc-backup
```

## Manual run (testing or first-time verification)

```bash
kubectl -n espocrm create job --from=cronjob/pvc-backup-espocrm test-$(date +%s)
kubectl -n espocrm get pods -l job-name=test-... -w
aws s3 ls s3://cloudless-analytics-data/pvc-backups/espocrm/daily/ --recursive
```

Verified during PR #1094: `pvc-backup-espocrm-r10-v2` dumped 32,945 bytes to
`pvc-backups/espocrm/daily/2026-06-21T201124Z.sql.gz`.

## Restore

### Postgres (AppFlowy / Postiz)

```bash
aws s3 cp s3://cloudless-analytics-data/pvc-backups/<app>/daily/<date>.sql.custom /tmp/
kubectl -n <ns> cp /tmp/<date>.sql.custom <pod>:/tmp/
kubectl -n <ns> exec <pod> -- \
  pg_restore --clean --if-exists --no-owner -U postgres -d <db> /tmp/<date>.sql.custom
kubectl -n <ns> rollout restart deploy/<app>
```

### MariaDB (EspoCRM)

```bash
aws s3 cp s3://cloudless-analytics-data/pvc-backups/espocrm/daily/<date>.sql.gz /tmp/
gunzip /tmp/<date>.sql.gz
kubectl -n espocrm cp /tmp/<date>.sql espocrm-mariadb:/tmp/
kubectl -n espocrm exec espocrm-mariadb -- \
  mariadb --user=root --password="$MARIADB_ROOT_PASSWORD" espocrm < /tmp/<date>.sql
kubectl -n espocrm rollout restart deploy/espocrm
```

### SQLite (n8n)

```bash
aws s3 cp s3://cloudless-analytics-data/pvc-backups/n8n/daily/<date>.sqlite.gz /tmp/
gunzip /tmp/<date>.sqlite.gz
kubectl -n n8n scale deploy/n8n --replicas=0
kubectl -n n8n cp /tmp/<date>.sqlite n8n-data-restore-pod:/n8n-data/database.sqlite
kubectl -n n8n scale deploy/n8n --replicas=1
```

(SQLite restore requires the app to be stopped; the alpine `restore-pod`
pattern is documented in `skills/cluster-bash/SKILL.md`.)

## Failure handling

CronJob exits non-zero if dump is suspiciously small (<10KB), triggering
k8s job retry up to `backoffLimit: 2`. After 2 retries the job marks
failed and Alertmanager's existing `kube-state-metrics` job-failure rule
fires → routes to Slack `#alerts` channel + `notifyAdmin()` via the R8 path.

(No new alert rules added in R10 — existing kube-state-metrics coverage
already handles `kube_job_status_failed > 0`.)

## See also

- `docs/master-todo-list.md` — R10 row (struck through; R11 in-progress next)
- `docs/optimal-architecture-assessment.md` — the "8 SPOF" finding R10 closes
- `skills/espocrm-operator/SKILL.md` — EspoCRM-specific notes
- `skills/appflowy-operator/SKILL.md` — AppFlowy postgres + MinIO
- `skills/cluster-bash/SKILL.md` — SFTP read/write to host paths
