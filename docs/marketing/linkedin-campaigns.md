# LinkedIn Campaigns — Insight Tag + Conversions API

End-to-end implementation reference for the LinkedIn paid-acquisition stack on
`cloudless.gr`. Read this before adding a new campaign, rotating a token, or
debugging missing conversions in LinkedIn Campaign Manager.

For the agent-facing workflow (file paths, "add a new campaign in 6 steps",
operating notes) see [`skills/linkedin-campaigns/SKILL.md`](../../skills/linkedin-campaigns/SKILL.md).

## Architecture at a glance

```
┌──────────────────────────────────────────────────────────────────────┐
│ Browser                                                              │
│                                                                      │
│  /en/campaigns/shop-online                                           │
│       │                                                              │
│       │  Click "Choose Growth"                                       │
│       ▼                                                              │
│  GET /api/checkout?campaign=shop-online&tier=growth                  │
│       │                                                              │
│       │  Stripe wired:    302 → Stripe Checkout Session              │
│       │  Stripe unwired:  302 → /<locale>/.../thanks?tier=…&order=…  │
│       ▼                                                              │
│  /en/campaigns/shop-online/thanks?tier=growth&order=cs_test_…        │
│       │                                                              │
│       │  ThanksConversion mounts (client-only, fires ONCE)           │
│       │     ├── window.lintrk("track", { conversion_id })            │
│       │     └── fetch POST /api/campaigns/conversion                 │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Server (Next.js Lambda)                                              │
│                                                                      │
│  POST /api/campaigns/conversion                                      │
│       │                                                              │
│       │  Reads LINKEDIN_CAPI_ACCESS_TOKEN (server-only env)          │
│       │     • unset   → 204 No Content (client fire is enough)       │
│       │     • set     → POST https://api.linkedin.com/rest/          │
│       │                       conversionEvents                       │
│       │                                                              │
│       │  Headers: Authorization, LinkedIn-Version, X-Restli-…        │
│       │  Body:    { conversion (URN), conversionHappenedAt,          │
│       │             eventId (= Stripe session ID), requestMetadata } │
│       ▼                                                              │
│  LinkedIn Conversions API                                            │
│       │                                                              │
│       │  Dedups against the Insight Tag event by `eventId`.          │
│       │  Counts exactly one conversion per Stripe session.           │
└──────────────────────────────────────────────────────────────────────┘
```

## File map

| File                                                             | Purpose                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/components/LinkedInInsightTag.tsx`                          | Consent-gated Insight Tag loader. Mirrors `ConsentGatedPixel`.   |
| `src/lib/linkedin-track.ts`                                      | `trackLinkedInConversion(conversionId)` helper.                  |
| `src/data/campaigns.ts`                                          | Static campaign metadata (slug, tiers, conversion ID).           |
| `src/app/[locale]/campaigns/<slug>/page.tsx`                     | Landing page — 3 tiers + CTAs.                                   |
| `src/app/[locale]/campaigns/<slug>/thanks/page.tsx`              | Confirmation server component (`force-dynamic`).                 |
| `src/app/[locale]/campaigns/<slug>/thanks/ThanksConversion.tsx`  | Client component that dual-fires the conversion exactly once.    |
| `src/app/api/checkout/route.ts` (GET branch)                     | Campaign-aware Stripe adapter; stubs to thanks page until wired. |
| `src/app/api/campaigns/conversion/route.ts`                      | Server-side CAPI mirror.                                         |
| `__tests__/data/campaigns.test.ts`                               | Unit tests over the campaign metadata.                           |
| `__tests__/lib/linkedin-track.test.ts`                           | Unit tests over the `lintrk` helper.                             |
| `e2e/campaigns-shop-online.spec.ts`                              | Playwright spec covering the full flow.                          |

## Env vars

| Variable                          | Visibility  | Required? | Set in                                                                 |
| --------------------------------- | ----------- | --------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` | Client      | Yes       | `.env.local`, GitHub Secrets (CI), SST stage (`production`/`staging`)  |
| `LINKEDIN_CAPI_ACCESS_TOKEN`      | Server-only | Optional  | SSM Parameter Store (preferred), or env at deploy time                 |

