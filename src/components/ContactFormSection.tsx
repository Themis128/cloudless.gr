"use client";

import type { FormEvent } from "react";
import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import SocialLinks from "@/components/SocialLinks";
import TurnstileWidget from "@/components/TurnstileWidget";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";
import { trackPixelEvent } from "@/lib/meta-pixel";
import { getStoredAttribution } from "@/lib/lead-attribution";
import { fireCampaignConversion } from "@/lib/fire-campaign-conversion";
import { getCampaign } from "@/data/campaigns";

const serviceOptions = [
  "Cloud Architecture & Migration",
  "Serverless Development",
  "Data Analytics & Dashboards",
  "AI & Digital Marketing",
  "Full-Stack Growth Engine (Bundle)",
  "Brand Partnership / Sponsorship",
  "Not sure yet — let's discuss",
];

const LABEL_CLASS = "mb-2 block font-mono text-xs font-medium tracking-wider text-slate-400";
const INPUT_CLASS =
  "border-neon-cyan/20 bg-void-light focus:border-neon-cyan/60 w-full rounded-lg border px-4 py-3 font-mono text-sm text-white transition-all outline-none placeholder:text-slate-600 focus:shadow-[0_0_10px_rgba(0,255,245,0.1)]";
const SELECT_CLASS =
  "border-neon-cyan/20 bg-void-light focus:border-neon-cyan/60 w-full rounded-lg border px-4 py-3 font-mono text-sm text-white transition-all outline-none focus:shadow-[0_0_10px_rgba(0,255,245,0.1)]";
const TEXTAREA_CLASS =
  "border-neon-cyan/20 bg-void-light focus:border-neon-cyan/60 w-full resize-y rounded-lg border px-4 py-3 font-mono text-sm text-white transition-all outline-none placeholder:text-slate-600 focus:shadow-[0_0_10px_rgba(0,255,245,0.1)]";
const SIDEBAR_LABEL_CLASS = "text-xs text-slate-500";
// Form field identifiers — each used as htmlFor, id, name, and in payload extraction.
const FIELD_NAME = "name";
const FIELD_EMAIL = "email";
const FIELD_COMPANY = "company";
const FIELD_SERVICE = "service";
const FIELD_MESSAGE = "message";
// bf2026 audit qualification screening — 4 quick radio questions per the
// offer-audit recommendation. Option `value` is the canonical English string
// stored in the lead payload; `labelKey` resolves the localized display text.
const SCREENING_QUESTIONS = [
  {
    key: "teamSize",
    labelKey: "contact.screen.teamSize.label",
    options: [
      { value: "2-5 people", code: "2-5", labelKey: "contact.screen.teamSize.opt.2_5" },
      { value: "6-10 people", code: "6-10", labelKey: "contact.screen.teamSize.opt.6_10" },
      { value: "11-20 people", code: "11-20", labelKey: "contact.screen.teamSize.opt.11_20" },
      { value: "20+ people", code: "20+", labelKey: "contact.screen.teamSize.opt.20plus" },
    ],
  },
  {
    key: "topPain",
    labelKey: "contact.screen.topPain.label",
    options: [
      {
        value: "Unexplained software and cloud costs",
        code: "costs",
        labelKey: "contact.screen.topPain.opt.costs",
      },
      {
        value: "Fragile or undocumented infrastructure",
        code: "fragile",
        labelKey: "contact.screen.topPain.opt.fragile",
      },
      {
        value: "Slow delivery and too many manual steps",
        code: "slow",
        labelKey: "contact.screen.topPain.opt.slow",
      },
      {
        value: "Scattered tools with no visibility",
        code: "scatter",
        labelKey: "contact.screen.topPain.opt.scatter",
      },
      { value: "Not sure yet", code: "unsure", labelKey: "contact.screen.topPain.opt.unsure" },
    ],
  },
  {
    key: "setupState",
    labelKey: "contact.screen.setupState.label",
    options: [
      {
        value: "Messy multi-cloud sprawl",
        code: "sprawl",
        labelKey: "contact.screen.setupState.opt.sprawl",
      },
      {
        value: "One cloud, but unmanaged",
        code: "unmanaged",
        labelKey: "contact.screen.setupState.opt.unmanaged",
      },
      {
        value: "Mostly manual processes",
        code: "manual",
        labelKey: "contact.screen.setupState.opt.manual",
      },
      {
        value: "Early stage, little in place",
        code: "early",
        labelKey: "contact.screen.setupState.opt.early",
      },
    ],
  },
  {
    key: "timeline",
    labelKey: "contact.screen.timeline.label",
    options: [
      { value: "This month", code: "month", labelKey: "contact.screen.timeline.opt.month" },
      { value: "This quarter", code: "quarter", labelKey: "contact.screen.timeline.opt.quarter" },
      {
        value: "Just exploring",
        code: "exploring",
        labelKey: "contact.screen.timeline.opt.exploring",
      },
    ],
  },
] as const;
// Form status literals — extracted to satisfy sonarjs/no-duplicate-string (S1192).
const FORM_STATUS_IDLE = "idle" as const;
const FORM_STATUS_SENDING = "sending" as const;
const FORM_STATUS_SENT = "sent" as const;
const FORM_STATUS_ERROR = "error" as const;
// LinkedIn Campaign Manager conversion ID for bf2026 "contact_created"
// (LEAD rule, CONVERSIONS_API). Server-side CAPI fires from /api/contact via
// fireLinkedInServerConversion — this ID is only for the browser Insight Tag
// dual-fire; the campaign-slug CAPI mirror intentionally stays a no-op so the
// same lead is not double-counted.
const BF2026_LINKEDIN_CONVERSION_ID = 30589812;
type FormStatus =
  | typeof FORM_STATUS_IDLE
  | typeof FORM_STATUS_SENDING
  | typeof FORM_STATUS_SENT
  | typeof FORM_STATUS_ERROR;

