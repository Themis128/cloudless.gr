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
- [x] `DONE` Create Kuma status page and wire monitor alerts to ntfy (+ Slack).
      Proof 2026-07-29: slug `cloudless`, 12 monitors, ntfy notification id=1; in-cluster
      `GET http://uptime-kuma…/api/status-page/cloudless` → 200; app ConfigMap
      `KUMA_BASE_URL` + `KUMA_STATUS_PAGE_SLUG=cloudless`. Slack cut over 2026-07-29 to
      `POST /api/webhooks/kuma` on `cloudless-app` (Bearer `ADMIN_ALERT_SECRET`);
      `kuma-slack-bridge` scaled to 0 (rollback manifest retained).
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

- [x] `DONE` AppFlowy CMS dual-run (Notion → AppFlowy primary on Pi).
      Evidence 2026-07-29: `src/lib/appflowy.ts` + dual-run readers; migrate/backfill scripts;
      `CMS_PARITY_REQUIRE_APPFLOWY=1` → **6/6 appflowy** on LAN `:30300` and
      `https://cloudless-proxy.fly.dev` (parity probe uses `Accept-Encoding: identity`).
      Prod pod: `APPFLOWY_API_URL=http://nginx.appflowy.svc.cluster.local`.

- [x] `DONE` R25 self-hosted admin auto-login bridge.
      Evidence: `src/lib/selfhosted-autologin.ts`, `src/app/api/admin/autologin/route.ts`, `src/app/[locale]/admin/selfhosted/page.tsx`, `src/app/[locale]/admin/cluster/page.tsx`.

- [x] `DONE` R21a self-host Meilisearch on `omv-ha` (manifests/tunnel assets in repo).
      Evidence: `infrastructure/meilisearch/k8s.yaml`, `k8s/search/meilisearch.yaml`, `infrastructure/search/cloudflare-tunnel.yaml`, `infrastructure/search/README.md`.
- [x] `DONE` R21b `/api/search` with Bedrock embeddings + store UI wire-up.
      Evidence: `src/app/api/search/route.ts`, `src/lib/product-search.ts`, `src/lib/search-index.ts`,
      `src/lib/meilisearch.ts`, `src/components/store/StoreGrid.tsx` (debounced `/api/search`, local fallback).
- [x] `DONE` R21c product recommendations.
      Evidence: `src/lib/product-recommendations.ts`, `src/app/api/recommendations/route.ts`, `src/components/store/RecommendationGrid.tsx`.
- [x] `DONE` R21d GenAI product descriptions + admin approve UI.
      Evidence: `src/app/api/admin/ai/product-descriptions/route.ts`,
      `scripts/generate-product-descriptions.ts`,
      `src/app/[locale]/admin/product-descriptions/page.tsx`.

- [x] `DONE` R15 Cloudflare Access hardening artifacts.
      Evidence: `infrastructure/cloudflare-access/access-apps.tf`, `infrastructure/cloudflare-access/applications.yaml`, `infrastructure/cloudflare-access/README.md`, `src/lib/cloudflare-access.ts`.
- [x] `DONE` R19 monthly failover drill workflow.
      Evidence: `.github/workflows/failover-drill.yml` (monthly schedule + manual dispatch probes for primary/secondary health).

- [x] `DONE` R16 AppFlowy WAL-G → **Cloudflare R2** (replaces S3 design).
      Evidence: `infrastructure/appflowy/walg-sidecar.yaml` + `appflowy-walg-env` /
      `appflowy-walg-r2` live; daily `appflowy-walg-basebackup` CronJob created.
      Account endpoint `https://fb7dc7b69b662480cd5961a4d1913c78.r2.cloudflarestorage.com`.
      Continuous `archive_command` **live** (2026-07-29): rclone →
      `r2://datalake-bucket/appflowy-wal/wal/` (`archive_command=/walg-bin/archive.sh %p %f`
      in `k8s/appflowy.yaml`). Re-test same day: `pg_switch_wal` → `archived_count`
      advanced; objects `00000001…017` listed in R2. Daily CronJob uses
      `pg_dump -Fc` + rclone → `appflowy-wal/base/` (wal-g hang + `pg_basebackup`
      blocked by replication HBA on omv). Smoke 2026-07-29:
      `postgres-20260729T182641Z.dump` uploaded; re-verify `20260729T182822Z` OK.
      Never set `WALG_LOG_LEVEL=INFO` (only NORMAL|DEVEL|ERROR). Do not apply empty
      Secret stubs from `walg-sidecar.yaml` (wipes live R2 keys).
