/**
 * Cloudless Campaigns — single source of truth.
 *
 * Add a new entry here to publish a new campaign page at
 * /[locale]/campaigns/<slug>.
 *
 * Conventions:
 * - `slug` is URL-safe kebab-case and used in routing.
 * - `status: "live"` makes it visible on /[locale]/campaigns.
 *   "draft" hides it from the index but the URL still resolves
 *   (useful for QA before launch).
 * - All copy is keyed by locale ("el" | "en"). Campaigns target Greek
 *   retail; the rest of the site supports "fr" and "de" too but we don't
 *   surface campaign pages there yet — see `LOCALES` below.
 * - `tiers` is ordered cheapest → flagship; the `featured` tier is highlighted.
 * - `linkedinConversionId` is the numeric ID from LinkedIn Campaign Manager.
 *   Leave `null` while the conversion is still being defined; the thanks
 *   page's browser-side fire becomes a no-op and the CAPI mirror skips too.
 * - `adPlatforms[]` + `notifyChannels[]` (added Phase 1, 2026-06-19) are the
 *   reusable-ad-analytics module's configuration. Each entry describes one
 *   ad source (LinkedIn, Meta, Google, …) and one notification target. See
 *   `src/lib/ad-analytics/types.ts` for the shapes and `skills/ad-analytics/
 *   SKILL.md` for the operating playbook.
 *
 * Wiring guide: `docs/linkedin-campaigns.md` + `skills/linkedin-campaigns/SKILL.md`.
 */

import type {
  CampaignPlatformConfig,
  NotifyChannelConfig,
  AnomalyRules,
} from "@/lib/ad-analytics/types";

export const CAMPAIGN_LOCALES = ["el", "en"] as const;
export type Locale = (typeof CAMPAIGN_LOCALES)[number];
export type CampaignStatus = "live" | "draft" | "archived";

export type Tier = {
  id: string;
  badge?: string;
  name: Record<Locale, string>;
  oneOff?: string;
  monthly?: string;
  savings?: Record<Locale, string>;
  highlights: Record<Locale, string[]>;
  cta: Record<Locale, string>;
  /** Where the Buy button goes. Stubs to /api/checkout until Stripe is wired. */
  checkoutHref: string;
  featured?: boolean;
};

export type Campaign = {
  slug: string;
  status: CampaignStatus;
  /** ISO date when the campaign goes live (informational). */
  startsAt: string;
  /** ISO date when the campaign ends; used for scarcity. */
  endsAt: string;
  /** Brand tagline that overrides the global one on this page. */
  tagline: Record<Locale, string>;
  /** Above-the-fold H1. */
  headline: Record<Locale, string>;
  /** Italic accent inside the headline (matches Quiet Commerce aesthetic). */
  headlineAccent: Record<Locale, string>;
  /** Sub-line under the H1. */
  subhead: Record<Locale, string>;
  /** Image in /public/campaigns. */
  heroImage: string;
  /** Image used for og:image (LinkedIn share preview). */
  ogImage: string;
  tiers: Tier[];
  /** Limit number for Founding Client framing. */
  slotsRemaining?: number;
  faq: Array<{
    q: Record<Locale, string>;
    a: Record<Locale, string>;
  }>;
  /** Source of paid traffic for analytics tagging. */
  utmCampaign: string;
  /** LinkedIn Campaign Manager numeric conversion ID. null until set.
   *  Back-compat alias — concrete adapters now read
   *  `adPlatforms[platform=linkedin].insightTagConversionId` directly. Leave
   *  this set so the existing `ThanksConversion.tsx` browser fire stays a
   *  one-liner; the runtime treats it as the LinkedIn browser conversion ID
   *  when no explicit `adPlatforms` entry exists. */
  linkedinConversionId: number | null;
  /** Optional — wire-level config for the reusable ad-analytics module.
   *  When present, each entry tells the runtime how to talk to that ad
   *  platform (per-platform conversion IDs, account ID, campaign IDs). When
   *  absent, the runtime falls back to legacy single-platform behaviour
   *  driven by `linkedinConversionId`. */
  adPlatforms?: CampaignPlatformConfig[];
  /** Optional — where the runtime sends notifications. Multiple entries
   *  (different `level` values) are allowed: typically one `event` channel
   *  for real-time conversions and one `digest` channel for the 15-min poll. */
  notifyChannels?: NotifyChannelConfig[];
  /** Optional — anomaly thresholds for Phase 4 DM alerts. */
  anomalyRules?: AnomalyRules;
};

