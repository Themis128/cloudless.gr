import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import ContactFormSection from "@/components/ContactFormSection";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { translate } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";

export const metadata: Metadata = {
  title: "Contact Us",
};

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

      <ContactFormSection />
    </>
  );
}
