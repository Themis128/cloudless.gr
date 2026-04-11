import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { translate } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Cloudless.gr collects, uses, and protects your personal data. GDPR and CCPA compliant.",
};

/* ── Section helper ──────────────────────────────────────── */

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
      <h2 className="text-neon-cyan/80 mb-4 font-heading text-xl font-bold text-white">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">
        {children}
      </div>
    </section>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

export default async function PrivacyPolicyPage() {
  const locale = await getServerLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Privacy Policy", url: "https://cloudless.gr/privacy" },
        ])}
      />

      <div className="bg-void min-h-screen">
        <div className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
          <ScrollReveal>
            <p className="text-neon-cyan/70 mb-4 font-mono text-xs tracking-widest">
              {t("legal.legalDocument", "LEGAL DOCUMENT")}
            </p>
            <h1 className="mb-4 font-heading text-3xl font-bold text-white lg:text-4xl">
              {t("legal.privacyTitle", "Privacy Policy")}
            </h1>
            <p className="mb-2 font-mono text-xs text-slate-500">
              {t("legal.lastUpdated", "Last updated")}: April 2026
            </p>
            <p className="mb-12 text-sm leading-relaxed text-slate-400">
              {t(
                "legal.privacyIntro",
                'This Privacy Policy explains how Cloudless ("we", "us", "our") collects, uses, discloses, and safeguards your information when you visit cloudless.gr and use our services. We are committed to protecting your privacy in compliance with the EU General Data Protection Regulation (GDPR), the ePrivacy Directive, and the California Consumer Privacy Act (CCPA/CPRA).',
              )}
            </p>
          </ScrollReveal>

          <div className="space-y-10">
            <ScrollReveal>
              <Section
                id="controller"
                title={t("legal.controllerTitle", "1. Data Controller")}
              >
                <p>
                  {t(
                    "legal.controllerText",
                    "The data controller responsible for your personal data is Cloudless, operated by Themistoklis Baltzakis, based in Greece, EU. For data protection inquiries, contact us at:",
                  )}
                </p>
                <p className="font-mono text-xs">
                  {t("legal.controllerEmail", "Email: tbaltzakis@cloudless.gr")}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="data-collected"
                title={t(
                  "legal.dataCollectedTitle",
                  "2. Information We Collect",
                )}
              >
                <p className="font-semibold text-white">
                  {t(
                    "legal.dataProvidedTitle",
                    "Information you provide directly:",
                  )}
                </p>
                <p>
                  {t(
                    "legal.dataProvided",
                    "Name, email address, company name, and message content when you submit our contact form. Email address when you subscribe to our newsletter. Account credentials when you register. Payment information when you purchase products or services (processed by Stripe — we never store card details).",
                  )}
                </p>
                <p className="font-semibold text-white">
                  {t(
                    "legal.dataAutoTitle",
                    "Information collected automatically:",
                  )}
                </p>
                <p>
                  {t(
                    "legal.dataAuto",
                    "IP address (anonymised for analytics), browser type and version, device type, operating system, pages visited, time spent on pages, referring URL. This data is only collected if you consent to analytics cookies.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="legal-basis"
                title={t(
                  "legal.legalBasisTitle",
                  "3. Legal Basis for Processing (GDPR)",
                )}
              >
                <p>
                  {t(
                    "legal.legalBasis",
                    "We process your personal data on the following legal bases: (a) Consent — for newsletter subscriptions, analytics cookies, and marketing cookies. You may withdraw consent at any time. (b) Contract performance — to fulfil orders and deliver services you have purchased. (c) Legitimate interest — for fraud prevention, security, and improving our services. (d) Legal obligation — for tax and accounting records required by Greek and EU law.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="cookies"
                title={t("legal.cookiesTitle", "4. Cookies & Tracking")}
              >
                <p>
                  {t(
                    "legal.cookiesText",
                    "We use cookies in three categories: (1) Necessary cookies — required for the site to function (session management, consent preferences, security). These cannot be disabled. (2) Analytics cookies — help us understand how visitors use the site. Only set with your consent. (3) Marketing cookies — used for targeted advertising. Only set with your consent. You can manage your preferences at any time via the cookie settings link in our footer, or in your browser settings.",
                  )}
                </p>
                <p>
                  <Link
                    href="/cookies"
                    className="text-neon-cyan hover:underline"
                  >
                    {t("legal.fullCookiePolicy", "Read our full Cookie Policy")}
                  </Link>
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="data-use"
                title={t("legal.dataUseTitle", "5. How We Use Your Data")}
              >
                <p>
                  {t(
                    "legal.dataUse",
                    "We use your data to: respond to your contact form enquiries, process and fulfil orders, send newsletter updates (only with consent), improve our website and services, comply with legal obligations, prevent fraud and ensure security, and — with consent — personalise content and advertising.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="data-sharing"
                title={t(
                  "legal.dataSharingTitle",
                  "6. Data Sharing & Third Parties",
                )}
              >
                <p>
                  {t(
                    "legal.dataSharing",
                    "We share data only with processors that are necessary to deliver our services: Stripe (payment processing, US — EU-US Data Privacy Framework certified), Amazon Web Services (hosting and email via SES, EU region), and AWS Cognito (authentication). We do not sell your personal data. Each third-party processor is bound by a Data Processing Agreement (DPA) and processes data only on our instructions.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="data-transfers"
                title={t(
                  "legal.dataTransfersTitle",
                  "7. International Data Transfers",
                )}
              >
                <p>
                  {t(
                    "legal.dataTransfers",
                    "Some of our processors (e.g. Stripe) are based in the United States. These transfers are protected by the EU-US Data Privacy Framework, Standard Contractual Clauses (SCCs), or your explicit consent, in accordance with GDPR Chapter V.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="retention"
                title={t("legal.retentionTitle", "8. Data Retention")}
              >
                <p>
                  {t(
                    "legal.retention",
                    "Contact form submissions: 2 years, then deleted. Newsletter subscriptions: until you unsubscribe. Purchase records: 7 years (Greek tax law requirement). Account data: until you request deletion. Analytics data: 14 months (anonymised). Cookie consent records: 1 year.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="your-rights"
                title={t("legal.yourRightsTitle", "9. Your Rights")}
              >
                <p className="font-semibold text-white">
                  {t(
                    "legal.gdprRightsTitle",
                    "Under the GDPR, you have the right to:",
                  )}
                </p>
                <p>
                  {t(
                    "legal.gdprRights",
                    'Access — request a copy of your personal data. Rectification — correct inaccurate data. Erasure — request deletion of your data ("right to be forgotten"). Restriction — limit how we process your data. Portability — receive your data in a machine-readable format. Objection — object to processing based on legitimate interest. Withdraw consent — at any time, without affecting prior processing.',
                  )}
                </p>
                <p className="font-semibold text-white">
                  {t(
                    "legal.ccpaRightsTitle",
                    "Under the CCPA/CPRA (California residents):",
                  )}
                </p>
                <p>
                  {t(
                    "legal.ccpaRights",
                    "Right to know what personal data we collect and why. Right to delete your personal data. Right to opt out of the sale of personal data (we do not sell your data). Right to non-discrimination for exercising your privacy rights.",
                  )}
                </p>
                <p>
                  {t(
                    "legal.rightsExercise",
                    "To exercise any of these rights, email us at tbaltzakis@cloudless.gr. We will respond within 30 days (GDPR) or 45 days (CCPA).",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="children"
                title={t("legal.childrenTitle", "10. Children's Privacy")}
              >
                <p>
                  {t(
                    "legal.children",
                    "Our services are not directed at children under 16. We do not knowingly collect personal data from children. If you believe we have inadvertently collected such data, please contact us immediately.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="security"
                title={t("legal.securityTitle", "11. Data Security")}
              >
                <p>
                  {t(
                    "legal.security",
                    "We implement appropriate technical and organisational measures to protect your data, including: HTTPS/TLS encryption in transit, encryption at rest for stored data, access controls and authentication, regular security reviews, and incident response procedures.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="complaints"
                title={t("legal.complaintsTitle", "12. Complaints")}
              >
                <p>
                  {t(
                    "legal.complaints",
                    "If you believe we have not handled your data correctly, you have the right to lodge a complaint with the Hellenic Data Protection Authority (HDPA) at www.dpa.gr, or your local supervisory authority if you reside in another EU/EEA country.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="changes"
                title={t("legal.changesTitle", "13. Changes to This Policy")}
              >
                <p>
                  {t(
                    "legal.changes",
                    'We may update this Privacy Policy from time to time. Material changes will be communicated via a notice on our website. The "Last updated" date at the top reflects the most recent revision.',
                  )}
                </p>
              </Section>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </>
  );
}
