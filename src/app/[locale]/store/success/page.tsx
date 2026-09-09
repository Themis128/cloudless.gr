export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { translate, getMessages, isSupportedLocale, type Locale } from "@/lib/i18n";

const BASE_URL = "https://cloudless.gr";
const canonical = `${BASE_URL}/store/success`;

type PageProps = {
  params: Promise<{ locale: string }>;
};

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
  const storeMeta = meta?.store;
  const title = storeMeta?.title ? `${storeMeta.title} — OK` : "Order Confirmed";
  const description = meta?.store?.description ?? "Thank you for your purchase from Cloudless.";

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${BASE_URL}/en/store/success`,
        el: `${BASE_URL}/el/store/success`,
        de: `${BASE_URL}/de/store/success`,
        fr: `${BASE_URL}/fr/store/success`,
        "x-default": `${BASE_URL}/en/store/success`,
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: "Cloudless",
    },
  };
}

/* Static Tailwind class maps — dynamic template literals like `bg-${x}` are
   invisible to Tailwind's JIT compiler, so we spell out every variant. */
const accentClasses = {
  "neon-cyan": {
    box: "bg-neon-cyan/10 border-neon-cyan/20",
    text: "text-neon-cyan",
  },
  "neon-magenta": {
    box: "bg-neon-magenta/10 border-neon-magenta/20",
    text: "text-neon-magenta",
  },
  "neon-green": {
    box: "bg-neon-green/10 border-neon-green/20",
    text: "text-neon-green",
  },
} as const;

type Accent = keyof typeof accentClasses;

export default async function SuccessPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isSupportedLocale(rawLocale) ? rawLocale : "en";
  setRequestLocale(rawLocale);
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  const nextSteps: {
    icon: string;
    title: string;
    description: string;
    accent: Accent;
  }[] = [
    {
      icon: "\u2699",
      title: t("storeSuccess.servicePurchasesTitle", "Service purchases"),
      description: t(
        "storeSuccess.servicePurchasesDesc",
        "Our team will reach out within 24 hours to schedule your kickoff call. Check your inbox for a calendar invite."
      ),
      accent: "neon-cyan",
    },
    {
      icon: "\u21E9",
      title: t("storeSuccess.digitalProductsTitle", "Digital products"),
      description: t(
        "storeSuccess.digitalProductsDesc",
        "Download links have been sent to your email. You can access your files immediately. Updates are included for life."
      ),
      accent: "neon-magenta",
    },
    {
      icon: "\u2709",
      title: t("storeSuccess.physicalItemsTitle", "Physical items"),
      description: t(
        "storeSuccess.physicalItemsDesc",
        "Your order is being prepared. You will receive a shipping confirmation with tracking within 2 business days. Free EU shipping."
      ),
      accent: "neon-green",
    },
  ];

  return (
    <>
      <section className="bg-void scanlines relative py-20 md:py-28">
        <div className="cyber-grid absolute inset-0 opacity-20" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <div className="text-neon-cyan glow-cyan mb-6 font-mono text-6xl">&#x2713;</div>
          <h1 className="font-heading text-3xl font-bold text-white md:text-4xl">
            {t("storeSuccess.title", "Order")}{" "}
            <span className="from-neon-cyan to-neon-green bg-gradient-to-r bg-clip-text text-transparent">
              {t("storeSuccess.titleHighlight", "confirmed")}
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-400">
            {t(
              "storeSuccess.subtitle",
              "Thanks for your purchase. A confirmation email with your order details and any download links is on its way."
            )}
          </p>
        </div>
      </section>

      {/* Next steps by product type */}
      <section className="bg-void border-t border-slate-800 py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-neon-cyan mb-2 font-mono text-xs font-medium tracking-[0.3em]">
            {t("storeSuccess.nextStepsLabel", "[ WHAT HAPPENS NEXT ]")}
          </p>
          <h2 className="font-heading mb-10 text-2xl font-bold text-white">
            {t("storeSuccess.nextStepsTitle", "Next steps for your order")}
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {nextSteps.map((step) => (
              <div
                key={step.title}
                className="bg-void-light/50 rounded-xl border border-slate-800 p-6"
              >
                <div
                  className={`h-10 w-10 ${accentClasses[step.accent].box} mb-4 flex items-center justify-center rounded-lg border text-lg`}
                >
                  <span className={accentClasses[step.accent].text}>{step.icon}</span>
                </div>
                <h3 className="mb-2 text-sm font-semibold text-white">{step.title}</h3>
                <p className="text-xs leading-relaxed text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Support + CTA */}
      <section className="bg-void border-t border-slate-800 py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="mb-6 font-mono text-sm text-slate-500">
            {t("storeSuccess.questions", "Questions? Reach us at")}{" "}
            <a href="mailto:tbaltzakis@cloudless.gr" className="text-neon-cyan hover:underline">
              tbaltzakis@cloudless.gr
            </a>
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/store"
              className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 rounded-lg border px-8 py-3 text-center font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)]"
            >
              {t("storeSuccess.continueShopping", "Continue Shopping")}
            </Link>
            <Link
              href="/"
              className="hover:border-neon-cyan/30 hover:text-neon-cyan rounded-lg border border-slate-700 px-8 py-3 text-center font-mono font-semibold text-slate-400 transition-all duration-300"
            >
              {t("storeSuccess.backToHome", "Back to Home")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
