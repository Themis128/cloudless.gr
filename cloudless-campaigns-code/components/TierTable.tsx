"use client";

import Link from "next/link";
import type { Campaign, Locale } from "@/data/campaigns";

type Props = {
  campaign: Campaign;
  locale: Locale;
};

export function TierTable({ campaign, locale }: Props) {
  return (
    <section className="cl-tiers" aria-label={locale === "el" ? "Πακέτα" : "Tiers"}>
      <div className="cl-tiers__grid">
        {campaign.tiers.map((t) => (
          <article
            key={t.id}
            className={`cl-tier ${t.featured ? "cl-tier--featured" : ""}`}
          >
            {t.badge && <span className="cl-tier__badge">{t.badge}</span>}
            <h3 className="cl-tier__name">{t.name[locale]}</h3>
            <div className="cl-tier__prices">
              {t.oneOff && <div className="cl-tier__oneoff">{t.oneOff}</div>}
              {t.monthly && <div className="cl-tier__monthly">{t.monthly}</div>}
            </div>
            {t.savings && (
              <div className="cl-tier__savings">{t.savings[locale]}</div>
            )}
            <ul className="cl-tier__highlights">
              {t.highlights[locale].map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
            <Link
              href={t.checkoutHref}
              className="cl-tier__cta"
              data-tier={t.id}
              data-campaign={campaign.slug}
            >
              {t.cta[locale]}
            </Link>
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