export default function ContactFormSection({ source = "" }: { source?: string }) {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const [status, setStatus] = useState<FormStatus>(FORM_STATUS_IDLE);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const onTurnstile = useCallback((token: string | null) => setTurnstileToken(token), []);
  const searchParams = useSearchParams();

  // Pre-fill message from checkout / campaign redirect context
  const topic = searchParams.get("topic");
  const products = searchParams.get("products");
  const campaign = searchParams.get("campaign");
  const utmCampaign = searchParams.get("utm_campaign");
  const tier = searchParams.get("tier");
  const price = searchParams.get("price");
  const isBf2026 = campaign === "bf2026" || utmCampaign === "bf2026";
  const effectiveCampaign = campaign ?? (isBf2026 ? "bf2026" : null);
  const isPurchaseFlow = topic === "purchase";
  const isFitCallFlow = topic === "fit-call" || Boolean(campaign);
  const showCampaignBanner = isPurchaseFlow || isFitCallFlow || isBf2026;

  let defaultMessage = "";
  if (isBf2026) {
    defaultMessage = t(
      "contact.bf2026Prefill",
      "I'd like to book the free 30-minute Digital Department audit (Black Friday offer)."
    );
  } else if (isPurchaseFlow || isFitCallFlow) {
    const parts: string[] = [];
    if (isFitCallFlow && !isPurchaseFlow) {
      parts.push("I'd like a free 20-min fit call.");
    }
    if (products) parts.push(`Products: ${products}`);
    if (campaign) parts.push(`Campaign: ${campaign}`);
    if (tier) parts.push(`Tier: ${tier}`);
    if (price) parts.push(`Price: ${price}`);
    defaultMessage = parts.join("\n");
  }

  // Auto-select service based on product / campaign context
  const defaultService = showCampaignBanner ? "Not sure yet — let's discuss" : "";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(FORM_STATUS_SENDING);

    const form = e.currentTarget;
    const rawMessage = (form.elements.namedItem(FIELD_MESSAGE) as HTMLTextAreaElement).value;
    // Screening answers ride inside `message` so every downstream surface
    // (admin email, Slack, CRM, NLP scoring) sees them without API changes.
    // Compact `key=code` tokens keep the block ~75 chars so the visitor's
    // message survives downstream 500-char slices (Slack/email/CRM).
    const screeningPairs = isBf2026
      ? SCREENING_QUESTIONS.map((q) => {
          const node = form.elements.namedItem(`screening-${q.key}`) as RadioNodeList | null;
          const opt = q.options.find((o) => o.value === node?.value);
          return opt ? `${q.key}=${opt.code}` : null;
        }).filter((pair): pair is string => pair !== null)
      : [];
    const message =
      screeningPairs.length > 0
        ? `[screen] ${screeningPairs.join("|")}\n\n${rawMessage}`
        : rawMessage;
    const payload = {
      name: (form.elements.namedItem(FIELD_NAME) as HTMLInputElement).value,
      email: (form.elements.namedItem(FIELD_EMAIL) as HTMLInputElement).value,
      company: (form.elements.namedItem(FIELD_COMPANY) as HTMLInputElement).value,
      service: (form.elements.namedItem(FIELD_SERVICE) as unknown as HTMLSelectElement).value,
      message,
      // First-touch UTM/referrer attribution captured by <AttributionCapture />.
      attribution: getStoredAttribution() ?? undefined,
      turnstileToken: turnstileToken ?? undefined,
      // Distinguishes inline homepage form from /contact page.
      source: source || undefined,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as {
          eventId?: string;
        } | null;
        // Browser-side Lead event with the same eventId the server sent to CAPI.
        // No-ops if the pixel is not loaded.
        trackPixelEvent(
          "Lead",
          {
            content_name: payload.service || "contact_form",
            ...(source ? { source } : {}),
          },
          data?.eventId
        );

        // Campaign / fit-call arrivals dual-fire LinkedIn Insight Tag + CAPI.
        if (effectiveCampaign) {
          const meta = getCampaign(effectiveCampaign);
          fireCampaignConversion({
            campaign: effectiveCampaign,
            tier: tier ?? (topic === "fit-call" ? "fit-call" : null),
            orderId: `lead-${Date.now()}`,
            conversionId:
              meta?.linkedinConversionId ?? (isBf2026 ? BF2026_LINKEDIN_CONVERSION_ID : null),
            customer: {
              name: payload.name,
              email: payload.email,
            },
          });
        }

        setStatus(FORM_STATUS_SENT);
        form.reset();
      } else {
        setStatus(FORM_STATUS_ERROR);
      }
    } catch {
      setStatus(FORM_STATUS_ERROR);
    }
  }

  return (
    <section className="bg-void dot-matrix py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">
          {/* Form */}
          <div className="lg:col-span-3" data-testid="contact-form-panel">
            {isBf2026 && status !== FORM_STATUS_SENT && (
              <div
                className="border-neon-cyan/40 bg-neon-cyan/5 mb-6 rounded-xl border p-5"
                data-testid="bf2026-offer-banner"
              >
                <p className="text-neon-cyan font-mono text-xs font-semibold tracking-[0.2em]">
                  {t("contact.bf2026Kicker", "[ BLACK FRIDAY — ENDS NOV 30 ]")}
                </p>
                <p className="font-heading mt-2 text-lg font-bold text-white">
                  {t("contact.bf2026Title", "Your free 30-minute Digital Department audit")}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                  <li>
                    {t(
                      "contact.bf2026Item1",
                      "✓ We map where your setup burns money — you leave with the written roadmap."
                    )}
                  </li>
                  <li>
                    {t(
                      "contact.bf2026Item2",
                      "✓ Free 12-Automation Checklist + 50% off website design when you book this week."
                    )}
                  </li>
                  <li>
                    {t(
                      "contact.bf2026Item3",
                      "✓ Fixed scope, one point of contact, no lock-in — yours to keep, no pitch."
                    )}
                  </li>
                </ul>
                <p className="mt-3 text-xs text-slate-400">
                  {t(
                    "contact.bf2026Sub",
                    "Answer 4 quick questions below, then leave your details — we confirm your slot within 24 hours."
                  )}
                </p>
              </div>
            )}
            {!isBf2026 && showCampaignBanner && status !== FORM_STATUS_SENT && (
              <div className="border-neon-cyan/30 bg-neon-cyan/5 mb-6 rounded-xl border p-4">
                <div className="flex items-start gap-3">
                  <span className="text-neon-cyan mt-0.5 text-lg">&#9889;</span>
                  <div>
                    <p className="font-mono text-sm font-semibold text-white">
                      {isFitCallFlow && !isPurchaseFlow
                        ? t(
                            "contact.fitCallIntent",
                            "Book your free fit call — leave your details below."
                          )
                        : t("contact.purchaseIntent", "Almost there! Tell us about your project.")}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {(() => {
                        if (tier && price) return `${tier} — ${price}`;
                        if (campaign) return `Campaign: ${campaign}`;
                        return products || "";
                      })()}
                      {" — "}
                      {t(
                        "contact.purchaseIntentSub",
                        "Fill in your details and we'll send you a tailored proposal within 24 hours."
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {status === FORM_STATUS_SENT ? (
              <ScrollReveal>
                <div className="neon-border bg-void-light rounded-lg p-10 text-center">
                  <div className="text-neon-cyan mb-4 font-mono text-4xl">✓</div>
                  <h2 className="font-heading text-2xl font-bold text-white">
                    {t("contact.success", "Message sent successfully!")}
                  </h2>
                  <p className="mt-2 text-slate-400">
                    {t(
                      "contact.subtitle",
                      "Ready to go cloudless? Tell us about your project and we'll get back to you within 24 hours."
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus(FORM_STATUS_IDLE)}
                    className="text-neon-cyan mt-6 font-mono text-sm font-semibold transition-colors hover:text-white"
                  >
                    {t("contact.sendAnother", "Send another message →")}
                  </button>
                </div>
              </ScrollReveal>
            ) : (
              <form data-testid="contact-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor={FIELD_NAME} className={LABEL_CLASS}>
                      {t("contact.name", "Name")} *
                    </label>
                    <input
                      id={FIELD_NAME}
                      name={FIELD_NAME}
                      type="text"
                      required
                      placeholder="John Doe"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor={FIELD_EMAIL} className={LABEL_CLASS}>
                      {t("contact.email", "Email")} *
                    </label>
                    <input
                      id={FIELD_EMAIL}
                      name={FIELD_EMAIL}
                      type="email"
                      required
                      placeholder="john@company.com"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={FIELD_COMPANY} className={LABEL_CLASS}>
                    {t("contact.company", "Company")}
                  </label>
                  <input
                    id={FIELD_COMPANY}
                    name={FIELD_COMPANY}
                    type="text"
                    placeholder="Acme Inc."
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor={FIELD_SERVICE} className={LABEL_CLASS}>
                    {t("contact.serviceOfInterest", "SERVICE OF INTEREST")}
                  </label>
                  <select
                    id={FIELD_SERVICE}
                    name={FIELD_SERVICE}
                    defaultValue={defaultService}
                    className={SELECT_CLASS}
                  >
                    <option value="">Select a service</option>
                    {serviceOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {isBf2026 && (
                  <fieldset className="border-neon-cyan/20 rounded-lg border p-4">
                    <legend className="text-neon-cyan px-1 font-mono text-xs font-semibold tracking-wider">
                      {t(
                        "contact.bf2026ScreeningTitle",
                        "4 quick questions so we can make the audit count:"
                      )}
                    </legend>
                    <p className="mb-4 text-xs text-slate-500">
                      {t(
                        "contact.bf2026ScreeningHint",
                        "20 seconds — helps us qualify your setup before the call."
                      )}
                    </p>
                    <div className="space-y-5">
                      {SCREENING_QUESTIONS.map((q) => (
                        <fieldset key={q.key} className="m-0 border-0 p-0">
                          <legend className={LABEL_CLASS}>{t(q.labelKey, q.key)} *</legend>
                          <div className="flex flex-wrap gap-x-5 gap-y-2">
                            {q.options.map((opt, optIdx) => {
                              const inputId = `screening-${q.key}-${optIdx}`;
                              return (
                                <label
                                  key={opt.value}
                                  htmlFor={inputId}
                                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"
                                >
                                  <input
                                    id={inputId}
                                    type="radio"
                                    name={`screening-${q.key}`}
                                    value={opt.value}
                                    required
                                    className="h-4 w-4 accent-cyan-400"
                                  />
                                  {t(opt.labelKey, opt.value)}
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  </fieldset>
                )}

                <div>
                  <label htmlFor={FIELD_MESSAGE} className={LABEL_CLASS}>
                    {t("contact.message", "Message")} *
                  </label>
                  <textarea
                    id={FIELD_MESSAGE}
                    name={FIELD_MESSAGE}
                    required
                    rows={5}
                    defaultValue={defaultMessage}
                    placeholder="What are you working on? What challenges are you facing?"
                    className={TEXTAREA_CLASS}
                  />
                </div>

                {/* GDPR consent checkbox */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="privacy-consent"
                    name="privacyConsent"
                    required
                    className="border-neon-cyan/30 bg-void mt-0.5 h-5 w-5 shrink-0 rounded border accent-cyan-400"
                  />
                  <label
                    htmlFor="privacy-consent"
                    className="text-sm leading-relaxed text-slate-400"
                  >
                    {t(
                      "contact.privacyConsent",
                      "I agree that my data will be processed to respond to my enquiry, as described in the"
                    )}{" "}
                    <Link href="/privacy" className="text-neon-cyan underline underline-offset-2">
                      {t("legal.privacyTitle", "Privacy Policy")}
                    </Link>
                    . *
                  </label>
                </div>

                <TurnstileWidget onToken={onTurnstile} className="my-2" />

                {status === FORM_STATUS_ERROR && (
                  <p role="alert" className="text-neon-magenta font-mono text-sm">
                    Something went wrong. Please try again or email us directly at{" "}
                    <a href="mailto:tbaltzakis@cloudless.gr" className="text-neon-cyan underline">
                      tbaltzakis@cloudless.gr
                    </a>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === FORM_STATUS_SENDING}
                  className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 w-full rounded-lg border px-10 py-3.5 font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)] disabled:opacity-40 sm:w-auto"
                >
                  {status === FORM_STATUS_SENDING
                    ? t("contact.sending", "Sending...")
                    : t("contact.submit", "Send Message")}
                </button>
              </form>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8 lg:col-span-2" data-testid="contact-info">
            <ScrollReveal>
              <div className="neon-border bg-void-light/50 rounded-lg p-8">
                <h2 className="font-heading text-lg font-bold text-white">What happens next?</h2>
                <ol className="mt-4 space-y-4 text-sm text-slate-400">
                  {[
                    "We review your message and get back within 24 hours.",
                    "Free 30-minute audit call to understand your needs.",
                    "Custom proposal with clear scope, timeline & pricing.",
                  ].map((step, i) => (
                    <li key={step} className="flex gap-3">
                      <span className="border-neon-cyan/30 text-neon-cyan flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="neon-border bg-void-light/50 rounded-lg p-8">
                <h3 className="font-heading text-lg font-bold text-white">Direct Contact</h3>
                <div className="mt-4 space-y-3 font-mono text-sm">
                  <p>
                    <span className={SIDEBAR_LABEL_CLASS}>EMAIL:</span>{" "}
                    <a
                      href="mailto:tbaltzakis@cloudless.gr"
                      className="text-neon-cyan text-xs hover:underline"
                    >
                      tbaltzakis@cloudless.gr
                    </a>
                  </p>
                  <p>
                    <span className={SIDEBAR_LABEL_CLASS}>VIDEO CALL:</span>{" "}
                    <a
                      href="https://cloud.cloudless.gr/call/zsykkx97"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10 mt-1 inline-flex items-center rounded-lg border px-3 py-1.5 font-mono text-xs font-medium transition-colors"
                    >
                      Join a Talk call — no account needed
                    </a>
                  </p>
                  <p>
                    <span className={SIDEBAR_LABEL_CLASS}>LOCATION:</span>{" "}
                    <span className="text-xs text-slate-400">Greece, EU</span>
                  </p>
                  <p>
                    <span className={SIDEBAR_LABEL_CLASS}>RESPONSE:</span>{" "}
                    <span className="text-xs text-slate-400">Within 24 hours</span>
                  </p>
                </div>

                <div className="border-neon-cyan/10 mt-6 border-t pt-4">
                  <p className="text-neon-cyan/70 mb-3 font-mono text-[10px] font-medium tracking-[0.3em]">
                    CONNECT
                  </p>
                  <SocialLinks />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
