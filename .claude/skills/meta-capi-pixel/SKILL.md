---
name: meta-capi-pixel
description: Meta Pixel (browser) + Conversions API (server) for cloudless.gr — server-side conversion tracking with deduplicated browser events. Use when working with src/lib/meta-capi.ts, src/lib/meta-pixel.ts, or wiring conversion events into contact, signup, or Stripe webhook flows. Distinct from meta-marketing-api which is for ad-buying.
---

# Meta Pixel + Conversions API — cloudless.gr Skill

## Overview

This is the **conversion tracking** half of the Meta integration — separate
from `meta-marketing-api` (ad creation/management). The goal is high-quality
attribution by sending each event from BOTH the browser pixel and the server
CAPI, deduped by a shared `event_id`.

**Implementation:**
- `src/lib/meta-capi.ts` — server-side CAPI sender (`sendCapiEvent`, `sendLeadEvent`, etc.)
- `src/lib/meta-pixel.ts` — browser-side `trackPixelEvent`
- `meta-account-runbook.md` — phase-by-phase activation steps

**Status:** code is **staged but not wired**. Activated when:
1. Pixel exists in Events Manager → ID in `NEXT_PUBLIC_META_PIXEL_ID`.
2. CAPI access token generated → `META_CAPI_ACCESS_TOKEN`.
3. `<Script>` base init added to `src/app/layout.tsx` (Phase C.5 of runbook).
4. `sendLeadEvent` called from `src/app/api/contact/route.ts` after SES send (C.6).

The Instagram business account ID is currently **blocked by an unrelated ad
policy violation on portfolio 1558125105019725** — see `project_instagram_blocker.md`.
Pixel + CAPI do not depend on Instagram and can ship independently.

## Core principle — dedup by event_id

Meta dedupes a browser pixel event and a server CAPI event when:
- `event_name` matches (e.g. both send `Lead`)
- `event_id` matches **exactly**
- They arrive within ~24h of each other

Without dedup, every conversion is double-counted. The dedup architecture in
this app:

```
Server route handler:
  1. Generate ONE eventId (e.g. uuid or `lead-{timestamp}-{rand}`)
  2. Call sendLeadEvent({ eventId, email, ... }) — server -> CAPI
  3. Return eventId in the JSON response
Browser:
  4. On submit success, call trackPixelEvent("Lead", {...}, eventId)
```

The eventId MUST be generated server-side (or at least decided server-side)
so both sides agree. `generateEventId()` in `lib/meta-pixel.ts` is fine for
new generation; for purchases, prefer a deterministic key (Stripe payment
intent ID) so retries dedupe correctly.

## CAPI — server side

**Endpoint:** `POST https://graph.facebook.com/v19.0/{PIXEL_ID}/events`
**Auth:** `access_token` in the **request body** (NOT a header — keeps it
out of CloudWatch URL logs).

### Required env / SSM

```
NEXT_PUBLIC_META_PIXEL_ID    pixel ID (also used by browser)
META_CAPI_ACCESS_TOKEN       Generated in Events Manager -> Settings -> Conversions API
                             Store as SecureString in SSM
```

### Payload shape

```json
{
  "data": [{
    "event_name": "Lead",
    "event_time": 1714000000,
    "event_id": "lead-1714000000-abc123",
    "action_source": "website",
    "event_source_url": "https://cloudless.gr/contact",
    "user_data": {
      "em": ["sha256(lowercased trimmed email)"],
      "ph": ["sha256(digits-only phone)"],
      "fn": ["sha256(lowercased first name)"],
      "ln": ["sha256(lowercased last name)"],
      "country": ["sha256(iso2 lowercased)"],
      "ct": ["sha256(lowercased city)"],
      "client_ip_address": "1.2.3.4",
      "client_user_agent": "Mozilla/5.0 ...",
      "fbp": "_fbp cookie value",
      "fbc": "_fbc cookie or fbclid-derived"
    },
    "custom_data": {
      "value": 99.0,
      "currency": "EUR",
      "content_name": "..."
    }
  }],
  "access_token": "..."
}
```

### Hashing rules — STRICT

The `meta-capi.ts` helpers handle this; if writing new code, follow:

| Field | Normalize | Hash |
|---|---|---|
| `em` (email) | trim, lowercase | SHA-256 hex |
| `ph` (phone) | strip all non-digit chars (`+30 21 555 -> 3021555`) | SHA-256 hex |
| `fn`, `ln` | trim, lowercase | SHA-256 hex |
| `country` | ISO-3166-1 alpha-2 lowercase (`gr`, `us`) | SHA-256 hex |
| `ct` (city) | trim, lowercase | SHA-256 hex |
| `client_ip_address` | NOT hashed | raw |
| `client_user_agent` | NOT hashed | raw |
| `fbp`, `fbc` | NOT hashed | raw |

