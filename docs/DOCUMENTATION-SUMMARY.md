# Structured documentation summary

Inventory of operator docs for cloudless.gr (August 2026). Use with
[`roadmap/agency-platform-backlog.md`](roadmap/agency-platform-backlog.md) as a
**filter**: prefer `.cursor/rules/` and this checklist over older runbooks that
still describe AWS primary, Cognito, HubSpot, or Notion CMS.

Hub index: [`README.md`](README.md). Current production path:
`.cursor/rules/cloudless2-pi-proxy.mdc`.

---

## 1. Architecture (current)

| Source | Role |
| --- | --- |
| [`BUSINESS-LOGIC-REPORT.md`](BUSINESS-LOGIC-REPORT.md) | CRM, Stripe, analytics, AI, CMS, comms — corrected flows |
| `.cursor/rules/cloudless2-pi-proxy.mdc` | **Production edge** |
| `.cursor/rules/aws-to-cloudflare.mdc` | New infra → Cloudflare; no AWS CLI / new AWS SDK |
| `.cursor/rules/appflowy-cms.mdc` | CMS is AppFlowy; EspoCRM replaced HubSpot |
| `docs/cluster/TAILSCALE-FABRIC.md` | Tailscale admin fabric vs Cloudflare public HTTP |
| `docs/cluster/README.md` | Single-node k3s on `omv` |
| `docs/databases/landscape.md` | Engines per product |
| `docs/databases/ADR-001-mediated-db-access.md` | SQLTools / no public DB TCP |

**Edge (current):**

```
browser → cloudless.gr → Worker cloudless2 (reverse proxy only)
        → pi-origin.cloudless.gr (Tunnel)
        → k3s cloudless-app on omv (NodePort)
```

- `cloudless2` does not run Next.js and holds **no** app secrets.
- Header `x-served-by: pi-tunnel-proxy` = this path.
- Data plane: D1 `user-auth-db` + R2 `datalake-bucket`.
- Auth: D1 sessions. Cognito JWKS only if `NEXT_PUBLIC_AUTH_PROVIDER=cognito`.
- Config on Pi: D1 `app_config` + k8s secrets (`SSM_DISABLED=1`). Do not expand AWS SSM / Lambda / CloudFront / Athena.

**Cluster:** single-node `omv` (Pi 5, 8GB, 4K-page kernel). `omv-ha` is mail only
(not a k3s worker). Databases stay ClusterIP; use `kubectl port-forward`.
R2 is the off-box backup plane. One store per product domain.

**Treat as historical (do not operate from these):**

| Doc | Why |
| --- | --- |
| `docs/deploy/pi-cloud-sync.md` | Dual-homed SST AWS primary + APIGW→Pi secondary. Banner says historical; production is `cloudless2` → Tunnel → Pi |
| `docs/PAGES-DEPLOYMENT.md` / Amplify→Pages path | Public site is Pi via `cloudless2`, not Pages SSR |
| Skill refs to `docs/ARCHITECTURE.md`, `docs/CLOUDFLARE-ARCHITECTURE.md`, `docs/HA-ARCHITECTURE.md` | **Files do not exist** |

---

## 2. Deployment (current)

| Doc | Role |
| --- | --- |
| `docs/SAFEDEPLOY.md` | Atomic symlink + k3s rollout; last 5 releases; auto-rollback on deploy health fail |
| `docs/SAFEDEPLOY-WATCHDOG.md` | systemd every 2 min; alert ~6 min; auto-rollback ~16 min |
| `docs/deploy/deploy.md`, `docs/deploy/runners.md` | `deploy-pi.yml`; R2 artifact + `pi-release-pull.timer`; runner topology |
| `docs/deploy/ci-health-routine.md` | Weekly read-only workflow check |
| `docs/deploy/ROLLBACK-GUIDE.md` | Mix of Pi/D1 (use) and full AWS DNS/Cognito/DynamoDB (legacy) |
| `docs/deploy/configuration-checklist.md` | Stale in places (token scopes, Notion ESP32, Workers app secrets on `cloudless2`) |

SSH/rsync deploy is retired. Happy path: GitHub Actions → R2 → omv pull when load is OK.

---

## 3. Integrations (`docs/integrations/`)

| File | Current use |
| --- | --- |
| `STRIPE.md` | Checkout, webhooks, compliance — **current** |
| `SLACK.md` | Two-way Slack — **current** |
| `GSC.md` | ETL / cache; admin UI reads **gold** (see datalake reports) |
| `ACTIVECAMPAIGN.md` | Optional; 503 when unbound — **current** |
| `GOOGLE-CALENDAR.md` | Booking SA — **current** |
| `SENTRY.md`, `POSTIZ.md`, `NEWSLETTER.md` | **current** |
| `ANTHROPIC.md` | Chatbot + admin AI; still mentions `search_notion` — update to AppFlowy |
| `NOTION-CMS.md` | **Archive.** Live CMS is AppFlowy |
| `HUBSPOT.md` | **Misnamed / stale.** Code is `src/lib/espocrm.ts`; still documents `hubspot.ts` + `HUBSPOT_API_KEY` |
| `notion-integration-reshare.md` | Historical GSC/Notion DB share runbook |

