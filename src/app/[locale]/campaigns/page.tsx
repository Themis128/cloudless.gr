/**
 * /[locale]/campaigns — index of all live campaigns.
 *
 * Reachable in EL/EN only (campaigns target Greek retail). For FR/DE the
 * page falls back to the EN copy and renders empty if no live campaign
 * matches the locale — never 404 inside the global locale prefix.
 */
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getLiveCampaigns, isCampaignLocale, type Locale } from "@/data/campaigns";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "Campaigns — Cloudless",
  description: "Active offers and time-bound campaigns from Cloudless. Greek SMB focus.",
  robots: { index: false, follow: true },
};

const COPY = {
  el: {
    label: "[ CAMPAIGNS ]",
    h1: "Ενεργές καμπάνιες.",
    sub:
      "Χρονικά περιορισμένες προσφορές για ελληνικά καταστήματα και startups. " +
      "Κάθε καμπάνια έχει ξεκάθαρη ημερομηνία λήξης και διαφανείς όρους.",
    cta: "Δες την καμπάνια",
    none: "Καμία ενεργή καμπάνια αυτή τη στιγμή.",
  },
  en: {
    label: "[ CAMPAIGNS ]",
    h1: "Active campaigns.",
    sub:
      "Time-bound offers for Greek shops and startups. Each campaign has a " +
      "hard end date and transparent terms.",
    cta: "See the campaign",
    none: "No active campaigns right now.",
  },
} as const satisfies Record<Locale, unknown>;

export default async function CampaignsIndex({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale: Locale = isCampaignLocale(rawLocale) ? rawLocale : "en";
  const t = COPY[locale];
  const campaigns = getLiveCampaigns();

  return (
    <main className="cl-cam-index">
      <header className="cl-cam-index__head">
        <span className="cl-cam-index__label">{t.label}</span>
        <h1>{t.h1}</h1>
        <p>{t.sub}</p>
      </header>

      {campaigns.length === 0 ? (
        <p className="cl-cam-index__empty">{t.none}</p>
      ) : (
        <ul className="cl-cam-index__list">
          {campaigns.map((c) => (
            <li key={c.slug} className="cl-cam-card">
              <div className="cl-cam-card__meta">
                <time dateTime={c.startsAt}>
                  {new Date(c.startsAt).toLocaleDateString(locale, { timeZone: "Europe/Athens" })}
                </time>
                <span aria-hidden> — </span>
                <time dateTime={c.endsAt}>
                  {new Date(c.endsAt).toLocaleDateString(locale, { timeZone: "Europe/Athens" })}
                </time>
              </div>
              <h2>{c.headline[locale]}</h2>
              <p>{c.subhead[locale]}</p>
              <Link href={`/campaigns/${c.slug}`}>{t.cta} →</Link>
            </li>
          ))}
        </ul>
      )}

      {/* prettier-ignore */}
      <style>{`
        .cl-cam-index { max-width: 980px; margin: 0 auto; padding: 80px 24px 120px; color: #1a2528; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
        .cl-cam-index__head { margin-bottom: 56px; }
        .cl-cam-index__label { font-size: 11px; letter-spacing: 2.4px; text-transform: uppercase; color: #0a7785; font-weight: 600; }
        .cl-cam-index__head h1 { font-family: "Fraunces", Georgia, serif; font-size: clamp(32px, 4.5vw, 52px); line-height: 1.1; margin: 14px 0 16px; font-weight: 400; }
        .cl-cam-index__head p { color: #4a5a5f; font-size: 16px; line-height: 1.6; max-width: 640px; }
        .cl-cam-index__list { list-style: none; padding: 0; display: grid; gap: 18px; }
        .cl-cam-card { padding: 28px 28px 26px; border: 1px solid #d8d2c4; border-radius: 8px; background: #f7f3ec; }
        .cl-cam-card__meta { font-size: 11px; letter-spacing: 1.6px; text-transform: uppercase; color: #4a5a5f; margin-bottom: 12px; font-variant-numeric: tabular-nums; }
        .cl-cam-card h2 { font-family: "Fraunces", Georgia, serif; font-size: 24px; font-weight: 500; margin: 0 0 8px; }
        .cl-cam-card p { color: #1a2528; font-size: 15px; line-height: 1.55; margin: 0 0 14px; }
        .cl-cam-card a { color: #0a7785; text-decoration: none; font-weight: 600; letter-spacing: 0.4px; }
        .cl-cam-card a:hover { color: #064d57; }
        .cl-cam-index__empty { color: #4a5a5f; font-style: italic; }
      `}</style>
    </main>
  );
}
