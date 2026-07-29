# Master TODO — cloudless.gr perfection roadmap (post-R12)

Quick checklist: `docs/current-source-of-truth-checklist.md` is the single
active execution list. This file remains the detailed roadmap ledger and
history.

**Status as of 2026-07-29:** Phases 0–6 roadmap rows are closed in
`docs/current-source-of-truth-checklist.md` (DONE / PARTIAL / DEFERRED /
SKIPPED). R10 PVC backups + R16 WAL-G now land on **Cloudflare R2**
(not S3). R20/R24 AWS DR paths are **legacy-deferred**. Customer-facing
R21b store search is wired to `/api/search`; R21d admin Product Copy UI,
D1 search/rec funnel (`0008`), and `store-recommendations` A/B holdout
shipped 2026-07-29. Auth: register + activate fall back to D1 when Cognito
unset; lake sinks (Stripe events, admin notifications) write R2 not S3.
**Still open:** Phase 7 operator cadence; Cognito JWKS retirement; Athena
cost UI → R2/Workers.

Quick execution list → `docs/current-source-of-truth-checklist.md`.
This file remains the detailed ledger + history.

Platform direction (2026-07-29): **migrate off AWS → Cloudflare**
(Workers / R2 / D1 / Access / Tunnel). Do not expand AWS or install
AWS CLI/SDK for agent work. Same-hardware constraint still applies:
no new Pi nodes beyond omv + omv-ha.

Synthesizes:

- CLAUDE.md "Pending One-Time Setup" table
- `docs/optimal-architecture-assessment.md` R10-R20 roadmap
- `docs/best-practices-audit-2026.md` R21-R24 additions
- Per-app upstream-doc gaps from `selfhosted-admin-bootstrap` skill
- Memory entries — esp. `project_grafana_athena_blocked_scp`, `project_r7_r8_r9_shipped`

## Constraints

- **Cloudflare-first:** prefer Workers / R2 / D1 / Access / Tunnel for new
  work. Remaining AWS (Lambda, DDB, SES, SSM, Cognito, Athena, …) is
  legacy — do not expand; do not install AWS CLI/SDK for operator work.
- **Pi side:** omv + omv-ha only. No third node, no NAS migration.
- **Solo Greek SMB volume.** Budget per change must match value — reject
  $50/mo+ recurring costs unless ROI is obvious.

## Session log — 2026-06-22 (workflows + ops sweep + R18)

18 PRs merged today after R10-R14 landed in the previous session.
15 on the ops / CI / housekeeping side + 2 shipping R18 (Pi-side SSM
scope assertion probe) + 1 automated chore (Notion sitemap sync).
Listed here so future sessions know what state the repo is in
without diffing git.

