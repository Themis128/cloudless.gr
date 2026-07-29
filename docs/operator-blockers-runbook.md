# Operator Blockers Runbook

Track A from the remaining-checklist plan. Each item is operator-only
(UI / external dashboard / out-of-band). Capture proof in the checklist
status section after completion.

## 1. Cloudflare API token rotation — SKIPPED (2026-07-29)

Operator deferred rotation this pass. Do **not** mint or overwrite
`CLOUDFLARE_API_TOKEN` unless a later instruction reopens this item.

When resumed, follow `skills/cloudflare-token-doctor/SKILL.md` and
`store-cloudflare-token.yml` / `verify-cloudflare-token.yml`.

## 2. Sentry webhook secret

**Closes:** R8 inbound issue events → `/api/webhooks/sentry`.

1. Sentry → Settings → Developer Settings → New Internal Integration.
2. Webhook URL: `https://cloudless.gr/api/webhooks/sentry`
3. Subscribe to **issue** events.
4. Copy Client Secret → dispatch:

```bash
gh workflow run store-sentry-webhook-secret.yml \
  -f sentry_webhook_secret='…' \
  -f update_cluster_secret=true
```

(Pi runs with `SSM_DISABLED=1`, so the workflow also merge-patches
`cloudless/cloudless-secrets` and restarts `cloudless-app`.)

**Proof to log:** workflow run ID + SSM parameter version + a test issue event reaching Slack/ntfy.

## 3. Kuma status page + ntfy — DONE (2026-07-29)

Bootstrapped in-cluster via `scripts/kuma-bootstrap.cjs`:

- Admin already present; DB = sqlite (`UPTIME_KUMA_DB_TYPE=sqlite`)
- Status page slug: **`cloudless`**
- **12** HTTP monitors (public + self-hosted + cluster)
- Notification: ntfy → `https://ntfy.cloudless.gr` topic `cloudless-alerts`
- App ConfigMap: `KUMA_BASE_URL=http://uptime-kuma.uptime-kuma.svc.cluster.local:3001`,
  `KUMA_STATUS_PAGE_SLUG=cloudless` (public `kuma.cloudless.gr` is CF-challenged from pods)

Optional leftover: add Slack Incoming Webhook in Kuma UI (or re-run bootstrap with
`KUMA_SLACK_WEBHOOK=…`) — no webhook URL was present in cluster secrets.

**Proof:** in-cluster `GET /api/status-page/cloudless` → 200, `monitors=12`.

## 4. ESP32 Notion page — PARTIAL reconstruct (2026-07-29)

Page history restore is still UI-only when retention exists (incident 2026-06-02;
Plus history is ~30 days — may be gone by 2026-07-29).

API reconstruct applied:

```bash
# from cloudless-app pod (has NOTION_API_KEY)
node scripts/notion-restore-esp32.mjs
```

Page: https://www.notion.so/ESP32-ESPHome-Watchdog-Pi-Cluster-Monitor-v2-3677d82c410a81e4a6dbe9ae89578fda

Devices + Telemetry DBs remain empty (never populated). If history still shows a
pre-15:19 UTC 2026-06-02 revision, restore that for full prose.

Skill: `.claude/skills/esp32-notion-restore/SKILL.md`.

**Proof to log:** reconstruct timestamp above + optional history restore timestamp.

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