The partner ID is **baked into the client bundle at build time** because Next.js
inlines `NEXT_PUBLIC_*` at compile. Changes require a rebuild — they do NOT
flow through SSM at runtime (see `CLAUDE.md`, *"NEXT_PUBLIC_* vars"*).

The CAPI token is a **server-only secret** — it grants
`r_marketing_leadgen_automation` against the LinkedIn API. Treat it like a
Stripe secret key: SSM Parameter Store (`/cloudless/prod/linkedin/capi-token`)
with a 90-day rotation calendar, and never log it.

## Why dual-fire (Insight Tag + CAPI)?

LinkedIn rolled CAPI out alongside the Insight Tag for the same reason Meta
rolled out the Conversions API: browser-only tracking misses ~15-25% of
conversions due to ad-blockers, ITP, and consent walls. The CAPI fire is the
server-side safety net.

LinkedIn deduplicates events that arrive via both channels when they share an
`eventId`. We use the Stripe Checkout session ID (`cs_test_…` / `cs_live_…`),
which is unique per purchase and survives page reloads — so a customer who
reloads `/thanks` once does not generate a phantom second conversion.

## Versioning

LinkedIn pins API versions at the month-year level. The route currently sends
`LinkedIn-Version: 202506`. Bump this **and** confirm the request body shape
hasn't changed when you upgrade:
<https://learn.microsoft.com/en-us/linkedin/marketing/versioning>.

## Adding a new campaign

See [`skills/linkedin-campaigns/SKILL.md`](../../skills/linkedin-campaigns/SKILL.md)
for the 6-step recipe. Quick version:

1. New slug in `src/data/campaigns.ts` (extend the `CampaignSlug` type).
2. Define 3 tiers, leave `checkoutHref` pointing at the `/api/checkout` stub.
3. Copy the `shop-online/` landing + thanks pages, rename the slug.
4. Paste the LinkedIn conversion ID from Campaign Manager into the metadata.
5. Replace the stub branch in `/api/checkout`'s GET with a real Stripe session
   create; keep `success_url` shape identical.
6. Add a Playwright spec mirroring `campaigns-shop-online.spec.ts`.

## Verification

Before a campaign is announced:

```bash
pnpm typecheck
pnpm test:ci -- campaigns linkedin
pnpm test:e2e -- --grep campaigns-shop-online
```

In LinkedIn Campaign Manager → Analyze → Conversions, the conversion's status
should switch from "Inactive" to "Active" within ~30 minutes of the first
genuine purchase. If it stays "Inactive":

- Open `/en/campaigns/<slug>/` in an incognito window, accept marketing
  cookies, and confirm `window._linkedin_data_partner_ids` is populated.
- DevTools → Network → filter `lintrk` on the thanks page: expect a `pixel`
  request to `px.ads.linkedin.com` with the conversion ID in its query.
- Server side: tail Lambda logs for `LinkedIn CAPI error` — these surface
  expired/missing tokens (re-rotate via SSM and redeploy is not needed; the
  module-level cache reads SSM lazily — see `aws-ssm-config` skill).

## Out of scope

- **Offline conversions** (CRM-import retro events): the CAPI route is wired
  only for online events. To send offline conversions, add a second route or
  reuse the same payload with `conversionHappenedAt` in the past.
- **LinkedIn Lead Gen Form events**: handled via a separate webhook from
  LinkedIn — not covered by this stack.

## Sources

- LinkedIn Help: [Add the LinkedIn Insight Tag to your website](https://www.linkedin.com/help/lms/answer/a418880)
- LinkedIn Help: [LinkedIn Conversions API](https://www.linkedin.com/help/lms/answer/a1655394)
- LinkedIn Help: [Set up a Conversions API integration in Campaign Manager](https://www.linkedin.com/help/lms/answer/a1657171)
- Microsoft Learn: [Conversions API — GTM server-side implementation](https://learn.microsoft.com/en-us/linkedin/marketing/conversions/conversions-api-gtm-guide?view=li-lms-2026-05)
- GitHub: [phbernard/nextjs-linkedIn-insight-tag](https://github.com/phbernard/nextjs-linkedIn-insight-tag)
- GitHub: [jelleklaver/react-linkedin-insight](https://github.com/jelleklaver/react-linkedin-insight)