| PR | Theme | Net |
|---|---|---|
| #1100 | `.github/workflows/README.md` catalogue index (124 wfs grouped into 14 categories) | docs |
| #1101 | Archived 8 truly-one-shot workflows (cloudless.online decom, OIDC fixes, indexing smoke) → 116 active | -8 wfs |
| #1102 | Archived 9th (`deploy-infrastructure-workaround.yml`, GPG fix obsolete since `terraform-doctor` skill) + documented 2 known-failing wfs | -1 wf |
| #1103 | Cleanup: 3 tmp survey scripts that slipped into #1102 via `git add -A` | hygiene |
| #1104 | **perf(ci)**: `.next/cache` restore added to `ci.yml` + `bundle-budget.yml` + `bundle-size-pr.yml`. All 4 Next builders now cached. ~2-3 min savings per cache-hit run. | perf |
| #1105 | `docs/gh-workflows-strategy.md` — measured baseline + 8 ROI-ranked optimization patterns + prioritized roadmap. Memory `project_gh_workflows_speedup_strategy` added as pointer. | docs |
| #1106 | **fix(etl-selfhosted)**: dropped unneeded `pnpm/action-setup` (the install is `npm ci` in `scripts/etl/`, separate npm project). | fix |
| #1107 | `.gitignore`: `tmp_*.sh` + `q-dev-chat-*.md` so session helpers stop slipping into PRs. | hygiene |
| #1108 | **fix(etl-selfhosted)**: use `AWS_DEPLOY_ROLE_ARN` (the `AWS_ETL_ROLE_ARN` secret was never created). End-to-end ETL run verified green. | fix |
| #1109 | **fix(ci)**: `lint:md:fix` swept 161 markdown files clean (was red since R10-R14 docs landed) + excluded `etl-aws-cost-to-lake.test.ts` from vitest (separate npm project unresolvable from root). | fix |
| #1110 | **feat(ops)**: `skills/pi-runner-failover/SKILL.md` + `scripts/pi-runner-doctor.sh` + refactored `sync-smtp-secrets.yml` from Pi-pinned to GH-hosted-with-tailnet. Memory `reference_pi_runner_failover` added. | feat |
| #1111 | Honesty pass on the pi-runner-failover inventory: only 1 of 5 hard-pinned workflows is actually moveable (not 3 of 5). Added "non-DC-IP-required" bullet to Step 5 for Cloudflare bot-detection case. | docs |
| #1112 | This doc update — Master TODO marked post-R12 with the session log. | docs |
| #1113 | **fix(sync-smtp-secrets)**: `timeout 30s` wrapper on `kubectl get ns` smoke test. Default kubectl client-side timeout is 0; hung 5+ min on first GH-hosted → tailnet handshake (verified twice in this session). | fix |
| #1114 | Master TODO session-log addendum (PR #1112+#1113, Pi-back confirmation, CI-green note). | docs |
| #1115 | **feat(R18)**: `scripts/audit-pi-ssm-scope.sh` + `.github/workflows/probe-pi-ssm-scope.yml`. Daily 06:05 UTC `iam:SimulatePrincipalPolicy` diff of SSM keys vs `cloudless-pi-standby`. Drift → `/api/webhooks/admin-alert` (severity=high). Closes pi-cloud-sync.md gap #2. | feat |
| #1116 | **perf(R18)**: batch `simulate-principal-policy` 32 ARNs/call. v1 sequential timed out at 5 min on first verification run; v2 runs ~75s end-to-end. | perf |
| #1117 | Automated: Notion sitemap entries sync. | chore |
| #1122 | This doc update — added #1114-#1117 + status header bump (R18 now ✅). | docs |
| #1123 | docs(master-todo): correct PR number table after #1117 merge race | living roadmap |
| #1124 | docs(master-todo): R13 descoped to 24h (already covered by R10) | Phase 2 → 2/3 done |
| #1125 | docs(session): summary of 2026-06-22 — workflows sweep + R13/R18; saved local + Drive + AppFlowy | docs |
| #1126 | **audit(R22)**: Stripe webhook idempotency — safe at SMB volume; 3-rule JSDoc guard inlined on `handleStripeEvent()` | Phase 2 → **3/3 done** |
| #1127 | **docs(drive)**: `docs/google-drive-cleanup.md` operator runbook + `scripts/audit-drive-folder.mjs` (read-only, local-execution). No Drive cleanup workflow in CI (would need operator-provisioned service account; cloudless.gr Drive footprint is ~50 KB so not yet worth wiring). | docs |

**Pi runners** (`omv`, `omv-build`) were offline for most of the
session and **are back online as of 2026-06-22 ~01:30 UTC**
(verified via `scripts/pi-runner-doctor.sh`; EspoCRM ETL re-trigger
ran cleanly on the Pi end-to-end). Flip `RUNNER_GENERIC` back to
`[self-hosted, omv, build]` via `.github/scripts/toggle-runner.sh pi`
when you want load on Pi again.

**CI on main:** ✅ green after PR #1109. `pnpm lint:md` reports
**0 errors** (was 161 across 12 files); `pnpm test:ci` ignores the
parquetjs-dependent test that vitest couldn't resolve from root.
Re-verified live on sha `4f558a1b` after R18 + all follow-up PRs:
run #27927063197 = completed/success.

