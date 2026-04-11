import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { translate } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";

export const metadata: Metadata = {
  title: "Refund & Returns Policy",
  description:
    "Our refund and returns policy, including the EU 14-day right of withdrawal for consumers.",
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

export default async function RefundPolicyPage() {
  const locale = await getServerLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          {
            name: "Refund & Returns Policy",
            url: "https://cloudless.gr/refund",
          },
        ])}
      />

      <div className="bg-void min-h-screen">
        <div className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
          <ScrollReveal>
            <p className="text-neon-cyan/70 mb-4 font-mono text-xs tracking-widest">
              {t("legal.legalDocument", "LEGAL DOCUMENT")}
            </p>
            <h1 className="mb-4 font-heading text-3xl font-bold text-white lg:text-4xl">
              {t("legal.refundTitle", "Refund & Returns Policy")}
            </h1>
            <p className="mb-2 font-mono text-xs text-slate-500">
              {t("legal.lastUpdated", "Last updated")}: April 2026
            </p>
            <p className="mb-12 text-sm leading-relaxed text-slate-400">
              {t(
                "legal.refundIntro",
                "We want you to be completely satisfied with your purchase. This policy outlines your rights regarding refunds and returns, including the EU 14-day right of withdrawal.",
              )}
            </p>
          </ScrollReveal>

          <div className="space-y-10">
            <ScrollReveal>
              <Section
                id="eu-withdrawal"
                title={t(
                  "legal.euWithdrawalTitle",
                  "1. EU Right of Withdrawal (14-Day Cooling-Off Period)",
                )}
              >
                <p>
                  {t(
                    "legal.euWithdrawal",
                    "If you are a consumer in the European Union, you have the right to withdraw from a purchase within 14 calendar days without giving any reason, as guaranteed by the Consumer Rights Directive (2011/83/EU).",
                  )}
                </p>
                <p>
                  {t(
                    "legal.euWithdrawalPeriod",
                    "The withdrawal period expires 14 days after the day of the conclusion of the contract (for services) or the day you receive the goods (for physical products).",
                  )}
                </p>
                <p>
                  {t(
                    "legal.euWithdrawalHow",
                    "To exercise your right of withdrawal, send a clear statement (e.g. by email) to tbaltzakis@cloudless.gr. You may use the model withdrawal form below, but it is not obligatory.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="withdrawal-form"
                title={t(
                  "legal.withdrawalFormTitle",
                  "2. Model Withdrawal Form",
                )}
              >
                <div className="bg-void rounded-lg border border-slate-700 p-4 font-mono text-xs">
                  <p className="mb-2 text-slate-300">
                    {t(
                      "legal.withdrawalFormTo",
                      "To: Cloudless — tbaltzakis@cloudless.gr",
                    )}
                  </p>
                  <p className="mb-2 text-slate-300">
                    {t(
                      "legal.withdrawalFormBody",
                      "I hereby give notice that I withdraw from my contract for the provision of the following service/product: [describe]. Ordered on: [date]. Consumer name: [your name]. Consumer address: [your address]. Date: [today's date]. Signature (if sent on paper): ___",
                    )}
                  </p>
                </div>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="exceptions"
                title={t(
                  "legal.exceptionsTitle",
                  "3. Exceptions to the Right of Withdrawal",
                )}
              >
                <p>
                  {t(
                    "legal.exceptions",
                    "The right of withdrawal does not apply in the following cases, as permitted by Article 16 of Directive 2011/83/EU: (a) Digital content — once you have started downloading or accessing digital content, provided you gave prior express consent and acknowledged that you lose the right of withdrawal. (b) Fully performed services — if the service has been fully performed and you gave prior express consent and acknowledged that you lose the right of withdrawal once the contract is fully performed. (c) Personalised services — services made to your specifications or clearly personalised to your business needs.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="refund-process"
                title={t("legal.refundProcessTitle", "4. Refund Process")}
              >
                <p>
                  {t(
                    "legal.refundProcess",
                    "If you exercise your right of withdrawal, we will reimburse all payments received from you within 14 days of receiving your withdrawal notice. We will use the same payment method you used for the initial transaction (Stripe refund to your original card). No fees will be charged for the refund.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="service-issues"
                title={t(
                  "legal.serviceIssuesTitle",
                  "5. Service Quality Issues",
                )}
              >
                <p>
                  {t(
                    "legal.serviceIssues",
                    "If you are dissatisfied with a service we delivered, please contact us within 30 days of delivery. We will work with you to resolve the issue, which may include: re-performing part of the service at no extra cost, providing a partial refund proportional to the issue, or offering a credit toward future services.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="subscriptions"
                title={t("legal.subscriptionsTitle", "6. Subscriptions")}
              >
                <p>
                  {t(
                    "legal.subscriptions",
                    "For subscription-based services, you may cancel at any time. Cancellation takes effect at the end of the current billing period. No refunds are provided for partial billing periods unless required by law. The 14-day right of withdrawal applies to the initial subscription purchase.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="us-customers"
                title={t("legal.usCustomersTitle", "7. US Customers")}
              >
                <p>
                  {t(
                    "legal.usCustomers",
                    "While US federal law does not mandate a cooling-off period for online purchases, we extend the same 14-day refund policy to all customers regardless of location, subject to the same exceptions listed above.",
                  )}
                </p>
              </Section>
            </ScrollReveal>

            <ScrollReveal>
              <Section
                id="refund-contact"
                title={t("legal.refundContactTitle", "8. Contact Us")}
              >
                <p>
                  {t(
                    "legal.refundContact",
                    "To request a refund or discuss a service issue, email us at tbaltzakis@cloudless.gr. We aim to respond within 2 business days.",
                  )}
                </p>
                <p>
                  {t("legal.refundSeeAlso", "See also:")}{" "}
                  <Link
                    href="/terms"
                    className="text-neon-cyan hover:underline"
                  >
                    {t("legal.termsTitle", "Terms of Service")}
                  </Link>
                  {" | "}
                  <Link
                    href="/privacy"
                    className="text-neon-cyan hover:underline"
                  >
                    {t("legal.privacyTitle", "Privacy Policy")}
                  </Link>
                </p>
              </Section>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </>
  );
}
