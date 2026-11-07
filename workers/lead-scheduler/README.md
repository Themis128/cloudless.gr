# lead-scheduler

Durable Objects powering funnel timing + consistency (paid plan feature).

## Objects

| Class          | Route                                                   | Purpose                                                                                                                                                                                |
| -------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LeadFollowup` | `/do/followup/<leadId>/enroll` `/unsubscribe` `/status` | Quiet-lead 24h/3d/7d cadence via `alarm()` — serverless version of the manifest follow-up. Dispatches through `DISPATCH_URL` (mail-outbound).                                          |
|                | `GET \| POST /u/<doId>/<hmac>`                          | Public signed unsubscribe — HMAC of the DO id under `SCHEDULER_TOKEN`. GET renders a confirmation page (prefetchers can't unsubscribe); POST unsubscribes — covers RFC 8058 one-click. |
| `BookingSlot`  | `/do/slot/<key>/hold?slot=..&ttl=..` `/release`         | Atomic slot holds for the /audit calendar — a hold succeeds exactly once until expiry/release. `ttl` is in seconds, must be `1..86400`, defaults to 900; anything else is a `400`.     |
| `WebhookDedup` | `/do/dedup/<key>/` `{eventId}`                          | 7-day TTL seen-cache — `firstSeen:false` on replays (Meta leads, Slack, Stripe). Expired keys are swept by a daily `alarm()`, so storage stays bounded.                                |

## Delivery semantics

- `enroll` is idempotent: re-enrolling a lead with an alarm already armed
  does **not** reschedule it, so duplicate form submits cannot postpone
  the cadence.
- `alarm()` only advances `step` after the dispatch returns `2xx`. A
  failed or unconfigured dispatch retries hourly up to 6 times, then the
  lead is **parked** (`parked:true`, `lastError` set) — not `done` — and
  a later `/enroll` resumes it at the same step with a fresh budget.
- `DISPATCH_URL` and `PUBLIC_BASE_URL` are both required: without the
  public origin there is no unsubscribe URL, and mail without one is
  non-compliant — the step defers via the same retry path instead of
  dispatching.
- After the awaited dispatch, the lead record is re-read before the next
  step is written — a concurrent `/unsubscribe` is never overwritten.
  `retryLater` does the same re-read so a failed dispatch can't resurrect
  a finished sequence either.
- Each step sends real copy (`STEP_BODIES` env, pipe-separated, `{name}`
  placeholder) plus an unsubscribe footer and `List-Unsubscribe` /
  `List-Unsubscribe-Post` headers built from `PUBLIC_BASE_URL`.
- `enroll` rejects missing/malformed emails with `400`.

## Setup

```bash
cd workers/lead-scheduler
wrangler secret put SCHEDULER_TOKEN
wrangler secret put DISPATCH_URL      # e.g. mail-outbound /send
wrangler secret put DISPATCH_TOKEN    # its MAIL_OUTBOUND_TOKEN
pnpm deploy
```

SocialAuto calls `enroll`/`unsubscribe` per quiet lead; the Postgres
nurture sweep remains the fallback/authoritative lane until proven.
