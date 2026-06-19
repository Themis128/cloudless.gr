Phase 1 of the reusable ad-analytics Slack module (Notion: [📊 Architecture](https://app.notion.com/p/3837d82c410a81bfb560d517d9140138) + [✅ Build Tracker](https://app.notion.com/p/3837d82c410a81f9ab17f212493a4613)).

## What it does

- A real-time conversion on `/[locale]/campaigns/<slug>/thanks` now posts a Block Kit message to `#ads-realtime` within seconds — fed by `dispatchConversion()` (`src/lib/ad-analytics/runtime.ts`).
- The CAPI mirror to LinkedIn is now **gated on `capiConversionId != null`** so the existing 403 noise (conversion `26846068` is `EVENT_SPECIFIC_TAG`-typed — see the Gilgamesh source-bound finding) stops.
- New `LinkedInAdapter` and `SlackChannel` implement the Phase 0 interfaces (`AdPlatformAdapter`, `NotificationChannel`). Adding Meta / Google Ads / TikTok in the future = one new adapter file + one registry line.

## What it does NOT do (yet)

- Phase 2 — scheduled 15-min digest with demographic enrichment (industry / seniority / job-title pivots): planned per the Notion page §9 added this morning.
- Phase 3 — `/cloudless analytics` slash commands.
- Phase 4 — anomaly DMs.

## Files

| Layer | Path |
|---|---|
| Configuration | `src/data/campaigns.ts` — new optional `adPlatforms[] / notifyChannels[] / anomalyRules` fields. `shop-online` populated with `linkedin` platform (capi=null) + `#ads-realtime` channel. |
| LinkedIn adapter | `src/lib/ad-analytics/adapters/linkedin.ts` — `LinkedIn-Version: 202605`, `pushConversion()` returns `{ accepted, status, message }` instead of throwing on 403. |
| Slack channel | `src/lib/ad-analytics/channels/slack.ts` — wraps `SlackClient`, per-target instance cache. |
| Renderer | `src/lib/ad-analytics/digest.ts` — `renderConversionBlocks()` (Phase 2 will add `renderDigest()` to the same file). |
| Runtime | `src/lib/ad-analytics/runtime.ts` — `dispatchConversion()` orchestrator + adapter / channel registries + a `_setRegistries` test hook. |
| Route | `src/app/api/campaigns/conversion/route.ts` — delegates to the runtime; same wire format `ThanksConversion.tsx` already sends. Returns 204 when no platforms or channels are configured (preserves the legacy "browser tag is the system of record" behaviour). |

## Tests

8 new tests, 80 total in the touched suites — all green.

- `__tests__/ad-analytics/runtime.test.ts` (4):
  - Unknown campaign → noop.
  - `shop-online` fires Slack `#ads-realtime` with `tier`, `order`, and the creative variant in the body.
  - **Regression guard:** `capiConversionId: null` ⇒ adapter `pushConversion` is NOT called. Stops the 403s.
  - When a synthetic campaign with `capiConversionId: 99999999` is registered, the adapter receives the right `conversionId` and `eventId`.
- `__tests__/ad-analytics/linkedin-adapter.test.ts` (4):
  - POSTs to `/rest/conversionEvents` with `LinkedIn-Version: 202605` and correct URN.
  - 403 returns `{ accepted: false, status: 403, message }` and emits a single `warn` — never throws.
  - No token ⇒ `{ accepted: false, status: 204 }`, no fetch.
  - `LINKEDIN_CAPI_ACCESS_TOKEN` takes precedence over the shared `LINKEDIN_ACCESS_TOKEN`.

`pnpm typecheck` ok.

## Operator action items

- **Mint the CAPI-typed conversion** in Campaign Manager → Account assets → Conversions → "Create conversion" → **Conversion method: API**. Take the numeric ID and set it as `capiConversionId` on `shop-online` in `src/data/campaigns.ts`. Until that's done, the CAPI path stays skipped (no errors).
- After deploy, hit `https://cloudless.gr/en/campaigns/shop-online/thanks?tier=starter&order=cs_test_xyz&utm_source=linkedin&utm_content=A_EN` in a browser. A Block Kit message should land in `#ads-realtime` within a few seconds, containing tier, order ID, creative `A_EN` and the GR flag.
- The `#ads-realtime` Slack channel must exist and the Cloudless bot must be a member (or `SLACK_WEBHOOK_URL` must be set for the fallback path).

## How to plug a second platform

Three steps, no other code changes:

1. New file `src/lib/ad-analytics/adapters/meta.ts` implementing `AdPlatformAdapter`.
2. Register in `ADAPTERS` in `src/lib/ad-analytics/runtime.ts`.
3. Append `{ platform: "meta", … }` to the campaign's `adPlatforms[]`.

## Skill / docs

`skills/ad-analytics/SKILL.md` already documents the file map and operating principles — no edits needed for this phase. The Notion architecture doc was updated this morning with the click-level demographic enrichment plan for Phase 2.

Closes task #29.
