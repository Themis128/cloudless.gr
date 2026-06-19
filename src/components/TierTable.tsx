"use client";

import { useState, useRef, type FormEvent, type MouseEvent } from "react";
import type { Campaign, Locale, Tier } from "@/data/campaigns";
import { getStoredAttribution } from "@/lib/lead-attribution";

// Design tokens — extracted to satisfy sonarjs/no-duplicate-string (S1192).
// Each value is used 3+ times across the JSX and <style jsx> block.
const COLOR_BRAND = "#0a7785";
const COLOR_BRAND_DARK = "#064d57";
const COLOR_INK = "#1a2528";
const COLOR_SAND = "#f7f3ec";
const COLOR_MUTED = "#4a5a5f";
const FONT_FRAUNCES = '"Fraunces", Georgia, serif';
const TRANSITION_FAST = "120ms ease";
const CLS_INPUT = "cl-tiers__input";

type Props = {
  campaign: Campaign;
  locale: Locale;
};

type FormStatus = "idle" | "sending" | "sent" | "error";

export default function TierTable({ campaign, locale }: Props) {
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const formRef = useRef<HTMLDivElement>(null);

  function handleCtaClick(e: MouseEvent<HTMLAnchorElement>, tier: Tier) {
    e.preventDefault();
    setSelectedTier(tier);
    setFormStatus("idle");
    // Scroll to form after a tick (DOM needs to render)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedTier) return;
    setFormStatus("sending");

    const form = e.currentTarget;
    const payload = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
      service: `${campaign.slug} — ${selectedTier.name[locale]}`,
      message: `Tier: ${selectedTier.name[locale]}\nPrice: ${selectedTier.oneOff ?? selectedTier.monthly ?? ""}\nCampaign: ${campaign.slug}`,
      attribution: getStoredAttribution() ?? undefined,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setFormStatus("sent");
        form.reset();
        // Fire conversion event → #ads-realtime Slack notification
        const attr = getStoredAttribution();
        fetch("/api/campaigns/conversion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaign: campaign.slug,
            tier: selectedTier.id,
            orderId: `lead-${Date.now()}`,
            url: window.location.href,
            userAgent: navigator.userAgent,
            utm: attr
              ? {
                  source: attr.utmSource,
                  medium: attr.utmMedium,
                  campaign: attr.utmCampaign,
                  content: attr.utmContent,
                  term: attr.utmTerm,
                }
              : undefined,
          }),
        }).catch(() => {});
      } else {
        setFormStatus("error");
      }
    } catch {
      setFormStatus("error");
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
            <a
              href={t.checkoutHref}
              onClick={(e) => handleCtaClick(e, t)}
              className={`cl-tier__cta ${selectedTier?.id === t.id ? "cl-tier__cta--active" : ""}`}
              data-tier={t.id}
              data-campaign={campaign.slug}
            >
              {t.cta[locale]}
            </a>
          </article>
        ))}
      </div>

      {/* Inline request form — appears when a tier is selected */}
      {selectedTier && (
        <div ref={formRef} className="cl-tiers__form-wrap">
          {formStatus === "sent" ? (
            <div className="cl-tiers__success">
              <div className="cl-tiers__success-icon">✓</div>
              <h3>
                {locale === "el"
                  ? "Ευχαριστούμε! Θα επικοινωνήσουμε εντός 24 ωρών."
                  : "Thank you! We'll be in touch within 24 hours."}
              </h3>
              <p>
                {locale === "el"
                  ? `Επιλογή: ${selectedTier.name[locale]}`
                  : `Selected: ${selectedTier.name[locale]}`}
              </p>
            </div>
          ) : (
            <>
              <h3 className="cl-tiers__form-title">
                {locale === "el"
                  ? `Ξεκίνα με ${selectedTier.name[locale]}`
                  : `Get started with ${selectedTier.name[locale]}`}
                {selectedTier.oneOff && (
                  <span className="cl-tiers__form-price">{selectedTier.oneOff}</span>
                )}
              </h3>
              <p className="cl-tiers__form-sub">
                {locale === "el"
                  ? "Συμπλήρωσε τα στοιχεία σου και θα σου στείλουμε πρόταση εντός 24 ωρών."
                  : "Fill in your details and we'll send you a tailored proposal within 24 hours."}
              </p>
              <form onSubmit={handleSubmit} className="cl-tiers__form">
                <input
                  name="name"
                  type="text"
                  required
                  placeholder={locale === "el" ? "Ονοματεπώνυμο *" : "Full name *"}
                  autoComplete="name"
                  className={CLS_INPUT}
                />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Email *"
                  autoComplete="email"
                  className={CLS_INPUT}
                />
                <input
                  name="phone"
                  type="tel"
                  placeholder={locale === "el" ? "Τηλέφωνο" : "Phone (optional)"}
                  autoComplete="tel"
                  className={CLS_INPUT}
                />
                {formStatus === "error" && (
                  <p className="cl-tiers__error">
                    {locale === "el"
                      ? "Κάτι πήγε στραβά. Δοκίμασε ξανά."
                      : "Something went wrong. Please try again."}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={formStatus === "sending"}
                  className="cl-tiers__submit"
                >
                  {formStatus === "sending"
                    ? locale === "el"
                      ? "Αποστολή..."
                      : "Sending..."
                    : locale === "el"
                      ? "Λάβε πρόταση →"
                      : "Get my proposal →"}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        .cl-tiers {
          padding: 56px 24px;
          background: ${COLOR_SAND};
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
          border-color: ${COLOR_BRAND};
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
          font-family: ${FONT_FRAUNCES};
          font-weight: 500;
          font-size: 22px;
          color: ${COLOR_INK};
          margin: 0 0 14px;
        }
        :global(.cl-tier__prices) {
          margin-bottom: 6px;
        }
        :global(.cl-tier__oneoff) {
          font-family: ${FONT_FRAUNCES};
          font-size: 32px;
          color: ${COLOR_BRAND};
          line-height: 1;
        }
        :global(.cl-tier__monthly) {
          font-size: 13px;
          color: ${COLOR_MUTED};
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
          color: ${COLOR_INK};
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
          background: ${COLOR_BRAND};
          color: ${COLOR_SAND};
          text-decoration: none;
          font-weight: 600;
          letter-spacing: 0.4px;
          transition: background ${TRANSITION_FAST};
        }
        :global(.cl-tier__cta:hover) {
          background: ${COLOR_BRAND_DARK};
        }
        :global(.cl-tier__cta--active) {
          background: ${COLOR_BRAND_DARK};
          box-shadow: 0 0 0 3px rgba(10, 119, 133, 0.3);
        }
        :global(.cl-tier--featured .cl-tier__cta) {
          background: ${COLOR_INK};
        }
        .cl-tiers__form-wrap {
          max-width: 560px;
          margin: 40px auto 0;
          padding: 32px;
          background: #ffffff;
          border: 2px solid ${COLOR_BRAND};
          border-radius: 12px;
          box-shadow: 0 12px 32px -12px rgba(10, 119, 133, 0.15);
        }
        .cl-tiers__form-title {
          font-family: ${FONT_FRAUNCES};
          font-size: 22px;
          font-weight: 500;
          color: ${COLOR_INK};
          margin: 0 0 6px;
          display: flex;
          align-items: baseline;
          gap: 12px;
          flex-wrap: wrap;
        }
        .cl-tiers__form-price {
          font-size: 18px;
          color: ${COLOR_BRAND};
        }
        .cl-tiers__form-sub {
          font-size: 14px;
          color: ${COLOR_MUTED};
          margin: 0 0 20px;
          line-height: 1.5;
        }
        .cl-tiers__form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cl-tiers__input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #d8d2c4;
          border-radius: 6px;
          font-size: 15px;
          color: ${COLOR_INK};
          background: #faf8f4;
          transition: border-color ${TRANSITION_FAST};
          outline: none;
        }
        .cl-tiers__input:focus {
          border-color: ${COLOR_BRAND};
          box-shadow: 0 0 0 3px rgba(10, 119, 133, 0.08);
        }
        .cl-tiers__input::placeholder {
          color: #8a9599;
        }
        .cl-tiers__error {
          font-size: 13px;
          color: #c0392b;
          margin: 0;
        }
        .cl-tiers__submit {
          padding: 14px 24px;
          background: ${COLOR_BRAND};
          color: ${COLOR_SAND};
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background ${TRANSITION_FAST};
          letter-spacing: 0.3px;
        }
        .cl-tiers__submit:hover {
          background: ${COLOR_BRAND_DARK};
        }
        .cl-tiers__submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .cl-tiers__success {
          text-align: center;
          padding: 16px 0;
        }
        .cl-tiers__success-icon {
          font-size: 36px;
          color: ${COLOR_BRAND};
          margin-bottom: 12px;
        }
        .cl-tiers__success h3 {
          font-family: ${FONT_FRAUNCES};
          font-size: 20px;
          font-weight: 500;
          color: ${COLOR_INK};
          margin: 0 0 8px;
        }
        .cl-tiers__success p {
          font-size: 14px;
          color: ${COLOR_MUTED};
          margin: 0;
        }
      `}</style>
    </section>
  );
}
