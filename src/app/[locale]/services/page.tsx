import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import TerminalBlock from "@/components/TerminalBlock";
import JsonLd from "@/components/JsonLd";
import {
  getServiceSchema,
  getBreadcrumbSchema,
  getFAQSchema,
} from "@/lib/structured-data";
import { translate } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Cloud architecture, serverless development, data analytics, and AI-powered digital marketing services for startups and SMBs.",
};

/* ── Service data ─────────────────────────────────────────────── */

const getServices = (t: (key: string, fallback: string) => string) => [
  {
    tag: t("servicesSection.service1Tag", "CLOUD"),
    num: "01",
    title: t("servicesSection.service1Title", "Cloud Architecture & Migration"),
    price: "From €2,000",
    unit: t("servicesPage.perProject", "per project"),
    color: "cyan" as const,
    outcome: t(
      "servicesPage.s1Outcome",
      "Typically saves €15K–€50K/year in infrastructure costs alone.",
    ),
    perfectFor: t(
      "servicesSection.service1For",
      "For teams paying €500+/mo for infrastructure they can't explain.",
    ),
    description: t(
      "servicesSection.service1Desc",
      "Design resilient, cost-optimised cloud infrastructure on AWS, GCP, or Azure. We handle architecture blueprints, zero-downtime migrations, and Infrastructure as Code — so your team ships faster with less risk.",
    ),
    features: [
      "AWS / GCP / Azure architecture design",
      "Zero-downtime migration planning",
      "Cost optimization & right-sizing",
      "Security & compliance review",
      "Infrastructure as Code (Terraform / CDK)",
    ],
    stats: [
      { value: "99.99%", label: "Uptime SLA" },
      { value: "40-60%", label: "Cost Reduction" },
      { value: "Zero", label: "Downtime Migrations" },
      { value: "IaC", label: "First Approach" },
    ],
    terminal: [
      "$ cloudless infra plan --provider aws",
      "  ✓ VPC + subnets designed",
      "  ✓ ECS Fargate cluster configured",
      "  ✓ RDS Multi-AZ provisioned",
      "  ✓ CloudFront CDN attached",
      "  ✓ WAF rules applied",
      "  ---",
      "  status: ready to deploy",
      "  estimated cost: €420/mo",
    ],
  },
  {
    tag: t("servicesSection.service2Tag", "SERVERLESS"),
    num: "02",
    title: t("servicesSection.service2Title", "Serverless Development"),
    price: "From €2,400",
    unit: t("servicesPage.perProject", "per project"),
    color: "magenta" as const,
    outcome: t(
      "servicesPage.s2Outcome",
      "Up to 60–80% infrastructure savings. Pay only when code actually runs.",
    ),
    perfectFor: t(
      "servicesSection.service2For",
      "For founders tired of paying for servers that sit idle 90% of the time.",
    ),
    description: t(
      "servicesSection.service2Desc",
      "Build event-driven apps that scale to zero and explode to millions — without managing a single server. Lambda, API Gateway, DynamoDB, Step Functions — we wire it all together with CI/CD from day one.",
    ),
    features: [
      "Event-driven application design",
      "AWS Lambda / API Gateway / DynamoDB",
      "CI/CD pipeline setup",
      "Monitoring & alerting",
      "Pay-per-use cost modeling",
    ],
    stats: [
      { value: "60-80%", label: "Infra Savings" },
      { value: "<50ms", label: "Cold Starts" },
      { value: "∞", label: "Auto-scale" },
      { value: "CI/CD", label: "From Day One" },
    ],
    terminal: [
      "$ cloudless serverless deploy --stage prod",
      "  ✓ 12 Lambda functions deployed",
      "  ✓ API Gateway routes configured",
      "  ✓ DynamoDB tables provisioned",
      "  ✓ CloudWatch alarms set",
      "  ✓ GitHub Actions pipeline live",
      "  ---",
      "  cold start: 42ms avg",
      "  monthly estimate: €18.40",
    ],
  },
  {
    tag: t("servicesSection.service3Tag", "ANALYTICS"),
    num: "03",
    title: t("servicesSection.service3Title", "Data Analytics & Dashboards"),
    price: "From €2,400",
    unit: t("servicesPage.perProject", "per project"),
    color: "green" as const,
    outcome: t(
      "servicesPage.s3Outcome",
      "Replace gut-feeling decisions with real data. 10x faster insights from your existing data.",
    ),
    perfectFor: t(
      "servicesSection.service3For",
      "For teams making decisions on gut feeling instead of data.",
    ),
    description: t(
      "servicesSection.service3Desc",
      "Turn raw data into decisions. Custom ETL pipelines, real-time dashboards, and BI reporting — all built on modern data stacks so your metrics are always fresh and always actionable.",
    ),
    features: [
      "Custom analytics dashboards",
      "ETL pipeline development",
      "Real-time data processing",
      "Business intelligence reporting",
      "Data warehouse design",
    ],
    stats: [
      { value: "Real-time", label: "Data Refresh" },
      { value: "10x", label: "Faster Insights" },
      { value: "100%", label: "Data Ownership" },
      { value: "Custom", label: "KPI Tracking" },
    ],
    terminal: [
      "$ cloudless analytics init --stack modern",
      "  ✓ S3 data lake configured",
      "  ✓ Glue ETL jobs scheduled",
      "  ✓ Athena queries optimised",
      "  ✓ Grafana dashboards deployed",
      "  ✓ Alerting rules active",
      "  ---",
      "  latency: <2s query time",
      "  sources: 6 connected",
    ],
  },
  {
    tag: t("servicesSection.service4Tag", "AI"),
    num: "04",
    title: t("servicesSection.service4Title", "AI & Digital Marketing"),
    price: "From €800",
    unit: t("servicesPage.perMonth", "per month"),
    color: "blue" as const,
    outcome: t(
      "servicesPage.s4Outcome",
      "Typically 3x organic traffic growth. Know exactly which channels are converting.",
    ),
    perfectFor: t(
      "servicesSection.service4For",
      "For startups spending on ads with no idea what's actually working.",
    ),
    description: t(
      "servicesSection.service4Desc",
      "AI-powered content, SEO, paid ads, and social automation — driven by real data, not guesswork. We build growth engines that compound month over month.",
    ),
    features: [
      "AI-powered content strategy",
      "SEO & search optimization",
      "Paid advertising management",
      "Social media automation",
      "Performance tracking & reporting",
    ],
    stats: [
      { value: "3x", label: "Organic Traffic" },
      { value: "AI", label: "Content Engine" },
      { value: "ROAS", label: "Optimised Ads" },
      { value: "24/7", label: "Social Automation" },
    ],
    terminal: [
      "$ cloudless marketing report --month apr",
      "  ✓ 47 AI-generated posts published",
      "  ✓ Organic traffic +210% MoM",
      "  ✓ Ad ROAS: 4.2x",
      "  ✓ Social engagement +180%",
      "  ✓ 12 keywords on page 1",
      "  ---",
      "  leads generated: 340",
      "  cost per lead: €2.35",
    ],
  },
];