export const campaigns: Campaign[] = [
  {
    slug: "shop-online",
    status: "live",
    startsAt: "2026-06-19",
    endsAt: "2026-07-01",
    tagline: {
      el: "Clear skies. Zero friction.",
      en: "Clear skies. Zero friction.",
    },
    headline: {
      el: "Βγάλε το κατάστημά σου online —",
      en: "Get your shop online —",
    },
    headlineAccent: {
      el: "και δες κάθε Δευτέρα τι δουλεύει.",
      en: "and finally see what's working.",
    },
    subhead: {
      el:
        "Website + e-shop + η εβδομαδιαία αναφορά για τις πωλήσεις σου. " +
        "Για ελληνικά retail καταστήματα. Φτιάχνεται και τρέχει από μία ομάδα.",
      en:
        "Website + e-shop + the weekly answers about your sales. " +
        "For Greek retailers. Built and run by one team.",
    },
    heroImage: "/campaigns/shop-online-hero.png",
    ogImage: "/campaigns/shop-online-ad-a.png",
    slotsRemaining: 5,
    utmCampaign: "shop_online_founding",
    // LinkedIn Campaign Manager → Conversion Tracking → "Shop Online — Tier
    // purchased". Last-touch, 30d post-click + 7d post-view, value €890,
    // page-load match on URL containing /campaigns/shop-online/thanks.
    // The browser-side fire (lintrk + CAPI mirror) happens in ThanksConversion.tsx.
    linkedinConversionId: 26846068,
    // Phase 1 ad-analytics wiring. `capiConversionId` is null until the
    // operator creates a `CONVERSIONS_API`-typed conversion in Campaign
    // Manager — see `skills/ad-analytics/SKILL.md` operating principle #2
    // for why we cannot reuse `26846068` (it's `EVENT_SPECIFIC_TAG`-typed
    // and any /rest/conversionEvents POST against it 403s).
    adPlatforms: [
      {
        platform: "linkedin",
        // Campaign Manager → URL `…/accounts/<accountId>/…`. The Marketing
        // API expects this same numeric ID, not the URN — `LinkedInAdapter`
        // wraps it as `urn:li:sponsoredAccount:<id>` internally.
        accountId: "511588554",
        campaignIds: ["692134846"],
        insightTagConversionId: 26846068,
        capiConversionId: null,
      },
    ],
    notifyChannels: [
      { channel: "slack", target: "#contacts", level: "event" },
      { channel: "slack", target: "#contacts", level: "digest" },
      { channel: "slack", target: "#contacts", level: "anomaly" },
    ],
    tiers: [
      {
        id: "starter",
        name: { el: "Online Starter", en: "Online Starter" },
        oneOff: "€890",
        monthly: "€29/μήνα",
        highlights: {
          el: [
            "5-σέλιδη επώνυμη ιστοσελίδα",
            "Domain · hosting · SSL · GDPR",
            "Google Business Profile",
            "Βασικό GA4",
            "10 εργάσιμες παράδοση",
          ],
          en: [
            "5-page branded website",
            "Domain · hosting · SSL · GDPR",
            "Google Business Profile",
            "Basic GA4",
            "10 business days delivery",
          ],
        },
        cta: { el: "Επιλέγω Starter", en: "Choose Starter" },
        checkoutHref: "/api/checkout?campaign=shop-online&tier=starter",
      },
      {
        id: "eshop-launch",
        name: { el: "E-shop Launch", en: "E-shop Launch" },
        oneOff: "€1.800",
        monthly: "€59/μήνα",
        highlights: {
          el: [
            "Όλα τα Starter +",
            "Πλήρες e-shop (WooCommerce/Next.js)",
            "Έως 50 προϊόντα · Stripe / Viva / PayPal",
            "ELTA · ACS · Speedex",
            "Skroutz + BestPrice XML feed",
            "Abandoned-cart email · Meta Pixel",
            "21 εργάσιμες παράδοση",
          ],
          en: [
            "Everything in Starter +",
            "Full e-shop (WooCommerce/Next.js)",
            "Up to 50 SKUs · Stripe / Viva / PayPal",
            "ELTA · ACS · Speedex shipping",
            "Skroutz + BestPrice XML feed",
            "Abandoned-cart email · Meta Pixel",
            "21 business days delivery",
          ],
        },
        cta: { el: "Επιλέγω E-shop", en: "Choose E-shop" },
        checkoutHref: "/api/checkout?campaign=shop-online&tier=eshop-launch",
      },
      {
        id: "full-bundle",
        featured: true,
        badge: "1 + 2 + 3",
        name: { el: "Full Bundle", en: "Full Bundle" },
        oneOff: "€2.900",
        monthly: "€149/μήνα · €112/μήνα Founding",
        savings: {
          el: "Κερδίζεις €990 vs. ξεχωριστά",
          en: "Save €990 vs. buying separately",
        },
        highlights: {
          el: [
            "Όλα τα προηγούμενα +",
            "Cloudless Shop Insights dashboard",
            "Live data: shop · GA4 · Meta · Google · Skroutz",
            "Εβδομαδιαίο email Δευτέρα 08:00",
            "Μηνιαία τηλεδιάσκεψη ανασκόπησης",
            "30 εργάσιμες παράδοση",
          ],
          en: [
            "Everything above +",
            "Cloudless Shop Insights dashboard",
            "Live data: shop · GA4 · Meta · Google · Skroutz",
            "Monday 08:00 email digest",
            "Monthly review call",
            "30 business days delivery",
          ],
        },
        cta: { el: "Επιλέγω Full Bundle", en: "Choose Full Bundle" },
        checkoutHref: "/api/checkout?campaign=shop-online&tier=full-bundle",
      },
    ],
    faq: [
      {
        q: { el: "Πόσο γρήγορα παραδίδετε;", en: "How long until it's live?" },
        a: {
          el: "Starter 10 εργάσιμες · E-shop 21 · Full Bundle 30. Milestone-billed.",
          en: "Starter 10 business days · E-shop 21 · Full Bundle 30. Milestone-billed.",
        },
      },
      {
        q: { el: "Ποιανού είναι ο κώδικας;", en: "Who owns the code?" },
        a: {
          el: "Δικός σας. Με documentation. Καμία εξάρτηση.",
          en: "You. Fully documented, no lock-in.",
        },
      },
      {
        q: { el: "Μπορώ να ακυρώσω;", en: "Can I cancel?" },
        a: {
          el: "Ναι. Μηνιαία συνδρομή. Καμία υπαναχώρηση, καμία ποινή.",
          en: "Yes. Month-to-month. No exit fees.",
        },
      },
      {
        q: { el: "Τιμολόγιο με ΦΠΑ;", en: "Greek VAT invoice?" },
        a: {
          el: "Ναι, αυτόματη έκδοση μέσω Stripe.",
          en: "Yes, auto-issued via Stripe.",
        },
      },
      {
        q: { el: "Είστε στην περιοχή μου;", en: "Are you in my area?" },
        a: {
          el:
            "Σε όλη την Ελλάδα remote. On-site επισκέψεις σε Αττική και " +
            "Θεσσαλονίκη τις πρώτες 90 ημέρες.",
          en:
            "Remote across Greece. On-site visits in Attica and Thessaloniki " +
            "during the first 90 days.",
        },
      },
    ],
  },
];

export function getCampaign(slug: string): Campaign | undefined {
  return campaigns.find((c) => c.slug === slug);
}

export function getLiveCampaigns(): Campaign[] {
  return campaigns.filter((c) => c.status === "live");
}

export function isCampaignLocale(value: string): value is Locale {
  return (CAMPAIGN_LOCALES as readonly string[]).includes(value);
}
