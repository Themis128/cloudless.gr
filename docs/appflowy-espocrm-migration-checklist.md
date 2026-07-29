# AppFlowy + EspoCRM Migration Checklist

This checklist tracks the production cutover from Notion to AppFlowy CMS and
the final semantic cleanup for EspoCRM.

## 1) Baseline and parity gates

- Run `pnpm cms:parity` against staging and production.
- Confirm these endpoints return non-empty payloads when content exists:
  - `/api/blog`, `/api/blog/posts`, `/api/docs`, `/api/docs/[slug]`
  - `/api/services`, `/api/faqs`, `/api/testimonials`
  - `/api/case-studies`, `/api/case-studies/[slug]`
- Keep fallback behavior valid:
  - AppFlowy unavailable/empty → Notion
  - Notion unavailable → static/empty fallback, no 500s

## 2) CMS runtime cutover (AppFlowy-first)

Public routes are dual-run:

- Blog: `src/lib/blog-source.ts` + blog API routes
- Docs: docs API routes via `appflowy-docs` / `notion-docs`
- Services / FAQs / Testimonials / Case studies: AppFlowy adapters with Notion fallback

AppFlowy page naming conventions:

| Domain | Page title prefix |
| --- | --- |
| Blog | `[Blog] <title>` (or `[Review]` for drafts) |
| Docs | `[Docs] <title>` |
| Services | `[Service] <name>` |
| FAQs | `[FAQ] <question>` |
| Testimonials | `[Testimonial] <name>` |
| Case studies | `[CaseStudy] <title>` |

Response headers:

- `x-blog-source: appflowy|notion|static`
- `x-cms-source: appflowy|notion|static`

## 3) Data migration

```bash
# Dry-run export mapping
node scripts/migrate-notion-to-appflowy.mjs --dry-run

# Live import (requires APPFLOWY_* + NOTION_API_KEY)
# Uses page_data on create (not /doc/:id — 404 on our AppFlowy build).
node scripts/migrate-notion-to-appflowy.mjs

# Backfill bodies for titled pages created without content
node scripts/backfill-appflowy-cms-bodies.mjs --dry-run
node scripts/backfill-appflowy-cms-bodies.mjs

# Parity probe against a running app (local dual-run server)
CMS_PARITY_BASE_URL=http://localhost:4000 CMS_PARITY_REQUIRE_APPFLOWY=1 pnpm cms:parity

# Production — Cloudflare bot challenge blocks anonymous cloudless.gr probes.
# Use the Fly HA proxy (bypasses the challenge) or an Access service token:
CMS_PARITY_BASE_URL=https://cloudless-proxy.fly.dev CMS_PARITY_REQUIRE_APPFLOWY=1 pnpm cms:parity

# Optional Access service token (when probing hosts behind Cloudflare Access):
CF_ACCESS_CLIENT_ID=… CF_ACCESS_CLIENT_SECRET=… \
  CMS_PARITY_BASE_URL=https://cloudless.gr CMS_PARITY_REQUIRE_APPFLOWY=1 pnpm cms:parity
```

Promote AppFlowy as primary only when parity counts/slugs match and public pages render correctly.

**Auth note:** `APPFLOWY_PASSWORD` must match k8s `appflowy-secrets` / `GOTRUE_ADMIN_PASSWORD` (not a stale longer `.env` value). Prefer LAN NodePort (`http://<omv-ip>:30810`) when `appflowy.cloudless.gr` returns a Cloudflare bot challenge.

**Prod config:** Lambda/Pi must have `APPFLOWY_API_URL`, `APPFLOWY_EMAIL`, `APPFLOWY_PASSWORD`, and `APPFLOWY_JWT_SECRET` from SSM (`/cloudless/production/APPFLOWY_*`). Without them the dual-run path falls back to Notion/static.

## 4) CRM semantic standardization

- Runtime CRM is EspoCRM (`src/lib/espocrm.ts`).
- Operator guidance must reference `ESPOCRM_API_KEY` / `ESPOCRM_BASE_URL`.
- `HUBSPOT_*` fields in SSM config are deprecated empty stubs for type compatibility only.
- Operator may delete leftover SSM keys:
  - `/cloudless/production/HUBSPOT_API_KEY`
  - `/cloudless/production/HUBSPOT_CLIENT_SECRET`

## 5) OMV stack health and hardening

```bash
pnpm omv:selfhosted:health
```

Source-of-truth manifests:

- `infrastructure/appflowy/k8s/appflowy.yaml`
- `infrastructure/espocrm/k8s/espocrm.yaml`
- tunnel fragments under `infrastructure/{appflowy,espocrm}/cloudflare-tunnel.yaml`

Backups:

- EspoCRM MariaDB: `infrastructure/espocrm/k8s/mariadb-xbstream-backup.yaml`
- AppFlowy Postgres/MinIO: see `docs/appflowy-deploy.md` + `infrastructure/appflowy/walg-sidecar.yaml` (PARTIAL)

## 6) Notion decommission readiness

After two successful release cycles with AppFlowy primary:

1. Stop writing new content to Notion DBs.
2. Keep Notion webhook/admin routes only as read-only fallback for one cooldown window.
3. Remove Notion production secrets from SSM after cooldown.
4. Archive Notion-only scripts/docs (`docs/NOTION-CMS.md` → historical).

## Exit criteria

- Public CMS routes prefer AppFlowy when configured and populated.
- CRM UI/API no longer require HubSpot semantics.
- AppFlowy + EspoCRM healthy on OMV (or Access-gated 403 from outside, 200 from cluster).
- `pnpm cms:parity` and unit/e2e suites pass.
