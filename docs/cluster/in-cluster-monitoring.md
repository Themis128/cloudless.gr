# In-cluster monitoring & the OMV remote-routine decommission

**TL;DR:** the cluster already runs 21 in-cluster CronJobs doing the same monitoring/auto-fix work that the failing remote Claude Code on the Web routines were trying to do via SSH. The remote routines could never succeed (cloud container has no SSH + no NAS host). This doc covers what runs inside the cluster, which remote routines to disable, and how to verify the replacements.

## What the cluster already covers

| Concern | In-cluster job | Cadence | Slack | Notes |
|---|---|---|---|---|
| Crash-loop + OOMKilled + admission warnings | `monitoring/cluster-alerts` | every 5 min | ✅ `C09AF5W3X16` | Was **suspended** 2026-05-29 → **un-suspended 2026-06-21** |
| Disk space on omv (sda1 k3s / sdb1 user-data / SD card root) | `monitoring/omv-disk-watchdog` | every 15 min | ✅ `C09AF5W3X16` | NEW 2026-06-21. WARN ≥80%, CRIT ≥90%. Detected sdb1 at 89% on first run. |
| `nas-backup` journalctl freshness | `monitoring/omv-backup-verify` | every 6 hours | ✅ `C09AF5W3X16` | NEW 2026-06-21. Alerts when no entry in last 25h or last entry contains error/fail |
| Traefik VIP + Pi-hole admin reachability | `maintenance/cluster-health-check` | every 15 min | ❌ console-only | Could be Slack-wired later; non-critical because cluster-alerts covers downstream symptoms |
| `etcd` periodic defrag | `monitoring/etcd-defrag` | Sundays 04:00 UTC | ❌ | Auto-snapshot first |
| Journal vacuum (sda1 / sdb1) | `maintenance/journal-vacuum-omv` + `omv-ha` | Sundays 03:00 + 03:15 UTC | ❌ | Releases ~10s of MB/week |
| ImagePullBackOff auto-fix (ECR cred refresh + pod delete) | `cloudless/auto-healer` | every 3 min | ❌ console-only | Auto-heals; no escalation needed |
| ECR credential refresh | `cloudless/ecr-cred-refresher` | every 8 hours | ❌ | Auto-healer fires it on-demand too |
| ReplicaSet GC | `maintenance/replicaset-gc` | daily 02:00 UTC | ❌ | Removes stale RS objects |
| Cluster overall health ping | `kube-system/health-monitor` | every 2 min | ❌ | Internal liveness signal |
| Postiz publish/error → Slack | `postiz/postiz-slack-notify` | every 5 min | ✅ | Channel `C09AF5W3X16` (same) |
| Image sync from ECR | `cloudless/image-sync` | every minute | ❌ | Hot-cache prep |
| Config sync (cloudless app) | `cloudless/config-sync` | every 5 min | ❌ | Hot-reload signal |
| ML pipelines (anomaly, churn, RFM, collab) | `analytics/ml-*` | weekly/daily | ❌ | Async training |
| s3 → DuckDB sync | `analytics/s3-to-duckdb-sync` | every 30 min | ❌ | Analytics pipeline |

That's **17 of 21 jobs** covering monitoring/auto-heal/escalation needs. The remaining 4 are ML/analytics pipelines that have their own surface.

## Remote routines to DISABLE

The following routines are running in a **separate Claude Code on the Web** environment (judging by the Slack thread `2026-06-20 03:04 → 2026-06-21 09:05`). They CANNOT succeed from a cloud container that has no SSH path to the NAS, and they post the same failure message every 4 hours. The in-cluster jobs above are doing the work that matters; the remote ones are dead weight.

**How to disable** (operator action — must be done in the *other* Claude environment, not in Cowork):

1. Open Claude Code on the Web at https://code.claude.com.
2. Switch to the environment / project where these routines are scheduled (the one that's been firing the Slack messages).
3. Run `/scheduled list` (or equivalent) to enumerate scheduled tasks.
4. Disable / delete these by description match:
   - **OMV NAS Remediation Routine** (the orchestrator, ~every 4h)
   - **NAS Backup Check** (the `omv-backup` subagent caller)
   - **OMV NAS Watchdog** (the weekly disk-space watchdog)
   - Anything else that references `omv-health`, `omv-docker`, `omv-backup` subagents or `NAS_HOST` / `OMV_HOST` env vars

5. Confirm by waiting through one cycle (longest is ~4h) without seeing the BLOCKED Slack messages.

If you don't know which Claude environment scheduled them, search `https://code.claude.com` for "OMV NAS Remediation" or "nas-backup routine" — the env that owns those routines will show them under Scheduled.

## Verify the in-cluster replacements work

From any machine with `kubectl` configured against the omv k3s cluster:

```bash
# 1. Force-run the disk watchdog (don't wait for the */15 schedule).
kubectl -n monitoring create job disk-watchdog-now --from=cronjob/omv-disk-watchdog
kubectl -n monitoring wait --for=condition=complete job/disk-watchdog-now --timeout=60s
kubectl -n monitoring logs job/disk-watchdog-now

# 2. Same for backup verify.
kubectl -n monitoring create job backup-verify-now --from=cronjob/omv-backup-verify
kubectl -n monitoring logs job/backup-verify-now

# 3. Confirm cluster-alerts is un-suspended.
kubectl -n monitoring get cronjob cluster-alerts -o jsonpath='{.spec.suspend}'
# Expected: false
```

Expected outcome on a healthy cluster: `omv-disk-watchdog` logs the df output, posts to Slack `C09AF5W3X16` IFF any monitored filesystem is over 80%, exits 0. `omv-backup-verify` exits 0 silently if it finds a recent journal entry, posts to Slack if it doesn't.

Both pods use `nsenter --target 1` to exec on the host's namespaces — the same pattern documented in `CLAUDE.md` for the cloudflared restart pod. They require `privileged: true` + `hostPID: true` + `nodeSelector: kubernetes.io/hostname: omv`.

## Files

- `infrastructure/monitoring/omv-watchdogs.yaml` — the source-of-truth manifest. Apply with `kubectl apply -f infrastructure/monitoring/omv-watchdogs.yaml -n monitoring`.
- `cluster-alerts-secret` (existing `monitoring` Secret) — shared `SLACK_BOT_TOKEN`. Re-used by all three Slack-posting CronJobs.

## When to revisit

- If sdb1 alerts become noisy (likely, since it's already at 89%): adjust `WARN_PCT` env var on `omv-disk-watchdog` and re-apply, OR address the disk pressure (per CLAUDE.md "omv-main Storage Layout" the SD card backup tree is the usual culprit).
- If `nas-backup` is renamed: update the `journalctl -t nas-backup` tag in `omv-backup-verify`.
- If you actually want SSH access from the remote Claude environment: configure SessionStart hook + `TAILSCALE_AUTH_KEY` + `OMV_SSH_KEY_CONTENTS` secrets per CLAUDE.md "Cloud Session Secrets" — same pattern Cowork uses.