**R18 verified live:** probe run #27924784597 = completed/success in
~75s. Zero drift detected — `cloudless-pi-standby` can read every
SSM key under `/cloudless/production/*` today. From now on, any
"added SSM key, forgot Pi" drift will fire a Slack + ntfy alert
within 24h instead of surfacing as a runtime crash.

**Operator-side blockers (reconciled 2026-07-29 — see Phase 0):**

- Cloudflare token rotation — **SKIPPED** (operator deferred)
- Sentry webhook + Kuma status/ntfy — **DONE**
- ESP32 Notion restore — **PARTIAL** (API reconstruct; DBs empty)
- Grafana Athena SCP — **DEFERRED** (R12 `/admin/cost` covers it)
- LinkedIn CAPI config path — **DONE** in `src/data/campaigns.ts`
- Healthchecks.io URLs (6) — still optional; workflows skip without them

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

- [x] ~~👤 🔵 **Cloudflare API token rotation.**~~ ✅ **SKIPPED 2026-07-29** — operator deferred; do not mint/store this pass. See checklist + runbook §1.
- [x] ~~👤 🔵 **Sentry webhook.**~~ ✅ **DONE 2026-07-29** — SSM `SENTRY_WEBHOOK_SECRET` v1 + Pi secret; `notifyAdmin` Slack DM + in-cluster ntfy verified (`slack.ok` + `ntfy.ok`). Runbook §2.
- [x] ~~👤 🟠 **Kuma status page.**~~ ✅ **DONE 2026-07-29** — slug `cloudless`, 12 monitors, ntfy + `kuma-slack-bridge`. Runbook §3.
- [x] ~~👤 🟠 **ESP32 Notion page restore.**~~ ✅ **PARTIAL 2026-07-29** — API reconstruct 16 blocks; history UI/API unavailable past Plus retention. Runbook §4.
- [x] ~~👤 🔵 **Grafana Athena SCP.**~~ ✅ **DEFERRED 2026-07-29** — chose (b): R12 `/admin/cost` already renders Athena natively; org SCP lift is optional Grafana polish only. See `docs/operator-blockers-runbook.md` §5.

---

## Phase 1 — Week 1 (highest value/effort, Claude can ship)