const getServicesFaqs = (t: (key: string, fallback: string) => string) => [
  {
    question: t("servicesPage.faq1Q", "How much will I actually save?"),
    answer: t(
      "servicesPage.faq1A",
      "Cloud Architecture projects typically save €15K–€50K/year in infrastructure costs. Serverless cuts hosting bills by up to 60–80%. The full bundle at €3,600/mo replaces €20K+ in salaries. The free audit gives you exact numbers for your specific setup.",
    ),
  },
  {
    question: t(
      "servicesPage.faq2Q",
      "What's the difference between hiring a CTO and using Cloudless?",
    ),
    answer: t(
      "servicesPage.faq2A",
      "A CTO costs €8K–€12K/month in salary alone, needs 3–6 months to ramp up, and handles strategy but not execution. We deliver architecture, development, analytics, and marketing — execution from day one, at a fraction of the cost. And you can cancel anytime.",
    ),
  },
  {
    question: t(
      "servicesPage.faq3Q",
      "Can you work with our existing infrastructure?",
    ),
    answer: t(
      "servicesPage.faq3A",
      "Absolutely. We start with an audit of your current setup and create a phased migration plan. No rip-and-replace — we improve what you have and build from there.",
    ),
  },
  {
    question: t("servicesPage.faq4Q", "What happens after the project ends?"),
    answer: t(
      "servicesPage.faq4A",
      "Everything we build is yours — fully documented, handoff-ready, and built with standard tools (Terraform, AWS CDK, GitHub Actions). Your next engineer picks it up without calling us.",
    ),
  },
  {
    question: t(
      "servicesPage.faq5Q",
      "How do I know this will work for my business?",
    ),
    answer: t(
      "servicesPage.faq5A",
      "The free audit tells you. In 30 minutes, we review your setup and give you a concrete action plan with specific ROI estimates. Most founders say it's the most useful 30 minutes they've spent on their tech stack — even if they never hire us.",
    ),
  },
];

