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
| `k3s-state-backup.sh` | `/usr/local/sbin/k3s-state-backup.sh` | `sqlite3 .backup` of `state.db` to a temp file → `PRAGMA integrity_check` → atomic rename (a partial file can never look fresh to the watchdog); `server/{cred,tls,manifests,token,agent-token,etc}` tar **encrypted AES-256-CBC** (key `/root/.k3s-backup-key`, root-only) before it touches disk — the plaintext tar never exists; `rclone copy` to `r2:datalake-bucket/k3s-state/` (`*.db` + `*.enc` only); 48-file retention |
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

### Off-site + encryption

- The config tar packages the cluster **TLS private keys** and the
  secrets-encryption keys — it is written to disk only as
  `k3s-server-config-*.tar.gz.enc` (openssl AES-256-CBC, PBKDF2, passphrase
  file `/root/.k3s-backup-key`, mode 0600, never committed or uploaded).
  Restore: `openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/root/.k3s-backup-key -in <file>.enc | tar -xzf -`.
- `state.db` uploads as-is — k3s secrets inside are already
  envelope-encrypted via `encryption-config.json`, which travels only in
  the encrypted tar.
- rclone remote `r2` is configured at `/root/.config/rclone/rclone.conf`;
  R2 credentials live in `.env` on the host — never commit them.

### Retired

- `k3s-snapshot-mirror.timer/.service` + `/usr/local/sbin/k3s-snapshot-mirror.*`
  were **deleted from the host** (2026-10-16) — it rsynced the dead etcd
  dir with `--delete` into the live backup destination. Do not restore it.
- etcd keys in `/etc/rancher/k3s/config.yaml` are commented out on the host
  (inert either way on SQLite). `secrets-encryption-config-file` stays —
  it is required and referenced by the running server.
