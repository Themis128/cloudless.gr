# etcd backup — k3s snapshot pipeline (local NAS + Cloudflare R2 Free)

Three files glued together so the `omv-backup-verify` watchdog
(`infrastructure/monitoring/omv-watchdogs.yaml`) always sees a fresh
etcd snapshot under
`/srv/dev-disk-by-uuid-fa6231ab-*/Backups/k3s-db/snapshots/`.

| File | Installed at | Purpose |
| ---- | ------------ | ------- |
| `config.yaml` | `/etc/rancher/k3s/config.yaml` (mode 0600, root:root) | Hourly local snapshots + R2 off-site mirror. |
| `k3s-snapshot-mirror.sh` | `/usr/local/sbin/k3s-snapshot-mirror.sh` (mode 0755) | rsyncs snapshots to the NAS backup mount. |
| `k3s-snapshot-mirror.service` | `/etc/systemd/system/k3s-snapshot-mirror.service` | systemd one-shot for the mirror script. |
| `k3s-snapshot-mirror.timer` | `/etc/systemd/system/k3s-snapshot-mirror.timer` | every 30 min + 5 min after boot. |

## Stages

1. k3s writes hourly snapshots to its data-dir (local SSD).
2. Mirror timer copies them every 30 min to the NAS mount (sdb1).
3. k3s `etcd-s3` also pushes to **Cloudflare R2** `datalake-bucket/etcd/` (Free).

Do **not** point etcd-s3 at AWS. Do **not** store R2 keys in git or SSM.

## Apply on omv (operator)

```bash
# 1. Put R2 API token on the host (same CF_R2_* as other backups).
#    k3s reads etcd-s3-access-key / etcd-s3-secret-key from config overlay
#    or environment — never commit them. Example (root-only file):
#    /etc/rancher/k3s/etcd-s3-creds.env
#      ETCD_S3_ACCESS_KEY=...
#      ETCD_S3_SECRET_KEY=...
#    Wire into k3s.service EnvironmentFile= if not already.

# 2. Ship + install config (keys stay on host).
scp infrastructure/etcd-backup/config.yaml tbaltzakis@omv:/tmp/
ssh tbaltzakis@omv '
  sudo cp /etc/rancher/k3s/config.yaml \
    /etc/rancher/k3s/config.yaml.bak.$(date +%Y%m%dT%H%M%S)
  sudo install -m 0600 -o root -g root \
    /tmp/config.yaml /etc/rancher/k3s/config.yaml
  # Ensure access/secret keys are set for etcd-s3 (host-only), then:
  sudo systemctl restart k3s
'

# 3. Verify local + R2.
ssh tbaltzakis@omv '
  TS=$(date +%s)
  sudo k3s etcd-snapshot save --name "verify-${TS}"
  sudo systemctl start k3s-snapshot-mirror.service
  sleep 3
  sudo find /srv/dev-disk-by-uuid-fa6231ab-*/Backups/k3s-db \
    -type f -printf "%T@ %TY-%Tm-%Td %TH:%TM %p\n" \
  | sort -nr | head -3
'
# List R2 etcd/ with wrangler or rclone using CF_R2_* (from a trusted machine).
```

## Schedule

| What | Where | Cadence |
| ---- | ----- | ------- |
| k3s etcd snapshot | local data-dir | hourly |
| Mirror to NAS | Backups/k3s-db | every 30 min |
| R2 off-site | `datalake-bucket/etcd/` | with each snapshot |
| omv-backup-verify | monitoring ns | every 6h |
