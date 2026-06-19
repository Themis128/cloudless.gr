---
name: linkedin-campaigns
description: |
  Author and operate LinkedIn paid-acquisition campaigns on cloudless.gr —
  add a new campaign to `src/data/campaigns.ts`, render it via the dynamic
  `/[locale]/campaigns/[slug]` route, wire its tiers to Stripe checkout,
  set the Insight Tag partner ID, and dual-fire the conversion (browser
  Insight Tag + server Conversions API). Triggered by "add a LinkedIn
  campaign", "wire LinkedIn conversion", "new landing page for paid",
  "shop-online tier", "lintrk", "Insight Tag", "LinkedIn CAPI", "Campaign
  Manager", or any change under `src/data/campaigns.ts`,
  `src/app/[locale]/campaigns/**`, or `src/app/api/campaigns/**`.
---

# LinkedIn campaigns toolkit

cloudless.gr ships paid-acquisition landing pages under
`/<locale>/campaigns/<slug>/` via a single dynamic route. Every campaign is
defined as one entry in `src/data/campaigns.ts`; no per-campaign React file
is needed.

## File map

| Piece                       | Path                                                            | Role                                                               |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Campaign metadata           | `src/data/campaigns.ts`                                         | Slug, tiers, FAQ, hero/og images, conversion ID, locale copy       |
| Campaign index              | `src/app/[locale]/campaigns/page.tsx`                           | EL/EN listing of all live campaigns                                |
| Single landing page         | `src/app/[locale]/campaigns/[slug]/page.tsx`                    | Hero + tier table + FAQ                                            |
| Thanks page                 | `src/app/[locale]/campaigns/[slug]/thanks/page.tsx`             | Confirmation copy + mounts ThanksConversion                        |
| Browser conversion (lintrk) | `src/app/[locale]/campaigns/[slug]/thanks/ThanksConversion.tsx` | Fires `lintrk("track", { conversion_id })` exactly once            |
| Server conversion (CAPI)    | `src/app/api/campaigns/conversion/route.ts`                     | Mirrors the event to LinkedIn `/rest/conversionEvents`             |
| Insight Tag loader          | `src/components/LinkedInInsightTag.tsx`                         | Consent-gated, mounted by `src/app/[locale]/layout.tsx`            |
| `lintrk()` helper           | `src/lib/linkedin-track.ts`                                     | Type-safe `trackLinkedInConversion(id)` call                       |
| Hero block                  | `src/components/CampaignHero.tsx`                               | Reusable headline + slots-remaining + proof image                  |
| 3-tier pricing table        | `src/components/TierTable.tsx`                                  | Reusable tier grid + CTAs                                          |
| Checkout adapter            | `src/app/api/checkout/route.ts` (GET branch)                    | Resolves campaign+tier → Stripe session OR stub redirect to thanks |

## Operating principles

1. **Insight Tag is consent-gated.** It mirrors `ConsentGatedPixel`: nothing
   loads until the visitor accepts marketing cookies. No inline `<script>` —
   the LinkedIn loader is appended by URL, so the strict CSP that
   `src/proxy.ts` sets does not need a nonce for it.
2. **Dual-fire the conversion.** The browser Insight Tag fires it via
   `lintrk("track", …)`; `/api/campaigns/conversion` also pings LinkedIn's
   Conversions API. LinkedIn dedupes via `eventId` — when `orderId` is the
   Stripe session ID the two fires collapse to one counted conversion.
3. **Partner ID is `NEXT_PUBLIC_*`, CAPI token is server-only.** The partner
   ID is baked into the client bundle at build time. The CAPI Bearer token
   must never leak to the browser.
4. **Campaign data is static.** `src/data/campaigns.ts` ships in the bundle
   — no CMS, no runtime fetch on the landing page. Edits flow through CI.
5. **`/<locale>/` prefix is mandatory.** Use `@/i18n/navigation`; any
   `next/link` import on a campaign page is a bug (see CLAUDE.md
   "Locale-Aware Navigation").
6. **EL + EN only for campaigns.** `CAMPAIGN_LOCALES` in
   `src/data/campaigns.ts` is `["el", "en"]`. The pages accept any global
   locale prefix and fall back to EN — but copy is authored in EL and EN.

## Add a new campaign in 5 steps

1. **Pick a slug.** URL-safe, lowercase, hyphenated (`shop-online`,
   `cloud-migration`, `data-stack-audit`).
2. **Append a `Campaign` object** to `src/data/campaigns.ts`. Required
   fields: `slug`, `status: "live"`, `startsAt`/`endsAt`, `tagline`,
   `headline`, `headlineAccent`, `subhead`, `heroImage`, `ogImage`, three
   `tiers` (each with EL+EN copy + `checkoutHref` stubbed to
   `/api/checkout?campaign=<slug>&tier=<id>`), `faq`, `utmCampaign`, and
   `linkedinConversionId: null`.
3. **Drop hero + og images** under `public/campaigns/<slug>-hero.png` and
   `public/campaigns/<slug>-ad-a.png` (1200×627 for og).
4. **Wire the conversion ID** in Campaign Manager → Conversions, paste the
   numeric ID into `linkedinConversionId`. Until then leave it as `null` —
   the browser fire becomes a no-op.