`em` / `ph` / `fn` / `ln` are arrays even when there's one value — Meta
allows multiple values per user (e.g. multiple emails).

### Standard events — typed wrappers

The lib exports typed wrappers per event. Use these instead of raw
`sendCapiEvent`:

| Function | Event | When to call |
|---|---|---|
| `sendLeadEvent` | `Lead` | Contact form / quote / consultation booking — qualified lead |
| `sendContactEvent` | `Contact` | Newsletter signup, lower-intent engagement |
| `sendPurchaseEvent` | `Purchase` | Stripe webhook on `payment_intent.succeeded`. Requires `value` + `currency` |

Other Meta standard events you may add:
`CompleteRegistration`, `InitiateCheckout`, `AddToCart`, `ViewContent`,
`Subscribe`, `Schedule`, `SubmitApplication`. Add a wrapper to `lib/meta-capi.ts`
rather than calling `sendCapiEvent` from a route.

### Where to call CAPI from

| Event | Call site | Notes |
|---|---|---|
| `Lead` | `src/app/api/contact/route.ts` after SES send succeeds | Skip on form errors |
| `Contact` | `src/app/api/subscribe/route.ts` after AC sync | Lower-intent than Lead |
| `Purchase` | `src/app/api/webhooks/stripe/route.ts` on `payment_intent.succeeded` | Use the PaymentIntent ID as `eventId` for natural dedup |
| `CompleteRegistration` | Cognito post-confirmation handler | Email is hashed in user_data |

### Failure handling

`sendCapiEvent` is **fire-and-forget by intent** but currently `await`-ed —
result type:
```ts
| { ok: true, eventsReceived }
| { ok: false, skipped: true, reason }   // not configured / no eventId
| { ok: false, status, error }            // network / API error
```

Never block the user response on CAPI. Either `void`-cast the call, or `await`
with a timeout (already 5s in the lib) and ignore non-ok results. Errors are
sent to Sentry with the `integration: meta-capi` tag.

## Pixel — browser side

**Init script** (added once to `src/app/layout.tsx`):

```html
<Script id="meta-pixel" strategy="afterInteractive">{`
  !function(f,b,e,v,n,t,s){...standard fbq snippet...}
  (window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${process.env.NEXT_PUBLIC_META_PIXEL_ID}');
  fbq('track', 'PageView');
`}</Script>
```

After the snippet runs, `window.fbq` is callable. `isPixelReady()` in
`lib/meta-pixel.ts` guards SSR + pre-load gracefully.

### Tracking

```ts
import { trackPixelEvent } from "@/lib/meta-pixel";

trackPixelEvent("Lead", {
  content_name: "Consultation form",
  value: 0,
  currency: "EUR",
}, eventId);  // eventId from server response — SAME as CAPI
```

The `{ eventID: ... }` option in `fbq("track", ...)` is the dedup key. Always
pass it when also sending via CAPI.

### Consent

If you add consent management, use `fbq("consent", "revoke")` to disable
the pixel and **also short-circuit `sendCapiEvent`** server-side using a
header/cookie passed from the client. The lib does not currently gate by
consent — wire that in `lib/meta-capi.ts` if/when consent UI ships.

## Test events

Events Manager has a **Test Events** tab. To route a CAPI call there:

```ts
sendCapiEvent("Lead", { eventId, email, customData: { ... } });
// Then in fetch body, append: test_event_code: "TEST12345"
```

Currently `sendCapiEvent` does not expose `test_event_code` — add a
parameter when first integrating, then remove the test code before shipping.

## Common gotchas

- **`access_token` in URL** = leaks to CloudWatch / proxy logs. Keep it in
  the body (already correct in lib).
- **`em` as a string instead of array** = silent reject, no `events_received`.
- **Forgetting to lowercase + trim before hashing** = no PII match, attribution
  drops. The `hashMaybe` helper handles it — use the helpers.
- **`event_time` in milliseconds** = silent fail. It's UNIX **seconds**.
- **Pixel without CAPI** = OK, drops attribution but works. **CAPI without
  the matching pixel event_id** = double-count on every conversion. Always pair.
- **Different `event_id`s on the two sides** = no dedup. Server generates,
  passes to client.
- **Graph API version**: lib pins `v19.0`. Bump cautiously — the `events`
  endpoint shape is stable but Meta deprecates versions on a 2-year cycle.

## Reference

- CAPI overview: https://developers.facebook.com/docs/marketing-api/conversions-api
- User data params: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
- Standard events: https://developers.facebook.com/docs/meta-pixel/reference
- Dedup: https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events
- App code: [src/lib/meta-capi.ts](src/lib/meta-capi.ts), [src/lib/meta-pixel.ts](src/lib/meta-pixel.ts)
- Activation runbook: [meta-account-runbook.md](meta-account-runbook.md)
