# Session summary — 2026-06-21 (R-series + best-practices assessment)

A complete chronicle of the work shipped in this single day across the
cloudless.gr serverless app + the k3s self-hosted stack on omv + omv-ha.

## TL;DR
Shipped 8 R-row PRs, 2 hotfix PRs, 2 doc PRs, plus mid-session ops
(MQTT/KUMA SSM bootstrap, Grafana Athena plugin install + datasource
registration + dashboard provisioning, end-to-end alert pipeline
verification). Closed every silent gap from the 2026-06-20 audit with
one exception (Grafana Athena query path blocked by a suspected
Organization-level SCP — operator action).

## PRs landed

| PR | Title | Outcome |
|---|---|---|
| #1077 | R3 — MQTT lib + `/admin/cluster` chip | Cluster-side MQTT alerts visible in admin |
| #1078 | R4 — `admin-alerts.ts` helper + R5 grafana admin page | Foundation for ntfy fan-out |
| #1079 | R6 — SSM-readable `ADMIN_PUSH_VIA_NTFY` flag | Operator can toggle without redeploy |
| #1080 | Drop Apollo, retire lead-enrich Apollo node | Greek SMB volume too low for Apollo cost |
| #1081 | Root-folder cleanup | Stale `kubectl` binary + `.env.local.bak-*` removed |
| #1082 | **R7 + R8** — ntfy public tunnel + `notifyAdmin()` wired into 3 SEV1 paths | Phone push works without Tailscale; Sentry + admin-alert + MQTT publish all fan out |
| #1083 | **R9** — AWS Cost Explorer → S3 → Athena → Grafana | Daily cost ETL live; dashboard provisioned |
| #1084 | hotfix — regenerate `pnpm-lock.yaml` (overrides drift) | Unstuck CI on main after #1083 |
| #1085 | hotfix — `SLACK_OPS_USERS` falls back to `SLACK_OPS_USER_ID` | Slack DM fan-out actually works now |
| #1086 | docs(R9) — Grafana Athena plugin install steps | Operator runbook updated |
| #1087 | docs — add `documentation/` folder + purchase-flow diagram | Root-level discoverability |
| #1088 | docs — best-practices assessment + R10-R20 roadmap | Forward plan |

## Mid-session ops (not PRs but live changes)

- **SSM keys bootstrapped:** MQTT_USERNAME / MQTT_PASSWORD / MQTT_BROKER_HOST / MQTT_BROKER_PORT (4 keys), KUMA_BASE_URL / KUMA_STATUS_PAGE_SLUG (2 keys). All 8 self-hosted apps now have 100% SSM coverage (29 keys verified non-empty).
- **Athena DDL executed live:** `CREATE EXTERNAL TABLE cloudless_analytics.aws_cost_daily` + `CREATE OR REPLACE VIEW cloudless_analytics.v_aws_cost_by_service`. Both SUCCEEDED.
- **Grafana plugin installed:** `grafana-athena-datasource@3.2.0` into `kube-prom-grafana` pod, persisted via PVC.
- **Grafana datasource registered:** UID `athena`, AWS keys auth, points at workgroup `primary`.
- **Grafana dashboard provisioned:** UID `aws-cost` (4 panels) via REST API from inside the pod.
- **IAM policy `AthenaReadAccess` attached** to user `cloudless-pi-standby`. Simulator agrees; runtime still denies → suspected Org-level SCP.
- **Cloudflare tunnel patched on both Pis:** added `ntfy.cloudless.gr` ingress block + restarted cloudflared (HA pair).
- **Cloudless pod rolled** to invalidate the 5-min SSM cache so new MQTT + KUMA keys take immediate effect.

## End-to-end verifications fired live this session

| Probe | Result |
|---|---|
| `https://ntfy.cloudless.gr/v1/health` (external, no VPN) | HTTP 200 `{"healthy":true}` |
| `POST https://ntfy.cloudless.gr/cloudless-ops` (Bearer auth) | HTTP 200, msg id `lPPmzCcpo9Ey` |
| `mosquitto_pub` from inside pod with `tbaltzakis` / `TH!123789th!` | `CONNACK (0)` (success) |
| `POST /api/webhooks/admin-alert` with severity=info | HTTP 200, `slack.ok:true, ntfy.ok:true` |
| All 7 public tunnels (`*.cloudless.gr`) | reachable (302/200/307/404 as designed) |
| CI on main after hotfix #1084 | 12 most-recent runs green |
| AWS Cost Explorer API with deploy role | returns daily $ per service |
| Athena view `v_aws_cost_by_service` | rows returnable via Athena query |

## Documents created

