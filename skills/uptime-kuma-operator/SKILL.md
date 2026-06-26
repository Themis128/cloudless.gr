---
name: uptime-kuma-operator
description: Use when working with Uptime Kuma at kuma.cloudless.gr — adding/editing monitors, debugging missed heartbeats, wiring new alert sources, rotating push tokens, or any task mentioning "kuma", "push monitor", "heartbeat", "alert state", "monitor down", or the cluster-alerts-kuma Secret. Covers the API/UI split (metrics endpoint vs. socket.io-only monitor CRUD) so you don't waste time scripting against a non-existent REST surface.
---

# Uptime Kuma operator

Kuma is the single pane of glass for in-cluster alert state. Cluster CronJobs
dual-fire to Kuma (push monitor) AND Slack (direct fallback) so a Kuma outage
doesn't blind us. Slack is loud, Kuma is the deduplicated history + uptime %.

UI: https://kuma.cloudless.gr (admin = tbaltzakis@cloudless.gr / unified
self-hosted password, see project memory `project_unified_admin_creds`).

## Quick health check

```bash
KEY=$(aws ssm get-parameter --name /cloudless/production/KUMA_API_KEY \
        --with-decryption --query Parameter.Value --output text)
curl -sS -u ":$KEY" https://kuma.cloudless.gr/metrics | head -20
```

Returns Prometheus metrics for every monitor — proves the API key is valid and
the server is up. If `monitor_status{...}` returns `0` for a monitor you expect
to be `1`, that monitor is currently in DOWN state.

## Where the API can and can't go

- `/metrics` (Basic Auth, API key): **works** — Prometheus scrape format.
- `/api/push/<token>?status=up|down&msg=...`: **works** — heartbeat ingestion
  (no auth, token IS the auth).
- Monitor CRUD (create/edit/delete/toggle, notification channels, status
  pages, tags): **socket.io-only**. No REST. There are community projects
  like `MedAziz11/Uptime-Kuma-Web-API` that wrap the socket.io layer but
  we do NOT run one. Treat the UI as the source of truth for monitor config.
- Bulk import: paste an exported JSON via Settings → Backup → Import.

Do not waste time scripting monitor creation. Use the UI walkthrough below.

## Creating a push monitor (UI walkthrough)

We have 7 push monitors backing the cluster-alerts-kuma Secret. Recreate them
exactly as below; the script `scripts/populate-kuma-secrets.sh` expects the
tokens in this order.

Steps for each monitor:

1. Top-right → "+ Add New Monitor".
2. Monitor Type: **Push**.
3. Friendly Name: as in table below.
4. Heartbeat Interval: as in table.
5. Retries: **1** for cluster-health, **0** for backup monitors (one missed
   nightly backup is a real alert, not noise).