- [x] `DONE` R23 Resend pilot for order confirmations.
      Evidence: `src/lib/email-resend.ts` plus pilot switch/fallback in `src/lib/email.ts` (`sendOrderConfirmation` prefers Resend when configured, falls back to SES).
- [x] `DEFERRED` R24 AWS secondary-region DR path (legacy).
      Decision 2026-07-29: do not provision; prefer Cloudflare Tunnel HA + R2 offsite + R19 failover drill. Manifests retained under `infrastructure/r24-dr/`.
- [x] `DEFERRED` R20 Postgres logical replication subscriber to AWS (legacy).
      Decision 2026-07-29: do not provision AWS subscriber; prefer R16→R2 WAL + ETL
      `scripts/etl/appflowy-to-r2.mjs`. Manifests retained under `infrastructure/r20-replication/`.

## Next open (Cloudflare-first)

- [x] `DONE` Retarget R10 PVC backup CronJobs to R2 via rclone (no `apk add aws-cli`).
      Evidence: `infrastructure/backup/cronjob-*.yaml`, `README.md`,
      `.github/workflows/store-r2-backup-credentials.yml`.
- [x] `DONE` Provision R2 S3 API credentials + cluster secrets (2026-07-29).
      Derived Access Key ID / Secret from User API Token with R2 Storage R/W on account
      `fb7dc7b69b662480cd5961a4d1913c78` (SHA-256 of token value per Cloudflare R2 docs).
      Applied `pvc-backup-r2` in appflowy/espocrm/postiz/n8n + `appflowy-walg-r2` +
      `appflowy-walg-env`. Stored `CF_R2_*` + corrected `CF_ACCOUNT_ID` in GitHub secrets.
- [x] `DONE` Smoke PVC backup Job to R2.
      Proof: `pvc-backup-appflowy` Job Completed; uploaded **1178437** bytes to
      `r2://datalake-bucket/pvc-backups/appflowy/daily/2026-07-29T170155Z.sql.custom`.
- [x] `DONE` EspoCRM hourly ETL → R2 (NodePort + API key).
      Evidence: `.github/workflows/etl-espocrm-to-r2.yml` uses `http://127.0.0.1:30700`;
      API user `cloudless-app` + role ACL; `ESPOCRM_API_KEY` in GH + `cloudless-secrets`.
      Run https://github.com/Themis128/cloudless.gr/actions/runs/30485173560 — **5/5** entities
      → `lake/espocrm-{contacts,accounts,opportunities,cases,campaigns}/*.parquet`.
- [x] `DONE` Kuma push monitors for ETL + cluster alerts (2026-07-29).
      Evidence: 8 push monitors in Kuma SQLite; GH secret `KUMA_PUSH_ETL_ESPOCRM`;
      `cluster-alerts-kuma` populated in monitoring/appflowy/espocrm/n8n/postiz;
      ETL run https://github.com/Themis128/cloudless.gr/actions/runs/30486610424
      shows non-empty `KUMA_PUSH_URL` on Ping Kuma step.
- [x] `DONE` Search funnel analytics on Cloudflare D1 (query → result → click; buy hook ready).
      Evidence: `migrations/0008-search-funnel-events.sql`, `src/lib/search-funnel.ts`,
      `src/lib/funnel-client.ts`, `StoreGrid` beacons, `POST /api/analytics/track` D1 sink,
      `GET /api/admin/analytics/search-funnel`. Remote D1 tables verified 2026-07-29:
      `search_funnel_events` + `analytics_events` present on `user-auth-db`.
- [x] `DONE` Recommendation A/B vs no-rec baseline (flag + instrumentation).
      Evidence: `store-recommendations` in `src/lib/ab-flags.ts`, `GET /api/experiments/[flagId]`,
      `RecommendationGrid` holdout + `rec_impression`/`rec_click` funnel events. Enable flag in
      `/admin/ab-tests` to start traffic split.
