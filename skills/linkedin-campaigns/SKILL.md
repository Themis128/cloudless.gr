---
name: linkedin-campaigns
description: |
  Author and operate LinkedIn paid-acquisition campaigns on cloudless.gr —
  add a new campaign + landing page, wire its three tiers to Stripe checkout,
  set the Insight Tag partner ID, attach a conversion ID, and dual-fire the
  conversion (browser Insight Tag + server Conversions API). Triggered by
  "add a LinkedIn campaign", "wire LinkedIn conversion", "new landing page
  for paid", "shop-online tier", "lintrk", "Insight Tag", "LinkedIn CAPI",
  "Campaign Manager", or any change under `src/data/campaigns.ts` or
  `src/app/[locale]/campaigns/**`.
---

# LinkedIn campaigns toolkit

cloudless.gr ships paid-acquisition landing pages under
`/<locale>/campaigns/<slug>/` with a matching `/thanks` page that fires the
LinkedIn conversion. The pieces live in three places:

| Piece                          | Path                                                     | Role                                                                                  |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Campaign metadata              | `src/data/campaigns.ts`                                  | Slug, tiers (3), checkoutHref, conversion ID                                          |
| Landing page                   | `src/app/[locale]/campaigns/<slug>/page.tsx`             | 3-tier grid, CTAs hit `checkoutHref`                                                  |
| Thanks page                    | `src/app/[locale]/campaigns/<slug>/thanks/page.tsx`      | Renders confirmation + mounts `ThanksConversion`                                      |
| Browser conversion             | `src/app/[locale]/campaigns/<slug>/thanks/ThanksConversion.tsx` | Fires `lintrk("track", { conversion_id })` exactly once                          |
| Server conversion (CAPI)       | `src/app/api/campaigns/conversion/route.ts`              | Mirrors the event to `/rest/conversionEvents` for dedup-safe attribution              |
| Insight Tag loader             | `src/components/LinkedInInsightTag.tsx`                  | Consent-gated, mounted by `src/app/[locale]/layout.tsx`                               |
| Checkout adapter               | `src/app/api/checkout/route.ts` (GET branch)             | Resolves campaign+tier → Stripe session OR stub redirect to thanks                    |

## Operating principles

1. **Insight Tag is consent-gated.** It mirrors `ConsentGatedPixel`: nothing
   loads until the visitor accepts marketing cookies. No inline `<script>` —
   the LinkedIn loader is appended by URL so the CSP nonce isn't needed.
2. **Dual-fire the conversion.** The browser Insight Tag fires it; the
   `/api/campaigns/conversion` route also pings LinkedIn's Conversions API.
   LinkedIn dedups via `eventId` — when `orderId` is supplied (Stripe session
   ID) the two fires collapse to one counted conversion.
3. **Partner ID is `NEXT_PUBLIC_*`, CAPI token is server-only.** The partner
   ID is baked into the client bundle at build time; the CAPI token (Bearer)
   must never leak to the browser.
4. **Campaign data is static.** `src/data/campaigns.ts` ships in the bundle
   — no CMS, no runtime fetch on the landing page. Edits flow through CI.
5. **`/<locale>/` prefix is mandatory.** Use `@/i18n/navigation`; any
   `next/link` import on a campaign page is a bug (see CLAUDE.md
   "Locale-Aware Navigation").

## Add a new campaign in 6 steps

1. **Pick a slug.** URL-safe, lowercase, hyphenated (`shop-online`,
   `cloud-migration`, `data-stack-audit`). Update `CampaignSlug` in
   `src/data/campaigns.ts`.
2. **Define 3 tiers** under `campaigns[slug].tiers`. Each tier needs `id`,
   `name`, `priceLabel`, `blurb`, `bullets` (≤ 6), `checkoutHref` (start
   with the stub `/api/checkout?campaign=<slug>&tier=<id>`), and optionally
   `recommended: true` on the middle card.
3. **Copy the landing page**: `src/app/[locale]/campaigns/shop-online/` →
   `…/<slug>/`. Replace `getCampaign("shop-online")` with the new slug.
