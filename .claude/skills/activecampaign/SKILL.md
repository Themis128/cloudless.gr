---
name: activecampaign
description: ActiveCampaign API v3 integration for cloudless.gr — contacts, lists, campaigns, automations, deals, and tags. Use when working with src/lib/activecampaign.ts, the activecampaign-mcp-server, or any /api/admin/email/* route.
---

# ActiveCampaign API v3 — cloudless.gr Skill

## Overview

cloudless.gr uses ActiveCampaign as the email marketing + lightweight CRM
backbone. The integration lives in:

- `src/lib/activecampaign.ts` — typed REST client (uses SSM config)
- `activecampaign-mcp-server/` — local MCP server exposing AC tools
- `src/app/api/admin/email/*` — admin routes (campaigns, lists, contacts, automations, stats)
- `docs/ACTIVECAMPAIGN.md` — setup notes

**Base URL:** `https://{account}.api-us1.com/api/3`
**Auth:** Header `Api-Token: {token}` (NOT `Authorization: Bearer ...`)
**Rate limit:** 5 requests/sec per account. Retry with backoff on 429.

## Config

Two SSM keys, both required:

```
ACTIVECAMPAIGN_API_URL    = https://{account}.api-us1.com   (no trailing slash)
ACTIVECAMPAIGN_API_TOKEN  = {api-token from Settings -> Developer}
```

`getACConfig()` in [src/lib/activecampaign.ts](src/lib/activecampaign.ts) reads
both via `getConfig()` (SSM-backed). Local dev reads from `.env.local`.

## Adding a new endpoint

Always extend `src/lib/activecampaign.ts` rather than calling AC from a route
directly — keeps token/URL handling, error swallowing, and SSM config in one
place.

```ts
async function acFetch(path: string, options: RequestInit = {}): Promise<Response>
```

The helper prepends `/api/3` and injects `Api-Token`. Pass paths starting with
`/`, e.g. `/contacts`, `/lists/123`, `/contactLists`.

## Endpoint cheatsheet

All paths are appended to `/api/3`.

### Contacts

| Method | Path | Notes |
|---|---|---|
| GET | `/contacts?limit=20&orders[cdate]=DESC` | List, paginated. `meta.total` for count |
| GET | `/contacts/{id}` | Single |
| GET | `/contacts?email={email}` | Lookup by email |
| POST | `/contacts` | Body: `{ contact: { email, firstName, lastName, phone } }` |
| POST | `/contact/sync` | **Upsert** by email — preferred for newsletter signup |
| PUT | `/contacts/{id}` | Update |
| DELETE | `/contacts/{id}` | Delete |

### Lists

| Method | Path | Notes |
|---|---|---|
| GET | `/lists?limit=100` | All lists |
| POST | `/lists` | Body: `{ list: { name, sender_url, sender_reminder } }` |
| POST | `/contactLists` | Subscribe contact to list. Body: `{ contactList: { list: id, contact: id, status: 1 } }` (status 1 = active, 2 = unsubscribed) |

### Campaigns

| Method | Path | Notes |
|---|---|---|
| GET | `/campaigns?limit=20&orders[sdate]=DESC` | List recent |
| GET | `/campaigns/{id}` | Single + stats |
| POST | `/campaigns` | Create. Status `0` = draft, `1` = scheduled (requires `sdate`) |

Create payload (matches `createCampaign` in lib):

```json
{
  "campaign": {
    "type": "single",
    "name": "Q2 Newsletter",
    "subject": "...",
    "fromname": "Cloudless",
    "fromemail": "hello@cloudless.gr",
    "status": "0",
    "htmlcontent": "...",
    "textcontent": "...",
    "sdate": "2026-05-01T10:00:00-05:00",
    "lists": [{ "id": "1" }]
  }
}
```

### Automations

| Method | Path | Notes |
|---|---|---|
| GET | `/automations?limit=50` | List |
| POST | `/contactAutomations` | Add contact to automation. Body: `{ contactAutomation: { contact: id, automation: id } }` |
| DELETE | `/contactAutomations/{id}` | Remove |

### Tags

| Method | Path | Notes |
|---|---|---|
| GET | `/tags?limit=100` | List all |
| POST | `/tags` | Body: `{ tag: { tag: "name", tagType: "contact" } }` |
| POST | `/contactTags` | Apply tag. Body: `{ contactTag: { contact: id, tag: id } }` |

### Deals (CRM)

| Method | Path | Notes |
|---|---|---|
| GET | `/deals?limit=50` | List |
| POST | `/deals` | Create. Required: `title`, `value` (cents), `currency`, `stage`, `owner` |
| PUT | `/deals/{id}` | Update |
| GET | `/dealStages` | Pipeline stages |

### Custom fields

| Method | Path | Notes |
|---|---|---|
| GET | `/fields` | Custom contact fields |
| POST | `/fieldValues` | Set value. Body: `{ fieldValue: { contact: id, field: id, value: "..." } }` |

## Patterns used in this app

### 1. Newsletter signup (use sync, not create)

`/contact/sync` upserts by email. Always use it for public-form signups so a
returning subscriber does not 409.

```ts
await acFetch("/contact/sync", {
  method: "POST",
  body: JSON.stringify({
    contact: { email, firstName, lastName }
  }),
});
```

After sync, subscribe to the list with `/contactLists` (status `1`).

### 2. Stats dashboard

`getEmailStats()` parallelises 3 calls and pulls `meta.total` from each. Avoid
fetching full collections just to count — use `limit=1` and read meta.

### 3. Error handling

Every function in `src/lib/activecampaign.ts` swallows errors and returns empty
arrays / null. The admin UI must always render — AC outages should not 500
the dashboard. Keep this pattern in new helpers.

### 4. Webhook signature

Inbound webhooks (if used) sign with the `Event-Key` header HMAC. Not
currently wired — add a `lib/activecampaign-verify.ts` if needed, mirroring
the pattern in `lib/slack-verify.ts`.

## Common gotchas

- **`Api-Token` is case-sensitive.** Not `Authorization`, not `X-API-Token`.
- **Trailing slash on URL breaks signing logic** — `getACConfig` strips it.
  Always strip before building paths.
- **IDs are strings**, not numbers. `meta.total` is also a string.
- **Status fields are stringified ints**: `"0"`, `"1"`, `"2"`. Don't compare
  to numbers.
- **List subscription is a separate call** from contact creation. `/contacts`
  alone does NOT add to a list.
- **Custom field values use `field` (singular)** in the body, not `fields`.
- **Account URL prefix is account-specific**: `youracct.api-us1.com`. Don't
  hardcode `api-us1` — the account region can differ.

## When to use the MCP server vs the lib

- **MCP server** (`activecampaign-mcp-server/`) — for Claude Code interactive
  exploration: "list my recent campaigns", "find contact by email". Read-leaning.
- **`src/lib/activecampaign.ts`** — for app code, admin dashboard, cron jobs.
  Always.

Never call the MCP from app code. Never inline `fetch` to AC from a route.

## Reference

- Official docs: https://developers.activecampaign.com/reference
- App code: [src/lib/activecampaign.ts](src/lib/activecampaign.ts)
- Setup notes: [docs/ACTIVECAMPAIGN.md](docs/ACTIVECAMPAIGN.md)
