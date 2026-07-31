# Project Context

## What is Cloudless.gr?

Cloudless.gr is a **cloud consulting & DevOps agency** website built with Next.js 16, deployed on a self-hosted Pi k3s cluster with Cloudflare Workers as the edge proxy.

## Business Model

- **Services:** Cloud consulting, DevOps automation, infrastructure audits
- **Products:** Digital products sold via Stripe (store section)
- **Content:** Blog (Notion CMS), Documentation (Notion CMS)
- **Lead gen:** Contact form → EspoCRM + Slack + Notion + Email

## Key Business Rules

1. **All integrations are optional** — degrade gracefully with 503 or fallback data
2. **Fire-and-forget notifications** — contact form uses `Promise.allSettled` so email is never blocked by CRM/Slack failures
3. **Admin panel** is for internal use only — magenta accent to distinguish from user-facing cyan
4. **No .env files in production** — secrets come from Wrangler secrets (Workers) or SSM (k3s)

## Target Audience

- SMBs needing cloud migration/optimization
- Startups needing DevOps setup
- Enterprises needing infrastructure audits

## Current Focus Areas

- [x] AWS → Cloudflare migration (complete)
- [x] Pi k3s cluster operational (11 services)
- [x] Cloudflare Tunnel active
- [ ] Analytics stack (DuckDB + Metabase)
- [ ] Content marketing pipeline