# Current Source of Truth Checklist

Last reconciled: 2026-07-29.

This is the single execution checklist for roadmap work. Canonical detail and
history remain in `docs/master-todo-list.md`.

Status labels used below:

- `DONE` = implemented in repo
- `PARTIAL` = scaffold/pilot present, production completion still required
- `BLOCKED-OPERATOR` = requires external/operator action
- `DEFERRED` = consciously postponed with rationale
- `OPEN` = not yet implemented
- `SKIPPED` = consciously skipped (operator decision)

## Operator-only blockers

Runbook: [`docs/operator-blockers-runbook.md`](operator-blockers-runbook.md).

- [x] `SKIPPED` Rotate Cloudflare API token and store in SSM.
  Decision 2026-07-29: operator deferred rotation; do not mint/store a new token in this pass.
  Proof: left untouched per explicit instruction.
- [x] `DONE` Wire Sentry webhook secret (`SENTRY_WEBHOOK_SECRET`) to SSM (+ Pi secret).
  Workflow: `.github/workflows/store-sentry-webhook-secret.yml` run `30468613018` → SSM version **1**.
  Cluster patch failed in CI (stale kubeconfig TLS); completed locally 2026-07-29:
  `cloudless-secrets` key present (len 64) + `cloudless-app` rollout OK.
  Ops fan-out live 2026-07-29: `SLACK_OPS_USERS=U09AF5VU7LY`, `ADMIN_PUSH_VIA_NTFY=1`,
  Pi `NTFY_BASE_URL=http://ntfy.ntfy.svc.cluster.local` (public tunnel hits CF challenge).
  Proof: signed POST → `{ ok: true, result: { slack: { ok: true }, ntfy: { ok: true } } }`;
  Slack DM + ntfy topic `cloudless-ops` both received.
- [x] `DONE` Create Kuma status page and wire monitor alerts to ntfy (+ Slack bridge).
  Proof 2026-07-29: slug `cloudless`, 12 monitors, ntfy notification id=1; in-cluster
  `GET http://uptime-kuma…/api/status-page/cloudless` → 200; app ConfigMap
  `KUMA_BASE_URL` + `KUMA_STATUS_PAGE_SLUG=cloudless`. Slack fan-out via
  `kuma-slack-bridge` Deployment (`infrastructure/uptime-kuma/k8s/kuma-slack-bridge.yaml`).
  App route `POST /api/webhooks/kuma` is mounted on Pi hostpath after 2026-07-29
  standalone rebuild (unauth → **401**, not 404). Incoming Webhook URL not required.
- [x] `PARTIAL` Restore ESP32 Notion page (API reconstruct; history UI expired).
  Proof 2026-07-29: `scripts/notion-restore-esp32.mjs` rebuilt 16 blocks on page
  `3677d82c-410a-81e4-a6db-e9ae89578fda` (Devices/Telemetry DBs still empty).
  Re-check 2026-07-29T14:50Z: page live, 16 blocks, `last_edited` = reconstruct
  time; Notion public API still has **no page-history** — Plus ~30d retention
  for 2026-06-02 incident is past; reconstruct is the durable baseline.
- [x] `DEFERRED` Grafana Athena SCP lift.
  Decision 2026-07-29: skip SCP change; R12 `/admin/cost` already renders Athena natively.
  Proof: `src/lib/cost-analytics.ts`, `/admin/cost`, runbook §5.

## Claude-shippable roadmap items

- [x] `DONE` R25 self-hosted admin auto-login bridge.
  Evidence: `src/lib/selfhosted-autologin.ts`, `src/app/api/admin/autologin/route.ts`, `src/app/[locale]/admin/selfhosted/page.tsx`, `src/app/[locale]/admin/cluster/page.tsx`.

- [x] `DONE` R21a self-host Meilisearch on `omv-ha` (manifests/tunnel assets in repo).
  Evidence: `infrastructure/meilisearch/k8s.yaml`, `k8s/search/meilisearch.yaml`, `infrastructure/search/cloudflare-tunnel.yaml`, `infrastructure/search/README.md`.
- [x] `DONE` R21b `/api/search` with Bedrock embeddings.
  Evidence: `src/app/api/search/route.ts`, `src/lib/product-search.ts`, `src/lib/search-index.ts`, `src/lib/meilisearch.ts`.
