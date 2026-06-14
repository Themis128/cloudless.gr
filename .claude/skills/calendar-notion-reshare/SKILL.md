---
name: calendar-notion-reshare
description: Re-share the Calendar Notion DB (and other unshared databases) with the Cloudless.gr App integration after they were removed from its scope. Notion's public API does NOT expose share/connection management — this is strictly UI but covers verification and bulk handling.
when_to_use:
  - CLAUDE.md notes Notion DBs for case studies / testimonials / services / FAQs / **calendar** return 404 `object_not_found`
  - The notion-calendar.ts fix (commit `8983eb3`) now propagates these errors as 502, surfacing them to admin users
  - You need to grant a fresh integration access to existing databases
  - Connections appear to be in place but the integration still gets `object_not_found`
---

# Calendar Notion DB Re-share

After `8983eb3` (the calendar silent-data-loss fix), missing integration access on a Notion database now surfaces as a **502 Bad Gateway** to admin users (was previously a silent data loss). This skill restores access.

This is **UI-only**. Notion's public API has no `add_connection`, `share`, or `grant` endpoint. Notion's stance, quoted from their docs: *"A connection's capabilities will never supersede a user's"* — and there is no admin API to auto-attach a connection to resources.

## Affected databases (verify which are broken)

From CLAUDE.md ("E2E (Playwright) Conventions" section):
- Case studies
- Testimonials
- Services
- FAQs
- **Calendar** (the immediate one — `notion-calendar.ts` calls it)

Production code falls back gracefully on most of these (returning static fallback content). Calendar is the one that now 502s on writes.

## Pre-check — confirm which DBs are unshared

Before clicking anything, list the broken DBs:

```bash
# From the cloud session — fetch SSM-stored Notion token + DB IDs
NOTION_TOKEN=$(aws ssm get-parameter \
  --name /cloudless/production/NOTION_API_KEY \
  --with-decryption --region us-east-1 \
  --query 'Parameter.Value' --output text)

# Iterate over the DB IDs in SSM (path /cloudless/production/notion/*)
for DB_NAME in calendar case-studies testimonials services faqs; do
  DB_ID=$(aws ssm get-parameter \
    --name "/cloudless/production/notion/${DB_NAME}-db-id" \
    --query 'Parameter.Value' --output text 2>/dev/null || echo "MISSING")

  if [ "$DB_ID" = "MISSING" ]; then
    echo "  $DB_NAME: SSM key not set — skipping"
    continue
  fi

  RESP=$(curl -sS -H "Authorization: Bearer $NOTION_TOKEN" \
    -H "Notion-Version: 2022-06-28" \
    "https://api.notion.com/v1/databases/$DB_ID")
  CODE=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code', 'ok'))")

  if [ "$CODE" = "object_not_found" ]; then
    echo "  ❌ $DB_NAME ($DB_ID): unshared — needs re-share"
  elif [ "$CODE" = "ok" ]; then
    echo "  ✅ $DB_NAME ($DB_ID): healthy"
  else
    echo "  ⚠️  $DB_NAME ($DB_ID): $CODE"
  fi
done
```

## Re-share procedure (per DB)

For each broken DB:

### 1. Open the DB as a full page

In Notion, open the workspace. Search for the DB name (e.g. "Calendar") and open it. If it's inline-embedded in another page, click the `↗` icon to open it as a full page.

### 2. Open the Connections menu

1. Click the **`•••`** menu in the top-right
2. Hover over **Connections** (further down the menu, past "Add to Favorites" and "Page history")
3. The Connections submenu opens with a search field and the currently-connected integrations listed

### 3. Add the integration

1. In the search field, type **`Cloudless.gr App`** (the exact name of your integration as registered at `https://www.notion.so/my-integrations`)
2. Select it from the dropdown
3. A confirmation dialog appears: "Connect Cloudless.gr App to this database?" — click **Confirm**
4. The integration now appears in the connected list with its capability scope

### 4. Verify immediately

Run the pre-check above for just that DB:

```bash
NOTION_TOKEN=$(aws ssm get-parameter --name /cloudless/production/NOTION_API_KEY \
  --with-decryption --region us-east-1 --query 'Parameter.Value' --output text)

curl -sS -H "Authorization: Bearer $NOTION_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  "https://api.notion.com/v1/databases/$DB_ID" \
  | python3 -m json.tool | head -10
```

You should see the database metadata (title, properties, etc.), not `object_not_found`.

### 5. Test the production code path

For the Calendar specifically:

```bash
# Hit the create endpoint with a known-good payload
curl -sS -X POST "https://cloudless.gr/api/admin/calendar/create" \
  -H "Cookie: <admin-session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Re-share verification","date":"2026-06-15","platform":"linkedin","status":"draft"}'
```

Should return `201 { item: {...} }`, not `502 { error: "..." }`.

## Bulk re-share — Chrome MCP fallback

If you have many DBs to re-share, drive the Notion UI from a Chrome session via Claude in Chrome:

> Open `https://www.notion.so` in a new tab, log in if needed, then for each of these DB URLs in turn: open it, click ••• → Connections → add Cloudless.gr App.

The Notion UI is React-rendered (Web Fetch returns empty shells), so Claude in Chrome's DOM tools are the right path.

## Why the API can't do this

Per Notion's own documentation (verified against `developers.notion.com/reference` 2026-06):

- The `Authentication` section covers OAuth flow only — not granting access.
- The `Databases` section has `Retrieve / Query / Update / Create` — no `Share / Connect / Grant` endpoint.
- The workspace-admin endpoints (`Users.list`, `Search`) do not expose connection management.

This is by design: Notion wants every connection grant to be a deliberate human action so workspace admins can audit what each integration sees. The cost is automation isn't possible.

## Future-proofing

The `8983eb3` calendar fix means future un-shares surface as 502s in production immediately, instead of being hidden silent-data-loss bugs. If you see a 502 from `/api/admin/calendar/create`, the first place to check is whether the integration has been unshared from the calendar DB.

A weekly cron that runs the pre-check above and posts to Slack if any DB is `object_not_found` would catch silent un-shares before users do. The pattern is the same as `cloudflare-token-rotate.yml`'s daily smoketest — a few minutes of CI per day saves hours of debugging when a connection silently drops.

## See also

- CLAUDE.md "E2E (Playwright) Conventions" → Notion DB 404 notes
- `notion-calendar.ts` — the lib that surfaces these failures
- `src/app/api/admin/calendar/create/route.ts` — the route that now returns 502 instead of silent 201
- `esp32-notion-restore` skill — companion skill for the other Notion UI-only action
