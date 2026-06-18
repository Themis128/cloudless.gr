/**
 * Campaign definitions for paid-acquisition landing pages.
 *
 * Each campaign maps to a route under `/[locale]/campaigns/<slug>/`.
 * Tiers define the three CTAs shown on the landing page. The `checkoutHref`
 * for each tier currently points at a stub query on `/api/checkout` — wire it
 * to your real Stripe checkout session creator and set its `success_url` to
 *   /<locale>/campaigns/<slug>/thanks?tier=<tier.id>&order=<stripe_id>
 * so the LinkedIn conversion fires on the thanks page.
 *
 * `linkedinConversionId` is the numeric conversion ID issued by LinkedIn
 * Campaign Manager on the Conversion Tracking step (alongside the partner ID
 * that lives in `NEXT_PUBLIC_LINKEDIN_PARTNER_ID`). Set to `null` to skip
 * conversion firing for that campaign while the value is pending.
 */

export type CampaignSlug = "shop-online";

export interface CampaignTier {
  /** URL-safe ID — appears in `?tier=…` query string. */
  id: string;
  /** Display name on the landing-page card. */
  name: string;
  /** Headline number on the card, e.g. "€990 one-off". */
  priceLabel: string;
  /** Short one-liner under the price. */
  blurb: string;
  /** What's included — kept terse, max ~6 bullets renders cleanly. */
  bullets: string[];
  /** Stripe-bound checkout URL. Stub until wired. */
  checkoutHref: string;
  /** Highlight the middle card visually. */
  recommended?: boolean;
}

export interface Campaign {
  slug: CampaignSlug;
  /** SEO + hero title. */
  title: string;
  /** SEO description + hero subtitle. */
  description: string;
  /** Three tiers — the landing page hard-codes a 3-column grid. */
  tiers: [CampaignTier, CampaignTier, CampaignTier];
  /** LinkedIn Campaign Manager numeric conversion ID. `null` = not yet set. */
  linkedinConversionId: number | null;
}

export const campaigns: Record<CampaignSlug, Campaign> = {
  "shop-online": {
    slug: "shop-online",
    title: "Launch your online store",
    description:
      "Turnkey ecommerce on Stripe + a Next.js storefront. Pick the tier that matches where you are — we ship the rest.",
    tiers: [
      {
        id: "starter",
        name: "Starter",
        priceLabel: "€990 one-off",
        blurb: "Sell your first 10 products this month.",
        bullets: [
          "Branded Next.js storefront",
          "Stripe Checkout integration",
          "Up to 10 products configured",
          "1-page legal + cookie banner",
          "DNS, SSL, deploy on Cloudflare",
        ],
        checkoutHref: "/api/checkout?campaign=shop-online&tier=starter",
      },
      {
        id: "growth",
        name: "Growth",
        priceLabel: "€2 490 one-off + €49/mo",
        blurb: "Everything in Starter, plus the muscle to scale.",
        bullets: [
          "Up to 100 products + variants",
          "Inventory + order admin",
          "Email receipts + abandoned-cart",
          "Google Analytics + Meta Pixel",
          "30 days of post-launch support",
        ],
        checkoutHref: "/api/checkout?campaign=shop-online&tier=growth",
        recommended: true,
      },
      {
        id: "scale",
        name: "Scale",
        priceLabel: "From €5 900 + €149/mo",
        blurb: "Custom catalogue, subscriptions, multi-currency.",
        bullets: [
          "Unlimited products + collections",
          "Stripe Subscriptions + Customer Portal",
          "Multi-currency + EU VAT handling",
          "Headless CMS for content team",
          "90 days of post-launch support",
        ],
        checkoutHref: "/api/checkout?campaign=shop-online&tier=scale",
      },
    ],
    linkedinConversionId: null,
  },
};

export function getCampaign(slug: CampaignSlug): Campaign {
  return campaigns[slug];
}
