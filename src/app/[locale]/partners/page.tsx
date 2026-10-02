export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import JsonLd from "@/components/JsonLd";
import ContactFormSection from "@/components/ContactFormSection";
import ScrollReveal from "@/components/ScrollReveal";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { translate, getMessages, isSupportedLocale, type Locale } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";

const BASE_URL = "https://cloudless.gr";

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
  const title = meta?.partners?.title ?? "Partner with Cloudless — Sponsorships & Brand Deals";
  const description =
    meta?.partners?.description ??
    "Sponsored content, product walkthroughs, and brand partnerships with an engaged niche audience of founders and engineers. Media kit and formats inside.";

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/partners`,
      languages: {
        en: `${BASE_URL}/en/partners`,
        el: `${BASE_URL}/el/partners`,
        de: `${BASE_URL}/de/partners`,
        fr: `${BASE_URL}/fr/partners`,
        "x-default": `${BASE_URL}/en/partners`,
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${BASE_URL}/partners`,
      siteName: "Cloudless",
    },
  };
}

export default async function PartnersPage() {
  const locale = await getServerLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  const formats = [
    {
      title: t("partners.formatSponsoredTitle", "Sponsored post or carousel"),
      body: t(
        "partners.formatSponsoredBody",
        "A dedicated LinkedIn post or multi-slide carousel in our signature engineering case-study format. Your product appears where it naturally fits the story — real usage, real numbers."
      ),
    },
    {
      title: t("partners.formatWalkthroughTitle", "Product walkthrough"),
      body: t(
        "partners.formatWalkthroughBody",
        "A hands-on demo of your tool: we build something real with it and document the result across LinkedIn and the blog. Readers see the product working, not a screenshot."
      ),
    },
    {
      title: t("partners.formatCobrandTitle", "Co-branded content"),
      body: t(
        "partners.formatCobrandBody",
        "Joint webinars, data studies, or technical guides published under both brands. Best for tools our audience would genuinely evaluate."
      ),
    },
    {
      title: t("partners.formatAmbassadorTitle", "Ambassador retainer"),
      body: t(
        "partners.formatAmbassadorBody",
        "Ongoing monthly collaboration: recurring mentions, content integration, and feedback loops. For products we already use and can vouch for long-term."
      ),
    },
  ];

  const stats = [
    {
      value: t("partners.statErValue", "~19%"),
      label: t("partners.statErLabel", "avg. LinkedIn engagement rate"),
      note: t("partners.statErNote", "vs. ~2% platform average"),
    },
    {
      value: t("partners.statPostsValue", "100+"),
      label: t("partners.statPostsLabel", "posts / month, 6 platforms"),
      note: t("partners.statPostsNote", "LinkedIn · IG · FB · Threads · TikTok · X"),
    },
    {
      value: t("partners.statCtrValue", "4.15%"),
      label: t("partners.statCtrLabel", "CTR on our own paid test"),
      note: t("partners.statCtrNote", "9x the LinkedIn average — see below"),
    },
    {
      value: t("partners.statReachValue", "890+"),
      label: t("partners.statReachLabel", "LinkedIn followers & growing"),
      note: t("partners.statReachNote", "founders, engineers, SMB owners"),
    },
  ];

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Partners", url: "https://cloudless.gr/partners" },
        ])}
      />

      {/* Hero */}
      <section className="bg-void scanlines relative overflow-hidden py-16 text-white md:py-20">
        <div className="cyber-grid absolute inset-0 opacity-30" />
        <div className="bg-neon-cyan/5 animate-float absolute top-0 left-1/4 h-[400px] w-[400px] -translate-y-1/2 rounded-full blur-3xl" />
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <p className="animate-shimmer-text mb-3 font-mono text-xs font-medium tracking-[0.3em]">
            [ PARTNERSHIPS ]
          </p>
          <h1 className="animate-fade-in-up font-heading text-3xl leading-tight font-bold delay-100 md:text-5xl">
            {t("partners.title", "Put your product in front of builders.")}
          </h1>
          <p className="animate-fade-in-up mt-4 max-w-xl text-lg text-slate-400 delay-200">
            {t(
              "partners.subtitle",
              "Cloudless builds in public: cloud architecture, self-hosted stacks, and AI marketing — documented honestly for an audience of founders and engineers who actually ship. If your tool belongs in that story, let's talk."
            )}
          </p>
          <div className="animate-fade-in-up mt-8 delay-300">
            <a
              href="#inquiry"
              className="bg-neon-cyan text-void inline-flex min-h-[44px] items-center rounded-lg px-6 py-3 font-mono text-sm font-bold tracking-wide transition-all hover:shadow-[0_0_20px_rgba(0,255,245,0.4)]"
            >
              {t("partners.ctaHero", "Start a partnership inquiry")}
            </a>
          </div>
        </div>
      </section>

      {/* Media kit stats */}
      <section className="bg-void dot-matrix py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-neon-cyan mb-3 font-mono text-xs font-medium tracking-[0.3em]">
            [ MEDIA KIT ]
          </p>
          <h2 className="font-heading mb-2 text-2xl font-bold text-white md:text-3xl">
            {t("partners.statsTitle", "Small audience. Serious engagement.")}
          </h2>
          <p className="mb-10 max-w-2xl text-slate-400">
            {t(
              "partners.statsSubtitle",
              "We optimize for depth, not reach. Numbers below are 30-day figures pulled from our own analytics pipeline — refreshed, not estimated."
            )}
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <ScrollReveal key={s.label}>
                <div className="hover:border-neon-cyan/50 bg-void-light/50 rounded-xl border border-slate-800 p-6 transition-colors">
                  <p className="font-heading text-neon-cyan text-3xl font-bold">{s.value}</p>
                  <p className="mt-2 text-sm font-medium text-white">{s.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{s.note}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Proof: the boost experiment */}
      <section className="bg-void-light/30 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <ScrollReveal>
              <div>
                <p className="text-neon-cyan mb-3 font-mono text-xs font-medium tracking-[0.3em]">
                  [ PROOF ]
                </p>
                <h2 className="font-heading mb-4 text-2xl font-bold text-white md:text-3xl">
                  {t("partners.proofTitle", "We ran the experiment on ourselves first.")}
                </h2>
                <p className="text-slate-400">
                  {t(
                    "partners.proofBody1",
                    "Before asking anyone to sponsor our content, we spent our own money proving the format works. A €100 LinkedIn promotion of a single carousel returned a 4.15% click-through rate — nine times the platform average — and drove qualified traffic to cloudless.gr."
                  )}
                </p>
                <p className="mt-4 text-slate-400">
                  {t(
                    "partners.proofBody2",
                    "We published the full breakdown — budget, targeting, creative, results — as a case study, because that's what we do for partners too: show the work, report real numbers."
                  )}
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <div className="border-neon-cyan/20 bg-void rounded-xl border p-6 font-mono text-sm">
                <p className="mb-4 text-xs tracking-widest text-slate-500">
                  $ experiment --summary
                </p>
                <div className="space-y-2 text-slate-300">
                  <p>
                    <span className="text-slate-500">budget:</span> €100 LinkedIn credit
                  </p>
                  <p>
                    <span className="text-slate-500">format:</span> 6-slide carousel, company page
                  </p>
                  <p>
                    <span className="text-slate-500">ctr:</span>{" "}
                    <span className="text-neon-cyan font-bold">4.15%</span>{" "}
                    <span className="text-slate-500">(avg ≈ 0.44%)</span>
                  </p>
                  <p>
                    <span className="text-slate-500">audience:</span> Greece · founders &amp; owners
                  </p>
                  <p>
                    <span className="text-slate-500">result:</span> qualified traffic → cloudless.gr
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Formats */}
      <section className="bg-void py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-neon-cyan mb-3 font-mono text-xs font-medium tracking-[0.3em]">
            [ FORMATS ]
          </p>
          <h2 className="font-heading mb-10 text-2xl font-bold text-white md:text-3xl">
            {t("partners.formatsTitle", "Ways to work together")}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {formats.map((f) => (
              <ScrollReveal key={f.title}>
                <div className="hover:border-neon-cyan/50 bg-void-light/50 h-full rounded-xl border border-slate-800 p-6 transition-colors">
                  <h3 className="font-heading mb-2 text-lg font-bold text-white">{f.title}</h3>
                  <p className="text-sm text-slate-400">{f.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Audience + honesty strip */}
      <section className="bg-void-light/30 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <ScrollReveal>
              <div>
                <p className="text-neon-cyan mb-3 font-mono text-xs font-medium tracking-[0.3em]">
                  [ AUDIENCE ]
                </p>
                <h2 className="font-heading mb-4 text-2xl font-bold text-white md:text-3xl">
                  {t("partners.audienceTitle", "Who reads this")}
                </h2>
                <ul className="space-y-3 text-slate-400">
                  <li className="flex gap-3">
                    <span className="text-neon-cyan">→</span>
                    {t(
                      "partners.audience1",
                      "Founders and SMB owners evaluating cloud, automation, and AI tooling"
                    )}
                  </li>
                  <li className="flex gap-3">
                    <span className="text-neon-cyan">→</span>
                    {t(
                      "partners.audience2",
                      "Engineers and technical decision-makers who follow build-in-public content"
                    )}
                  </li>
                  <li className="flex gap-3">
                    <span className="text-neon-cyan">→</span>
                    {t(
                      "partners.audience3",
                      "Greece-first with EU reach — the audience our paid test already proved converts"
                    )}
                  </li>
                </ul>
              </div>
            </ScrollReveal>
            <ScrollReveal>
              <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
                <h3 className="font-heading mb-3 text-lg font-bold text-white">
                  {t("partners.fitTitle", "Honest fit check")}
                </h3>
                <p className="text-sm text-slate-400">
                  {t(
                    "partners.fitBody",
                    "We're a growing niche account, not a reach machine — and we won't pretend otherwise. If you need a million impressions, we're not it. If you need a credible voice telling an engaged technical audience that your product actually works, that's the deal on the table. Every sponsored piece is clearly disclosed."
                  )}
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Inquiry form */}
      <div id="inquiry" className="animate-scale-in scroll-mt-24">
        <Suspense fallback={<div className="bg-void py-16 md:py-24" aria-hidden="true" />}>
          <ContactFormSection source="partners" />
        </Suspense>
      </div>
    </>
  );
}
