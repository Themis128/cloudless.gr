# k3s datastore backup — SQLite/kine (post-2026-07-22)

The omv single-node cluster runs **kine/SQLite**, not etcd
(`data/server/db/state.db` + `kine.sock` under
`/srv/dev-disk-by-uuid-fa6231ab-*/omv-ai-cluster/data`). The etcd-snapshot
pipeline in `infrastructure/etcd-backup/` is **dead config** — k3s ignores
`etcd-snapshot-*` keys on a SQLite datastore; no snapshots have been written
since 2026-07-22.

This directory holds the live replacement:

| File | Installed at | Purpose |
| ---- | ------------ | ------- |
| `k3s-state-backup.sh` | `/usr/local/sbin/k3s-state-backup.sh` | `sqlite3 .backup` of `state.db` + tar of `server/{cred,tls,manifests,token,agent-token,etc}` → `Backups/k3s-db/snapshots/`, 48-file retention |
| `k3s-state-backup.service` | `/etc/systemd/system/` | oneshot unit |
| `k3s-state-backup.timer` | `/etc/systemd/system/` | hourly + 5 min after boot |

The `omv-backup-verify` CronJob (`infrastructure/monitoring/omv-watchdogs.yaml`)
watches `Backups/k3s-db/` freshness (<2h SLO) and Slack-alerts on staleness —
it is datastore-agnostic (newest-file mtime), so it needs no change.

## Restore

1. Stop `k3s-k3s-omv.service`.
2. Replace `data/server/db/state.db` with the chosen `k3s-state-*.db` copy.
3. Restore `server/{cred,tls,manifests,token,agent-token,etc}` from the
   matching `k3s-server-config-*.tar.gz` if needed.
4. Start the service.

## Off-site (live 2026-10-15)

The script also `rclone copy`s each run to **Cloudflare R2**
`datalake-bucket/k3s-state/` (remote `r2` configured at
`/root/.config/rclone/rclone.conf` on omv — keys on host only, S3-compatible
endpoint `fb7dc7b69b662480cd5961a4d1913c78.r2.cloudflarestorage.com`).
`--max-age 2h` makes each hourly run upload only the files it just wrote.
