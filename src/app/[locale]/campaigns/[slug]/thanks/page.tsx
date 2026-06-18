/**
 * /[locale]/campaigns/[slug]/thanks
 *
 * Single thank-you template for ALL campaign conversions.
 * The page mounts `ThanksConversion` which dual-fires the LinkedIn
 * conversion: browser-side via the Insight Tag (`window.lintrk`) and
 * server-side via `/api/campaigns/conversion` (CAPI). LinkedIn dedupes by
 * `eventId` (= the order/session ID), so a reload doesn't double-count.
 *
 * Query params:
 *   ?tier=<id>            which tier (or "fit-call") triggered the conversion
 *   ?order=<stripe_id>    optional, used as the dedup eventId in CAPI
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCampaign, isCampaignLocale, type Locale } from "@/data/campaigns";
import ThanksConversion from "./ThanksConversion";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ tier?: string; order?: string }>;
};

export const metadata: Metadata = {
  title: "Thanks — Cloudless",
  robots: { index: false, follow: false },
};

const COPY = {
  el: {
    label: "[ ΕΥΧΑΡΙΣΤΟΥΜΕ ]",
    h1: "Έχουμε την παραγγελία σου.",
    sub:
      "Θα λάβεις email επιβεβαίωσης με το αναλυτικό πλάνο παράδοσης σε λίγα " +
      "λεπτά. Επόμενο βήμα: η πρώτη μας τηλεδιάσκεψη kickoff.",
    nextLabel: "Κλείσε kickoff →",
    homeLabel: "← Επιστροφή στις καμπάνιες",
    tierLabel: "Πακέτο:",
    orderLabel: "Αρ. παραγγελίας:",
    fitcallH1: "Καταχωρήθηκε η αίτησή σου.",
    fitcallSub:
      "Σου στέλνουμε email με 2-3 διαθέσιμα ραντεβού μέσα στις επόμενες 4 " +
      "εργάσιμες ώρες. Καμία πίεση, καμία πώληση.",
  },
  en: {
    label: "[ THANK YOU ]",
    h1: "We have your order.",
    sub:
      "You'll receive a confirmation email with the delivery plan in a few " +
      "minutes. Next step: our kickoff call.",
    nextLabel: "Book kickoff →",
    homeLabel: "← Back to campaigns",
    tierLabel: "Tier:",
    orderLabel: "Order ID:",
    fitcallH1: "Your fit-call request is in.",
    fitcallSub:
      "We'll email you 2-3 time slots within the next 4 working hours. " + "No pressure, no pitch.",
  },
} as const satisfies Record<Locale, unknown>;

export default async function CampaignThanks({ params, searchParams }: PageProps) {
  const { locale: rawLocale, slug } = await params;
  setRequestLocale(rawLocale);
  const { tier, order } = await searchParams;
  const locale: Locale = isCampaignLocale(rawLocale) ? rawLocale : "en";
  const c = getCampaign(slug);
  if (!c) notFound();
  const t = COPY[locale];
  const isFitCall = tier === "fit-call";

  return (
    <main className="cl-thanks">
      <ThanksConversion
        conversionId={c.linkedinConversionId}
        campaign={c.slug}
        tier={tier ?? null}
        orderId={order ?? null}
      />

      <span className="cl-thanks__label">{t.label}</span>
      <h1>{isFitCall ? t.fitcallH1 : t.h1}</h1>
      <p>{isFitCall ? t.fitcallSub : t.sub}</p>

      <dl className="cl-thanks__meta">
        {tier && (
          <>
            <dt>{t.tierLabel}</dt>
            <dd>
              <code>{tier}</code>
            </dd>
          </>
        )}
        {order && (
          <>
            <dt>{t.orderLabel}</dt>
            <dd>
              <code>{order}</code>
            </dd>
          </>
        )}
      </dl>

      <div className="cl-thanks__actions">
        {!isFitCall && (
          <a
            className="cl-thanks__cta"
            href={`/${rawLocale}/contact?topic=kickoff&campaign=${c.slug}&tier=${tier ?? ""}`}
          >
            {t.nextLabel}
          </a>
        )}
        <Link className="cl-thanks__link" href="/campaigns">
          {t.homeLabel}
        </Link>
      </div>

      {/* prettier-ignore */}
      <style>{`
        .cl-thanks { max-width: 640px; margin: 0 auto; padding: 100px 24px 120px; color: #1a2528; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; text-align: left; }
        .cl-thanks__label { font-size: 11px; letter-spacing: 2.4px; text-transform: uppercase; color: #0a7785; font-weight: 600; }
        .cl-thanks h1 { font-family: "Fraunces", Georgia, serif; font-size: clamp(28px, 4vw, 40px); margin: 14px 0 16px; font-weight: 400; line-height: 1.18; }
        .cl-thanks p { font-size: 17px; line-height: 1.6; color: #4a5a5f; margin: 0 0 28px; }
        .cl-thanks__meta { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; padding: 18px; background: #f7f3ec; border-radius: 6px; margin: 0 0 32px; font-size: 13px; }
        .cl-thanks__meta dt { color: #4a5a5f; }
        .cl-thanks__meta dd { margin: 0; }
        .cl-thanks__meta code { font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 13px; color: #0a7785; }
        .cl-thanks__actions { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
        .cl-thanks__cta { background: #0a7785; color: #f7f3ec; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; }
        .cl-thanks__link { color: #4a5a5f; text-decoration: none; font-size: 14px; }
      `}</style>
    </main>
  );
}
