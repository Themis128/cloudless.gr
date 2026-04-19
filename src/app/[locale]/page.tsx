import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import TypingText from "@/components/TypingText";
import TerminalBlock from "@/components/TerminalBlock";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema, getFAQSchema } from "@/lib/structured-data";
import HolographicCard from "@/components/HolographicCard";
import { translate, translateArray } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";
import ClientParticleField from "@/components/ClientParticleField";

// ISR: render once per hour, served from CloudFront cache (avoids Lambda cold start on every hit)
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const localePaths: Record<string, string> = {
    en: "https://cloudless.gr",
    el: "https://cloudless.gr/el",
    fr: "https://cloudless.gr/fr",
  };
  const canonical = localePaths[locale] ?? `https://cloudless.gr/${locale}`;

  return {
    title: "Cloudless \u2014 Cloud Computing, Serverless & AI Marketing",
    description:
      "Clear skies. Zero friction. We help startups and SMBs with cloud architecture, serverless development, data analytics, and AI-powered digital marketing.",
    alternates: {
      canonical,
      languages: {
        en: localePaths.en,
        el: localePaths.el,
        fr: localePaths.fr,
        "x-default": localePaths.en,
      },
    },
  };
}

const terminalLines = [
  "$ cloudless deploy --env production",
  "  Provisioning serverless infrastructure...",
  "  Setting up API Gateway endpoints...",
  "  Configuring DynamoDB tables...",
  "  Deploying Lambda functions...",
  "  ✓ All services deployed successfully",
  "  ✓ SSL certificates issued",
  "  ✓ Monitoring & alerts configured",
  "$ echo $STATUS",
  "  production: LIVE | latency: 12ms | cost: $0.003/req",
];

