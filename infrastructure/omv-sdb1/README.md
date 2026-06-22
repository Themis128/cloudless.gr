# omv-sdb1 ops

Daily k8s CronJob `sdb1-readme-and-probe` running on omv-main that
does two jobs:

1. **README sync** — fetches `docs/google-to-omv-migration.md` from
   `main` and writes it to
   `/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/google-archive/README.md`
   so it's discoverable when the operator browses `\\omv\google-archive`
   from Windows.

2. **Capacity probe** — `df -BG` on the same mount; alerts to
   `/api/webhooks/admin-alert` (severity=medium) when free space
   drops below the NAS-headroom budget, severity=high when it
   drops below the hard floor.

## NAS-headroom budget (sdb1 = 916 GB Samsung 1TB)

| Slice | Target |
|---|---|
| Google-archive (Photos + Drive + Gmail) | ~150 GB |
| Working headroom for ad-hoc NAS drops | ~300 GB |
| **Alert threshold (free GB)** | **200 GB** |
| **Hard floor (manual intervention)** | **100 GB** |

If sdb1 drops below 200 GB free, the daily probe POSTs a medium-severity
alert. Below 100 GB, severity bumps to high (NAS unusable for ad-hoc
writes from the workstation).

When that fires, the fix is one of:

- Prune old Takeout snapshots in `google-archive/`
- Re-sync only the latest Google export rather than keeping all
- Move oldest content to cold storage (an external USB drive, S3
  Glacier via `aws s3 cp ... --storage-class GLACIER`)
- As a last resort, prune `Backups/WindowsImageBackup/` per
  `docs/google-to-omv-migration.md` Step 0

## Deploy

```bash
kubectl apply -f infrastructure/omv-sdb1/cronjob-share-readme-and-probe.yaml
```

Plus once (so the alert webhook authenticates):

```bash
kubectl -n omv-ops create secret generic admin-alert-token \
  --from-literal=ADMIN_ALERT_TOKEN=$(aws ssm get-parameter \
    --name /cloudless/production/ADMIN_ALERT_TOKEN \
    --with-decryption --query Parameter.Value --output text) \
  --dry-run=client -o yaml | kubectl apply -f -
```

If the Secret is absent the probe still runs and logs the alert
locally; only the POST fails (warning, not error).

## Verify

```bash
# Force one off-schedule run
kubectl -n omv-ops create job --from=cronjob/sdb1-readme-and-probe \
  manual-$(date +%s)

# Watch output
kubectl -n omv-ops logs -f -l job-name=manual-...

# Confirm README landed on the share
ls -lh /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/google-archive/README.md
```

## See also

- `docs/google-to-omv-migration.md` — the runbook this syncs
- Memory `project_pi_disk_layout` — full sdb1 / sda1 breakdown
- `infrastructure/backup/cronjob-*.yaml` — sibling CronJob pattern
