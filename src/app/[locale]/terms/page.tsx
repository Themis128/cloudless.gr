import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { translate } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms and conditions for using Cloudless.gr services and store. Compliant with EU Consumer Rights Directive.",
};

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

export default async function TermsPage() {
  const locale = await getServerLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Terms of Service", url: "https://cloudless.gr/terms" },
        ])}
      />

      <div className="bg-void min-h-screen">
        <div className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
          <ScrollReveal>
            <p className="text-neon-cyan/70 mb-4 font-mono text-xs tracking-widest">
              {t("legal.legalDocument", "LEGAL DOCUMENT")}
            </p>
            <h1 className="mb-4 font-heading text-3xl font-bold text-white lg:text-4xl">
              {t("legal.termsTitle", "Terms of Service")}
            </h1>
            <p className="mb-2 font-mono text-xs text-slate-500">
              {t("legal.lastUpdated", "Last updated")}: April 2026
            </p>
            <p className="mb-12 text-sm leading-relaxed text-slate-400">
              {t(
                "legal.termsIntro",
                'These Terms of Service ("Terms") govern your access to and use of cloudless.gr and all services and products offered by Cloudless ("we", "us", "our"). By using our website or purchasing our services, you agree to these Terms. If you do not agree, please do not use our services.',
              )}
            </p>
          </ScrollReveal>

          <div className="space-y-10">
            <ScrollReveal>
              <Section
                id="provider"
                title={t("legal.providerTitle", "1. Service Provider")}
              >
                <p>
                  {t(
                    "legal.providerText",
                    "Cloudless is operated by Themistoklis Baltzakis, based in Greece, EU. Contact: tbaltzakis@cloudless.gr. As required by the EU eCommerce Directive (2000/31/EC), our full business identification details will be published here upon formal registration.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="services"
                title={t("legal.servicesTitle", "2. Services & Products")}
              >
                <p>
                  {t(
                    "legal.servicesText",
                    "We offer cloud computing consultancy, serverless development, data analytics, and AI-powered digital marketing services. We also sell digital products and service packages through our online store. All prices are displayed in Euros (EUR) and include applicable VAT where required by Greek law.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="orders"
                title={t("legal.ordersTitle", "3. Orders & Payment")}
              >
                <p>
                  {t(
                    "legal.ordersText",
                    "When you place an order, you are making a binding offer to purchase. We confirm acceptance by sending an order confirmation email. Payment is processed securely through Stripe. We accept major credit/debit cards. Prices are final at the time of checkout and include VAT where applicable.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="withdrawal"
                title={t(
                  "legal.withdrawalTitle",
                  "4. Right of Withdrawal (EU Consumers)",
                )}
              >
                <p>
                  {t(
                    "legal.withdrawalText",
                    "Under the EU Consumer Rights Directive (2011/83/EU), you have 14 calendar days from the date of purchase to withdraw from a contract without giving any reason. To exercise this right, email us at tbaltzakis@cloudless.gr with a clear statement of your decision.",
                  )}
                </p>
                <p className="font-semibold text-white">
                  {t("legal.withdrawalExceptions", "Exceptions:")}
                </p>
                <p>
                  {t(
                    "legal.withdrawalExceptionsText",
                    "The right of withdrawal does not apply to: digital content that has been accessed or downloaded (with your prior express consent and acknowledgement), fully performed services (where you agreed performance could begin within the withdrawal period), and custom/personalised services delivered to your specifications.",
                  )}
                </p>
                <p>
                  <Link
                    href="/refund"
                    className="text-neon-cyan hover:underline"
                  >
                    {t(
                      "legal.fullRefundPolicy",
                      "Read our full Refund & Returns Policy",
                    )}
                  </Link>
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="delivery"
                title={t("legal.deliveryTitle", "5. Delivery")}
              >
                <p>
                  {t(
                    "legal.deliveryText",
                    "Digital products are delivered electronically via email or dashboard access immediately after payment confirmation. Service engagements begin according to the timeline agreed in the project scope or service description. Estimated timelines are provided in good faith but are not binding unless explicitly stated.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="ip"
                title={t("legal.ipTitle", "6. Intellectual Property")}
              >
                <p>
                  {t(
                    "legal.ipText",
                    "All content on cloudless.gr — including text, code, design, logos, and graphics — is owned by Cloudless and protected by copyright and intellectual property laws. You may not reproduce, distribute, or create derivative works without our written permission. Work product delivered to clients as part of a paid service engagement is transferred to the client upon full payment, unless otherwise agreed in writing.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="liability"
                title={t("legal.liabilityTitle", "7. Limitation of Liability")}
              >
                <p>
                  {t(
                    "legal.liabilityText",
                    "To the maximum extent permitted by law, Cloudless shall not be liable for any indirect, incidental, consequential, or punitive damages arising from your use of our services. Our total liability for any claim shall not exceed the amount you paid for the specific service giving rise to the claim. Nothing in these Terms excludes or limits liability for death or personal injury, fraud, or any liability that cannot be excluded under applicable law.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="accounts"
                title={t("legal.accountsTitle", "8. User Accounts")}
              >
                <p>
                  {t(
                    "legal.accountsText",
                    "You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You must notify us immediately of any unauthorised use. We reserve the right to suspend or terminate accounts that violate these Terms.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="acceptable-use"
                title={t("legal.acceptableUseTitle", "9. Acceptable Use")}
              >
                <p>
                  {t(
                    "legal.acceptableUseText",
                    "You agree not to: use our services for any unlawful purpose, attempt to gain unauthorised access to our systems, interfere with the proper functioning of the website, upload malicious code or content, impersonate any person or entity, or use automated tools to scrape or harvest data from the site.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="governing-law"
                title={t(
                  "legal.governingLawTitle",
                  "10. Governing Law & Disputes",
                )}
              >
                <p>
                  {t(
                    "legal.governingLawText",
                    "These Terms are governed by the laws of the Hellenic Republic (Greece). Any disputes shall be resolved by the competent courts of Greece. EU consumers retain the right to bring proceedings in their country of residence. You may also use the EU Online Dispute Resolution platform at https://ec.europa.eu/odr.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="terms-changes"
                title={t(
                  "legal.termsChangesTitle",
                  "11. Changes to These Terms",
                )}
              >
                <p>
                  {t(
                    "legal.termsChanges",
                    "We may update these Terms from time to time. Material changes will be communicated via a notice on our website. Continued use of our services after changes constitutes acceptance of the updated Terms.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="contact-legal"
                title={t("legal.contactTitle", "12. Contact")}
              >
                <p>
                  {t(
                    "legal.contactText",
                    "For questions about these Terms, contact us at tbaltzakis@cloudless.gr.",
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
