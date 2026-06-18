"use client";

import Image from "next/image";
import type { Campaign, Locale } from "@/data/campaigns";

type Props = {
  campaign: Campaign;
  locale: Locale;
};

export function CampaignHero({ campaign, locale }: Props) {
  return (
    <header className="cl-hero">
      <div className="cl-hero__inner">
        <div className="cl-hero__copy">
          <div className="cl-hero__brand">
            <span className="cl-hero__dot" aria-hidden />
            <span className="cl-hero__brandname">
              cloudless<span className="cl-hero__tld">.gr</span>
            </span>
            <span className="cl-hero__tagline">{campaign.tagline[locale]}</span>
          </div>

          <h1 className="cl-hero__headline">
            {campaign.headline[locale]}
            <em>{" " + campaign.headlineAccent[locale]}</em>
          </h1>
          <p className="cl-hero__sub">{campaign.subhead[locale]}</p>

          {campaign.slotsRemaining ? (
            <div className="cl-hero__slots">
              <strong>
                {campaign.slotsRemaining}{" "}
                {locale === "el"
                  ? "Founding Client θέσεις"
                  : "Founding Client slots"}
              </strong>
              <span>
                {locale === "el"
                  ? "Λήγει 1 Ιουλ 2026"
                  : "Closes 1 Jul 2026"}
              </span>
            </div>
          ) : null}
        </div>

        <div className="cl-hero__proof">
          <div className="cl-hero__proof-label">
            {locale === "el" ? "Δείγμα · Δευτέρα 08:00" : "Sample · Monday 08:00"}
          </div>
          <Image
            src={campaign.heroImage}
            alt={
              locale === "el"
                ? "Εβδομαδιαία αναφορά Shop Insights"
                : "Weekly Shop Insights digest"
            }
            width={760}
            height={1380}
            className="cl-hero__proof-img"
            priority
          />
        </div>
      </div>

      <style jsx>{`
        .cl-hero {
          background: linear-gradient(180deg, #0a7785 0%, #064d57 100%);
          color: #f7f3ec;
          padding: 80px 24px 60px;
        }
        .cl-hero__inner {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 48px;
          align-items: start;
        }
        @media (max-width: 880px) {
          .cl-hero__inner {
            grid-template-columns: 1fr;
          }
        }
        .cl-hero__brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 36px;
          flex-wrap: wrap;
        }
        .cl-hero__dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #f7f3ec;
        }
        .cl-hero__brandname {
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.2px;
        }
        .cl-hero__tld {
          font-weight: 300;
        }
        .cl-hero__tagline {
          font-size: 10px;
          letter-spacing: 2.2px;
          text-transform: uppercase;
          color: #cfe3e7;
          margin-left: 8px;
        }
        .cl-hero__headline {
          font-family: "Fraunces", Georgia, serif;
          font-weight: 400;
          font-size: clamp(28px, 4.2vw, 46px);
          line-height: 1.15;
          letter-spacing: -0.6px;
          margin: 0 0 18px;
        }
        .cl-hero__headline em {
          font-style: italic;
          color: #f3d59a;
        }
        .cl-hero__sub {
          font-size: 16px;
          line-height: 1.55;
          color: rgba(247, 243, 236, 0.85);
          max-width: 480px;
          margin: 0 0 28px;
        }
        .cl-hero__slots {
          display: inline-flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 18px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 6px;
          font-size: 12px;
        }
        .cl-hero__slots strong {
          color: #f3d59a;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .cl-hero__slots span {
          color: #cfe3e7;
          font-variant-numeric: tabular-nums;
        }
        .cl-hero__proof {
          padding: 14px;
          background: rgba(247, 243, 236, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
        }
        .cl-hero__proof-label {
          font-size: 10px;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: #cfe3e7;
          margin-bottom: 10px;
        }
        :global(.cl-hero__proof-img) {
          width: 100%;
          height: auto;
          border-radius: 4px;
          display: block;
        }
      `}</style>
    </header>
  );
}
