# Agency platform backlog

Filter applied to [Cloudless Platform Assessment rev. 2](https://claude.ai/code/artifact/7c1b2cf7-4f30-449d-acad-32aff8c37109) (August 2026). Treat that artifact as a **backlog filter**, not a build plan.

**Scope:** Cloudless is an agency operating system (marketing + CRM + light delivery). Do not build general-purpose ERP (HR, payroll, inventory, warehouse).

**Production edge stays:** `cloudless.gr` → Worker `cloudless2` (proxy only) → Pi Tunnel → k3s Next.js. App secrets live on the Pi pod. Do not extract Next.js into a UI shell + extra Workers, and do not put app secrets on `cloudless2`.

Ignore assessment lines that still say “offload to Workers for 100K req/day.” New D1 tables and API routes go **in the Next app**.

Percentages in the artifact (~75% marketing, ~60% CRM, ~15% ERP) are a snapshot, not targets.

---

## Do now (this week)

| Status          | Item                                                                                            | Why                                                                                                       | Notes                                                                |
| --------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Done (this branch)** | Unified admin contact page `/admin/crm/[id]`                                             | Highest-leverage CRM gap: EspoCRM, Stripe, and D1 are already populated; nothing joins them               | Join by email. No new database.                                      |
| Todo            | Gate EspoCRM Opportunity create on lead score ≥ 65                                              | Contact form already scores leads and Slack already shows the score; every inbound currently opens a deal | Keep Slack + ActiveCampaign `enrollLeadInAutomation` for all inbound |
| Todo            | Delete residual `src/lib/notion-*.ts` adapters and Notion fallback in `src/lib/cms-provider.ts` | CMS is AppFlowy; do not revive Notion admin/webhooks                                                      | Orphan unit suites → `vitest.config.mts` `test.exclude` or delete    |
| Todo            | Attribution dashboard (2–3d)                                                                    | UTM / campaign data already lands on contact notes and EspoCRM description                                | Read-only admin view first                                           |

## Do next (after the contact page proves matching)

| Status | Item                                                  | Why                                                              | Notes                                                                       |
| ------ | ----------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Wait   | Customer Data Platform (new D1 + identity resolution) | 4–6 weeks. Only if join-by-email on `/admin/crm/[id]` is painful | Do not start four new D1 databases up front                                 |
| Wait   | Marketing automation beyond ActiveCampaign            | Phase 2 in the artifact                                          | Use existing AC automations until the contact page shows gaps               |
| Wait   | Invoicing                                             | Agency-only finance                                              | Prefer Stripe Invoicing API before a custom D1 ledger / `finance-db` Worker |
| Wait   | Projects + time tracking                              | Agency delivery, not ERP                                         | After invoicing has a real operator workflow                                |
| Wait   | EspoCRM D1 cache                                      | Latency, not a new CRM                                           | After Notion adapters are gone                                              |
| Wait   | Docs / contracts                                      | Phase 6                                                          | AppFlowy already hosts docs; do not add `docs-db` as a Worker               |
| Wait   | AI agents on Cloudflare Workers                       | Artifact Phase 7                                                 | Keep LangGraph / Bedrock on the Pi app path                                 |

## Explicitly out of scope

- HR, payroll, inventory, warehouse, manufacturing
- Finance Worker, `finance-db`, `project-db`, `docs-db` as separate services
- Rewriting the Next app into a BFF + extra Workers
- LangGraph on Cloudflare Workers
- Reviving Notion admin routes (`src/app/api/admin/notion/**`) or HubSpot surfaces

---

## Contact 360 — first slice

**Route:** `GET /api/admin/crm/contacts/[id]` (admin session)  
**Page:** `/[locale]/admin/crm/[id]`

Joins, all optional except EspoCRM contact:

1. EspoCRM Contact + related Opportunities, Cases, Notes
2. Stripe customer / checkout sessions / subscriptions by email
3. D1 `user` row by email
4. D1 `analytics_events` where `user_id` matches or `properties_json.email` matches

Matching is email-only. If that fails in production, _then_ consider a CDP.