const bundleTerminal = [
  "$ cloudless bundle --plan growth-engine",
  "  ✓ Cloud Architecture & Migration",
  "  ✓ Serverless Development",
  "  ✓ Data Analytics & Dashboards",
  "  ✓ AI & Digital Marketing",
  "  ---",
  "  total: €3,600/mo  (save 30%)",
  "  lock-in: none",
  "  guarantee: results in 14 days",
];

/* ── Color maps ───────────────────────────────────────────────── */

const colorMap = {
  cyan: {
    badge: "bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan",
    dot: "bg-neon-cyan",
    tag: "text-neon-cyan/60 bg-neon-cyan/5",
    stat: "border-neon-cyan/20 bg-neon-cyan/5",
    statValue: "text-neon-cyan",
    check: "text-neon-cyan",
    num: "bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan",
    price: "text-neon-cyan",
    link: "text-neon-cyan hover:text-white",
  },
  magenta: {
    badge: "bg-neon-magenta/10 border-neon-magenta/20 text-neon-magenta",
    dot: "bg-neon-magenta",
    tag: "text-neon-magenta/60 bg-neon-magenta/5",
    stat: "border-neon-magenta/20 bg-neon-magenta/5",
    statValue: "text-neon-magenta",
    check: "text-neon-magenta",
    num: "bg-neon-magenta/10 border-neon-magenta/20 text-neon-magenta",
    price: "text-neon-magenta",
    link: "text-neon-magenta hover:text-white",
  },
  green: {
    badge: "bg-neon-green/10 border-neon-green/20 text-neon-green",
    dot: "bg-neon-green",
    tag: "text-neon-green/60 bg-neon-green/5",
    stat: "border-neon-green/20 bg-neon-green/5",
    statValue: "text-neon-green",
    check: "text-neon-green",
    num: "bg-neon-green/10 border-neon-green/20 text-neon-green",
    price: "text-neon-green",
    link: "text-neon-green hover:text-white",
  },
  blue: {
    badge: "bg-neon-blue/10 border-neon-blue/20 text-neon-blue",
    dot: "bg-neon-blue",
    tag: "text-neon-blue/60 bg-neon-blue/5",
    stat: "border-neon-blue/20 bg-neon-blue/5",
    statValue: "text-neon-blue",
    check: "text-neon-blue",
    num: "bg-neon-blue/10 border-neon-blue/20 text-neon-blue",
    price: "text-neon-blue",
    link: "text-neon-blue hover:text-white",
  },
};

/* ── Page ─────────────────────────────────────────────────────── */

