"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import SocialLinks from "@/components/SocialLinks";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";
import { trackPixelEvent } from "@/lib/meta-pixel";

const serviceOptions = [
  "Cloud Architecture & Migration",
  "Serverless Development",
  "Data Analytics & Dashboards",
  "AI & Digital Marketing",
  "Full-Stack Growth Engine (Bundle)",
  "Not sure yet — let's discuss",
];

export default function ContactFormSection() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const form = e.currentTarget;
    const payload = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      company: (form.elements.namedItem("company") as HTMLInputElement).value,
      service: (form.elements.namedItem("service") as HTMLSelectElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement)
        .value,
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
          { content_name: payload.service || "contact_form" },
          data?.eventId,
        );
        setStatus("sent");
        form.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="bg-void dot-matrix py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">
          {/* Form */}
          <div className="lg:col-span-3">
            {status === "sent" ? (
              <ScrollReveal>
                <div className="neon-border bg-void-light rounded-lg p-10 text-center">
                  <div className="text-neon-cyan mb-4 font-mono text-4xl">
                    ✓
                  </div>
                  <h2 className="font-heading text-2xl font-bold text-white">
                    {t("contact.success", "Message sent successfully!")}
                  </h2>
                  <p className="mt-2 text-slate-400">
                    {t(
                      "contact.subtitle",
                      "Ready to go cloudless? Tell us about your project and we'll get back to you within 24 hours.",
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="text-neon-cyan mt-6 font-mono text-sm font-semibold transition-colors hover:text-white"
                  >
                    {t("contact.sendAnother", "Send another message →")}
                  </button>
                </div>
              </ScrollReveal>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block font-mono text-xs font-medium tracking-wider text-slate-400"
                    >
                      {t("contact.name", "Name")} *
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      placeholder="John Doe"
                      className="border-neon-cyan/20 bg-void-light focus:border-neon-cyan/60 w-full rounded-lg border px-4 py-3 font-mono text-sm text-white transition-all outline-none placeholder:text-slate-600 focus:shadow-[0_0_10px_rgba(0,255,245,0.1)]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block font-mono text-xs font-medium tracking-wider text-slate-400"
                    >
                      {t("contact.email", "Email")} *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="john@company.com"
                      className="border-neon-cyan/20 bg-void-light focus:border-neon-cyan/60 w-full rounded-lg border px-4 py-3 font-mono text-sm text-white transition-all outline-none placeholder:text-slate-600 focus:shadow-[0_0_10px_rgba(0,255,245,0.1)]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="company"
                    className="mb-2 block font-mono text-xs font-medium tracking-wider text-slate-400"
                  >
                    {t("contact.company", "Company")}
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    placeholder="Acme Inc."
                    className="border-neon-cyan/20 bg-void-light focus:border-neon-cyan/60 w-full rounded-lg border px-4 py-3 font-mono text-sm text-white transition-all outline-none placeholder:text-slate-600 focus:shadow-[0_0_10px_rgba(0,255,245,0.1)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="service"
                    className="mb-2 block font-mono text-xs font-medium tracking-wider text-slate-400"
                  >
                    {t("contact.serviceOfInterest", "SERVICE OF INTEREST")}
                  </label>
                  <select
                    id="service"
                    name="service"
                    className="border-neon-cyan/20 bg-void-light focus:border-neon-cyan/60 w-full rounded-lg border px-4 py-3 font-mono text-sm text-white transition-all outline-none focus:shadow-[0_0_10px_rgba(0,255,245,0.1)]"
                  >
                    <option value="">Select a service</option>
                    {serviceOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="mb-2 block font-mono text-xs font-medium tracking-wider text-slate-400"
                  >
                    {t("contact.message", "Message")} *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    placeholder="What are you working on? What challenges are you facing?"
                    className="border-neon-cyan/20 bg-void-light focus:border-neon-cyan/60 w-full resize-y rounded-lg border px-4 py-3 font-mono text-sm text-white transition-all outline-none placeholder:text-slate-600 focus:shadow-[0_0_10px_rgba(0,255,245,0.1)]"
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
                      "I agree that my data will be processed to respond to my enquiry, as described in the",
                    )}{" "}
                    <Link
                      href="/privacy"
                      className="text-neon-cyan underline underline-offset-2"
                    >
                      {t("legal.privacyTitle", "Privacy Policy")}
                    </Link>
                    . *
                  </label>
                </div>

                {status === "error" && (
                  <p
                    role="alert"
                    className="text-neon-magenta font-mono text-sm"
                  >
                    Something went wrong. Please try again or email us directly
                    at{" "}
                    <a
                      href="mailto:tbaltzakis@cloudless.gr"
                      className="text-neon-cyan underline"
                    >
                      tbaltzakis@cloudless.gr
                    </a>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 w-full rounded-lg border px-10 py-3.5 font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)] disabled:opacity-40 sm:w-auto"
                >
                  {status === "sending"
                    ? t("contact.sending", "Sending...")
                    : t("contact.submit", "Send Message")}
                </button>
              </form>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8 lg:col-span-2">
            <ScrollReveal>
              <div className="neon-border bg-void-light/50 rounded-lg p-8">
                <h3 className="font-heading text-lg font-bold text-white">
                  What happens next?
                </h3>
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
                <h3 className="font-heading text-lg font-bold text-white">
                  Direct Contact
                </h3>
                <div className="mt-4 space-y-3 font-mono text-sm">
                  <p>
                    <span className="text-xs text-slate-500">EMAIL:</span>{" "}
                    <a
                      href="mailto:tbaltzakis@cloudless.gr"
                      className="text-neon-cyan text-xs hover:underline"
                    >
                      tbaltzakis@cloudless.gr
                    </a>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">LOCATION:</span>{" "}
                    <span className="text-xs text-slate-400">Greece, EU</span>
                  </p>
                  <p>
                    <span className="text-xs text-slate-500">RESPONSE:</span>{" "}
                    <span className="text-xs text-slate-400">
                      Within 24 hours
                    </span>
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