5. **Replace the stub** in `src/app/api/checkout/route.ts` GET branch with
   a real `stripe.checkout.sessions.create({...})`. Keep `success_url` =
   `/<locale>/campaigns/<slug>/thanks?tier=<id>&order={CHECKOUT_SESSION_ID}`.

No new React files are required — the dynamic `[slug]/page.tsx` and
`[slug]/thanks/page.tsx` render every campaign from the metadata.

## Required env

| Variable                          | Where        | Purpose                                                     |
| --------------------------------- | ------------ | ----------------------------------------------------------- |
| `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` | client+build | LinkedIn Insight Tag partner ID (numeric)                   |
| `LINKEDIN_CAPI_ACCESS_TOKEN`      | server only  | Bearer for `https://api.linkedin.com/rest/conversionEvents` |

When `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` is empty the `<LinkedInInsightTag />`
mount in `src/app/[locale]/layout.tsx` is skipped via a truthy check. When
`LINKEDIN_CAPI_ACCESS_TOKEN` is empty the conversion route returns 204 and
the client-side fire still works end-to-end.

## Operating notes / gotchas

- **CAPI version header.** The route pins `LinkedIn-Version: 202506`. Bump
  to the current month-year string when upgrading — see Microsoft Learn,
  _LinkedIn Marketing API → versioning_.
- **`eventId` strategy.** Use the Stripe Checkout session ID
  (`cs_test_…` / `cs_live_…`). Stable, unique, idempotent if reloaded.
- **`fit-call` is a valid tier.** The thanks-page copy branches on
  `tier=fit-call` to use lead-style language. The checkout GET branch also
  accepts it so a `/contact?topic=…` flow can redirect through here.
- **Dev/preview behavior.** When Stripe is not configured the GET branch
  of `/api/checkout` redirects to the thanks page with `order=stub-<ts>`.
  The Insight Tag still fires (gated on `linkedinConversionId` being set),
  so end-to-end can be exercised before Stripe is live — only the CAPI
  ping skips on lack of the access token.
- **`force-dynamic`.** The thanks page reads search params, so it sets
  `export const dynamic = "force-dynamic";`. Don't remove that — under ISR
  the conversion would fire only on the build-time URL.
- **Strict-mode double-mount guard.** `ThanksConversion` uses a `useRef`
  to guarantee one fire even in React 18 dev double-mount.
- **Index/noindex.** Landing pages are indexable when `status: "live"`
  (they often rank for branded paid-search queries). The `/campaigns`
  index and thanks pages are `noindex`.
- **`@/i18n/navigation`-incompatible URLs.** Tier CTAs point at
  `/api/checkout?…` which is an API path, not a Next.js route — they must
  be plain `<a>` so the locale prefix isn't injected. See `TierTable.tsx`.

## Verification checklist before a campaign goes live

- `pnpm typecheck` and `pnpm test:ci -- campaigns linkedin` are green.
- `pnpm test:e2e -- --grep campaigns-shop-online` is green.
- Open `/en/campaigns/<slug>/` in an incognito window; accept marketing
  cookies; confirm `window._linkedin_data_partner_ids` is populated.
- Click a tier CTA; verify the redirect path matches
  `/<locale>/campaigns/<slug>/thanks?tier=…&order=…`.
- On the thanks page, DevTools → Network → filter `lintrk` — confirm a
  `pixel` request to `px.ads.linkedin.com` carries the conversion ID.
- Server: tail Lambda logs for `LinkedIn CAPI error` — expect none.
- In Campaign Manager → Analyze → Conversions, the conversion's status
  switches from "Inactive" to "Active" within ~30 min of the first real
  purchase.

## Troubleshooting

If a campaign is paying for impressions but showing zero conversions in
Campaign Manager:

1. **Run the doctor first.** Don't blame the ad creative or the audience
   until tracking is proven healthy.

   ```bash
   bash scripts/linkedin-insight-doctor.sh --slug <campaign-slug> --locale el
   ```

   Full reference: `skills/linkedin-insight-doctor/SKILL.md`.

2. **Most common cause: `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` GitHub secret
   is unset or empty.** Webpack bakes it into the client bundle at build
   time as a literal string; an empty value makes the layout's truthy
   check skip the `<LinkedInInsightTag />` mount entirely.

3. **PRs touching campaign code trigger the ad-readiness check**
   (`.github/workflows/ad-readiness.yml`). The PR comment reports which
   secrets are present.

## References

- LinkedIn Help: [Add the LinkedIn Insight Tag to your website](https://www.linkedin.com/help/lms/answer/a418880)
- LinkedIn Help: [LinkedIn Conversions API](https://www.linkedin.com/help/lms/answer/a1655394)
- Microsoft Learn: [Conversions API — GTM server-side implementation](https://learn.microsoft.com/en-us/linkedin/marketing/conversions/conversions-api-gtm-guide?view=li-lms-2026-05)
- GitHub: [phbernard/nextjs-linkedIn-insight-tag](https://github.com/phbernard/nextjs-linkedIn-insight-tag)
- GitHub: [jelleklaver/react-linkedin-insight](https://github.com/jelleklaver/react-linkedin-insight)
