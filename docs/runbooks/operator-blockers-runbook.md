# Operator Blockers Runbook

Track A from the remaining-checklist plan. Each item is operator-only
(UI / external dashboard / out-of-band). Capture proof in the checklist
status section after completion.

## 1. Cloudflare API token rotation — SKIPPED (2026-07-29)

Operator deferred rotation this pass. Do **not** mint or overwrite
`CLOUDFLARE_API_TOKEN` unless a later instruction reopens this item.

When resumed, follow `skills/cloudflare-token-doctor/SKILL.md` and
`store-cloudflare-token.yml` / `verify-cloudflare-token.yml`.

## 2. Sentry webhook secret — DONE (2026-07-29)

**Closes:** R8 inbound issue events → `/api/webhooks/sentry` → `notifyAdmin()`.

Stored SSM `/cloudless/production/SENTRY_WEBHOOK_SECRET` version **1** via
workflow run `30468613018`. Pi `cloudless-secrets` patched locally (CI
kubectl TLS against stale Tailscale kubeconfig failed).

**Pi fan-out (verified 2026-07-29):**

| Key | Where | Value / note |
|-----|--------|--------------|
| `SENTRY_WEBHOOK_SECRET` | SSM + `cloudless-secrets` | integration Client Secret |
| `SLACK_OPS_USERS` | `cloudless-secrets` (env wins over SSM) | Slack member ID(s), comma-separated |
| `ADMIN_PUSH_VIA_NTFY` | ConfigMap + secret | `1` |
| `NTFY_BASE_URL` | **Pi secret** must be in-cluster | `http://ntfy.ntfy.svc.cluster.local` — `https://ntfy.cloudless.gr` returns Cloudflare 403 to the pod |
| `NTFY_TOPIC` | secret | `cloudless-ops` |

Do **not** put the cluster DNS URL into SSM for Lambda; Lambda should keep the
public tunnel + `NTFY_TOKEN`. Hostpath ConfigMap mirror:
`k8s/cloudless-app-hostpath.yaml` (`NTFY_BASE_URL` + `ADMIN_PUSH_VIA_NTFY`).
Secret keys still override ConfigMap when both define the same name.

Smoke (from app pod):

```bash
# signed POST → expect slack.ok + ntfy.ok
# (HMAC with SENTRY_WEBHOOK_SECRET over body; header sentry-hook-signature)
```

Re-store / rotate later:

```bash
gh workflow run store-sentry-webhook-secret.yml \
  -f sentry_webhook_secret='…' \
  -f update_cluster_secret=true
```

(If cluster patch fails in CI, patch `cloudless/cloudless-secrets` from a
host with a working kubeconfig, then `rollout restart deploy/cloudless-app`.)

## 3. Kuma status page + ntfy + Slack — DONE (2026-07-29)

Bootstrapped in-cluster via `scripts/kuma-bootstrap.cjs`:

- Status page slug: **`cloudless`**, **12** HTTP monitors
- Notification: ntfy → `https://ntfy.cloudless.gr` topic `cloudless-alerts`
- Slack: Incoming Webhook was revoked (2026-05-25). **Live path (cut over 2026-07-29):**
  - `POST http://cloudless-app.cloudless.svc.cluster.local/api/webhooks/kuma`
  - Auth: Bearer `ADMIN_ALERT_SECRET` → `src/app/api/webhooks/kuma/route.ts` → `SlackClient`
  - Kuma notification row updated in SQLite; `kuma-slack-bridge` Deployment scaled to **0** (manifest kept for rollback)
  - Re-register script default: `scripts/kuma-slack-bridge.cjs` → app webhook URL

```bash
# Optional re-register from uptime-kuma pod
KUMA_BRIDGE_URL=http://cloudless-app.cloudless.svc.cluster.local/api/webhooks/kuma \
KUMA_BRIDGE_TOKEN="$ADMIN_ALERT_SECRET" KUMA_PASS='…' \
  node scripts/kuma-slack-bridge.cjs
```

## 4. ESP32 Notion page — PARTIAL (history expired)

Re-checked 2026-07-29: page has reconstructed skeleton (16 blocks). Notion API
does not expose page history; Plus retention (~30 days) for the 2026-06-02
incident is past. Treat reconstruct as baseline; seed Devices/Telemetry when
hardware is online.

## 5. Grafana Athena SCP — DEFERRED

**Decision (2026-07-29):** formally defer lifting the Athena SCP deny.

Rationale: R12 shipped `/admin/cost` which queries Athena from the app
and renders natively in admin. Lifting the org SCP is optional polish
for Grafana datasources, not required for cost visibility.

**Proof to log:** this deferral note + R12 evidence (`src/lib/cost-analytics.ts`, `/admin/cost`).

## Cadence reminders (no deadline, recurring)

| Cadence | Action |
|---------|--------|
| Annual | Rotate `APPFLOWY_PASSWORD`, `ESPOCRM_API_KEY`, `POSTIZ_API_KEY`, `GRAFANA_API_TOKEN`, `NTFY_TOKEN` |
| After every n8n UI edit | Commit `infrastructure/n8n/workflows/*.json` |
| Monthly | Open an `ops-cadence` issue; ratchet Vitest coverage thresholds if coverage grew |
| Quarterly | Re-read `docs/optimal-architecture-assessment.md` + `docs/best-practices-audit-2026.md` |

Use GitHub issue template **Ops cadence checklist**.
