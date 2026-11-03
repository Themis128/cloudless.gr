export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import ScrollReveal from "@/components/ScrollReveal";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { translate, getMessages, isSupportedLocale, type Locale } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";
import ConsultationBooking from "./ConsultationBooking";

const BASE_URL = "https://cloudless.gr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : "en";
  const messages = getMessages(safeLocale);
  const meta = (messages as Record<string, unknown>).meta as
    Record<string, Record<string, string>> | undefined;
  const title = meta?.consultation?.title ?? "Book a Free 30-Minute Consultation — Cloudless";
  const description =
    meta?.consultation?.description ??
    "Pick a live slot for a free 30-minute consultation. Senior-engineer review of your cloud, automation, or AI setup — leave with a concrete plan.";
  const canonical = `${BASE_URL}/${safeLocale}/consultation`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${BASE_URL}/en/consultation`,
        el: `${BASE_URL}/el/consultation`,
        de: `${BASE_URL}/de/consultation`,
        fr: `${BASE_URL}/fr/consultation`,
        "x-default": `${BASE_URL}/en/consultation`,
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${BASE_URL}/consultation`,
      siteName: "Cloudless",
    },
  };
}

export default async function ConsultationPage() {
  const locale = await getServerLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  const steps = [
    {
      title: t("consultation.step1", "Pick a slot"),
      desc: t("consultation.step1Desc", "Live availability — choose any open 30-minute window."),
    },
    {
      title: t("consultation.step2", "Meet on video"),
      desc: t("consultation.step2Desc", "You get a calendar invite + meeting link instantly."),
    },
    {
      title: t("consultation.step3", "Leave with a plan"),
      desc: t("consultation.step3Desc", "Concrete next steps, honest scope, zero pressure."),
    },
  ];

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Consultation", url: "https://cloudless.gr/consultation" },
        ])}
      />

      {/* Header */}
      <section className="bg-void scanlines relative overflow-hidden py-16 text-white md:py-20">
        <div className="cyber-grid absolute inset-0 opacity-30" />
        <div className="bg-neon-cyan/5 animate-float absolute top-0 left-1/4 h-[400px] w-[400px] -translate-y-1/2 rounded-full blur-3xl" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <p className="animate-shimmer-text mb-3 font-mono text-xs font-medium tracking-[0.3em]">
            [ BOOK A CALL ]
          </p>
          <h1 className="animate-fade-in-up font-heading text-3xl leading-tight font-bold delay-100 md:text-5xl">
            {t("consultation.title", "Book your free consultation.")}
          </h1>
          <p className="animate-fade-in-up mt-4 max-w-xl text-lg text-slate-400 delay-200">
            {t(
              "consultation.subtitle",
              "30 minutes with a senior engineer — not a salesperson. Pick a slot that works for you."
            )}
          </p>
        </div>
      </section>

      <section className="bg-void dot-matrix py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <ConsultationBooking />
            </div>

            {/* Sidebar — what to expect */}
            <div className="space-y-8 lg:col-span-2">
              <ScrollReveal>
                <div className="neon-border bg-void-light/50 rounded-lg p-8">
                  <h2 className="font-heading text-lg font-bold text-white">
                    {t("consultation.whatToExpect", "What happens")}
                  </h2>
                  <ol className="mt-4 space-y-4 text-sm text-slate-400">
                    {steps.map((step, i) => (
                      <li key={step.title} className="flex gap-3">
                        <span className="border-neon-cyan/30 text-neon-cyan flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold">
                          {i + 1}
                        </span>
                        <span>
                          <span className="block font-semibold text-white">{step.title}</span>
                          {step.desc}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={100}>
                <div className="neon-border bg-void-light/50 rounded-lg p-8">
                  <h3 className="font-heading text-lg font-bold text-white">
                    {t("consultation.preferWriting", "Prefer writing?")}
                  </h3>
                  <p className="mt-3 text-sm text-slate-400">
                    {t(
                      "consultation.preferWritingDesc",
                      "Tell us about your project in the contact form and we'll reply within 24 hours."
                    )}
                  </p>
                  <a
                    href="mailto:tbaltzakis@cloudless.gr"
                    className="text-neon-cyan mt-4 block font-mono text-xs hover:underline"
                  >
                    tbaltzakis@cloudless.gr
                  </a>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
