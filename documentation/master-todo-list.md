# Master TODO — cloudless.gr perfection roadmap

The single canonical action list for taking the AWS-serverless + Pi-cluster
stack to "production-perfect with full data-analytics features", under the
**same-hardware constraint**: no new AWS service categories beyond what we
already use, no new Pi nodes beyond omv + omv-ha.

Synthesizes:

- CLAUDE.md "Pending One-Time Setup" table
- `docs/optimal-architecture-assessment.md` R10-R20 roadmap
- `docs/best-practices-audit-2026.md` R21-R24 additions
- Per-app upstream-doc gaps from `selfhosted-admin-bootstrap` skill
- Memory entries — esp. `project_grafana_athena_blocked_scp`, `project_r7_r8_r9_shipped`

## Constraints

- **AWS side:** existing services only — Lambda, DDB, S3, SES, SSM, Cognito,
  Athena/Glue, CloudFront, Route 53, ECR, Bedrock. **No** new EC2, Aurora,
  Lightsail, MSK, RDS.
- **Pi side:** omv + omv-ha only. No third node, no NAS migration.
- **Solo Greek SMB volume.** Budget per change must match value — reject
  $50/mo+ recurring costs unless ROI is obvious.

## Legend

- 👤 Operator-only (UI clicks / external dashboards / out-of-band)
- 🤖 Claude can ship (PR-sized code change)
- 🔵 AWS-side change
- 🟠 Pi-side change
- 🟣 Both sides
- ✅ Already done

---

## Phase 0 — Operator-only blockers (do these whenever, all 5 are <10 min each)

These are the 5 items that ONLY you can resolve. None block users; all are
operator polish or unlock follow-on automation.

- [ ] 👤 🔵 **Cloudflare API token rotation.** Mint at Cloudflare dashboard → SSM `CLOUDFLARE_API_TOKEN` → `gh workflow run store-cloudflare-token.yml -f cloudflare_token=… -f apply=true`. **Unlocks 3 stale items:** HA LB setup, email-obfuscation fix, infra MCP. See `skills/cloudflare-token-doctor/SKILL.md`.
- [ ] 👤 🔵 **Sentry webhook.** Sentry → Settings → Developer Settings → New Internal Integration → Webhook URL `https://cloudless.gr/api/webhooks/sentry`, subscribe to "issue" events, copy Client Secret → SSM `SENTRY_WEBHOOK_SECRET`. R8 closure.
- [ ] 👤 🟠 **Kuma status page.** Kuma UI → Status Pages → New → slug `cloudless` → add 12 monitors (cloudless.gr/api/health, each self-hosted app, each Pi node, Stripe/Cognito surface checks). Wire Kuma → ntfy + Slack channels.
- [ ] 👤 🟠 **ESP32 Notion page restore.** Open Notion ESP32 page → ••• → Page history → restore pre-2026-06-02 15:19 UTC.
- [ ] 👤 🔵 **Grafana Athena SCP.** Either (a) `aws organizations list-policies-for-target --target-id 278585680617 --filter SERVICE_CONTROL_POLICY` and lift the athena-deny, OR (b) skip — ship R12 instead and the dashboard renders in `/admin/cost` natively.

---

## Phase 1 — Week 1 (highest value/effort, Claude can ship)

