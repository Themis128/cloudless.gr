export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import ContactFormSection from "@/components/ContactFormSection";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { translate, getMessages, isSupportedLocale, type Locale } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";

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
  return {
    title: meta?.contact?.title ?? "Contact Us",
    description: meta?.contact?.description,
  };
}

export default async function ContactPage() {
  const locale = await getServerLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Contact", url: "https://cloudless.gr/contact" },
        ])}
      />

      {/* Header */}
      <section className="bg-void scanlines relative overflow-hidden py-16 text-white md:py-20">
        <div className="cyber-grid absolute inset-0 opacity-30" />
        <div className="bg-neon-cyan/5 animate-float absolute top-0 left-1/4 h-[400px] w-[400px] -translate-y-1/2 rounded-full blur-3xl" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <p className="animate-shimmer-text mb-3 font-mono text-xs font-medium tracking-[0.3em]">
            [ CONTACT ]
          </p>
          <h1 className="animate-fade-in-up font-heading text-3xl leading-tight font-bold delay-100 md:text-5xl">
            {t("contact.title", "Get in touch.")}
          </h1>
          <p className="animate-fade-in-up mt-4 max-w-xl text-lg text-slate-400 delay-200">
            {t(
              "contact.subtitle",
              "Ready to go cloudless? Tell us about your project and we'll get back to you within 24 hours."
            )}
          </p>
        </div>
      </section>

      <div className="animate-scale-in delay-300">
        <ContactFormSection />
      </div>
    </>
  );
}