- [x] `DONE` R21c product recommendations.
  Evidence: `src/lib/product-recommendations.ts`, `src/app/api/recommendations/route.ts`, `src/components/store/RecommendationGrid.tsx`.
- [x] `DONE` R21d GenAI-assisted product description flow.
  Evidence: `src/app/api/admin/ai/product-descriptions/route.ts`, `scripts/generate-product-descriptions.ts`.

- [x] `DONE` R15 Cloudflare Access hardening artifacts.
  Evidence: `infrastructure/cloudflare-access/access-apps.tf`, `infrastructure/cloudflare-access/applications.yaml`, `infrastructure/cloudflare-access/README.md`, `src/lib/cloudflare-access.ts`.
- [x] `DONE` R19 monthly failover drill workflow.
  Evidence: `.github/workflows/failover-drill.yml` (monthly schedule + manual dispatch probes for primary/secondary health).

- [x] `DONE` R16 AppFlowy WAL-G continuous backup to S3.
  Evidence: WAL-G sidecar + archive_command wired in `infrastructure/appflowy/k8s/appflowy.yaml`; Secret/ConfigMap/CronJob in `infrastructure/appflowy/walg-sidecar.yaml`. Operator still must create `appflowy-walg-aws` from SSM before apply.
- [x] `DONE` R23 Resend pilot for order confirmations.
  Evidence: `src/lib/email-resend.ts` plus pilot switch/fallback in `src/lib/email.ts` (`sendOrderConfirmation` prefers Resend when configured, falls back to SES).
- [x] `DONE` R24 AWS secondary-region DR path.
  Evidence: `infrastructure/r24-dr/{main,route53,dynamodb}.tf`, `infrastructure/r24-dr/README.md`, `.github/workflows/r24-add-replicas.yml`.
- [x] `DONE` R20 Postgres logical replication subscriber to AWS.
  Evidence: `infrastructure/r20-replication/{README.md,subscriber.ts,wal2json-config.yaml}`, `.github/workflows/r20-replication-subscriber.yml`.

## LinkedIn CAPI finalization

- [x] `DONE` Verify/wire `li_fat_id` capture path in code flow.
  Evidence: thanks-page client now forwards `li_fat_id` in `src/app/[locale]/campaigns/[slug]/thanks/ThanksConversion.tsx`; route + runtime pass it through in `src/app/api/campaigns/conversion/route.ts` and `src/lib/ad-analytics/runtime.ts`.
- [x] `DONE` Provision CAPI conversion ID in config path.
  Evidence: `src/data/campaigns.ts` has `capiConversionId` for the LinkedIn campaign.
- [x] `DONE` Wire shared `eventId` dedup between browser + CAPI.
  Evidence: `src/app/[locale]/campaigns/[slug]/thanks/ThanksConversion.tsx`, `src/app/api/campaigns/conversion/route.ts`, `src/lib/ad-analytics/runtime.ts`.

## Ongoing operations cadence

Issue template: `.github/ISSUE_TEMPLATE/ops-cadence.yml`.

- [x] `DONE` Annual secret/token rotation tracked via ops-cadence issue template.
- [x] `DONE` n8n workflow JSON sync discipline tracked via ops-cadence issue template.
- [x] `DONE` Monthly coverage threshold ratchet review tracked via ops-cadence issue template.
- [x] `DONE` Quarterly architecture / best-practices audit refresh tracked via ops-cadence issue template.

## Already done baseline

- [x] R10, R11, R12, R13 (descoped), R14, R18, R22.

## Platform direction (operator decision 2026-07-29)

- **Migrate off AWS → Cloudflare.** Prefer Workers / R2 / D1 / Access / Tunnel over expanding SSM, S3, Lambda, Athena, Cognito, etc.
- **Do not install AWS CLI or AWS SDK** for agent/operator work on this repo; use Cloudflare tooling and existing in-repo paths instead.
- AWS-backed roadmap items still labeled `DONE` in-repo (R16 WAL-G→S3, R20→AWS, R24 secondary region) are **legacy designs** — next work should replace them with Cloudflare equivalents rather than provisioning AWS secrets/CLI.

## Notes

- `docs/master-todo-list.md` remains the detailed ledger (rationale, history, phase context).
- Operator: CF rotation skipped; Sentry secret + Slack/ntfy fan-out verified; Kuma done; ESP32 partial reconstruct done.
- This file is intentionally concise and execution-focused to avoid roadmap drift.