- [x] ~~🤖 🟣 **R10** PVC daily Restic backup to S3 — `infrastructure/backup/cronjob.yaml` sweeps all 8 PVCs to `s3://cloudless-analytics-data/pvc-backups/`, retain 7d + 4w. Closes the #1 SPOF in one PR. **EFFORT: M / RISK: LOW**~~ ✅ **SHIPPED 2026-06-21** — 4 CronJobs live (appflowy 03:30, espocrm 03:45, postiz 04:00, n8n 04:15 UTC). S3 lifecycle = 7d standard → GLACIER → expire 30d. EspoCRM test job verified end-to-end (32945-byte dump landed at `pvc-backups/espocrm/daily/`). MinIO blobs + Grafana plugins + Kuma SQLite are R10b/c follow-ups (see `infrastructure/backup/README.md` "Not yet covered" section).
- [x] ~~🤖 🟣 **R11** TLS cert parity probe~~ ✅ **SHIPPED 2026-06-21 (PR #1096)** — daily 07:00 UTC `.github/workflows/tls-cert-parity-probe.yml`. Both push + workflow_dispatch runs green in 7-9s. ACM + Let's Encrypt both valid + >14d to expiry. notifyAdmin() fires on cert expiry/SAN-mismatch/unreachable.
- [x] ~~🤖 🔵 **R12** `/admin/cost` panel rendering Athena directly~~ ✅ **SHIPPED 2026-06-21** — `src/lib/cost-analytics.ts` + `/api/admin/cost` route + `/admin/cost` page (4 panels: 30d total + yesterday vs 7d-avg + daily trend bars + top-10 services). Bypasses the Grafana SCP block. Linked from `/admin` home grid under "System". Fulfills the admin-must-track-backend rule for R9.
- [x] ~~🤖 🔵 **R14** Sentry env tagging~~ ✅ **SHIPPED 2026-06-21** — Lambda env adds `SENTRY_ENVIRONMENT: isProd ? "production" : "staging-${stage}"` (sst.config.ts); Pi container env hardcodes `SENTRY_ENVIRONMENT=pi-standby` (k8s/cloudless-app-optimized.yaml). All 3 sentry.{client,server,edge}.config.ts now prefer `SENTRY_ENVIRONMENT` over `NODE_ENV`. Closes pi-cloud-sync.md gap #3.
- [ ] 🤖 🟣 **R25** (NEW) Self-hosted admin auto-login bridge — `src/lib/selfhosted-autologin.ts` helper + per-app pre-auth tokens; every `/admin/cluster` tile becomes one-click ingress. Per `feedback_selfhosted_admin_autologin`. Per-app PRs (EspoCRM + AppFlowy first). **EFFORT: L (one PR per app) / RISK: MED**
- [ ] 🤖 🔵 **R14** Sentry env tagging: `SENTRY_ENVIRONMENT=pi-standby` on Pi build, `prod` on Lambda. **EFFORT: XS / RISK: LOW**

---

## Phase 2 — Week 2 (resilience + tighter RPO)

- [ ] 🤖 🟠 **R13** EspoCRM `mariadb-backup` hourly to S3 (RPO 1h on canonical CRM). CronJob exec into mariadb pod → xbstream → S3. **EFFORT: S / RISK: LOW**
- [ ] 🤖 🟣 **R18** Pi-side SSM scope assertion — daily workflow diffs SSM key list vs `cloudless-pi-standby` IAM read access. Catches "added key, forgot Pi" silently. **EFFORT: S / RISK: LOW**
- [ ] 🤖 🔵 **R22** Stripe webhook idempotency audit — confirm `event.id` dedup table in DDB + return 200 fast + process async. Prevents duplicate-charge bugs. **EFFORT: S (audit-only)**

---

## Phase 3 — Week 3 (AI baseline — the visible-value chunk)

Closes the "❓ MISSING — AI baseline" finding from `best-practices-audit-2026.md`.
Reuses existing Bedrock Nova IAM (no new SaaS bills).

- [ ] 🤖 🟠 **R21a** Meilisearch self-host on omv-ha — k8s manifest + PVC + tunnel route. **EFFORT: S / RISK: LOW**
- [ ] 🤖 🔵 **R21b** `/api/search` route with Bedrock Titan embeddings — index DDB product catalog into Meilisearch on order/edit hooks. **EFFORT: M / RISK: LOW**
- [ ] 🤖 🔵 **R21c** Product recommendation engine — collaborative filter over DDB orders + Bedrock embedding similarity. Renders on `/store/[id]` + `/store`. **EFFORT: M / RISK: LOW**
- [ ] 🤖 🔵 **R21d** GenAI product descriptions — one-shot script: Bedrock Nova generates description draft per product → operator approves before publish. **EFFORT: S / RISK: LOW**

---

## Phase 4 — Week 4 (hardening + observability)

- [ ] 🤖 🟠 **R15** Cloudflare Access on admin tunnel hosts (grafana / kuma / appflowy admin / n8n) via Service Tokens. **EFFORT: M / RISK: LOW**
- [ ] 👤 🟠 **R17** Operator: create 12 Kuma monitors + wire Kuma → ntfy + Slack channels directly. **(also in Phase 0 — duplicate intentional)**
- [ ] 🤖 🟣 **R19** Monthly failover drill — manual-dispatch workflow disables R53 PRIMARY for 90s, asserts SECONDARY served from outside, re-enables. **EFFORT: M / RISK: MED**

---

## Phase 5 — When time permits (lower priority)

- [ ] 🤖 🟠 **R16** AppFlowy WAL-G to S3 — wal-g sidecar on postgres pod streams WAL continuously. RPO ~5 min for knowledge base. **EFFORT: M / RISK: MED**
- [ ] 🤖 🔵 **R23** Resend pilot on order-confirmation flow (vs SES baseline). Keep SES for ETL/bulk. **EFFORT: S / RISK: LOW**
- [ ] 🤖 🔵 **R24** Route 53 health-check + secondary-region Lambda (`us-west-2`) passive + DDB Global Tables. AWS-side DR (paired with R20's Pi-side data sync). **EFFORT: M / RISK: MED**
- [ ] 🤖 🟣 **R20** Postgres logical replication subscriber on AWS — **using existing services only**: postgres logical decoding → Lambda subscriber → DDB write. No new EC2/Lightsail. RPO ~seconds. **EFFORT: L / RISK: MED**

---

## Phase 6 — LinkedIn CAPI finalization

Closes the half-done CAPI work from `project_linkedin_capi_source_bound` memory.

- [ ] 🤖 🔵 Verify `li_fat_id` capture in client (Insight Tag injects it; check `src/components/LinkedInInsightTag.tsx`).
- [ ] 👤 🔵 Provision a LinkedIn CAPI-typed conversion ID (the existing `26846068` is browser-only; CAPI needs a different conv type). Create at LinkedIn Campaign Manager → Account assets → Conversions → "Conversion API" type.
- [ ] 🤖 🔵 Wire `eventId` dedup between Insight Tag fire + CAPI fire (same UUID, fires on both client + server within ~5 s of each other).

---

## Phase 7 — Lifestyle changes (no PRs, just cadence)

- [ ] 👤 🟠 Annual rotation: `APPFLOWY_PASSWORD`, `ESPOCRM_API_KEY`, `POSTIZ_API_KEY`, `GRAFANA_API_TOKEN`, `NTFY_TOKEN`. Use `skills/selfhosted-admin-bootstrap/SKILL.md` rotation runbook.
- [ ] 👤 🟠 Update `infrastructure/n8n/workflows/*.json` in git after every UI change to the live workflows.
- [ ] 👤 🟣 Monthly: review `pnpm test:unit:coverage` thresholds in `vitest.config.mts`; ratchet up if coverage grew.
- [ ] 👤 🟣 Quarterly: re-read `docs/optimal-architecture-assessment.md` + `docs/best-practices-audit-2026.md`. Refresh if the SMB landscape moved.

---

## Data-analytics feature checklist (the "data-analytics website" goal)

✅ already shipping; ⬜ needs work.

### Data sources flowing into Athena (✅ all 10 ETLs daily)

- ✅ AWS Cost (R9, this session)
- ✅ EspoCRM contacts/leads/deals/cases
- ✅ Stripe orders + subscriptions + payouts
- ✅ Sentry issues + events
- ✅ Google Search Console keywords + clicks + impressions
- ✅ LinkedIn Ads campaigns + spend + conversions
- ✅ AppFlowy postgres direct
- ✅ Postiz scheduled posts + analytics
- ✅ n8n workflow execution history
- ✅ DDB orders + idempotency keys
- ✅ Computed RFM/churn segments

### Analytics surfaces (operator views)

- ✅ `/admin/analytics` consolidated dashboard
- ✅ `/admin/cluster` real-time health chips (MQTT + Kuma + Grafana + AppFlowy + EspoCRM + Postiz + n8n + ntfy)
- ✅ Grafana per-app dashboards (kube-prom + 2 custom)
- ⬜ **Phase 1:** `/admin/cost` Athena-backed panel (R12)
- ⬜ **Phase 3:** AI semantic-search funnel analytics (query → result → click → buy) — added when R21 lands
- ⬜ **Phase 3:** AI recommendation A/B vs no-rec baseline analytics — added when R21c lands

### Customer-facing data features

- ⬜ **Phase 3:** Personalized product recommendations (R21c) — biggest 2026 SMB e-shop expectation
- ⬜ **Phase 3:** Semantic search box on `/store` (R21b) — replaces keyword-only search
- ⬜ **Phase 3:** AI-generated product descriptions (R21d) — operator-approved before publish

---

## Cumulative outcome at end of Phase 4

After ~4 weeks shipping top-down, you will have:

- Every PVC backed up daily; EspoCRM hourly; AppFlowy continuous (after R16).
- TLS expiry alerts on BOTH halves.
- Cost dashboard rendering inside admin (bypasses Athena SCP).
- Independent observability via Kuma → ntfy (alerts when the app itself is down).
- Failover drill proving the path monthly.
- Sentry blaming the right surface during failover.
- Admin tunnel hosts behind Cloudflare Access.
- All 5 operator-blockers cleared.
- Stripe webhook bulletproof against retries.
- **AI baseline live: semantic search + recommendations + GenAI copy.**
- LinkedIn CAPI fully closed.

That's the **"perfect for 2026 SMB data-analytics e-shop"** state, achievable
with the same hardware you have today and no new AWS service categories.

## Cross-references

- `docs/optimal-architecture-assessment.md` — R10-R20 detailed rationale
- `docs/best-practices-audit-2026.md` — R21-R24 detailed rationale + 30+ sources
- `docs/architecture-purchase-flow.md` — current end-to-end purchase flow
- `docs/pi-cloud-sync.md` — canonical AWS↔Pi sync contract
- `docs/session-summary-2026-06-21.md` — what shipped this session
