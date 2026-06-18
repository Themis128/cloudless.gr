import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import TerminalBlock from "@/components/TerminalBlock";
import JsonLd from "@/components/JsonLd";
import StatCounter from "@/components/StatCounter";
import {
  getServiceSchema,
  getBreadcrumbSchema,
  getFAQSchema,
} from "@/lib/structured-data";
import { translate } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";

/**
 * Retail-MSP landing page — a single ad-targetable destination for the
 * "managed IT for retail SMBs in Greece" campaign. Sits under /services so
 * it inherits the OG generator + breadcrumb pattern, but the copy, ICP, and
 * pricing tiers are LP-tuned (single message, single CTA) rather than
 * mixed in with the 4-pillar services hub.
 *
 * ICP: retail chains (2–10 locations), standalone retail SMBs (1 location,
 * 1–20 staff), e-commerce with physical store(s).
 *
 * CTA: free 30-minute audit.
 *
 * Pricing tiers are anchored to the Greek MSP market (ITspecs.gr public
 * comparison at €150/€300/€600, audited 2026-06-18). We sit ~30% above with
 * cloud-first + 24/7 + POS-uptime SLA as the differentiator.
 *
 * Statically rendered — no per-request data, all i18n via translate(locale).
 */

const BASE_URL = "https://cloudless.gr";
const canonical = `${BASE_URL}/services/managed-it`;

export const metadata: Metadata = {
  title: "Managed IT for Retail — Greece | Cloudless",
  description:
    "Cloud-first managed IT for retail SMBs and chains in Greece. POS uptime SLA, 24/7 monitoring, no lock-in. From €199/mo. Free 30-min audit.",
  alternates: {
    canonical,
    languages: {
      en: `${BASE_URL}/en/services/managed-it`,
      el: `${BASE_URL}/el/services/managed-it`,
      de: `${BASE_URL}/de/services/managed-it`,
      fr: `${BASE_URL}/fr/services/managed-it`,
      "x-default": `${BASE_URL}/en/services/managed-it`,
    },
  },
  openGraph: {
    type: "website",
    title: "Managed IT for Retail — Greece | Cloudless",
    description:
      "Cloud-first managed IT for retail SMBs and chains. POS uptime SLA, 24/7 monitoring, no lock-in. From €199/mo.",
    url: canonical,
    siteName: "Cloudless",
  },
};

/* ── Data ────────────────────────────────────────────────────────── */

type TierColor = "cyan" | "magenta" | "amber";

interface MspTier {
  num: string;
  name: string;
  price: string;
  per: string;
  tagline: string;
  perfectFor: string;
  color: TierColor;
  features: string[];
  responseTime: string;
  monitoring: string;
  ctaKey: string;
}