4. **Copy the thanks page**: same folder pattern, change the slug.
5. **Wire the conversion ID** in Campaign Manager → Conversions, paste the
   numeric ID into `campaign.linkedinConversionId`. Until then leave it as
   `null` — the browser fire becomes a no-op.
6. **Replace the stub** in `src/app/api/checkout/route.ts` `GET` branch
   with a real `stripe.checkout.sessions.create({...})`. Keep
   `success_url` = `/<locale>/campaigns/<slug>/thanks?tier=<id>&order={CHECKOUT_SESSION_ID}`.

## Required env

| Variable                          | Where        | Purpose                                                       |
| --------------------------------- | ------------ | ------------------------------------------------------------- |
| `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` | client+build | LinkedIn Insight Tag partner ID (numeric)                     |
| `LINKEDIN_CAPI_ACCESS_TOKEN`      | server only  | Bearer for `https://api.linkedin.com/rest/conversionEvents`   |

When `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` is empty the `<LinkedInInsightTag />`
mount in `src/app/[locale]/layout.tsx` is skipped via a truthy check —
useful for local dev. When `LINKEDIN_CAPI_ACCESS_TOKEN` is empty the
conversion route returns 204 and the client-side fire still works.

## Operating notes / gotchas

- **CAPI version header.** The route pins `LinkedIn-Version: 202506`. Bump
  to the current month-year string when you upgrade — see Microsoft Learn,
  *LinkedIn Marketing API → versioning*.
- **`eventId` strategy.** Use the Stripe session ID. It's stable, unique,
  and idempotent if a visitor reloads the thanks page.
- **Dev/preview behavior.** When Stripe is not configured the GET branch of
  `/api/checkout` redirects to the thanks page with `order=stub-<ts>`. The
  Insight Tag still fires (gated on the `linkedinConversionId` being set),
  so end-to-end can be exercised before Stripe is live — only the CAPI ping
  will skip on lack of the access token.
- **`force-dynamic`.** The thanks page reads search params, so it sets
  `export const dynamic = "force-dynamic";`. Don't accidentally remove
  that — under ISR the conversion would fire only on the build-time URL.
- **Strict-mode double-mount guard.** `ThanksConversion` uses a `useRef`
  to guarantee one fire even in React 18 dev double-mount.
- **Index/noindex.** Landing pages are intentionally indexable (they often
  also rank for branded paid-search queries). Thanks pages are
  `robots: { index: false }` to keep them out of SERPs.

## Verification checklist before a campaign goes live

- `pnpm typecheck` and `pnpm test:unit -- campaigns` are green.
- `playwright test e2e/campaigns-shop-online.spec.ts` is green.
- Open `/en/campaigns/<slug>/` in an incognito window; accept marketing
  cookies; confirm `window._linkedin_data_partner_ids` is populated.
- Click a tier CTA; verify the redirect path matches
  `/<locale>/campaigns/<slug>/thanks?tier=…&order=…`.
- On the thanks page, DevTools → Network → filter `lintrk` — confirm a
  `pixel` ping with `conversionId` matches Campaign Manager.
- Server: tail Lambda logs for `LinkedIn CAPI error` — expect none.

## References

- LinkedIn Help: [Add the LinkedIn Insight Tag to your website](https://www.linkedin.com/help/lms/answer/a418880)
- LinkedIn Help: [LinkedIn Conversions API](https://www.linkedin.com/help/lms/answer/a1655394)
- Microsoft Learn: [Conversions API — GTM server-side implementation](https://learn.microsoft.com/en-us/linkedin/marketing/conversions/conversions-api-gtm-guide?view=li-lms-2026-05)
- GitHub: [phbernard/nextjs-linkedIn-insight-tag](https://github.com/phbernard/nextjs-linkedIn-insight-tag) — the pattern we mirror in `LinkedInInsightTag.tsx` (consent-gated, asynchronous loader, queueing stub).
- GitHub: [jelleklaver/react-linkedin-insight](https://github.com/jelleklaver/react-linkedin-insight) — reference for `lintrk()` queueing semantics.