export default async function Home() {
  const locale = await getServerLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  const services = [
    {
      icon: "01",
      title: t(
        "servicesSection.service1Title",
        "Cloud Architecture & Migration",
      ),
      description: t(
        "servicesSection.service1Desc",
        "Design and migrate your infrastructure to AWS, GCP, or Azure with zero downtime. Scalable, secure, cost-optimized.",
      ),
      tag: t("servicesSection.service1Tag", "CLOUD"),
      perfectFor: t(
        "servicesSection.service1For",
        "For teams paying €500+/mo for infrastructure they can't explain.",
      ),
    },
    {
      icon: "02",
      title: t("servicesSection.service2Title", "Serverless Development"),
      description: t(
        "servicesSection.service2Desc",
        "Build event-driven applications that scale automatically and cost nothing when idle. Lambda, API Gateway, DynamoDB.",
      ),
      tag: t("servicesSection.service2Tag", "SERVERLESS"),
      perfectFor: t(
        "servicesSection.service2For",
        "For founders tired of paying for servers that sit idle 90% of the time.",
      ),
    },
    {
      icon: "03",
      title: t("servicesSection.service3Title", "Data Analytics & Dashboards"),
      description: t(
        "servicesSection.service3Desc",
        "Turn raw data into actionable insights with custom dashboards, pipelines, and real-time reporting.",
      ),
      tag: t("servicesSection.service3Tag", "ANALYTICS"),
      perfectFor: t(
        "servicesSection.service3For",
        "For teams making decisions on gut feeling instead of data.",
      ),
    },
    {
      icon: "04",
      title: t("servicesSection.service4Title", "AI & Digital Marketing"),
      description: t(
        "servicesSection.service4Desc",
        "AI-powered campaigns, SEO, content strategy, and performance marketing that drives measurable growth.",
      ),
      tag: t("servicesSection.service4Tag", "AI"),
      perfectFor: t(
        "servicesSection.service4For",
        "For startups spending on ads with no idea what's actually working.",
      ),
    },
  ];

  const stats = [
    { value: "99.9%", label: t("stats.uptime", "Uptime SLA") },
    { value: "14 days", label: t("stats.firstResults", "First Results") },
    { value: "30%", label: t("stats.bundleSavings", "Bundle Savings") },
    { value: "0", label: t("stats.lockIn", "Lock-in Contracts") },
  ];

  const faqs = [
    {
      question: t("faq.q1", "How much will this actually cost me?"),
      answer: t(
        "faq.a1",
        "Individual services range from €800 to €2,400 depending on scope. The full bundle is €3,600/month. For context: hiring a single cloud engineer in-house costs €5K–€8K/month. A CTO + marketer + data analyst? €20K+/month. We replace all three for a fraction of the cost — and you can cancel anytime.",
      ),
    },
    {
      question: t("faq.q2", "Who is this for? Am I the right fit?"),
      answer: t(
        "faq.a2",
        "We work best with startups and SMBs that are past the MVP stage — typically 2–20 person teams doing €50K–€500K in revenue. You have a product that works but your infrastructure is duct tape, your marketing is guesswork, and you don't have a CTO to fix it. If that sounds familiar, the free audit will tell you exactly what to do next.",
      ),
    },
    {
      question: t("faq.q3", "What if I want to leave?"),
      answer: t(
        "faq.a3",
        "Leave whenever you want. Month-to-month, no lock-in, no exit fees. Your code, infrastructure, and data are always yours — fully documented and handoff-ready. We're not in the business of holding your code hostage.",
      ),
    },
    {
      question: t("faq.q4", "How quickly can I see results?"),
      answer: t(
        "faq.a4",
        "Measurable progress within 14 days of kickoff. Cloud migrations show cost savings immediately. Marketing campaigns deliver initial data within two weeks. We guarantee it — or we keep working until you see it.",
      ),
    },
    {
      question: t("faq.q5", "What does the free audit include?"),
      answer: t(
        "faq.a5",
        "A 30-minute call where we review your current infrastructure, marketing setup, or both. You'll get a concrete action plan with specific recommendations — no pitch, no pressure. Most founders say it's the most useful 30 minutes they've spent on their tech stack.",
      ),
    },
    {
      question: t("faq.q6", "Can I trust a new agency with my infrastructure?"),
      answer: t(
        "faq.a6",
        "Fair question. We're backed by AWS certifications (check our Credly badges), open-source contributions on GitHub, and 8+ years of hands-on cloud architecture. The free audit is zero-risk — you'll see our thinking and decide if it's worth going further. We'd rather lose a deal than overpromise.",
      ),
    },
  ];

  const guarantees = [
    {
      icon: "⚡",
      title: t("guarantees.resultsTitle", "Results in 14 Days"),
      desc: t(
        "guarantees.resultsDesc",
        "Measurable progress within two weeks of kickoff — or we keep working until you see it.",
      ),
    },
    {
      icon: "🔓",
      title: t("guarantees.noLockInTitle", "No Lock-in Contracts"),
      desc: t(
        "guarantees.noLockInDesc",
        "Month-to-month. Cancel anytime. We earn your business every month.",
      ),
    },
    {
      icon: "📦",
      title: t("guarantees.yourCodeTitle", "Your Code Is Yours"),
      desc: t(
        "guarantees.yourCodeDesc",
        "Full documentation, handoff-ready. We build it and you own it — always.",
      ),
    },
  ];

  const typingTexts = translateArray(locale, "hero.typingTexts", [
    "Zero friction.",
    "Full control.",
    "Pure speed.",
    "Real results.",
  ]);

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
        ])}
      />
      <JsonLd data={getFAQSchema(faqs)} />

      {/* Hero */}
      <section className="bg-void scanlines scan-line relative overflow-hidden text-white">
        {/* Particle network background */}
        <ClientParticleField particleCount={70} />

        {/* Grid overlay */}
        <div className="cyber-grid absolute inset-0 opacity-50" />

        {/* Gradient orbs */}
        <div className="bg-neon-cyan/5 animate-gradient-shift absolute top-0 right-0 h-[500px] w-[500px] translate-x-1/3 -translate-y-1/2 rounded-full blur-3xl" />
        <div className="bg-neon-magenta/5 animate-gradient-shift absolute bottom-0 left-0 h-[400px] w-[400px] -translate-x-1/3 translate-y-1/2 rounded-full blur-3xl delay-200" />

        <div className="relative z-10 mx-auto max-w-6xl px-6 py-14 md:py-20 lg:py-24">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            {/* Left — copy */}
            <div>
              <div className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-sm font-medium">
                <span className="bg-neon-green h-2 w-2 animate-pulse rounded-full" />
                {t("hero.badge", "v2.0 — Now Accepting Clients")}
              </div>
              <br />
              <h1 className="font-heading text-4xl leading-tight font-bold tracking-tight md:text-5xl lg:text-6xl">
                {t("hero.titleStatic", "Clear skies.")}{" "}
                <span className="from-neon-cyan to-neon-magenta bg-gradient-to-r bg-clip-text text-transparent">
                  <TypingText
                    initialText={typingTexts[0]}
                    texts={typingTexts}
                    typingSpeed={70}
                    pauseDuration={2500}
                    className="from-neon-cyan to-neon-magenta bg-gradient-to-r bg-clip-text text-transparent"
                  />
                </span>
              </h1>
              <p className="animate-fade-in-up mt-6 max-w-xl text-lg leading-relaxed text-slate-300 delay-200 md:text-xl">
                {t(
                  "hero.subtitle",
                  "Enterprise cloud? You can't afford it. DIY infrastructure? You shouldn't. We're the third way — serverless, data-driven growth, and scaling that actually fits a 2–20 person team.",
                )}{" "}
                <span className="text-neon-cyan font-medium">
                  {t("hero.subtitleHighlight", "Finally.")}
                </span>
              </p>
              <div className="animate-fade-in-up mt-8 flex flex-col gap-4 delay-300 sm:flex-row">
                <Link
                  href="/contact"
                  className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 relative rounded-lg border px-8 py-3.5 text-center font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)]"
                >
                  {t("hero.ctaPrimary", "Get a Free Audit")}
                </Link>
                <Link
                  href="/services"
                  className="hover:border-neon-magenta/50 hover:text-neon-magenta rounded-lg border border-slate-600 px-8 py-3.5 text-center font-mono font-semibold text-white transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,0,255,0.1)]"
                >
                  {t("hero.ctaSecondary", "View Services")}
                </Link>
              </div>
              {/* CTA microcopy */}
              <div className="animate-fade-in-up mt-4 flex flex-col gap-6 font-mono text-xs text-slate-500 delay-300 sm:flex-row">
                <span>
                  {t(
                    "hero.microCopy1",
                    "No commitment. Actionable insights in 30 min.",
                  )}
                </span>
                <span className="hidden sm:inline">•</span>
                <span>
                  {t("hero.microCopy2", "Transparent pricing. No lock-in.")}
                </span>
              </div>
            </div>

            {/* Right — terminal */}
            <div className="animate-fade-in-up hidden lg:block">
              <TerminalBlock
                lines={terminalLines}
                title={t("hero.terminalTitle", "cloudless-cli v2.0")}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-void-light border-neon-cyan/10 border-y">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, i) => (
              <ScrollReveal key={stat.label} delay={i * 100}>
                <div className="text-center">
                  <div className="text-neon-cyan glow-cyan animate-neon-pulse font-mono text-3xl font-bold">
                    {stat.value}
                  </div>
                  <div className="mt-1 font-mono text-xs tracking-wider text-slate-500 uppercase">
                    {stat.label}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Guarantees Row */}
      <section className="bg-void border-b border-slate-800 py-10 lg:py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {guarantees.map((g) => (
              <ScrollReveal key={g.title}>
                <div className="bg-void-light/30 hover:border-neon-cyan/30 flex items-start gap-4 rounded-xl border border-slate-800 p-5 transition-colors">
                  <span className="mt-0.5 text-2xl" aria-hidden="true">
                    {g.icon}
                  </span>
                  <div>
                    <p className="font-mono text-sm font-semibold text-white">
                      {g.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {g.desc}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Founder Credibility Strip */}
      <section className="bg-void-light/50 border-b border-slate-800 py-10 lg:py-14">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal>
            <div className="flex flex-col items-center gap-6 md:flex-row md:gap-10">
              {/* Avatar */}
              <div className="bg-neon-cyan/10 border-neon-cyan/20 flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border">
                <span className="font-heading text-neon-cyan text-xl font-bold">
                  TB
                </span>
              </div>
              {/* Copy */}
              <div className="flex-1 text-center md:text-left">
                <p className="text-sm leading-relaxed text-slate-300">
                  <span className="font-semibold text-white">
                    {t(
                      "credibility.builtBy",
                      "Built by Themistoklis Baltzakis",
                    )}
                  </span>{" "}
                  {t(
                    "credibility.bio",
                    "— AWS Certified Cloud Architect, 8+ years building serverless infrastructure and growth systems. I started cloudless.gr because startups deserve enterprise-grade cloud without the enterprise price or the enterprise BS.",
                  )}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                  <span className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px]">
                    {t("credibility.badgeAws", "AWS Certified")}
                  </span>
                  <span className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px]">
                    {t("credibility.badgeOss", "Open-Source Contributor")}
                  </span>
                  <span className="bg-neon-magenta/10 border-neon-magenta/20 text-neon-magenta inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px]">
                    {t(
                      "credibility.badgeCapacity",
                      "Now accepting 5 clients for Q2 2026",
                    )}
                  </span>
                </div>
              </div>
              {/* Links */}
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href="https://www.credly.com/users/themistoklis-baltzakis"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Credly certifications"
                  className="bg-void/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.3 4.8a7.2 7.2 0 110 14.4 7.2 7.2 0 010-14.4zm0 2.4a4.8 4.8 0 100 9.6 4.8 4.8 0 000-9.6zm0 2.4a2.4 2.4 0 110 4.8 2.4 2.4 0 010-4.8z" />
                  </svg>
                </a>
                <a
                  href="https://github.com/Themis128"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="bg-void/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                </a>
                <a
                  href="https://linkedin.com/in/baltzakis-themis"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="bg-void/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Services Overview */}
      <section className="bg-void py-12 lg:py-16">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal>
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <p className="text-neon-cyan mb-3 font-mono text-xs font-medium tracking-[0.3em]">
                {t("servicesSection.label", "[ WHAT WE DO ]")}
              </p>
              <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">
                {t("servicesSection.title", "Everything you need to")}{" "}
                <span className="text-neon-cyan">
                  {t("servicesSection.titleHighlight", "scale")}
                </span>
              </h2>
              <p className="mt-4 text-lg text-slate-400">
                {t(
                  "servicesSection.subtitle",
                  "From infrastructure to marketing, we cover the full stack of modern business growth.",
                )}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {services.map((service, i) => (
              <ScrollReveal key={service.title} delay={i * 100}>
                <HolographicCard className="bg-void-light/50 hover:border-neon-cyan/50 group rounded-xl border border-slate-800 p-6 transition-all duration-300 lg:p-8">
                  <div className="mb-4 flex items-center gap-4">
                    <span className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan group-hover:bg-neon-cyan/20 flex h-10 w-10 items-center justify-center rounded-lg border font-mono text-sm font-bold transition-colors">
                      {service.icon}
                    </span>
                    <span className="text-neon-magenta/60 bg-neon-magenta/5 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[0.2em]">
                      {service.tag}
                    </span>
                  </div>
                  <h3 className="font-heading group-hover:text-neon-cyan text-xl font-semibold text-white transition-colors">
                    {service.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                    {service.description}
                  </p>
                  <p className="text-neon-magenta/70 mt-3 font-mono text-xs italic">
                    {service.perfectFor}
                  </p>
                </HolographicCard>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={400}>
            <div className="mt-12 text-center">
              <Link
                href="/services"
                className="text-neon-cyan group inline-flex items-center gap-2 font-mono text-sm font-semibold transition-colors hover:text-white"
              >
                {t("servicesSection.viewPricing", "See pricing & details")}
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="transition-transform group-hover:translate-x-1"
                >
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
            </div>
          </ScrollReveal>

          {/* Secondary lead capture */}
          <ScrollReveal delay={500}>
            <div className="bg-void-light/30 mt-10 rounded-xl border border-slate-800 p-6 text-center">
              <p className="mb-3 text-sm text-slate-400">
                {t("leadCapture.notReady", "Not ready for a call? No problem.")}
              </p>
              <p className="mb-4 font-mono text-sm font-semibold text-white">
                {t(
                  "leadCapture.playbookTitle",
                  "Get our free Cloud Migration Playbook — the exact framework we use with clients.",
                )}
              </p>
              <Link
                href="/contact?type=playbook"
                className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta hover:bg-neon-magenta/20 inline-flex items-center gap-2 rounded-lg border px-6 py-2.5 font-mono text-sm font-semibold transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,0,255,0.1)]"
              >
                {t("leadCapture.playbookCta", "Download the Playbook")}
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M7 1v10M3 8l4 4 4-4" />
                </svg>
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-void-light/50 border-y border-slate-800 py-12 lg:py-16">
        <div className="mx-auto max-w-3xl px-6">
          <ScrollReveal>
            <div className="mb-14 text-center">
              <p className="text-neon-cyan mb-3 font-mono text-xs font-medium tracking-[0.3em]">
                {t("faq.label", "[ FAQ ]")}
              </p>
              <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">
                {t("faq.title", "Common")}{" "}
                <span className="text-neon-cyan">
                  {t("faq.titleHighlight", "questions")}
                </span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
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

      {/* Founder */}
      <section className="bg-void py-12 lg:py-16">
        <div className="mx-auto max-w-4xl px-6">
          <ScrollReveal>
            <div className="mb-12 text-center">
              <p className="text-neon-cyan mb-3 font-mono text-xs font-medium tracking-[0.3em]">
                {t("founder.label", "[ ABOUT ]")}
              </p>
              <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">
                {t("founder.title", "Meet the")}{" "}
                <span className="text-neon-cyan">
                  {t("founder.titleHighlight", "founder")}
                </span>
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <div className="bg-void-light/50 rounded-xl border border-slate-800 p-8 md:p-10">
              <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
                {/* Avatar */}
                <div className="bg-neon-cyan/10 border-neon-cyan/20 flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border">
                  <span className="font-heading text-neon-cyan text-3xl font-bold">
                    TB
                  </span>
                </div>

                {/* Bio */}
                <div className="flex-1 text-center md:text-left">
                  <h3 className="font-heading text-xl font-bold text-white">
                    {t("founder.name", "Themistoklis Baltzakis")}
                  </h3>
                  <p className="text-neon-cyan/70 mt-1 font-mono text-sm">
                    {t("founder.role", "Cloud Architect & Growth Engineer")}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-slate-400">
                    {t(
                      "founder.bio",
                      "Certified cloud architect with hands-on experience in AWS, serverless architectures, data analytics, and AI-powered marketing. I help startups and SMBs build infrastructure that scales without the enterprise overhead.",
                    )}
                  </p>

                  {/* Social links */}
                  <div className="mt-6 flex items-center justify-center gap-3 md:justify-start">
                    <a
                      href="https://linkedin.com/in/baltzakis-themis"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn"
                      className="bg-void/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                    </a>
                    <a
                      href="https://github.com/Themis128"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="GitHub"
                      className="bg-void/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                      </svg>
                    </a>
                    <a
                      href="https://www.credly.com/users/themistoklis-baltzakis"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Credly certifications"
                      className="bg-void/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-.3 4.8a7.2 7.2 0 110 14.4 7.2 7.2 0 010-14.4zm0 2.4a4.8 4.8 0 100 9.6 4.8 4.8 0 000-9.6zm0 2.4a2.4 2.4 0 110 4.8 2.4 2.4 0 010-4.8z" />
                      </svg>
                    </a>
                    <a
                      href="https://www.baltzakisthemis.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Portfolio website"
                      className="bg-void/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20" />
                        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="from-neon-cyan/10 via-neon-blue/10 to-neon-magenta/10 absolute inset-0 bg-gradient-to-r" />
        <div className="cyber-grid absolute inset-0 opacity-20" />
        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="font-heading mb-6 text-3xl font-bold text-white lg:text-4xl">
              {t("cta.title", "Ready to go")}{" "}
              <span className="from-neon-cyan to-neon-magenta bg-gradient-to-r bg-clip-text text-transparent">
                {t("cta.titleHighlight", "cloudless")}
              </span>
              ?
            </h2>
            <p className="mx-auto mb-4 max-w-xl text-xl text-slate-400">
              {t(
                "cta.subtitle",
                "Book a free 30-minute audit. We'll review your current setup and show you exactly where you're overpaying, underperforming, or both.",
              )}
            </p>
            <p className="mx-auto mb-8 max-w-lg text-sm text-slate-500">
              {t(
                "cta.subtext",
                "No pitch. No commitment. Just actionable insights you can use even if you never talk to us again.",
              )}
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/contact"
                className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 shadow-neon-cyan/10 rounded-lg border px-8 py-3.5 font-mono font-semibold shadow-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,255,245,0.25)]"
              >
                {t("cta.ctaPrimary", "Book Your Free Audit")}
              </Link>
              <Link
                href="/services"
                className="bg-void-light rounded-lg border border-slate-700 px-8 py-3.5 font-mono font-medium text-slate-300 transition-colors duration-200 hover:border-slate-500"
              >
                {t("cta.ctaSecondary", "View Pricing")}
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
