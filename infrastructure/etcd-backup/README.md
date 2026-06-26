# etcd backup — k3s snapshot pipeline

Three files glued together so the `omv-backup-verify` watchdog
(`infrastructure/monitoring/omv-watchdogs.yaml`) always sees a fresh
etcd snapshot under
`/srv/dev-disk-by-uuid-fa6231ab-*/Backups/k3s-db/snapshots/`.

| File | Installed at | Purpose |
| ---- | ------------ | ------- |
| `config.yaml` | `/etc/rancher/k3s/config.yaml` (mode 0600, root:root) | Tells k3s to write a snapshot every hour into its data-dir. |
| `k3s-snapshot-mirror.sh` | `/usr/local/sbin/k3s-snapshot-mirror.sh` (mode 0755) | rsyncs the data-dir snapshots dir to the NAS backup mount. |
| `k3s-snapshot-mirror.service` | `/etc/systemd/system/k3s-snapshot-mirror.service` | systemd unit that runs the script as a one-shot. |
| `k3s-snapshot-mirror.timer` | `/etc/systemd/system/k3s-snapshot-mirror.timer` | systemd timer that fires the service every 30 min + 5 min after boot. |

## Why two stages?

1. k3s writes hourly snapshots to its own data-dir (fast, local SSD).
2. The mirror timer copies them every 30 min to the NAS mount on the
   1 TB Samsung SSD (sdb1), which is independent of the k3s data SSD
   (sda1). This protects against sda1 failure and is what the watchdog
   actually checks.

If the k3s config still contained the (formerly used) etcd-s3 directives
with live AWS keys, there would be a third stage to S3 too. The keys
are currently dead — see `docs/aws-credentials-rotation-runbook.md`
for the path back to S3 mirroring. Local + NAS protection is fine for
the meantime.

## Install on omv (operator runbook)

```bash
# 1. Ship the files to the Pi.
scp infrastructure/etcd-backup/k3s-snapshot-mirror.sh \
    infrastructure/etcd-backup/k3s-snapshot-mirror.service \
    infrastructure/etcd-backup/k3s-snapshot-mirror.timer \
    infrastructure/etcd-backup/config.yaml \
    tbaltzakis@omv:/tmp/

# 2. Install (idempotent, mode-correct, root-owned).
ssh tbaltzakis@omv '
  sudo install -m 0755 -o root -g root \
    /tmp/k3s-snapshot-mirror.sh /usr/local/sbin/k3s-snapshot-mirror.sh
  sudo install -m 0644 -o root -g root \
    /tmp/k3s-snapshot-mirror.service /etc/systemd/system/
  sudo install -m 0644 -o root -g root \
    /tmp/k3s-snapshot-mirror.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now k3s-snapshot-mirror.timer
  sudo cp /etc/rancher/k3s/config.yaml \
    /etc/rancher/k3s/config.yaml.bak.$(date +%Y%m%dT%H%M%S)
  sudo install -m 0600 -o root -g root \
    /tmp/config.yaml /etc/rancher/k3s/config.yaml
  sudo systemctl restart k3s
'

# 3. Verify (force snapshot + mirror, then list newest under backup mount).
ssh tbaltzakis@omv '
  TS=$(date +%s)
  sudo k3s etcd-snapshot save --name "verify-${TS}"
  sudo systemctl start k3s-snapshot-mirror.service
  sleep 3
  sudo find /srv/dev-disk-by-uuid-fa6231ab-*/Backups/k3s-db \
    -type f -printf "%T@ %TY-%Tm-%Td %TH:%TM %p\n" \
  | sort -nr | head -3
'
```

## Verifying the watchdog passes

The watchdog runs every 6h at `30 */6 * * *`. Force-trigger via
`kubectl -n monitoring create job omv-backup-verify-manual --from=cronjob/omv-backup-verify`.
Look for `backup healthy: newest snapshot 0h old` in pod logs.

## Schedule cadence summary

| What | Where | Cadence |
| ---- | ----- | ------- |
| k3s etcd snapshot save | `/var/lib/rancher/k3s/server/db/snapshots/` (-> `/srv/.../k3s/...`) | hourly (top of hour, UTC) |
| Mirror to NAS | `/srv/.../Backups/k3s-db/snapshots/` | every 30 min |
| omv-backup-verify watchdog | k8s CronJob in `monitoring` ns | every 6h |
| Weekly defrag pre-snapshot | same data-dir | Sundays 04:30 EEST |
| Full nas-backup rsync (covers wider scope) | `/usr/local/sbin/nas-backup` (host cron) | daily 02:00 |