export default async function ServicesPage() {
  const locale = await getServerLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const services = getServices(t);
  const servicesFaqs = getServicesFaqs(t);

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Services", url: "https://cloudless.gr/services" },
        ])}
      />
      <JsonLd data={getFAQSchema(servicesFaqs)} />
      {services.map((s) => (
        <JsonLd
          key={s.title}
          data={getServiceSchema({
            name: s.title,
            description: s.features.join(". "),
            price: s.price.replace("From €", ""),
            unit: s.unit,
          })}
        />
      ))}

      {/* ── Header ──────────────────────────────────────────── */}
      <section className="bg-void relative overflow-hidden py-20 text-white lg:py-28">
        <div className="cyber-grid absolute inset-0 opacity-20" />
        <div className="bg-neon-cyan/5 absolute top-0 right-0 h-[400px] w-[400px] translate-x-1/3 -translate-y-1/2 rounded-full blur-3xl" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-sm font-medium">
            <span className="bg-neon-green h-2 w-2 animate-pulse rounded-full" />
            {t("servicesPage.badge", "Transparent Pricing")}
          </div>
          <h1 className="font-heading text-3xl leading-tight font-bold md:text-5xl">
            {t("servicesPage.title", "No hidden fees.")}{" "}
            <span className="from-neon-cyan to-neon-magenta bg-gradient-to-r bg-clip-text text-transparent">
              {t("servicesPage.titleHighlight", "Real results.")}
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-400">
            {t(
              "servicesPage.subtitle",
              "Pick what you need or bundle everything for 30% savings. No lock-in contracts — your code is always yours.",
            )}
          </p>
        </div>
      </section>

      {/* ── Alternating Feature Rows ────────────────────────── */}
      <section className="bg-void py-20 lg:py-28">
        <div className="mx-auto max-w-6xl space-y-24 px-6 lg:space-y-32">
          {services.map((service, i) => {
            const colors = colorMap[service.color];
            const isReversed = i % 2 !== 0;

            return (
              <ScrollReveal key={service.title}>
                <div
                  className={`grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16 ${isReversed ? "lg:[direction:rtl]" : ""}`}
                >
                  {/* Text column */}
                  <div className={isReversed ? "lg:[direction:ltr]" : ""}>
                    <div className="mb-5 flex items-center gap-3">
                      <span
                        className={`flex h-10 w-10 items-center justify-center ${colors.num} rounded-lg border font-mono text-sm font-bold`}
                      >
                        {service.num}
                      </span>
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1.5 ${colors.badge} rounded-full border font-mono text-xs font-medium`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${colors.dot} animate-pulse`}
                        />
                        {service.tag}
                      </span>
                    </div>

                    <h2 className="font-heading text-2xl leading-tight font-bold text-white md:text-3xl">
                      {service.title}
                    </h2>
                    <p className="mt-3 leading-relaxed text-slate-400">
                      {service.description}
                    </p>
                    <p className="text-neon-magenta/70 mt-2 font-mono text-xs italic">
                      {service.perfectFor}
                    </p>

                    {/* Checkmark feature list */}
                    <ul className="mt-6 space-y-3">
                      {service.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-3 text-sm text-slate-300"
                        >
                          <svg
                            className={`h-5 w-5 ${colors.check} mt-0.5 shrink-0`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Outcome + Price + CTA */}
                    <p className="text-neon-green/80 bg-neon-green/5 border-neon-green/10 mt-6 inline-block rounded-lg border px-3 py-2 font-mono text-xs">
                      ↗ {service.outcome}
                    </p>
                    <div className="mt-4 flex items-center gap-6">
                      <div>
                        <span
                          className={`font-mono text-2xl font-bold ${colors.price}`}
                        >
                          {service.price}
                        </span>
                        <span className="ml-2 font-mono text-xs text-slate-500">
                          {service.unit}
                        </span>
                      </div>
                      <Link
                        href="/contact"
                        className={`${colors.link} group/link font-mono text-sm font-semibold transition-colors`}
                      >
                        {t("servicesPage.getStarted", "Get started")}{" "}
                        <span className="inline-block transition-transform group-hover/link:translate-x-1">
                          →
                        </span>
                      </Link>
                    </div>
                  </div>

                  {/* Visual column — terminal + stats grid */}
                  <div
                    className={`space-y-4 ${isReversed ? "lg:[direction:ltr]" : ""}`}
                  >
                    <TerminalBlock
                      lines={service.terminal}
                      title={`cloudless-cli — ${service.tag.toLowerCase()}`}
                    />

                    {/* 2×2 Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {service.stats.map((stat) => (
                        <div
                          key={stat.label}
                          className={`rounded-lg border p-4 ${colors.stat} text-center`}
                        >
                          <div
                            className={`font-mono text-xl font-bold ${colors.statValue}`}
                          >
                            {stat.value}
                          </div>
                          <div className="mt-1 font-mono text-xs text-slate-500">
                            {stat.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* ── Bundle CTA ──────────────────────────────────────── */}
      <section className="relative overflow-hidden border-y border-slate-800">
        <div className="from-neon-cyan/10 via-neon-blue/10 to-neon-magenta/10 absolute inset-0 bg-gradient-to-r" />
        <div className="cyber-grid absolute inset-0 opacity-20" />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="bg-neon-magenta/10 border-neon-magenta/20 text-neon-magenta mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-sm font-medium">
                <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
                {t("servicesPage.bundleBadge", "Best Value")}
              </div>
              <h2 className="font-heading text-2xl font-bold text-white md:text-3xl">
                {t("servicesPage.bundleTitle", "Full-Stack Growth Engine")}
              </h2>
              <p className="mt-3 leading-relaxed text-slate-400">
                {t(
                  "servicesPage.bundleDesc",
                  "Get all four services bundled together. Cloud infrastructure, serverless apps, analytics dashboards, and AI marketing — everything your business needs to scale.",
                )}
              </p>
              <p className="bg-void/50 mt-3 rounded-lg border border-slate-700 p-3 text-sm text-slate-300">
                <span className="text-neon-cyan font-semibold">
                  {t("servicesPage.bundleAlt", "The alternative?")}
                </span>{" "}
                {t(
                  "servicesPage.bundleAltDesc",
                  "A CTO (~€8K/mo) + marketer (~€4K/mo) + data analyst (~€3K/mo) + cloud engineer (~€5K/mo) =",
                )}{" "}
                <span className="font-semibold text-white">
                  {t("servicesPage.bundleAltTotal", "€20K+/month.")}
                </span>{" "}
                {t(
                  "servicesPage.bundleAltSavings",
                  "We replace all four for €3,600.",
                )}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { label: "Cloud Architecture", color: "cyan" },
                  { label: "Serverless Dev", color: "magenta" },
                  { label: "Analytics", color: "green" },
                  { label: "AI Marketing", color: "blue" },
                ].map((item) => {
                  const c = colorMap[item.color as keyof typeof colorMap];
                  return (
                    <span
                      key={item.label}
                      className={`font-mono text-[10px] tracking-[0.15em] ${c.tag} border ${c.badge.split(" ").find((cls: string) => cls.startsWith("border-"))} rounded-full px-3 py-1`}
                    >
                      {item.label}
                    </span>
                  );
                })}
              </div>
              <div className="mt-8 flex items-baseline gap-3">
                <span className="text-neon-cyan font-mono text-4xl font-bold">
                  €3,600
                </span>
                <span className="font-mono text-sm text-slate-500">
                  {t("servicesPage.perMonth", "per month")}
                </span>
                <span className="text-neon-magenta bg-neon-magenta/10 ml-2 rounded-full px-2 py-0.5 font-mono text-xs">
                  {t("servicesPage.bundleSave", "SAVE 30%")}
                </span>
              </div>
              <Link
                href="/contact"
                className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 mt-6 inline-block rounded-lg border px-8 py-3.5 font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)]"
              >
                {t("servicesPage.bundleCta", "Let's Talk")}
              </Link>
            </div>
            <div className="hidden lg:block">
              <TerminalBlock
                lines={bundleTerminal}
                title="cloudless-cli — bundle"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Guarantee ───────────────────────────────────────── */}
      <section className="bg-void py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <ScrollReveal>
            <p className="text-neon-cyan mb-3 font-mono text-xs tracking-[0.3em]">
              {t("servicesPage.guaranteeLabel", "[ GUARANTEE ]")}
            </p>
            <h2 className="font-heading text-2xl font-bold text-white md:text-3xl">
              {t("servicesPage.guaranteeTitle", "Our Promise")}
            </h2>
          </ScrollReveal>
          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
            {[
              {
                icon: "⚡",
                title: t("servicesPage.g1Title", "Results in 14 Days"),
                desc: t(
                  "servicesPage.g1Desc",
                  "See measurable progress within two weeks of kickoff — or we keep working until you do.",
                ),
              },
              {
                icon: "🔓",
                title: t("servicesPage.g2Title", "No Lock-in"),
                desc: t(
                  "servicesPage.g2Desc",
                  "Month-to-month. Cancel anytime. We earn your business every month.",
                ),
              },
              {
                icon: "📦",
                title: t("servicesPage.g3Title", "Your Code Is Yours"),
                desc: t(
                  "servicesPage.g3Desc",
                  "Full documentation, handoff-ready. We build it and you own it — always.",
                ),
              },
              {
                icon: "🎯",
                title: t("servicesPage.g4Title", "Free Audit First"),
                desc: t(
                  "servicesPage.g4Desc",
                  "Every engagement starts with a no-cost review. Actionable insights in 30 minutes.",
                ),
              },
            ].map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 100}>
                <div className="bg-void-light/50 hover:border-neon-cyan/30 rounded-xl border border-slate-800 p-6 transition-all duration-300">
                  <div className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg border text-lg">
                    {item.icon}
                  </div>
                  <h3 className="font-heading font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="bg-void-light/50 border-y border-slate-800 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-6">
          <ScrollReveal>
            <div className="mb-14 text-center">
              <p className="text-neon-cyan mb-3 font-mono text-xs font-medium tracking-[0.3em]">
                {t("servicesPage.faqLabel", "[ FAQ ]")}
              </p>
              <h2 className="font-heading text-2xl font-bold text-white md:text-3xl">
                {t("servicesPage.faqTitle", "Questions about our")}{" "}
                <span className="text-neon-cyan">
                  {t("servicesPage.faqTitleHighlight", "services")}
                </span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="space-y-4">
            {servicesFaqs.map((faq, i) => (
              <ScrollReveal key={i} delay={i * 80}>
                <details className="group bg-void hover:border-neon-cyan/30 open:border-neon-cyan/30 rounded-xl border border-slate-800 transition-all duration-300 open:shadow-[0_0_15px_rgba(0,255,245,0.05)]">
                  <summary className="group-open:text-neon-cyan flex cursor-pointer list-none items-center justify-between p-5 font-mono text-sm font-semibold text-white transition-colors [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-3">
                      <span className="text-neon-cyan/40 text-xs">▸</span>
                      {faq.question}
                    </span>
                    <span className="text-neon-cyan/40 text-xs transition-transform duration-200 group-open:rotate-90">
                      ▸
                    </span>
                  </summary>
                  <div className="border-t border-slate-800 px-5 pt-4 pb-5 text-sm leading-relaxed text-slate-400">
                    {faq.answer}
                  </div>
                </details>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ready to Get Started? — Centered CTA ────────────── */}
      <section className="bg-void relative overflow-hidden py-20 lg:py-28">
        <div className="cyber-grid absolute inset-0 opacity-10" />
        <div className="bg-neon-cyan/5 absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
          <ScrollReveal>
            <p className="text-neon-cyan mb-4 font-mono text-xs tracking-[0.3em]">
              {t("servicesPage.ctaLabel", "[ NEXT STEP ]")}
            </p>
            <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">
              {t("servicesPage.ctaTitle", "Ready to get")}{" "}
              <span className="from-neon-cyan to-neon-magenta bg-gradient-to-r bg-clip-text text-transparent">
                {t("servicesPage.ctaTitleHighlight", "started?")}
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-slate-400">
              {t(
                "servicesPage.ctaSubtitle",
                "Book a free 30-minute audit call. We'll review your current setup, identify quick wins, and map out a plan — no commitment required.",
              )}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/contact"
                className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 rounded-lg border px-8 py-3.5 font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)]"
              >
                {t("servicesPage.ctaPrimary", "Book Free Audit")}
              </Link>
              <Link
                href="/store"
                className="group/link font-mono text-sm font-semibold text-slate-400 transition-colors hover:text-white"
              >
                {t("servicesPage.ctaSecondary", "Browse store")}{" "}
                <span className="inline-block transition-transform group-hover/link:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