const getTiers = (t: (key: string, fallback: string) => string): MspTier[] => [
  {
    num: "01",
    name: t("msp.tier1Name", "Storefront"),
    price: "€199",
    per: t("msp.perMonth", "/ month"),
    tagline: t("msp.tier1Tagline", "Single-store retail."),
    perfectFor: t(
      "msp.tier1For",
      "For 1-location retail SMBs with 1–5 endpoints + a single POS terminal."
    ),
    color: "cyan",
    responseTime: t("msp.tier1Response", "Same-day, business hours"),
    monitoring: t("msp.tier1Monitoring", "Business hours · Mon–Fri 09:00–21:00 EEST"),
    features: [
      t("msp.tier1F1", "Up to 5 endpoints (PCs / laptops / tablets)"),
      t("msp.tier1F2", "1 POS terminal with uptime monitoring"),
      t("msp.tier1F3", "Router + Wi-Fi + printer support"),
      t("msp.tier1F4", "Patch & security update management"),
      t("msp.tier1F5", "Cloud-backed daily backups (3-2-1 model)"),
      t("msp.tier1F6", "Endpoint protection (next-gen AV)"),
      t("msp.tier1F7", "Monthly health report"),
    ],
    ctaKey: "tier1",
  },
  {
    num: "02",
    name: t("msp.tier2Name", "Retail Pro"),
    price: "€449",
    per: t("msp.perMonth", "/ month"),
    tagline: t("msp.tier2Tagline", "Multi-store. POS-critical."),
    perfectFor: t(
      "msp.tier2For",
      "For 2–3 location retailers with up to 15 endpoints. When POS downtime costs you orders."
    ),
    color: "magenta",
    responseTime: t("msp.tier2Response", "1-hour SLA · M–Sun 08:00–22:00 EEST"),
    monitoring: t("msp.tier2Monitoring", "Extended hours · proactive alerts"),
    features: [
      t("msp.tier2F1", "Everything in Storefront, for 2–3 locations"),
      t("msp.tier2F2", "Up to 15 endpoints across stores"),
      t("msp.tier2F3", "Up to 5 POS terminals · 99.5% uptime SLA"),
      t("msp.tier2F4", "Network-redundancy review (4G failover)"),
      t("msp.tier2F5", "On-call extended hours"),
      t("msp.tier2F6", "Quarterly security audit + report"),
      t("msp.tier2F7", "Cloud cost optimization (AWS / Microsoft 365)"),
      t("msp.tier2F8", "Dedicated technical account manager"),
    ],
    ctaKey: "tier2",
  },
  {
    num: "03",
    name: t("msp.tier3Name", "Retail Chain"),
    price: "€899",
    per: t("msp.perMonth", "/ month"),
    tagline: t("msp.tier3Tagline", "4–10 locations. 24/7. SOC-backed."),
    perfectFor: t(
      "msp.tier3For",
      "For multi-location chains where 1 hour of POS downtime costs more than €1,000."
    ),
    color: "amber",
    responseTime: t("msp.tier3Response", "30-minute SLA · 24/7/365"),
    monitoring: t("msp.tier3Monitoring", "24/7 SOC · automated remediation"),
    features: [
      t("msp.tier3F1", "Everything in Retail Pro, for 4–10 locations"),
      t("msp.tier3F2", "Unlimited endpoints (within scope)"),
      t("msp.tier3F3", "Unlimited POS terminals · 99.9% uptime SLA"),
      t("msp.tier3F4", "24/7 Security Operations Centre coverage"),
      t("msp.tier3F5", "Automated patch + remediation pipeline"),
      t("msp.tier3F6", "PCI-DSS readiness consulting"),
      t("msp.tier3F7", "Disaster recovery plan + quarterly drills"),
      t("msp.tier3F8", "On-site visits — included quarterly"),
      t("msp.tier3F9", "Dedicated incident response line"),
    ],
    ctaKey: "tier3",
  },
];

const getMspFaqs = (t: (key: string, fallback: string) => string) => [
  {
    q: t("msp.faq1Q", "How is this different from a freelance IT person?"),
    a: t(
      "msp.faq1A",
      "Freelancers are great until they're on holiday, sick, or overwhelmed. Cloudless is a team with documented SLAs, 24/7 monitoring on every tier from Retail Chain up, and an audit trail your insurer will accept. Your POS doesn't go down on a Sunday because one person isn't picking up the phone."
    ),
  },
  {
    q: t("msp.faq2Q", "What about cybersecurity and PCI-DSS?"),
    a: t(
      "msp.faq2A",
      "Endpoint protection and patching are included on every tier. PCI-DSS readiness consulting starts on Retail Pro and is full-scope on Retail Chain — we run the gap analysis, document the controls, and give you a remediation roadmap. We won't sign a PCI attestation (that's your QSA's job) but we'll get you ready for one."
    ),
  },
  {
    q: t("msp.faq3Q", "We already have an e-commerce platform. Do you touch that?"),
    a: t(
      "msp.faq3A",
      "Yes — and it pairs naturally with the Cloud/Serverless service. We'll cost-optimise your AWS / Cloudflare / Shopify hosting and make sure the in-store POS speaks to the same inventory system the website uses. Bundle pricing applies."
    ),
  },
  {
    q: t("msp.faq4Q", "What does 'POS uptime SLA' actually mean?"),
    a: t(
      "msp.faq4A",
      "Retail Pro: 99.5% / month measured per terminal — that's ~3.6h of allowed downtime per month before service credits apply. Retail Chain: 99.9% — ~43 minutes per month. We measure with synthetic transactions every 60s and credit your bill if we miss."
    ),
  },
  {
    q: t("msp.faq5Q", "Can we cancel?"),
    a: t(
      "msp.faq5A",
      "Month-to-month. No lock-in. Your data, configurations, runbooks, and asset inventory are always yours — fully exported on request, no exit fees. Same promise as the rest of cloudless.gr."
    ),
  },
  {
    q: t("msp.faq6Q", "What's the bundle discount?"),
    a: t(
      "msp.faq6A",
      "30% off the MSP tier if you're already on (or signing for) the Cloud or Serverless service. We're betting that once we manage your cloud and your store IT, the integration savings will pay for both."
    ),
  },
];