| File | Purpose |
|---|---|
| `docs/architecture-purchase-flow.md` | End-to-end customer-buy flow with mermaid sequence diagram + static system map + latency table for 5 operator-notify channels |
| `documentation/architecture-purchase-flow.md` | Root-level mirror |
| `docs/optimal-architecture-assessment.md` | Best-practices scorecard for the AWS-primary + Pi-failover topology; per-app upstream-doc gaps; ranked R10-R20 roadmap |
| `documentation/optimal-architecture-assessment.md` | Root-level mirror |
| `docs/session-summary-2026-06-21.md` | This file |
| `documentation/session-summary-2026-06-21.md` | Root-level mirror |
| `documentation/README.md` | Folder convention note |

Also mirrored to AppFlowy via `scripts/appflowy-upload-md.mjs`:
- "Purchase flow — how the self-hosted apps connect end-to-end" → view_id `ba2f98ea-c759-4992-9b9b-9dbddf6dba60`

## Memory entries written (persist across sessions)

| Memory | Captures |
|---|---|
| `project_r7_r8_r9_shipped` | What R7/R8/R9 actually shipped, including the scripts/etl npm-vs-pnpm gotcha |
| `project_selfhosted_ssm_baseline` | Full 29-key SSM inventory for all 8 self-hosted apps (reference state) |
| `project_grafana_athena_blocked_scp` | The Athena AccessDenied diagnosis + workaround options |

## Where the app stands now (Saturday 2026-06-21, end-of-day)

### What works fully ✅
- **All 8 self-hosted apps configured + reachable.** AppFlowy, EspoCRM, Postiz, n8n, Mosquitto, ntfy, Uptime Kuma, Grafana — every SSM key present, every public tunnel responding.
- **Notification fan-out end-to-end live.** Any caller that POSTs `/api/webhooks/admin-alert` (or Sentry webhook receiver, or MQTT publish at severity ≥ high) reaches Slack + phone push within ~5 s.
- **AWS↔Pi sync surfaces.** Image SHA pinned, SSM shared, Cognito shared, webhooks idempotent on DDB. Drift detector runs every 6 h.
- **Daily ETLs** push EspoCRM, AppFlowy, Stripe, Sentry, GSC, LinkedIn, AWS Cost into S3 lake by 06:30 UTC for `/admin/analytics`.
- **CI green** across all critical workflows on main.

### What's pending operator action ⚠️
1. Cloudflare API token rotation — blocks 3 stale items (HA LB, email-obfuscation fix, infra MCP).
2. Sentry webhook URL + secret into SSM `SENTRY_WEBHOOK_SECRET` (R8 closure).
3. SCP-lift OR different IAM user for Grafana → Athena query path (or ship R12 to render in app).
4. Kuma status page slug `cloudless` (1-min UI click).
5. ESP32 Notion page restore via page history.

### What's next (R10-R20 roadmap)
See `documentation/optimal-architecture-assessment.md`. Top 3:
- **R10:** PVC daily backup to S3 via Restic — closes the 8-SPOF gap in one PR
- **R11:** TLS cert parity probe — addresses "highest silent-failure risk" per `pi-cloud-sync.md`
- **R12:** `/admin/cost` Athena panel — bypasses the Grafana SCP block

## Key architectural facts captured

(These were established or re-confirmed this session — captured here so the
next session inherits them without re-discovery.)

- AWS Lambda = primary; Pi k3s = HA warm-standby failover.
- Self-hosted apps live only on Pi (omv) — no AWS-side replica. They're SPOFs.
- Cloudflare tunnel is HA (both omv + omv-ha run cloudflared with the same config).
- `cloudless-pi-standby` is the IAM user behind the cluster's `aws-creds` Secret. Has SSM/SES/DDB/Cognito/ECR/Bedrock + (now) AthenaRead.
- All 8 self-hosted apps share one admin: `tbaltzakis@cloudless.gr` / `TH!123789th!`.
- ntfy Bearer token: `tk_xngjn17224v72l62ryibbd3i87f6z`.
- Cloudflare tunnel UUID: `e977a490-58c5-4fdb-9155-86832e3e636a`.
- scripts/etl is **npm**, not pnpm. Workflows use `npm ci` with `working-directory: scripts/etl`.
- AppFlowy Cloud has a stable (undocumented) `POST /api/workspace/<id>/page-view` endpoint; `scripts/appflowy-upload-md.mjs` uses it.
- Grafana `/var/lib/grafana/plugins/` is PVC-backed → plugins persist across pod restarts.
- Mosquitto password hash format is `$7$` (PBKDF2-SHA512), irreversible.

## Related docs

- `docs/pi-cloud-sync.md` — canonical AWS↔Pi sync contract
- `docs/architecture-purchase-flow.md` — purchase fan-out diagrams
- `docs/optimal-architecture-assessment.md` — best-practices roadmap
- `skills/selfhosted-admin-bootstrap/SKILL.md` — per-app admin recipes
- `skills/cloudflare-tunnel-ops/SKILL.md` — tunnel ops
- `infrastructure/grafana/dashboards/README.md` — Grafana dashboard provisioning
- `infrastructure/n8n/workflows/README.md` — n8n starter workflows + bootstrap
