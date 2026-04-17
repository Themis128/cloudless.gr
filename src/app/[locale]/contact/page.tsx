"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import JsonLd from "@/components/JsonLd";
import ScrollReveal from "@/components/ScrollReveal";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

const serviceOptions = [
  "Cloud Architecture & Migration",
  "Serverless Development",
  "Data Analytics & Dashboards",
  "AI & Digital Marketing",
  "Full-Stack Growth Engine (Bundle)",
  "Not sure yet — let's discuss",
];

export default function ContactPage() {
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
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Contact", url: "https://cloudless.gr/contact" },
        ])}
      />

      {/* Header */}
      <section className="bg-void scanlines relative py-16 text-white md:py-20">
        <div className="cyber-grid absolute inset-0 opacity-30" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <p className="text-neon-cyan mb-3 font-mono text-xs font-medium tracking-[0.3em]">
            [ CONTACT ]
          </p>
          <h1 className="font-heading text-3xl leading-tight font-bold md:text-5xl">
            {t("contact.title", "Get in Touch")}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-400">
            {t(
              "contact.subtitle",
              "Ready to go cloudless? Tell us about your project and we'll get back to you within 24 hours.",
            )}
          </p>
        </div>
      </section>

      {/* Form Section */}
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
                      Send another message →
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
                      SERVICE OF INTEREST
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
                        className="text-neon-cyan hover:underline"
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
                      Something went wrong. Please try again or email us
                      directly at{" "}
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
                    <div className="flex items-center gap-3">
                      <a
                        href="https://linkedin.com/in/baltzakis-themis"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="LinkedIn"
                        className="bg-void/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                      </a>
                      <a
                        href="https://github.com/Themis128"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="GitHub"
                        className="bg-void/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                        </svg>
                      </a>
                      <a
                        href="https://www.credly.com/users/themistoklis-baltzakis"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Credly"
                        className="bg-void/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.3 4.8a7.2 7.2 0 110 14.4 7.2 7.2 0 010-14.4zm0 2.4a4.8 4.8 0 100 9.6 4.8 4.8 0 000-9.6zm0 2.4a2.4 2.4 0 110 4.8 2.4 2.4 0 010-4.8z" />
                        </svg>
                      </a>
                      <a
                        href="https://www.baltzakisthemis.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Portfolio"
                        className="bg-void/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M2 12h20" />
                          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