/* ── Color tokens (match services-data colorMap) ──────────────── */

const colorMap = {
  cyan: {
    border: "border-neon-cyan/30",
    text: "text-neon-cyan",
    bg: "bg-neon-cyan/10",
    gradient: "from-neon-cyan/20 via-transparent to-transparent",
    badge: "bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan",
  },
  magenta: {
    border: "border-neon-magenta/30",
    text: "text-neon-magenta",
    bg: "bg-neon-magenta/10",
    gradient: "from-neon-magenta/20 via-transparent to-transparent",
    badge: "bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta",
  },
  amber: {
    border: "border-amber-400/40",
    text: "text-amber-300",
    bg: "bg-amber-400/10",
    gradient: "from-amber-400/20 via-transparent to-transparent",
    badge: "bg-amber-400/10 border-amber-400/30 text-amber-300",
  },
} as const;

/* ── Page ──────────────────────────────────────────────────────── */

export default async function ManagedItPage() {
  const locale = await getServerLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const tiers = getTiers(t);
  const faqs = getMspFaqs(t);

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: BASE_URL },
          { name: "Services", url: `${BASE_URL}/services` },
          { name: "Managed IT", url: canonical },
        ])}
      />
      <JsonLd data={getFAQSchema(faqs.map((f) => ({ question: f.q, answer: f.a })))} />
      {tiers.map((tier) => (
        <JsonLd
          key={tier.name}
          data={getServiceSchema({
            name: `Managed IT — ${tier.name}`,
            description: `${tier.tagline} ${tier.perfectFor}`,
            price: tier.price.replace("€", ""),
            unit: tier.per,
          })}
        />
      ))}

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="bg-void relative overflow-hidden py-20 text-white lg:py-28">
        <div className="cyber-grid absolute inset-0 opacity-20" />
        <div className="bg-neon-cyan/5 animate-float absolute top-0 right-0 h-[400px] w-[400px] translate-x-1/3 -translate-y-1/2 rounded-full blur-3xl" />

        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="bg-neon-green animate-ping-slow absolute inline-flex h-full w-full rounded-full opacity-75" />
              <span className="bg-neon-green relative inline-flex h-2 w-2 rounded-full" />
            </span>
            {t("msp.heroBadge", "Managed IT · Retail focus · Greece")}
          </div>

          <h1 className="font-heading text-3xl leading-tight font-bold md:text-5xl">
            {t("msp.heroTitle", "POS up. Network up.")}{" "}
            <span className="from-neon-cyan to-neon-magenta bg-gradient-to-r bg-clip-text text-transparent">
              {t("msp.heroHighlight", "Bill predictable.")}
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-400">
            {t(
              "msp.heroSubtitle",
              "Cloud-first managed IT for retail SMBs and small chains in Greece. POS uptime SLA, 24/7 monitoring, no lock-in. Built by an AWS Certified Cloud Architect — not the company that does your printer."
            )}
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/contact?type=msp-audit"
              className="bg-neon-cyan inline-flex items-center gap-2 rounded-md px-6 py-3 font-mono text-sm font-semibold text-black transition-transform hover:scale-105"
            >
              {t("msp.heroCta", "Book a Free 30-min Audit")}
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="#tiers"
              className="border-neon-cyan/30 text-neon-cyan hover:border-neon-cyan/60 inline-flex items-center gap-2 rounded-md border px-6 py-3 font-mono text-sm font-semibold"
            >
              {t("msp.heroSecondaryCta", "See Pricing")}
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
            <StatCounter value="99.9%" label={t("msp.stat1", "POS uptime SLA")} />
            <StatCounter value="30 min" label={t("msp.stat2", "Response · Retail Chain")} />
            <StatCounter value="0" label={t("msp.stat3", "Lock-in contracts")} />
            <StatCounter value="30%" label={t("msp.stat4", "Bundle savings")} />
          </div>
        </div>
      </section>

      {/* ── ICP / Problem framing ───────────────────────────────── */}
      <section className="bg-surface relative py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal>
            <h2 className="font-heading text-2xl font-bold md:text-3xl">
              {t("msp.icpTitle", "Built for retail. Not for whoever happens to call.")}
            </h2>
            <p className="mt-3 max-w-3xl text-slate-400">
              {t(
                "msp.icpSubtitle",
                "We don't take every IT contract. We take retail. Three ICPs — pick the one that sounds like you."
              )}
            </p>
          </ScrollReveal>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <article className="border-neon-cyan/20 bg-void/40 rounded-xl border p-6">
              <div className="text-neon-cyan font-mono text-xs uppercase tracking-wider">
                {t("msp.icp1Tag", "Retail Chain")}
              </div>
              <h3 className="mt-2 font-heading text-xl font-semibold">
                {t("msp.icp1Title", "2–10 locations across Greece")}
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                {t(
                  "msp.icp1Body",
                  "Pharmacy, mini-market, electronics, fashion. POS downtime in one store hurts; in three stores it's a Saturday-morning emergency. You need one number to call and an SLA you can hold someone to."
                )}
              </p>
            </article>
            <article className="border-neon-magenta/20 bg-void/40 rounded-xl border p-6">
              <div className="text-neon-magenta font-mono text-xs uppercase tracking-wider">
                {t("msp.icp2Tag", "Standalone Retail SMB")}
              </div>
              <h3 className="mt-2 font-heading text-xl font-semibold">
                {t("msp.icp2Title", "1 location · 1–20 staff")}
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                {t(
                  "msp.icp2Body",
                  "Single-store retail where the owner is tired of the printer-Wi-Fi-POS-router triangle eating their week. Predictable monthly bill, predictable response time, no surprises."
                )}
              </p>
            </article>
            <article className="rounded-xl border border-amber-400/30 bg-void/40 p-6">
              <div className="font-mono text-xs uppercase tracking-wider text-amber-300">
                {t("msp.icp3Tag", "E-commerce + Physical")}
              </div>
              <h3 className="mt-2 font-heading text-xl font-semibold">
                {t("msp.icp3Title", "Hybrid retailer")}
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                {t(
                  "msp.icp3Body",
                  "You sell online and you have 1–4 physical stores. Inventory has to sync. AWS / Shopify / Microsoft 365 already work — they just don't talk to the in-store POS. We close that loop and watch the whole stack."
                )}
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ── Pricing tiers ───────────────────────────────────────── */}
      <section id="tiers" className="bg-void relative py-16 text-white lg:py-24">
        <div className="cyber-grid absolute inset-0 opacity-10" />
        <div className="relative mx-auto max-w-6xl px-6">
          <ScrollReveal>
            <h2 className="font-heading text-2xl font-bold md:text-3xl">
              {t("msp.pricingTitle", "Transparent pricing. No surprises.")}
            </h2>
            <p className="mt-3 max-w-3xl text-slate-400">
              {t(
                "msp.pricingSubtitle",
                "Three tiers. Real numbers on the page. Bundle 30% off when paired with Cloud or Serverless. Month-to-month. Cancel anytime."
              )}
            </p>
          </ScrollReveal>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {tiers.map((tier) => {
              const c = colorMap[tier.color];
              return (
                <article
                  key={tier.name}
                  className={`relative rounded-2xl border ${c.border} bg-surface/60 p-8 backdrop-blur-sm`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${c.bg} rounded-t-2xl`} />

                  <div className="mb-4 flex items-center justify-between">
                    <div className={`font-mono text-sm ${c.text}`}>{tier.num}</div>
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${c.badge}`}
                    >
                      {tier.name}
                    </div>
                  </div>

                  <h3 className="font-heading text-2xl font-bold">{tier.tagline}</h3>
                  <p className="mt-2 text-sm text-slate-400">{tier.perfectFor}</p>

                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="font-heading text-4xl font-bold">{tier.price}</span>
                    <span className="text-sm text-slate-400">{tier.per}</span>
                  </div>

                  <dl className="mt-6 space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">{t("msp.responseLabel", "Response")}</dt>
                      <dd className={c.text}>{tier.responseTime}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">{t("msp.monitoringLabel", "Monitoring")}</dt>
                      <dd className={c.text}>{tier.monitoring}</dd>
                    </div>
                  </dl>

                  <ul className="mt-6 space-y-2 text-sm">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className={c.text} aria-hidden="true">
                          ✓
                        </span>
                        <span className="text-slate-300">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={`/contact?type=msp-audit&tier=${tier.ctaKey}`}
                    className={`mt-8 block w-full rounded-md border ${c.border} px-4 py-3 text-center font-mono text-sm font-semibold ${c.text} hover:bg-white/5`}
                  >
                    {t("msp.tierCta", "Start with a Free Audit")}
                  </Link>
                </article>
              );
            })}
          </div>

          <p className="mt-8 text-center font-mono text-xs text-slate-500">
            {t(
              "msp.pricingFootnote",
              "All prices exclude VAT. Greek market — anchored against published competitor tiers June 2026. Bundle discount applies when combined with Cloud or Serverless service."
            )}
          </p>
        </div>
      </section>

      {/* ── How it works (terminal) ─────────────────────────────── */}
      <section className="bg-surface relative py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal>
            <h2 className="font-heading text-2xl font-bold md:text-3xl">
              {t("msp.howTitle", "What a Cloudless retail audit looks like")}
            </h2>
            <p className="mt-3 max-w-3xl text-slate-400">
              {t(
                "msp.howSubtitle",
                "Free. 30 minutes. No slides. A working session over a video call, then a concrete action plan in your inbox the next morning."
              )}
            </p>
          </ScrollReveal>

          <div className="mt-10">
            <TerminalBlock
              lines={[
                "$ cloudless audit --target retail-msp",
                "  ✓ inventory: 2 stores, 11 endpoints, 4 POS, 2 routers",
                "  ✓ scan: 3 unpatched endpoints, 1 EOL switch",
                "  ✓ risk: POS isolated correctly, network flat (PCI risk)",
                "  ✓ cost: paying €240/mo for legacy AV + manual backups",
                "  ---",
                "  ➜ recommend tier: Retail Pro (€449/mo)",
                "  ➜ projected savings: €170/mo from consolidating",
                "  ➜ next step: 1-week onboarding plan attached",
                "  status: audit complete · 27 min",
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── FAQs ────────────────────────────────────────────────── */}
      <section className="bg-void relative py-16 text-white lg:py-20">
        <div className="mx-auto max-w-4xl px-6">
          <ScrollReveal>
            <h2 className="font-heading text-2xl font-bold md:text-3xl">
              {t("msp.faqTitle", "Common questions")}
            </h2>
          </ScrollReveal>

          <dl className="mt-10 space-y-6">
            {faqs.map((f) => (
              <div
                key={f.q}
                className="border-neon-cyan/10 bg-surface/30 rounded-xl border p-6"
              >
                <dt className="font-heading text-lg font-semibold">{f.q}</dt>
                <dd className="mt-2 text-sm text-slate-400">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────── */}
      <section className="bg-surface relative py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <ScrollReveal>
            <h2 className="font-heading text-2xl font-bold md:text-3xl">
              {t("msp.closeTitle", "Your audit takes 30 minutes.")}
            </h2>
            <p className="mt-3 text-slate-400">
              {t(
                "msp.closeBody",
                "We'll tell you exactly which tier fits, what you can drop from your current setup, and what €/month you should expect. No pitch. No commitment."
              )}
            </p>
          </ScrollReveal>

          <Link
            href="/contact?type=msp-audit"
            className="bg-neon-cyan mt-8 inline-flex items-center gap-2 rounded-md px-8 py-4 font-mono text-base font-semibold text-black transition-transform hover:scale-105"
          >
            {t("msp.closeCta", "Book Your Free Retail-IT Audit")}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
