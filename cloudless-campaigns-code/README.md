# Cloudless Campaigns Hub — Drop-in Code

Adds a `/[locale]/campaigns` section to the cloudless.gr Next.js site. Hosts every paid-ad landing page in one place, with consistent conversion-tracking and a single LinkedIn Insight Tag.

## Why this exists

- **One URL pattern for every campaign.** `/el/campaigns/<slug>` and `/en/campaigns/<slug>`. Easy to track, easy to A/B test, easy to retire.
- **One Insight Tag installed once.** Lives in the root layout (`<head>`). All campaign pages and their thank-you pages inherit it.
- **One thanks-page template.** `/[locale]/campaigns/<slug>/thanks?tier=<id>` — the URL that fires the LinkedIn `Purchase` conversion. The `tier` query param is captured so LinkedIn (and any future analytics) can split by tier.
- **Campaign content lives in data, not components.** Drop a new entry into `data/campaigns.ts` and a new campaign goes live with no UI work.

## File layout

```
app/[locale]/campaigns/
  page.tsx                      # /el/campaigns  (index)
  [slug]/
    page.tsx                    # /el/campaigns/shop-online  (single)
    thanks/
      page.tsx                  # /el/campaigns/shop-online/thanks?tier=full-bundle
data/
  campaigns.ts                  # all campaigns defined here
components/
  LinkedInInsightTag.tsx        # add once to app/layout.tsx
  CampaignHero.tsx              # hero block
  TierTable.tsx                 # 3-tier pricing table
public/campaigns/
  shop-online-hero.png          # copy the digest mockup here
  shop-online-ad-a.png          # ad creative (used as og:image)
```

## Integration steps (5 minutes)

1. **Copy files** into your cloudless.gr Next.js repo, preserving paths (treat the project root as `cloudless-campaigns-code/`).
2. **Set the env var:** `NEXT_PUBLIC_LINKEDIN_PARTNER_ID=<your partner id>` in `.env.local`. LinkedIn Campaign Manager gives you this number on the "Conversion tracking" step of the ad-set wizard.
3. **Mount the tag** in `app/layout.tsx`:
   ```tsx
   import { LinkedInInsightTag } from "@/components/LinkedInInsightTag";
   // inside <body>, ideally at the top:
   <LinkedInInsightTag />
   ```
4. **Copy the two PNGs** into `public/campaigns/`:
   - `shop-insights-monday-digest-mockup.png` → `shop-online-hero.png`
   - `linkedin-ad-variant-a-creative.png` → `shop-online-ad-a.png`
5. **(Optional)** wire each tier's CTA to a real Stripe Checkout link. The current code stubs them as `/api/checkout?tier=...` — replace with your existing checkout flow (the store at `/el/store` already has one).

## Conversion mapping (LinkedIn → reality)

When you reach the **Conversion tracking** step in the Campaign Manager wizard, define this conversion event:

| Field | Value |
|---|---|
| **Conversion name** | `Shop Online — Tier purchased` |
| **Type** | Purchase |
| **Value** | €890 (any value is fine — LinkedIn just averages later) |
| **Attribution** | 30-day post-click, 7-day post-view |
| **How will this conversion happen?** | Page load |
| **URL match** | URL contains `/campaigns/shop-online/thanks` |

A second optional conversion (`Lead`) can be defined for the fit-call form using `/campaigns/shop-online/thanks?tier=fit-call`.

## i18n note

The pages assume a `[locale]` dynamic segment (e.g. `app/[locale]/...`) and a `locale` param of `el` or `en`. If your i18n is set up differently (e.g. `next-intl` middleware), the routes will still work — only the locale-detection inside the page needs swapping.
