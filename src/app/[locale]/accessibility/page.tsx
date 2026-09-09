import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { translate, getMessages, isSupportedLocale, type Locale } from "@/lib/i18n";

const BASE_URL = "https://cloudless.gr";
const canonical = `${BASE_URL}/accessibility`;

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
  const title = meta?.accessibility?.title ?? "Accessibility Statement";
  const description =
    meta?.accessibility?.description ??
    "Cloudless.gr accessibility statement — WCAG 2.1 AA compliance and contact for assistance.";

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${BASE_URL}/en/accessibility`,
        el: `${BASE_URL}/el/accessibility`,
        de: `${BASE_URL}/de/accessibility`,
        fr: `${BASE_URL}/fr/accessibility`,
        "x-default": `${BASE_URL}/en/accessibility`,
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

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-heading mb-4 text-xl font-bold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export default async function AccessibilityPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isSupportedLocale(rawLocale) ? rawLocale : "en";
  setRequestLocale(rawLocale);
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const tArr = (key: string, fallback: string[]) => {
    const messages = getMessages(locale) as Record<string, unknown>;
    const section = messages.accessibilityPage as Record<string, unknown> | undefined;
    const candidate = section?.[key];
    return Array.isArray(candidate) ? (candidate as string[]) : fallback;
  };

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Accessibility", url: "https://cloudless.gr/accessibility" },
        ])}
      />
      <div className="bg-void min-h-screen">
        <div className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
          <ScrollReveal>
            <p className="text-neon-cyan/70 mb-4 font-mono text-xs tracking-widest">
              {t("accessibilityPage.legalDocument", "LEGAL DOCUMENT")}
            </p>
            <h1 className="font-heading mb-4 text-3xl font-bold text-white lg:text-4xl">
              {t("accessibilityPage.title", "Accessibility Statement")}
            </h1>
            <p className="mb-2 font-mono text-xs text-slate-500">
              {t("accessibilityPage.lastUpdated", "Last updated: June 2026")}
            </p>
            <p className="mb-12 text-sm leading-relaxed text-slate-400">
              {t(
                "accessibilityPage.intro",
                "Cloudless is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards."
              )}
            </p>
          </ScrollReveal>

          <div className="space-y-10">
            <ScrollReveal>
              <Section
                id="conformance"
                title={t("accessibilityPage.conformanceTitle", "Conformance Status")}
              >
                <p>
                  {t(
                    "accessibilityPage.conformanceText",
                    "Cloudless.gr aims to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA as required by the EU Web Accessibility Directive (Directive 2016/2102) and the European Accessibility Act (Directive 2019/882)."
                  )}
                </p>
                <p>
                  {t(
                    "accessibilityPage.conformancePartial",
                    "We are partially conformant — most content meets WCAG 2.1 AA. Known limitations are listed below."
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section id="measures" title={t("accessibilityPage.measuresTitle", "Measures Taken")}>
                <p>
                  {t(
                    "accessibilityPage.measuresIntro",
                    "We have implemented the following to support accessibility:"
                  )}
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {tArr("measuresList", [
                    "Semantic HTML5 landmarks and heading hierarchy on all pages",
                    "Keyboard navigability across all interactive elements",
                    "ARIA labels on icon-only buttons and form controls",
                    "Minimum 4.5:1 colour contrast ratio for body text (AA)",
                    "Minimum 44×44px touch targets for all interactive elements",
                    "Skip-to-content link on every page",
                    "Focus trap and Escape-key handling in all modal dialogs",
                    "Reduced-motion support via prefers-reduced-motion",
                    "All images have descriptive alt attributes",
                    "Forms include visible labels and autocomplete attributes",
                  ]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="limitations"
                title={t("accessibilityPage.limitationsTitle", "Known Limitations")}
              >
                <p>
                  {t(
                    "accessibilityPage.limitationsIntro",
                    "The following known issues are being addressed:"
                  )}
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {tArr("limitationsList", [
                    "Some third-party embedded content (e.g. EspoCRM forms) may not fully meet WCAG 2.1 AA — we are working with vendors on remediation",
                    "3D particle effects are decorative and hidden from assistive technologies; they respect prefers-reduced-motion",
                  ]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="feedback"
                title={t("accessibilityPage.feedbackTitle", "Feedback & Contact")}
              >
                <p>
                  {t(
                    "accessibilityPage.feedbackText",
                    "If you experience any accessibility barrier on cloudless.gr, please contact us:"
                  )}
                </p>
                <p className="font-mono text-xs">
                  Email:{" "}
                  <a
                    href="mailto:tbaltzakis@cloudless.gr"
                    className="text-neon-cyan hover:underline"
                  >
                    tbaltzakis@cloudless.gr
                  </a>
                </p>
                <p>
                  {t(
                    "accessibilityPage.feedbackResponse",
                    "We aim to respond to accessibility feedback within 5 business days."
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="enforcement"
                title={t("accessibilityPage.enforcementTitle", "Enforcement")}
              >
                <p>
                  {t(
                    "accessibilityPage.enforcementText",
                    "If you are not satisfied with our response, you may contact the Hellenic Data Protection Authority (HDPA) or your national supervisory body."
                  )}
                </p>
                <p>
                  {t(
                    "accessibilityPage.enforcementUs",
                    "US users may contact us directly or file a complaint under Section 508 of the Rehabilitation Act where applicable."
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <div className="text-sm text-slate-500">
                <Link href="/privacy" className="text-neon-cyan hover:underline">
                  {t("accessibilityPage.privacyLink", "Privacy Policy")}
                </Link>
                {" · "}
                <Link href="/terms" className="text-neon-cyan hover:underline">
                  {t("accessibilityPage.termsLink", "Terms of Service")}
                </Link>
                {" · "}
                <Link href="/cookies" className="text-neon-cyan hover:underline">
                  {t("accessibilityPage.cookiesLink", "Cookie Policy")}
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </>
  );
}