6. Heartbeat Retry Interval: leave default (60s).
7. Resend Notification if Down X times consecutively: as in table.
8. Notifications: check **Slack — cluster-alerts** (see "Wiring the Slack
   notification channel" below).
9. Save.
10. Click the monitor → copy the **Push URL** → the token is the last path
    segment (e.g. `abc123XYZ` from `.../api/push/abc123XYZ`).

| # | Friendly Name      | Heartbeat | Resend  | Source CronJob                              |
|---|--------------------|-----------|---------|---------------------------------------------|
| 1 | k3s-pod-health     | 60s       | 5 min   | omv-disk-watchdog (every 15min)             |
| 2 | etcd-snapshot-age  | 1h        | 6h      | omv-backup-verify (every 6h)                |
| 3 | cloudflared-drift  | 6h        | 0 (once)| cloudflared-drift-check (every 6h)          |
| 4 | backup-appflowy    | 24h       | 24h     | pvc-backup-appflowy (daily 03:30 UTC)       |
| 5 | backup-espocrm     | 24h       | 24h     | pvc-backup-espocrm (daily 03:30 UTC)        |
| 6 | backup-n8n         | 24h       | 24h     | pvc-backup-n8n (daily 03:30 UTC)            |
| 7 | backup-postiz      | 24h       | 24h     | pvc-backup-postiz (daily 03:30 UTC)         |

Note: monitor #1 is named "k3s-pod-health" for forward-compat but is
currently fed by the disk watchdog. When we add a true pod-health checker
we will reassign the push URL.

## Wiring the Slack notification channel

Once (not per-monitor):

1. Settings (cog icon, bottom-left) → Notifications → "Setup Notification".
2. Type: **Slack**.
3. Friendly Name: `cluster-alerts`.
4. Webhook URL: leave blank.
5. Slack Bot Token: paste the SAME token used by cluster-alerts-secret
   (`kubectl get secret cluster-alerts-secret -n monitoring -o jsonpath='{.data.SLACK_BOT_TOKEN}' | base64 -d`).
6. Channel name (without #) or Channel ID: `C09AF5W3X16`.
7. Username override: `kuma`.
8. Apply on all existing monitors: **yes**.
9. Save.

Now every Kuma DOWN/UP transition cross-posts to the same Slack channel as
the CronJob fallback — operators see TWO messages briefly when something
breaks, but only the Kuma one persists in monitor history.

## Populating cluster-alerts-kuma Secret

After all 7 monitors exist and you have all 7 push tokens:

```bash
bash scripts/populate-kuma-secrets.sh \
  <K3S_POD_HEALTH_TOKEN> \
  <ETCD_SNAPSHOT_AGE_TOKEN> \
  <CLOUDFLARED_DRIFT_TOKEN> \
  <BACKUP_APPFLOWY_TOKEN> \
  <BACKUP_ESPOCRM_TOKEN> \
  <BACKUP_N8N_TOKEN> \
  <BACKUP_POSTIZ_TOKEN>
```

The script writes the Secret to 5 namespaces (monitoring + appflowy + espocrm
+ n8n + postiz) and is idempotent — rerun on every token rotation.

Verify:

```bash
# Force a watchdog run + check Kuma UI shortly after.
kubectl create job --from=cronjob/omv-disk-watchdog test-kuma-$(date +%s) -n monitoring
kubectl logs -n monitoring -l job-name=test-kuma-... --tail=50
```

The corresponding monitor should flip to UP within ~30 seconds.

## Adding a new alert that bypasses Kuma

**Discouraged.** Kuma is the single pane of glass — bypassing it means the
alert has no history, no uptime %, no deduplication. Operators must check
N places instead of one.

Only acceptable for true emergencies:

- The new check runs in an environment where outbound HTTPS to
  kuma.cloudless.gr is blocked (rare — we have no such environment today).
- The check runs at a frequency Kuma cannot accept (sub-second heartbeats —
  also nothing in the cluster needs this).

For everything else: add a new push monitor in the UI, append its key to
`cluster-alerts-kuma-secret.yaml` (with sentinel + script update), and
dual-fire in the new CronJob.

## Sources of truth

- `infrastructure/monitoring/omv-watchdogs.yaml` — omv-disk-watchdog +
  omv-backup-verify (Kuma keys: `KUMA_PUSH_K3S_POD_HEALTH`,
  `KUMA_PUSH_ETCD_SNAPSHOT_AGE`).
- `infrastructure/monitoring/cloudflared-drift.yaml` — cloudflared-drift-check
  (`KUMA_PUSH_CLOUDFLARED_DRIFT`).
- `infrastructure/monitoring/cluster-alerts-kuma-secret.yaml` — Secret
  template (7-key sentinel).
- `infrastructure/backup/cronjob-{appflowy,espocrm,n8n,postiz}.yaml` — 4
  daily backup CronJobs (`KUMA_PUSH_BACKUP_*`).
- `scripts/populate-kuma-secrets.sh` — token loader.

If you add a new dual-fire CronJob, update this skill's table AND the
populate script in the same PR.