- [x] ~~🤖 🟣 **R10** PVC daily Restic backup to S3 — `infrastructure/backup/cronjob.yaml` sweeps all 8 PVCs to `s3://cloudless-analytics-data/pvc-backups/`, retain 7d + 4w. Closes the #1 SPOF in one PR. **EFFORT: M / RISK: LOW**~~ ✅ **SHIPPED 2026-06-21** — 4 CronJobs live (appflowy 03:30, espocrm 03:45, postiz 04:00, n8n 04:15 UTC). S3 lifecycle = 7d standard → GLACIER → expire 30d. EspoCRM test job verified end-to-end (32945-byte dump landed at `pvc-backups/espocrm/daily/`). MinIO blobs + Grafana plugins + Kuma SQLite are R10b/c follow-ups (see `infrastructure/backup/README.md` "Not yet covered" section).
- [x] ~~🤖 🟣 **R11** TLS cert parity probe~~ ✅ **SHIPPED 2026-06-21 (PR #1096)** — daily 07:00 UTC `.github/workflows/tls-cert-parity-probe.yml`. Both push + workflow_dispatch runs green in 7-9s. ACM + Let's Encrypt both valid + >14d to expiry. notifyAdmin() fires on cert expiry/SAN-mismatch/unreachable.
- [x] ~~🤖 🔵 **R12** `/admin/cost` panel rendering Athena directly~~ ✅ **SHIPPED 2026-06-21** — `src/lib/cost-analytics.ts` + `/api/admin/cost` route + `/admin/cost` page (4 panels: 30d total + yesterday vs 7d-avg + daily trend bars + top-10 services). Bypasses the Grafana SCP block. Linked from `/admin` home grid under "System". Fulfills the admin-must-track-backend rule for R9.
- [x] ~~🤖 🔵 **R14** Sentry env tagging~~ ✅ **SHIPPED 2026-06-21** — Lambda env adds `SENTRY_ENVIRONMENT: isProd ? "production" : "staging-${stage}"` (sst.config.ts); Pi container env hardcodes `SENTRY_ENVIRONMENT=pi-standby` (k8s/cloudless-app-optimized.yaml). All 3 sentry.{client,server,edge}.config.ts now prefer `SENTRY_ENVIRONMENT` over `NODE_ENV`. Closes pi-cloud-sync.md gap #3.
- [x] ~~🤖 🟣 **R25** Self-hosted admin auto-login bridge~~ ✅ **SHIPPED** — `src/lib/selfhosted-autologin.ts` + `/api/admin/autologin` + `/admin/selfhosted` portal (AppFlowy token SSO; other apps smart-link).

---

## Phase 2 — Week 2 (resilience + tighter RPO)

- [x] ~~🤖 🟠 **R13** EspoCRM `mariadb-backup` hourly to S3~~ ✅ **DESCOPED to 24h cadence — already shipped via R10** (2026-06-22). Operator chose RPO=24h over the originally-planned RPO=1h. The daily `infrastructure/backup/cronjob-espocrm.yaml` CronJob at 03:45 UTC (mariadb-dump → gzip → S3 `pvc-backups/espocrm/daily/`) covers this. If the RPO ever needs to drop back to 1h, add a sibling CronJob with `schedule: "0 * * * *"` reusing the same Secret + ServiceAccount.
- [x] ~~🤖 🟣 **R18** Pi-side SSM scope assertion~~ ✅ **SHIPPED 2026-06-22** — `scripts/audit-pi-ssm-scope.sh` walks `/cloudless/production/*` and runs `iam:SimulatePrincipalPolicy` for `ssm:GetParameter` against `cloudless-pi-standby`. `.github/workflows/probe-pi-ssm-scope.yml` runs daily 06:05 UTC; drift POSTs to `/api/webhooks/admin-alert` (severity=high) which fans to Slack + ntfy + Sentry per the R8 path. Read-only — needs only `ssm:DescribeParameters` + `iam:SimulatePrincipalPolicy` on the caller. Closes pi-cloud-sync.md gap #2.
- [x] ~~🤖 🔵 **R22** Stripe webhook idempotency audit~~ ✅ **AUDIT COMPLETE 2026-06-22** — `event.id` dedup via DDB ConditionalWrite ✅; <10s synchronous handler under Stripe's 10s timeout ✅; no async queue (rejected — would require SQS, banned by same-hardware constraint, and the conditional-write dedup makes it unnecessary). Full audit + 3-rule guard for future contributors in `docs/stripe-webhook-audit-r22.md`. Guard also inlined as JSDoc on `handleStripeEvent()` in the route. **Phase 2: 3/3 done.**

---

## Phase 3 — Week 3 (AI baseline — the visible-value chunk)

Closes the "❓ MISSING — AI baseline" finding from `best-practices-audit-2026.md`.
Reuses existing Bedrock Nova IAM (no new SaaS bills).

- [x] ~~🤖 🟠 **R21a** Meilisearch self-host on omv-ha~~ ✅ **SHIPPED** — manifests + tunnel under `infrastructure/meilisearch/` + `k8s/search/`.
- [x] ~~🤖 🔵 **R21b** `/api/search` with Bedrock Titan embeddings~~ ✅ **SHIPPED** — `src/app/api/search/route.ts` + `src/lib/product-search.ts`.
- [x] ~~🤖 🔵 **R21c** Product recommendation engine~~ ✅ **SHIPPED** — `src/lib/product-recommendations.ts` + `/api/recommendations` + `RecommendationGrid`.
- [x] ~~🤖 🔵 **R21d** GenAI product descriptions~~ ✅ **SHIPPED** — `/api/admin/ai/product-descriptions` + `scripts/generate-product-descriptions.ts`.

---

## Phase 4 — Week 4 (hardening + observability)

- [x] ~~🤖 🟠 **R15** Cloudflare Access on admin tunnel hosts~~ ✅ **SHIPPED** — `infrastructure/cloudflare-access/` + `src/lib/cloudflare-access.ts` (token apply still needs healthy Cloudflare token from Phase 0).
- [x] ~~👤 🟠 **R17** Operator: create 12 Kuma monitors + wire Kuma → ntfy + Slack~~ ✅ **DONE 2026-07-29** — slug `cloudless`, 12 monitors (`scripts/kuma-bootstrap.cjs`), ntfy + `POST /api/webhooks/kuma` on `cloudless-app` (Bearer `ADMIN_ALERT_SECRET`); legacy `kuma-slack-bridge` scaled to 0. Also Phase 0.
- [x] ~~🤖 🟣 **R19** Monthly failover drill~~ ✅ **SHIPPED** — `.github/workflows/failover-drill.yml` (monthly + workflow_dispatch primary/secondary health probes).

---

## Phase 5 — When time permits (lower priority)

- [x] ~~🤖 🟠 **R16** AppFlowy WAL-G → **Cloudflare R2**~~ ✅ **SHIPPED 2026-07-29** — `infrastructure/appflowy/walg-sidecar.yaml` + live `appflowy-walg-r2` / daily basebackup CronJob (S3 design superseded).
- [x] ~~🤖 🔵 **R23** Resend pilot on order-confirmation~~ ✅ **SHIPPED** — `src/lib/email-resend.ts` + `sendOrderConfirmation` prefers Resend when configured, SES fallback.
- [x] ~~🤖 🔵 **R24** Route 53 + secondary-region Lambda + DDB Global Tables~~ ✅ **DEFERRED 2026-07-29 (legacy)** — manifests retained under `infrastructure/r24-dr/`; prefer Tunnel HA + R2 + R19 drill.
- [x] ~~🤖 🟣 **R20** Postgres logical replication subscriber on AWS~~ ✅ **DEFERRED 2026-07-29 (legacy)** — manifests retained under `infrastructure/r20-replication/`; prefer R16→R2 WAL + `scripts/etl/appflowy-to-r2.mjs`.

---

## Phase 6 — LinkedIn CAPI finalization

Closes the half-done CAPI work from `project_linkedin_capi_source_bound` memory.

- [x] ~~🤖 🔵 Verify `li_fat_id` capture~~ ✅ **SHIPPED** — thanks page forwards `li_fat_id` through conversion route → runtime → LinkedIn adapter.
- [x] ~~👤 🔵 Provision LinkedIn CAPI-typed conversion ID~~ ✅ **SHIPPED in config** — `capiConversionId` set in `src/data/campaigns.ts` (operator-created `CONVERSIONS_API` conversion).
- [x] ~~🤖 🔵 Wire `eventId` dedup between Insight Tag + CAPI~~ ✅ **SHIPPED** — shared `orderId`/`eventId` in `ThanksConversion` + `dispatchConversion`.

---

## Phase 7 — Lifestyle changes (no PRs, just cadence)

Tracking scaffold: `.github/ISSUE_TEMPLATE/ops-cadence.yml` (checklist marks
tracking DONE). Checkboxes below stay open as **recurring operator work**.

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
- ✅ **Phase 1:** `/admin/cost` Athena-backed panel (R12) — live
- ✅ **Phase 3:** AI semantic-search funnel analytics (query → result → click) — **D1** `search_funnel_events` + `/api/admin/analytics/search-funnel` (buy hook typed; wire at checkout next)
- ✅ **Phase 3:** AI recommendation A/B vs no-rec baseline — `store-recommendations` flag + `RecommendationGrid` holdout + funnel `ab_variant`

### Customer-facing data features

- ✅ **Phase 3:** Product recommendations engine (R21c) — API + PDP related + store `trending`; user-personalized homepage signals still light
- ✅ **Phase 3:** Semantic search box on `/store` (R21b) — `StoreGrid` debounces to `/api/search` (Meili/Bedrock with local keyword fallback)
- ✅ **Phase 3:** AI-generated product descriptions (R21d) — API + CLI + `/admin/product-descriptions` approve UI

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
- `docs/session-summary-2026-06-21.md` — previous session (R7-R9 + R10-R14)
- `docs/session-summary-2026-06-22.md` — this session (workflows + R13/R18)
