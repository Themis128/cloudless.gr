# Admin / ops leftovers — tooling map

**As of:** 2026-08-14  
**Context:** Post-502 recovery, admin service repairs, AppFlowy workspace recreate, PR [#1639](https://github.com/Themis128/cloudless.gr/pull/1639) (`8240be2c`).  
**Companion canvas:** Cursor canvas `admin-ops-leftovers` (checklist UI).

This file maps each leftover to **local skills**, **repo scripts/docs**, **GitHub workflows**, **MCP/tools**, and **online docs**. Prefer the listed skill/script before inventing a new path.

## Live snapshot (updated 2026-08-14 ~02:32 EEST — playbook executed)

| Signal | Value |
| --- | --- |
| HostPath / health | **`cec309465b98`** — `ok`, `dbConnected: true` |
| Homepage | `https://cloudless.gr/en` → **200** |
| Tip promote | PR [#1640](https://github.com/Themis128/cloudless.gr/pull/1640) fixed D1 bundling; `deploy-pi` promoted successfully |
| Prior tip `8240be2c` | Failed (`getAuthDbFromEnv()` null); rolled back; desired cleared mid-incident |
| Notion → AppFlowy | **Live migrate completed** (Blog/Docs/Tasks/GSC/Contact/… — see outcomes) |
| AI Gateway | `CLOUDFLARE_AI_GATEWAY_ID=default` set in `cloudless-secrets` |
| CF token rotate | Dry-run **success** (token id verified active); **apply not run** (needs operator) |

### Playbook outcomes (2026-08-14)

| ID | Result |
| --- | --- |
| deploy-lag | **Done** — live on `cec309465b98` with healthy D1 |
| notion-migrate | **Done** — migrate script finished (e.g. Contact 233, Site Analytics 1000, Tasks 72, KB 32, …) |
| hotpatch | **Done** — clean tip release; no chunk edits |
| ai-gateway | **Done (config)** — `default` wired; confirm `/api/admin/ai/status` when logged in |
| secret-rotate | **Partial** — dry-run OK; run `apply=true` only if exposure risk warrants |
| meta / tiktok / x-ads | **Still human** — Business Manager / OAuth / Ads API |
| activecampaign / turnstile / espo-queue | **Still optional** — need human-minted secrets / CF widget / Worker deploy |

---

## Quick index

| ID | Priority | Automatable? | Best first skill | Best first action |
| --- | --- | --- | --- | --- |
| [deploy-lag](#1-deploy-lag--promote--verify-health) | High | Mostly yes | `deploy-pipeline` + SafeDeploy docs | Confirm health/`dbConnected` on `8240be2c`; fix D1 if still degraded |
| [notion-migrate](#2-notion-migrate--notion--appflowy-content) | High | Semi | `appflowy-operator` | `node scripts/migrate-notion-to-appflowy.mjs --dry-run` |
| [meta](#3-meta--ad-account-disabled) | Medium | Human-only | `meta-business-help` | Business Support Home → Account Quality → appeal |
| [tiktok](#4-tiktok--oauth--advertiser) | Medium | Human OAuth + script | `integration-activation` | `pnpm tsx scripts/tiktok-oauth.ts` |
| [x-ads](#5-x-ads--oauth) | Medium | Human (Ads API gate) | `x-ads-api` | Apply Ads API access → `scripts/x-ads-setup.ts` |
| [activecampaign](#6-activecampaign--unset) | Low | Semi | `activecampaign` | Mint token → `activate-integration.sh set …` |
| [turnstile](#7-turnstile--unset) | Low | Human + env | (docs / CF dashboard) | Create widget → set site/secret keys |
| [ai-gateway](#8-ai-gateway--unset) | Low | Semi | `workers-ai` | Set `CLOUDFLARE_AI_GATEWAY_ID=default` (or create gateway) |
| [espo-queue](#9-espo-queue--unset) | Low | Semi | `espocrm-operator` + fanout README | Deploy `workers/espocrm-fanout` + Pi env |
| [secret-rotate](#10-secret-rotate--cf--orchestrator-tokens) | Medium | Semi | `cloudflare-token-rotation` | `gh workflow run cloudflare-token-rotate.yml` |
| [hotpatch](#11-hotpatch--cleared-by-promote) | Low | Side-effect of #1 | — | Likely cleared by `8240be2c` promote; re-check AppFlowy login |

---

## 1. deploy-lag — promote + verify health

**Status update:** Tip `8240be2c` **was promoted** via `deploy-pi.yml` → orchestrator → `pi-release-pull`. Leftover is no longer “never promoted”; it is **verify / stabilize** (`degraded`, `dbConnected: false`).

### Steps

1. Watch agent: `journalctl -t pi-release-pull -f` on omv.
2. Confirm health: `curl -sS https://pi-origin.cloudless.gr/api/health` (want `status: ok`, `dbConnected: true`, `version` starts with `8240be2c`).
3. If D1 still down: `scripts/restore-auth.sh` (project memory: login-500 / D1 token pin) + `skills/cloudless-app-doctor`.
4. Rollback if needed: `scripts/rollback.sh previous` / `scripts/rollback.sh --check`.

### Local skills

| Path | Role |
| --- | --- |
| `.claude/skills/deploy-pipeline/SKILL.md` | Pipeline / SHA drift (legacy SSM notes; still useful for GH Actions triage) |
| `.claude/skills/pi-image-rollout/SKILL.md` | Older ECR/`kubectl` path (secondary to R2 pull) |
| `skills/cloudless-app-doctor/SKILL.md` | Post-promote pod / health doctor |
| `skills/cluster-bash/SKILL.md` | SSH fanout when infra MCP available |

### Scripts / docs / workflows

- Agent: `infrastructure/omv/pi-release-pull.sh`, `install-pi-release-pull.sh`, `pi-release-pull.{service,timer}`
- Watchdog: `infrastructure/omv/safedeploy-watchdog.sh` + `docs/SAFEDEPLOY-WATCHDOG.md`
- Docs: `docs/SAFEDEPLOY.md`, `docs/deploy/runners.md`, `workers/pi-deploy-orchestrator/README.md`
- Workflow: `.github/workflows/deploy-pi.yml` (latest tip run **success** for `8240be2c`)
- Scripts: `scripts/rollback.sh`, `scripts/restore-auth.sh`

### MCP / tools

- Ideal: `user-cloudless-infra` (`cluster_run_command`, `k3s_get_pods`)
- Available: `user-cloudflare-bindings` / observability (R2 / Worker), `gh` for Actions
- SSH: `omv` via Tailscale

### Secrets / env

- GH var `PI_DEPLOY_ORCHESTRATOR_URL`; secret `DEPLOY_ORCHESTRATOR_TOKEN`
- omv `/etc/cloudless/pi-release-pull.env`: orchestrator URL/token, `LOAD1_MAX`, `IOWAIT_MAX_PCT`
- R2 upload: `CF_ACCOUNT_ID`, `CF_R2_ACCESS_KEY_ID`, `CF_R2_SECRET_ACCESS_KEY`; bucket `cloudless-pi-releases`

### Online

- Cloudflare R2 / Workers (orchestrator Worker) — use CF dashboard or Wrangler; no public “desired.json” UI

---

## 2. notion-migrate — Notion → AppFlowy content

**Priority:** High · **Semi-automated** (script + human review)

### Steps

1. Confirm workspace + folders exist (already seeded under General; workspace id in `APPFLOWY_WORKSPACE_ID`).
2. Dry-run: `node scripts/migrate-notion-to-appflowy.mjs --dry-run`
3. Live migrate; optional `scripts/backfill-appflowy-cms-bodies.mjs`
4. Parity: `CMS_PARITY_REQUIRE_APPFLOWY=1 pnpm cms:parity` (see AppFlowy checklist)

### Local skills

| Path | Role |
| --- | --- |
| `skills/appflowy-operator/SKILL.md` | Operate AppFlowy Cloud on k3s; import/migration ops |
| `.claude/skills/notion-databases/SKILL.md` | Source DB inventory |
| `.claude/skills/notion-page-blocks/SKILL.md` | Page/block export helpers |
| `.claude/skills/notion-database-management/SKILL.md` | Schema / share drift |

### Scripts / docs / workflows

- `scripts/migrate-notion-to-appflowy.mjs`
- `scripts/seed-appflowy-cms-folders.mjs` (folders already done)
- `scripts/backfill-appflowy-cms-bodies.mjs`, `scripts/appflowy-upload-md.mjs`
- Docs: `docs/self-hosted/appflowy-espocrm-migration-checklist.md`, `docs/appflowy-deploy.md`
- Workflows (ops/ETL, not migrate itself): `pi-appflowy-provision.yml`, `pi-appflowy-probe.yml`, `etl-appflowy-to-r2.yml`

### MCP / tools

- `user-notion` — export/verify Notion source
- AppFlowy UI: `https://appflowy.cloudless.gr`
- Cluster: infra MCP / SSH when needed

### Secrets / env

- `NOTION_API_KEY`
- `APPFLOWY_API_URL` / `APPFLOWY_BASE_URL`, `APPFLOWY_EMAIL`, `APPFLOWY_PASSWORD`, `APPFLOWY_WORKSPACE_ID`
- Optional parity: `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, `CMS_PARITY_BASE_URL`

### Online

- [AppFlowy Cloud](https://docs.appflowy.io/) (self-host / API behavior)
- Notion API: https://developers.notion.com/

---

## 3. meta — ad account DISABLED

**Priority:** Medium · **Human-only** (Business Manager). Code already surfaces DISABLED via integrations status (`account_status=2`).

### Steps

1. Open [Meta Business Support Home](https://business.facebook.com/business-support-home) / Account Quality.
2. Fix root cause (payment, policy, verification) **before** appealing.
3. Request review; do **not** create a second ad account while disabled (local skill + Meta recovery guidance).
4. Re-check `/admin/integrations` / Graph ping after reinstatement.

### Local skills

| Path | Role |
| --- | --- |
| `.claude/skills/meta-business-help/SKILL.md` | BM ops |
| `.claude/skills/meta-business-help/references/ad-account.md` | Disabled → Account Quality → appeal |
| `.claude/skills/meta-marketing-api/SKILL.md` | Marketing API |
| `.claude/skills/facebook-ads/SKILL.md` | Campaign ops |
| `.claude/skills/meta-capi-pixel/SKILL.md` | CAPI / Pixel |
| `skills/ad-analytics/SKILL.md` | Cross-channel ads analytics |

### Scripts / docs / workflows

- Status: `src/app/api/admin/integrations/status/route.ts` (`pingMeta`)
- Client: `src/lib/campaigns/meta-ads.ts`, `src/lib/meta-capi.ts`
- UI: `src/app/[locale]/admin/campaigns/meta/page.tsx`
- Sync: `.github/workflows/sync-campaign-ads-from-ssm.yml`, `sync-campaign-ads-pi-secrets.yml`
- Docs: `docs/marketing/AGENCY-HUB.md`, `docs/marketing/MARKETING-HUB-SETUP.md`

### MCP / tools

- Browser / Meta Business Manager (no Meta MCP in this workspace)
- Optional: `.claude/skills/chrome-browser-automation` for UI clicks (operator present)

### Secrets / env

- `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_CAPI_ACCESS_TOKEN`, `META_PAGE_ID`, `META_PIXEL_ID` / `NEXT_PUBLIC_META_PIXEL_ID`

### Online

- Business Support Home: https://business.facebook.com/business-support-home  
- Account Quality (legacy path, often 404): `https://business.facebook.com/business/accountquality`  
- Recovery pattern (2026): diagnose restricted asset → fix billing/policy → appeal as admin within ~180 days; avoid parallel accounts while appealing

---

## 4. tiktok — OAuth / advertiser

**Priority:** Medium · **Human OAuth** in browser; script/workflow after tokens exist

### Steps

1. `pnpm tsx scripts/tiktok-oauth.ts` (or prod callback `/api/admin/oauth/tiktok/callback`).
2. Persist `TIKTOK_ACCESS_TOKEN` + `TIKTOK_ADVERTISER_ID` (SSM / `cloudless-secrets`).
3. `./scripts/activate-integration.sh verify tiktok` then sync workflows if needed.

### Local skills

| Path | Role |
| --- | --- |
| `.claude/skills/integration-activation/SKILL.md` | Activate + verify integrations |
| `.claude/skills/tiktok-api/SKILL.md` | TikTok API notes |
| `skills/ad-analytics/SKILL.md` | Insights after wired |

### Scripts / docs / workflows

- `scripts/tiktok-oauth.ts`, `scripts/activate-integration.sh`
- `src/lib/campaigns/tiktok.ts`, admin TikTok pages + `src/app/api/admin/oauth/tiktok/callback/route.ts`
- Workflows: `sync-campaign-ads-from-ssm.yml`, `sync-campaign-ads-pi-secrets.yml`
- Docs: `docs/marketing/MARKETING-HUB-SETUP.md`, `docs/product/USE-CASES.md`

### MCP / tools

- TikTok for Business / developer portal (browser)
- `activate-integration.sh` via `cluster_run_command` when infra MCP is up

### Secrets / env

- App (may already exist): `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`
- Must complete: `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID`

### Online

- TikTok Marketing API / Business Center: https://business-api.tiktok.com/portal/docs

---

## 5. x-ads — OAuth

**Priority:** Medium · **Mostly human** — Ads API access must be approved at X first (`UNAUTHORIZED_CLIENT_APPLICATION` historically)

### Steps

1. Apply / confirm Ads API access at [developer.x.com](https://developer.x.com/).
2. `pnpm tsx scripts/x-ads-setup.ts` → copy `X_AD_ACCOUNT_ID`.
3. Set all five X keys; `./scripts/activate-integration.sh verify x`; sync to Pi.

### Local skills

| Path | Role |
| --- | --- |
| `.claude/skills/x-ads-api/SKILL.md` | Account ID + API paths |
| `.claude/skills/integration-activation/SKILL.md` | Verify + SSM set |
| `skills/ad-analytics/SKILL.md` | ROI channel after wired |

### Scripts / docs / workflows

- `scripts/x-ads-setup.ts`, `scripts/activate-integration.sh`
- `src/lib/campaigns/x-ads.ts`, admin `/admin/campaigns/x`
- Workflows: `sync-campaign-ads-*.yml`
- Docs: `docs/marketing/AGENCY-HUB.md`, `MARKETING-HUB-SETUP.md`

### MCP / tools

- developer.x.com / ads.x.com (browser)

### Secrets / env

- `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `X_AD_ACCOUNT_ID`

### Online

- X Ads API docs: https://developer.x.com/en/docs/x-ads-api

---

## 6. activecampaign — unset

**Priority:** Low (optional) · **Semi** — human mints token; activation script verifies

### Steps

1. AC → Settings → Developer → API URL + token (+ optional automation ID).
2. `./scripts/activate-integration.sh set ACTIVECAMPAIGN_API_URL '…'` (and token / lead automation).
3. Confirm `/admin/email` / integrations status (routes soft-200 when unbound).

### Local skills

| Path | Role |
| --- | --- |
| `.claude/skills/activecampaign/SKILL.md` | AC API + campaigns |
| `.claude/skills/integration-activation/SKILL.md` | set/verify |

### Scripts / docs / workflows

- `scripts/activate-integration.sh`, `scripts/save-secrets-to-cloudflare.sh`, `scripts/lib/cf-secrets.sh`
- Lib: `src/lib/activecampaign.ts`; routes under `src/app/api/admin/email/*`
- Docs: `docs/integrations/ACTIVECAMPAIGN.md`, `docs/marketing/AGENCY-HUB.md`
- No dedicated AC GitHub workflow

### MCP / tools

- ActiveCampaign UI for token mint  
- Skill mentions an AC MCP server historically — **not present** in current MCP catalog

### Secrets / env

- `ACTIVECAMPAIGN_API_URL`, `ACTIVECAMPAIGN_API_TOKEN`, `ACTIVECAMPAIGN_LEAD_AUTOMATION_ID`

### Online

- ActiveCampaign developer docs: https://developers.activecampaign.com/

---

## 7. turnstile — unset

**Priority:** Low (optional; app soft-allows when unset) · **Human** widget create + env wire

### Steps

1. Cloudflare dashboard → **Turnstile** → Add widget for `cloudless.gr` hostnames.
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` on Pi / build as required.
3. Confirm contact/register/newsletter + integrations / AI status surfaces.

### Local skills

- No dedicated Turnstile skill. Related: `.claude/skills/workers-ai/SKILL.md`, `skills/cloudflare-token-doctor/SKILL.md`

### Scripts / docs / workflows

- Lib/UI: `src/lib/turnstile.ts`, `src/components/TurnstileWidget.tsx`
- Docs: `docs/cloudflare/WORKERS_AI_SETUP.md` (operator table mentions Turnstile keys)
- Status: `src/app/api/admin/integrations/status/route.ts`, `src/app/api/admin/ai/status/route.ts`
- No Turnstile-specific workflow

### MCP / tools

- `user-cloudflare-docs` (search Turnstile)
- Cloudflare dashboard Turnstile page

### Secrets / env

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`

### Online

- Get started: https://developers.cloudflare.com/turnstile/get-started/  
- Dashboard widgets: https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/  
- Siteverify: `https://challenges.cloudflare.com/turnstile/v0/siteverify`

---

## 8. ai-gateway — unset

**Priority:** Low (optional) · **Semi** — create/use gateway id; set Pi env

### Steps

1. Cloudflare dashboard → **AI** → **AI Gateway** → Create, **or** use id `default` (auto-creates on first authenticated request).
2. Set `CLOUDFLARE_AI_GATEWAY_ID` on the Pi app env (often `default`).
3. Confirm via `src/lib/admin-ai-usage.ts` / `/api/admin/ai/status` (`aiGatewayConfigured`).

### Local skills

| Path | Role |
| --- | --- |
| `.claude/skills/workers-ai/SKILL.md` | Workers AI + gateway usage |
| `skills/sst-cloudflare-ai/SKILL.md` | SST / CF AI binding notes |
| `skills/wrangler-ai-search/SKILL.md` | Wrangler AI helpers |

### Scripts / docs / workflows

- Lib: `src/lib/workers-ai-client.ts`, `src/lib/admin-ai-usage.ts`
- Docs: `docs/cloudflare/WORKERS_AI_SETUP.md`, `docs/cloudflare/cloudflare-mcp-integration.md` (remote MCP URL `https://ai-gateway.mcp.cloudflare.com/mcp`)
- Scripts: `scripts/workers-ai-doctor.sh`
- Workflow: `.github/workflows/workers-ai-verify.yml`

### MCP / tools

- `user-cloudflare-docs` — AI Gateway get-started  
- Documented remote MCP: `cloudflare-ai-gateway` (see `docs/cloudflare/cloudflare-mcp-integration.md`)

### Secrets / env

- `CLOUDFLARE_AI_GATEWAY_ID` (optional)
- Related: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`

### Online

- Get started: https://developers.cloudflare.com/ai-gateway/get-started/  
- Default gateway auto-create: https://developers.cloudflare.com/ai-gateway/configuration/manage-gateway/#default-gateway  
- Dashboard deep-link: https://dash.cloudflare.com/?to=/:account/ai/ai-gateway

---

## 9. espo-queue — unset

**Priority:** Low (optional; sync fan-out can work without Queues) · **Semi**

### Steps

1. Deploy Worker: `cd workers/espocrm-fanout && wrangler secret put … && wrangler deploy`
2. Ensure queues `espocrm-events` / `espocrm-events-dlq` exist once.
3. Set Pi `ESPOCRM_QUEUE_PRODUCER_URL` + `ESPOCRM_QUEUE_PRODUCER_SECRET`.

### Local skills

| Path | Role |
| --- | --- |
| `skills/espocrm-operator/SKILL.md` | EspoCRM stack on k3s |

### Scripts / docs / workflows

- Worker: `workers/espocrm-fanout/README.md`, `workers/espocrm-fanout/src/index.ts`
- Lib/routes: `src/lib/espocrm-queue.ts`, `src/app/api/webhooks/espocrm/fanout/route.ts`
- Docs: `infrastructure/espocrm/README.md`, `docs/cloudflare/WORKERS_AI_SETUP.md` (Espo Queues row)
- No dedicated espo-queue GitHub workflow

### MCP / tools

- Wrangler + `user-cloudflare-bindings` (Workers / Queues where exposed)
- EspoCRM webhooks UI

### Secrets / env

- Worker: `ESPOCRM_QUEUE_PRODUCER_SECRET`, `ESPOCRM_FANOUT_CALLBACK_URL`
- Pi: `ESPOCRM_QUEUE_PRODUCER_URL`, `ESPOCRM_QUEUE_PRODUCER_SECRET`
- Related (already live): `ESPOCRM_BASE_URL`, `ESPOCRM_API_KEY`, `ESPOCRM_WEBHOOK_SECRET`

### Online

- Cloudflare Queues: https://developers.cloudflare.com/queues/

---

## 10. secret-rotate — CF / orchestrator tokens

**Priority:** Medium (if session/kubectl dumps may have leaked tokens) · **Semi**

### Steps

1. Dry-run: `gh workflow run cloudflare-token-rotate.yml --repo Themis128/cloudless.gr --ref main -f apply=false`
2. Apply: same with `-f apply=true` (requires `GH_PAT` for `gh secret set`).
3. Paste new `CLOUDFLARE_API_TOKEN` into Cowork/session secrets for MCP.
4. Separately rotate `DEPLOY_ORCHESTRATOR_TOKEN`: Wrangler Worker secret + GH secret + `/etc/cloudless/pi-release-pull.env`.

### Local skills

| Path | Role |
| --- | --- |
| `.claude/skills/cloudflare-token-rotation/SKILL.md` | Full rotation playbook |
| `skills/cloudflare-token-doctor/SKILL.md` | Diagnose dead/scoped tokens |
| `.claude/skills/workers-ai/SKILL.md` | Required Workers AI scopes |

### Scripts / docs / workflows

- Workflows: `cloudflare-token-rotate.yml`, `store-cloudflare-token.yml`, `verify-cloudflare-token.yml`, `workers-ai-verify.yml`
- Docs: `docs/cloudflare/*`, `workers/pi-deploy-orchestrator/README.md`

### MCP / tools

- `user-cloudflare-*` after token update
- Cloudflare dashboard token mint (doctor Path A)

### Secrets / env

- `CLOUDFLARE_API_TOKEN` (GH Actions + session + optionally Pi)
- `GH_PAT` (rotation workflow writer)
- `DEPLOY_ORCHESTRATOR_TOKEN` (Worker + GH + omv)
- Optional distinct: `CLOUDFLARE_GR_API_TOKEN` (zone-scoped)

### Online

- Create token: https://dash.cloudflare.com/profile/api-tokens  
- Token verify API: Cloudflare `/user/tokens/verify`

---

## 11. hotpatch — cleared by promote

**Priority:** Low · **Side-effect of #1**

Live release `27d4d14038aa` had manual GoTrue `?grant_type=password` edits under `.next` chunks. Promote to `8240be2c` (source fix already on main via PR #1639) replaces that tree.

### Steps

1. Confirm symlink/health version is `8240be2c…` (done in live snapshot).
2. Smoke AppFlowy autologin / CMS admin APIs without chunk edits.
3. No separate hotpatch tool — treat as deploy hygiene.

### Skills / docs

- Same as deploy-lag + `skills/appflowy-operator/SKILL.md`

---

## Cross-cutting MCP catalog (this workspace)

| Server | Useful for leftovers |
| --- | --- |
| `user-github` / `gh` CLI | PRs, `deploy-pi`, token-rotate workflows |
| `user-cloudflare-docs` | Turnstile, AI Gateway, Queues |
| `user-cloudflare-bindings` | R2 / D1 / Workers inventory |
| `user-cloudflare-observability` | Worker logs (orchestrator, fanout) |
| `user-notion` | Notion → AppFlowy migrate source |
| `user-cloudless-infra` | Cluster SSH/k3s (when session secrets set) |
| `plugin-slack-slack` | Notify after promote / migrate |
| `user-sentry` | Post-promote error triage |

---

## Suggested order of attack

1. **Stabilize `8240be2c`** — restore `dbConnected: true` (item 1 leftover).  
2. **Secret rotate** if any CF/orchestrator token was exposed in the session (item 10).  
3. **Notion → AppFlowy migrate** (item 2).  
4. **Meta Account Quality** (item 3) — human, start now (appeal clocks).  
5. **TikTok OAuth** then **X Ads API access** (items 4–5).  
6. Optional: Turnstile, AI Gateway, ActiveCampaign, Espo queue (items 6–9).

---

## Done earlier (not leftovers)

- Site 502 / recursive `pi-release-pull` rsync fixed (repo + omv).  
- AppFlowy/Postiz/Grafana/MQTT/D1 admin logins repaired.  
- AppFlowy workspace recreated with Folder collab; CMS folders seeded under General.  
- `APPFLOWY_WORKSPACE_ID` updated; PR #1639 merged to `main`.
