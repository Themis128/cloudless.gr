# Re-architecture plan — connect self-hosted apps to cloudless.gr
**Status:** Plan-for-approval. Per-app PRs ship after the operator approves the table below.
**Constraints:**
- Revenue / marketing ops prioritized first.
- Both the **Next.js cloudless.gr app** (Pi k3s) AND the **AWS serverless half** (Lambda + SST + SES + S3 + Athena + DynamoDB + SSM + Cognito + CloudFront) MUST share resources.
- **No new EC2 instances. No new AWS services.** Reuse only what's already provisioned.

## Sharing pattern (one library, two callers)

Both halves call into the same `src/lib/<app>.ts` clients. The Next.js app
imports them directly via Next routes; Lambda imports them via the same
ESM path (Next.js builds the Lambda bundle from the same `src/` tree
through SST's `NextjsSite` construct per CLAUDE.md). Already proven by:
- `src/lib/espocrm.ts` ← used by `/api/admin/crm/*` (Next.js) AND
  `infrastructure/ses-to-espocrm/` Lambda (`SES → Case` bridge).
- `src/lib/email.ts` ← used by `/api/newsletter/send` AND the Lambda-driven
  cron `publish-and-send-newsletter.ts`.

**No new AWS service is created** — every existing self-hosted app is
reached from both halves over the public Cloudflare tunnel (HTTPS) or the
in-cluster Service URL (for in-cluster Lambda → app calls, which we don't
have today but could add via tailnet). For now: public HTTPS only.

## Current state — gap table

Each row maps a feature to the host (self-hosted app or AWS service) and
flags what wiring is **missing** that this re-arch needs to close.

| # | Feature | Hosts the data | Next.js wiring | Lambda wiring | Gap to close |
| - | ------- | -------------- | -------------- | ------------- | ------------ |
| 1 | CRM contacts + deals + tickets | EspoCRM | ✅ `src/lib/espocrm.ts` (21 exports mirror old hubspot.ts) | ✅ `infrastructure/ses-to-espocrm/` Lambda creates Cases from SES Inbound | NONE — already done in PRs #1029-#1043. |
| 2 | Newsletter subscribers | EspoCRM `Contact.leadSource=newsletter_signup` | ✅ `/api/subscribe`, `/api/unsubscribe`, `/api/admin/email/contacts` | ✅ Same lib import-path works from Lambda | NONE — verified in PR #1071 (`searchContacts` test green). |
| 3 | LinkedIn campaign tracking | EspoCRM `Lead` + Athena `linkedin_conversions` | ✅ `/api/campaigns/conversion` (CAPI mirror) + `/api/admin/leads` | ✅ Insight Tag client-side, CAPI server-side | NONE — PR #1049. |
| 4 | Social media scheduling | Postiz | ⚠️ `src/lib/postiz.ts` exists (read-only list) | ❌ Not called from any Lambda | **GAP-A:** wire `/api/admin/social` page + auto-post-on-blog-publish + ETL-to-lake. |
| 5 | Workflow automation | n8n | ⚠️ `src/lib/n8n.ts` exists (list workflows) | ❌ Not called from any Lambda | **GAP-B:** add webhook-receiver endpoint so app events trigger n8n workflows (lead arrives → enrich → notify). |
| 6 | Marketing analytics | Athena (`cloudless_analytics.events`) + Plausible | ✅ `notion-analytics.ts` reads Athena | ✅ Lambda `analytics-ingest` writes NDJSON to S3 | NONE — PR #1050. |
| 7 | Notion docs replacement | AppFlowy | ⚠️ no `src/lib/appflowy.ts` wired yet | ❌ Not called from Lambda | **GAP-C** (LOW priority per user, no revenue impact): defer until AppFlowy is actually used for docs. Right now the operator just logs in to take notes. |
| 8 | Uptime monitoring | Uptime Kuma (LAN) + blackbox-exporter (cluster) + healthchecks.io workflow | ❌ Admin /cluster page reads only Prometheus | ❌ No Lambda | **GAP-D** (LOW priority, ops not marketing): pull Kuma `GET /api/status-page/<slug>` into /admin/cluster. Defer. |
| 9 | Alert pub/sub | Mosquitto MQTT | ❌ No `src/lib/mqtt.ts` | ✅ alert-api on Pi publishes; ses-to-espocrm Lambda doesn't subscribe | **GAP-E** (MEDIUM priority): add `src/lib/mqtt.ts` so Next.js admin pages can subscribe to `homelab/alerts/status` for the live red/amber/green chip. |
| 10 | Push notifications | ntfy (self-hosted) | ❌ Browser uses web-push API today | ❌ No Lambda | **GAP-F** (LOW priority): swap web-push for ntfy on admin alerts. Defer. |
| 11 | Email transactional | SES SMTP fleet | ✅ All 5 apps wired in PR #1067-#1069 | ✅ SES SMTP creds in SSM, accessible from Lambda | NONE — done this session. |

## What ships, in what order (marketing-ops-first per operator)

| PR | Scope | Touches | Risk |
| -- | ----- | ------- | ---- |
| **PR R1 (GAP-A)** | **Postiz integration end-to-end.** Build `/admin/social` page (scheduled posts table + manual post composer + analytics). Auto-trigger Postiz post when a blog row flips Status=Published. Add `scripts/etl/postiz-to-lake.mjs` daily run → Athena view. | `src/lib/postiz.ts` (extend), `src/app/[locale]/admin/social/page.tsx` (new), `src/app/api/admin/social/*` (new), `src/app/api/cron/blog-publish/route.ts` (hook), `scripts/etl/postiz-to-lake.mjs` (new), `.github/workflows/etl-postiz-to-lake.yml` (new). | LOW — Postiz API is well-tested; nothing destructive. |
| **PR R2 (GAP-B)** | **n8n webhook + sync.** Build `src/app/api/webhooks/n8n/trigger/route.ts` (call n8n by workflow-id). Wire 2 launch workflows: (a) "Lead created in EspoCRM → enrich via Apollo → assign owner via round-robin"; (b) "Newsletter signup → tag in EspoCRM + add to nurture sequence". Surface workflow run status in `/admin/automation`. | `src/lib/n8n.ts` (extend), `src/app/[locale]/admin/automation/page.tsx` (new), `src/app/api/webhooks/n8n/*` (new), n8n workflow JSON exports under `infrastructure/n8n/workflows/`. | MEDIUM — depends on operator creating the 2 workflows in n8n UI; PR ships the receiver + page, operator provides the wf IDs. |
| **PR R3 (GAP-E)** | **MQTT live-status chip.** `src/lib/mqtt.ts` (server-side subscriber). `/admin/cluster` shows live red/amber/green from `homelab/alerts/status` retained payload. Replaces the polled Athena query for that one chip. | `src/lib/mqtt.ts` (new, uses `mqtt` npm pkg + `MQTT_USERNAME`/`MQTT_PASSWORD` from SSM), `src/app/[locale]/admin/cluster/page.tsx` (chip). | LOW — read-only subscribe; no broker config change. |
| **(deferred)** GAP-C AppFlowy, GAP-D Kuma/Grafana, GAP-F ntfy | Lower revenue/marketing value. Pick up after R1-R3 land + verify. | | |

## Per-PR acceptance criteria (what "done" looks like)

**R1 Postiz**
- `/admin/social` lists scheduled + published posts, last 30 days, with image/preview.
- Composer creates a post + schedule via Postiz API + returns toast on success.
- Blog Status=Published webhook fires `schedulePost()` with rendered Twitter/LinkedIn/Facebook copy.
- `cloudless_analytics.postiz_posts` Athena view returns rows from yesterday's ETL.
- Login uses unified admin creds (already set up).

**R2 n8n**
- Operator creates 2 workflows in n8n UI, copies their IDs into SSM.
- App-side `/api/webhooks/n8n/trigger/route.ts` accepts `{workflowId, payload}` and POSTs to `https://n8n.cloudless.gr/webhook/<id>`.
- `/admin/automation` lists last 50 runs (via `GET /rest/executions`) with status + duration.
- EspoCRM lead-create webhook → triggers workflow (1) automatically.

**R3 MQTT chip**
- `/admin/cluster` shows a live status chip that updates without a page refresh.
- Falls back to "—" if MQTT broker unreachable (no error, no crashloop).
- The chip uses **the same** `MQTT_USERNAME`/`MQTT_PASSWORD` from SSM that the alert-api Lambda uses (single source of truth).

## "No new AWS service" check

| Existing AWS resource | How this plan reuses it (NOT adds) |
| --------------------- | ---------------------------------- |
| SES | All apps' transactional email — wired in PR #1067-#1069. |
| SSM Parameter Store | All Postiz/n8n/MQTT credentials read via existing `ssmFetch()`. **No new key namespace** — just adds 3-4 keys under `/cloudless/production/`. |
| S3 (data lake) | Postiz + (eventually) AppFlowy ETLs write Parquet under existing `cloudless-data-lake` bucket. |
| Athena | New views (`postiz_posts`, etc.) under existing `cloudless_analytics` database. |
| Lambda (SST `NextjsSite`) | Next.js Lambda picks up new `/api/admin/social/*` + `/api/webhooks/n8n/*` routes automatically — no new function. |
| Cognito | `/admin/social` + `/admin/automation` reuse the existing `requireAdmin` JWT gate. |
| EventBridge | Optional later (defer): cron rule to invoke ETLs. For now `gh workflow run` is fine. |
| DynamoDB | Not needed — Postiz/n8n state lives in their own Postgres + SQLite. |
| CloudFront | No changes. Tunnel + Cognito gate are unchanged. |

**Zero new AWS resources to provision.** All wiring is code-level inside
the existing `src/`, `scripts/etl/`, and `infrastructure/` trees.

## What I need from you to start

1. Approve this plan (or push back on any row).
2. Pick the FIRST PR to ship (R1 / R2 / R3) — I'll execute it end-to-end:
   manifests + library + Next route + admin page + ETL workflow if applicable
   + test + memory entry + commit + push + merge.
3. For R2 (n8n), confirm: do you want me to ship a starter workflow JSON
   in `infrastructure/n8n/workflows/` that you import via n8n UI, or do
   you prefer to design the workflows yourself in n8n then give me the
   IDs to wire?

After PR R1-R3 land, GAP-C/D/F can be re-prioritized (or stay deferred).

## See also
- `docs/cluster-capacity-audit-2026-06-21.md` — confirms there's headroom on omv for any new ETL pod.
- `skills/espocrm-operator/SKILL.md` — the wiring pattern R1/R2 follow.
- `skills/mqtt-auth-rollout/SKILL.md` — the MQTT auth context R3 builds on.
- Memory: [[project-ses-smtp-fleet]], [[project-unified-admin-creds]], [[project-optional-secret-env-gotcha]].