EspoCRM operator truth: `infrastructure/espocrm/README.md` +
`skills/espocrm-operator/SKILL.md`. ETL writes **R2 parquet**, not S3.

---

## 4. Marketing (`docs/marketing/`)

| File | Role |
| --- | --- |
| `AGENCY-HUB.md` | Admin command center (Phases 2–10); Meta/Instagram still deferred |
| `MARKETING-HUB-SETUP.md` | Keys; 503 when absent |
| `linkedin-campaigns.md`, `meta-account-runbook.md` | Campaign ops |

`docs/roadmap/ROADMAP-ONE-STOP-SHOP.md` day-counts are a **2016-era plan
shape** — many items shipped (Postiz, pipeline, unified view). Do not restart
Phase 1 as a greenfield. Filter through the agency backlog instead.

---

## 5. Infrastructure

| Area | Docs |
| --- | --- |
| Mail | `docs/MAIL-SERVER-SETUP.md` — omv-ha dovecot + postfix/Resend + Roundcube; inbound CF Email Routing → Gmail |
| EspoCRM | `infrastructure/espocrm/README.md` — k3s, MariaDB, tunnel `espocrm.cloudless.gr` |
| Cluster | `docs/cluster/` — hw-list, capacity, overload, Prometheus/Grafana |
| Self-hosted | `docs/self-hosted/` — AppFlowy deploy + health audit |
| Pods | `docs/pods/` — per-workload READMEs (cloudless-app, cloudflared, AppFlowy, Espo, Postiz, n8n, monitoring, …) |

---

## 6. Always-apply rules (`.cursor/rules/`)

| Rule | Decision |
| --- | --- |
| `appflowy-cms.mdc` | AppFlowy CMS; no Notion admin APIs; EspoCRM not HubSpot |
| `aws-to-cloudflare.mdc` | Cloudflare for new infra; no `awscli` / new `@aws-sdk/*` |
| `cloudless2-pi-proxy.mdc` | Proxy-only Worker; secrets on Pi pod |
| `git-main-rebase.mdc` | Rebase onto `main`; squash-merge; never commit to `main` |

---

## 7. Roadmaps

| Doc | How to read |
| --- | --- |
| `docs/roadmap/agency-platform-backlog.md` | **Active filter** (CRM 360, lake, admin UI) |
| `docs/roadmap/ROADMAP-ONE-STOP-SHOP.md` | Historical phase plan — many items already live |
| `docs/roadmap/AGENTS_ROADMAP.md` | Phases 1–2 shipped; 2c still says `search_notion` |
| `docs/security/` | Plans / logs; do not reopen completed AWS-era items as new work |

---

## 8. Skills (`skills/`, 44 SKILL.md files)

Keep using: architecture, app-doctor, token-doctor, tunnel-ops, cluster-bash,
appflowy-operator, espocrm-operator, n8n/postiz/kuma operators, e2e-deep-triage,
linkedin-campaigns, contact-nlp, terraform-doctor.

AWS-migration skills are for **retiring** leftover AWS, not expanding it.
`omv-ha-memory-doctor` is mail-host memory now (omv-ha is not a k3s worker).

---

## 9. Other notable docs

| Folder | Notes |
| --- | --- |
| `docs/sessions/` | June–July 2026 session summaries |
| `docs/performance/` | Lighthouse |
| `docs/ai/` | Orchestration, NLP, local experiments |
| `docs/auth/` | **Cognito-era** — auth is D1; keep as archive |
| `docs/mcp/` | MCP rules / bridge |
| `docs/product/` | Design system, forms, tooling inventory |
| `docs/runbooks/` | Test accounts, WAF, operator blockers |
| `docs/data/` | Datalake hub + architecture + admin UI reports |
| `docs/archive/` | Explicitly superseded |

**Missing files** (linked from the architecture skill / CLAUDE.md):

`docs/ARCHITECTURE.md` / `ARCHITECTURE-MAP.md` are local gitignored
planning ledgers. The old names `CLOUDFLARE-ARCHITECTURE.md` /
`HA-ARCHITECTURE.md` still do not exist — do not recreate them as long essays.

---

## Doc hygiene (do not rewrite the world)

1. Point `HUBSPOT.md` / integrations README at EspoCRM; do not revive HubSpot.
2. Banner `NOTION-CMS.md` as archive; AppFlowy is live.
3. Banner `pi-cloud-sync.md` / Pages / Cognito auth docs as historical.
4. Fix EspoCRM README “ETL to S3” → R2.
5. Update `ANTHROPIC.md` / agents roadmap `search_notion` → AppFlowy.
6. Trim `configuration-checklist.md` Workers-secret list (`cloudless2` has none).
7. Keep new work on the agency backlog, not One-Stop-Shop day-counts.
