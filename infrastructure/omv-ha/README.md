# omv-ha host scripts

Tracked-in-git copies of the system-level scripts running on the
`omv-ha` **mail host**, so they're versioned + auditable instead of
"installed once and forgotten."

**Role (as of 2026-08-08):** omv-ha is a **dedicated mail host** — Pi 4,
1GB, SSH-reachable over Tailscale (`omv-ha`, 100.95.117.84). It was
drained + removed from k3s that day and is no longer a cluster node.
See `CLAUDE.md` "Cluster Topology" note.

## `setup-mail-server.sh`

One-shot idempotent installer for the self-hosted mail stack (postfix
relay via Resend + dovecot IMAP/LMTP). Reads `RESEND_API_KEY` and
`MAIL_TBALTZAKIS_PASSWORD` from the environment; never hard-codes secrets.
See `docs/MAIL-SERVER-SETUP.md` for the full architecture.

```bash
ssh tbaltzakis@omv-ha  # over Tailscale
sudo RESEND_API_KEY=re_… MAIL_TBALTZAKIS_PASSWORD=… \
  bash /path/to/setup-mail-server.sh
```

## `cloudless-cleanup.sh`

Daily disk-cleanup script triggered by
`/etc/systemd/system/cloudless-cleanup.timer` at 03:45 EEST.

**The systemd unit + timer are NOT in this repo** — they were created
on the host in 2026-06-16 (see CLAUDE.md "Pi Housekeeping"). Only the
shell script body lives here so the cleanup logic can be diff'd +
PR-reviewed like any other code.

### Install / refresh on the node

This is the one-shot operator command (or use a privileged k8s pod
to do it from CI without SSH — pattern below):

```bash
ssh tbaltzakis@omv-ha
sudo curl -fsSL \
  https://raw.githubusercontent.com/Themis128/cloudless.gr/main/infrastructure/omv-ha/cloudless-cleanup.sh \
  -o /usr/local/sbin/cloudless-cleanup.sh
sudo chmod +x /usr/local/sbin/cloudless-cleanup.sh
sudo systemctl daemon-reload
# Force one off-schedule run for verification:
sudo systemctl start cloudless-cleanup.service
sudo tail -30 /var/log/cloudless-cleanup.log
```

The old "install via k8s privileged pod (no SSH needed)" pattern **no longer
works** — omv-ha is no longer a k3s node. Use the SSH command above or the
Tailscale-based cluster ops path.

### Recent fixes

| Date | Fix |
|---|---|
| 2026-06-22 | crictl race: wait up to 30s for `/run/k3s/containerd/containerd.sock` before invoking `k3s crictl rmi`; pass `--runtime-endpoint` explicitly. Previously the bare invocation would fail with "connection refused" if cron beat k3s-agent's socket-bind; cleanup still "completed" because individual steps soft-fail, but the containerd image prune was silently a no-op. |

## See also

- CLAUDE.md "Pi Housekeeping" — the full overview
- `infrastructure/omv-sdb1/` — the sdb1 capacity probe (sibling daily CronJob)
- `infrastructure/omv/` — equivalent host scripts for `omv-main` (if/when extracted)
