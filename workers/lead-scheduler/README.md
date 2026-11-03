# lead-scheduler

Durable Objects powering funnel timing + consistency (paid plan feature).

## Objects

| Class | Route | Purpose |
|---|---|---|
| `LeadFollowup` | `/do/followup/<leadId>/enroll` `/unsubscribe` `/status` | Quiet-lead 24h/3d/7d cadence via `alarm()` — serverless version of the manifest follow-up. Dispatches through `DISPATCH_URL` (mail-outbound). |
| `BookingSlot` | `/do/slot/<key>/hold?slot=..&ttl=..` `/release` | Atomic slot holds for the /audit calendar — a hold succeeds exactly once until expiry/release. |
| `WebhookDedup` | `/do/dedup/<key>/` `{eventId}` | 7-day TTL seen-cache — `firstSeen:false` on replays (Meta leads, Slack, Stripe). |

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
