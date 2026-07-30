# Notion integration re-share runbook

**Problem:** `case-studies`, `testimonials`, `services`, and `FAQs` Notion DBs
return `object_not_found` from the Notion API. Calls hit
`/api/notion/...` → fall through to static fallback content. The site
keeps working but those four sections stop reflecting Notion edits.

**Root cause (not a code bug):** Notion API access is **per-DB**, not
per-workspace. When a DB is duplicated, moved, or shared with new people,
Notion sometimes drops the integration's access. The `Cloudless.gr App`
integration silently loses read permission on that DB; every read returns
404 with `code: "object_not_found"` regardless of API key validity.

**Why this isn't auto-fixed:** Notion's Public API does not allow an
integration to grant itself access to a database — it has to be added
through the workspace owner's UI. Re-sharing is an operator action.

## Fix (one-time, ~3 minutes)

1. **Find what's broken.** From the repo root, run:

   ```bash
   node scripts/probe-notion-dbs.mjs
   ```

   This calls `GET /v1/databases/{id}` for all 13 configured DBs using the
   `NOTION_API_KEY` in SSM (`/cloudless/production/NOTION_API_KEY`) and
   prints a status table. Any row with `❌ 404 object_not_found` needs a
   re-share. Exit code is `1` when re-share is required, `0` when clean.

2. **Open Notion as the workspace owner** (`baltzakis.themis@gmail.com`):
   <https://www.notion.so/>

3. **For each failed database**, open the page (search by name —
   `Case Studies`, `Testimonials`, `Services`, `FAQs`), then:

   - Click **⋯** (top-right of the database).
   - Choose **Connections** → **Add connections**.
   - Pick **`Cloudless.gr App`** from the list.

   Notion shows a `Confirm` dialog with the integration's scopes. Confirm.

4. **Verify.** Re-run the probe — every row should now report `✅ 200`:

   ```bash
   node scripts/probe-notion-dbs.mjs
   ```

   Exit code `0` means the integration is now reading all 13 DBs.

5. **Cache.** Public pages cache Notion reads via ISR (`revalidate: 600`).
   The first request after re-share repopulates the cache; visitors see
   fresh content within ~10 minutes. Force-refresh by hitting
   `/api/admin/cache/purge?key=notion-case-studies` (and equivalents) if
   you need it sooner.

## Why we don't migrate off Notion

Considered and rejected on **2026-06-21** (memory note:
`project_appflowy_rejected`). AppFlowy Cloud is a viable
Notion-alternative on arm64 k3s, but the migration is a 7-pod deploy + a
fresh `src/lib/appflowy.ts` client + bidirectional content sync — multi-day
effort, multi-PR, multi-risk, for a problem this runbook fixes in 3
minutes per occurrence. The right time to revisit is when:

- AppFlowy hits 1.0 with rollups/formulas at parity with Notion,
- OR Notion's free-tier integration limits force the hand,
- OR re-share incidents become more frequent than once per quarter.

Until then, the static fallback + this runbook is the maintenance plan.

## When this fires

Schedule the probe as a daily check via the existing `pi-disk-cleanup`-
style systemd timer if re-share drift becomes a recurring annoyance, or
wire it into the weekly stack-health workflow. As of 2026-06-21 the
incidence rate is low enough that on-demand operator action is fine.

## Related

- `src/lib/integrations.ts` — env-var → SSM resolution for all 13 DB IDs.
- `src/lib/notion.ts` — shared client (`notionFetch`, `notionHeaders`).
- `src/lib/notion-cms.ts` (and siblings) — surface where the static
  fallback kicks in when Notion returns 404.
- `CLAUDE.md` → "E2E (Playwright) Conventions" — flags this same set of
  DBs as currently 404'ing, with the fallback noted.
