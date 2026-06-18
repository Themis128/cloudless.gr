"use client";

import type { MouseEvent } from "react";
import type { Campaign, Locale } from "@/data/campaigns";
import { getStoredAttribution } from "@/lib/lead-attribution";

type Props = {
  campaign: Campaign;
  locale: Locale;
};

/**
 * Read first-touch attribution from sessionStorage and append it to the
 * outbound `/api/checkout?…` URL so the server can stamp UTM into Stripe
 * metadata (or carry it to /contact for the fit-call path). Without this
 * the visitor's creative variant (utm_content=A_EN / B_EN / …) is lost
 * the moment they leave the landing page.
 */
function appendAttributionToHref(href: string): string {
  if (typeof window === "undefined") return href;
  const a = getStoredAttribution();
  if (!a) return href;
  let url: URL;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return href;
  }
  if (a.utmSource) url.searchParams.set("utm_source", a.utmSource);
  if (a.utmMedium) url.searchParams.set("utm_medium", a.utmMedium);
  if (a.utmCampaign) url.searchParams.set("utm_campaign", a.utmCampaign);
  if (a.utmTerm) url.searchParams.set("utm_term", a.utmTerm);
  if (a.utmContent) url.searchParams.set("utm_content", a.utmContent);
  // Same-origin — drop the origin prefix so the navigation stays a same-origin
  // redirect (matters for the GET-302 → Stripe Checkout handoff).
  return url.pathname + url.search;
}

export default function TierTable({ campaign, locale }: Props) {
  function handleCtaClick(e: MouseEvent<HTMLAnchorElement>) {
    // Plain (no modifier) left clicks get the attribution-stamped URL. Cmd /
    // Ctrl / middle-click / right-click stay default so "open in new tab"
    // keeps working — those visitors still send the bare URL but session-
    // storage attribution is preserved for any subsequent paid hit.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const anchor = e.currentTarget;
    const stamped = appendAttributionToHref(anchor.getAttribute("href") ?? "");
    if (stamped && stamped !== anchor.getAttribute("href")) {
      e.preventDefault();
      window.location.href = stamped;
    }
  }

  return (
    <section className="cl-tiers" aria-label={locale === "el" ? "Πακέτα" : "Tiers"}>
      <div className="cl-tiers__grid">
        {campaign.tiers.map((t) => (
          <article key={t.id} className={`cl-tier ${t.featured ? "cl-tier--featured" : ""}`}>
            {t.badge && <span className="cl-tier__badge">{t.badge}</span>}
            <h3 className="cl-tier__name">{t.name[locale]}</h3>
            <div className="cl-tier__prices">
              {t.oneOff && <div className="cl-tier__oneoff">{t.oneOff}</div>}
              {t.monthly && <div className="cl-tier__monthly">{t.monthly}</div>}
            </div>
            {t.savings && <div className="cl-tier__savings">{t.savings[locale]}</div>}
            <ul className="cl-tier__highlights">
              {t.highlights[locale].map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            {/* `checkoutHref` is an API path (not a Next.js route) — must be a
                plain <a>. `@/i18n/navigation`'s Link rewrites to add the locale
                prefix, which would break the /api/checkout call. The onClick
                stamps first-touch UTM into the URL so the creative variant
                survives the Stripe handoff. */}
            <a
              href={t.checkoutHref}
              onClick={handleCtaClick}
              className="cl-tier__cta"
              data-tier={t.id}
              data-campaign={campaign.slug}
            >
              {t.cta[locale]}
            </a>
          </article>
        ))}
      </div>

      <style jsx>{`
        .cl-tiers {
          padding: 56px 24px;
          background: #f7f3ec;
        }
        .cl-tiers__grid {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 880px) {
          .cl-tiers__grid {
            grid-template-columns: 1fr;
          }
        }
        :global(.cl-tier) {
          background: #ffffff;
          border: 1px solid #d8d2c4;
          border-radius: 8px;
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        :global(.cl-tier--featured) {
          border-color: #0a7785;
          border-width: 2px;
          box-shadow: 0 18px 40px -22px rgba(10, 119, 133, 0.35);
        }
        :global(.cl-tier__badge) {
          position: absolute;
          top: -12px;
          right: 20px;
          background: #c87a17;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.6px;
          padding: 4px 10px;
          border-radius: 999px;
        }
        :global(.cl-tier__name) {
          font-family: "Fraunces", Georgia, serif;
          font-weight: 500;
          font-size: 22px;
          color: #1a2528;
          margin: 0 0 14px;
        }
        :global(.cl-tier__prices) {
          margin-bottom: 6px;
        }
        :global(.cl-tier__oneoff) {
          font-family: "Fraunces", Georgia, serif;
          font-size: 32px;
          color: #0a7785;
          line-height: 1;
        }
        :global(.cl-tier__monthly) {
          font-size: 13px;
          color: #4a5a5f;
          margin-top: 4px;
        }
        :global(.cl-tier__savings) {
          font-size: 12px;
          font-weight: 600;
          color: #c87a17;
          letter-spacing: 0.4px;
          margin: 8px 0 14px;
        }
        :global(.cl-tier__highlights) {
          list-style: none;
          padding: 0;
          margin: 12px 0 20px;
          color: #1a2528;
          font-size: 14px;
          line-height: 1.55;
          flex: 1;
        }
        :global(.cl-tier__highlights li) {
          padding: 6px 0;
          border-bottom: 1px solid #eee5d3;
        }
        :global(.cl-tier__highlights li:last-child) {
          border-bottom: 0;
        }
        :global(.cl-tier__cta) {
          display: inline-block;
          text-align: center;
          padding: 13px 18px;
          border-radius: 6px;
          background: #0a7785;
          color: #f7f3ec;
          text-decoration: none;
          font-weight: 600;
          letter-spacing: 0.4px;
          transition: background 120ms ease;
        }
        :global(.cl-tier__cta:hover) {
          background: #064d57;
        }
        :global(.cl-tier--featured .cl-tier__cta) {
          background: #1a2528;
        }
      `}</style>
    </section>
  );
}