- [x] `DONE` Admin UI to review/approve GenAI product descriptions (R21d).
      Evidence: `src/app/[locale]/admin/product-descriptions/page.tsx` + nav link in
      `AdminLayoutClient.tsx` (Workers AI primary / Gemini fallback API already shipped).

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

- [x] R10 (S3 design superseded by R2 CronJobs above), R11, R12, R13 (descoped), R14, R18, R22.

## Platform direction (operator decision 2026-07-29)

- **Migrate off AWS → Cloudflare.** Prefer Workers / R2 / D1 / Access / Tunnel over expanding SSM, S3, Lambda, Athena, Cognito, etc.
- **Do not install AWS CLI or AWS SDK** for agent/operator work on this repo; use Cloudflare tooling and existing in-repo paths instead.
- AWS-backed roadmap items (old R16→S3, R20→AWS, R24 secondary region) are
  **legacy** — R16 + R10 live on R2 (2026-07-29 smoke: 1.1 MiB AppFlowy dump).

### Platform migration pillars (2026-07-29)

- [x] `DONE` Drop S3 analytics **event** sink → D1 `analytics_events` (migration 0009).
      Evidence: `src/lib/analytics.ts` (`trackAnalyticsEvent`), `POST /api/analytics/track` (no S3).
- [x] `DONE` Stripe + admin-notification **lake** PutObject → R2 `DATALAKE_BUCKET`
      (`getDataLakeBucketFromEnv` in `r2-client.ts`; no S3 SDK in those sinks).
      Stripe webhook **idempotency** prefers D1 `stripe_transaction` when `AUTH_DB`
      is bound (`persistStripeEvent` / mark helpers in `stripe-transactions.ts`);
      Dynamo `STRIPE_TRANSACTIONS_TABLE` remains legacy fallback.
      Still AWS (follow-up): Athena cost/datalake UI reads;
      `stripe-analytics-read` Dynamo queries.
      Admin-notifications prefer D1 `admin_notification` when `AUTH_DB` bound
      (`src/lib/admin-notifications.ts` + migration 0011); Dynamo table is fallback.
- [x] `DEFERRED` ESLint 10 + TypeScript 7 majors (ecosystem blockers 2026-07-29).
      ESLint 10 crashes `eslint-plugin-react` (`getFilename is not a function`);
      `eslint-plugin-import` / `jsx-a11y` peers stop at eslint 9. TypeScript 7
      hard-stopped by `typescript-eslint` (`typescript: >=4.8.4 <6.1.0`). Revisit
      when Next `eslint-config-next` + typescript-eslint ship support.
- [x] `DONE` Cognito → D1 auth cutover (JWKS gated).
      Evidence: login/register/activate D1 paths; `requireAuth` uses Cognito JWKS
      **only** when `NEXT_PUBLIC_AUTH_PROVIDER=cognito`; otherwise opaque
      `session_token` (Bearer or cookie) via `auth-d1`; next-auth cookie skipped
      in D1 mode; `fetchWithAuth` does not attach Cognito ID tokens when D1.
      Leftover `COGNITO_ISSUER` alone no longer enables JWKS.
- [x] `DONE` SSM → D1 `app_config` (Cloudflare-first).
      Evidence: `getConfig()` prefers D1 via `getAuthDbFromEnv()`; admin PUT
      `/api/admin/config`; Pi ConfigMap `SSM_DISABLED=1` + `cloudless-secrets` envFrom;
      AWS SSM only when `SSM_ENABLED=1` (LocalStack CI / legacy Lambda). Secrets stay
      Wrangler/k8s. Cognito keys not required unless `NEXT_PUBLIC_AUTH_PROVIDER=cognito`.

## Notes

- `docs/master-todo-list.md` remains the detailed ledger (rationale, history, phase context).
- Operator: CF rotation skipped; Sentry + Slack/ntfy verified; Kuma webhook e2e **200**; ESP32 partial reconstruct done.
- This file is intentionally concise and execution-focused to avoid roadmap drift.
