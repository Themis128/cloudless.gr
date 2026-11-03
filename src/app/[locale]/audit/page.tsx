import type { Metadata } from "next";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { translate, getMessages, isSupportedLocale, type Locale } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";
import AuditForm from "./AuditForm";

const BASE_URL = "https://cloudless.gr";
const canonical = `${BASE_URL}/audit`;

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
  const title = meta?.audit?.title ?? "Free 30-Minute Tech Checkup — Cloudless";
  const description =
    meta?.audit?.description ??
    "Book a free 30-minute tech checkup. We review your setup, find the software cost leaks, and hand you a concrete action plan — no sales pitch.";

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${BASE_URL}/en/audit`,
        el: `${BASE_URL}/el/audit`,
        de: `${BASE_URL}/de/audit`,
        fr: `${BASE_URL}/fr/audit`,
        "x-default": `${BASE_URL}/en/audit`,
      },
    },
    openGraph: { type: "website", title, description, url: canonical, siteName: "Cloudless" },
  };
}

export default async function AuditPage() {
  const locale = await getServerLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  const problems = [
    {
      title: t("auditPage.probA", "Slow Daily Tasks"),
      body: t(
        "auditPage.probADesc",
        "Your team loses hours every week on manual data entries, broken tools, and clunky day-to-day operations."
      ),
    },
    {
      title: t("auditPage.probB", "Skyrocketing Software Bills"),
      body: t(
        "auditPage.probBDesc",
        "Hidden monthly subscription fees and overlapping software licenses quietly eat into your hard-earned profits."
      ),
    },
    {
      title: t("auditPage.probC", "Agency Retainer Traps"),
      body: t(
        "auditPage.probCDesc",
        "Getting trapped in open-ended monthly agency retainers or constantly chasing unreliable freelancers who do not reply."
      ),
    },
  ];

  const pillars = [
    {
      metric: t("auditPage.p1Metric", "14-Day Delivery"),
      desc: t(
        "auditPage.p1Desc",
        "Your custom high-converting website and background automations are fully built, tested, and pushed live by week two."
      ),
    },
    {
      metric: t("auditPage.p2Metric", "100% Ownership"),
      desc: t(
        "auditPage.p2Desc",
        "You own every single line of code and backend configuration we make. No forced ongoing tech lock-ins."
      ),
    },
    {
      metric: t("auditPage.p3Metric", "Transparent Rates"),
      desc: t(
        "auditPage.p3Desc",
        "Single platform setups start at a flat rate of only €800. Complete fractional tech execution at €3,600 a month."
      ),
    },
  ];

  const labels = {
    name: t("auditPage.formName", "Your name"),
    email: t("auditPage.formEmail", "Work email *"),
    goal: t("auditPage.formGoal", "What project or task do you need to get done right now? *"),
    pain: t(
      "auditPage.formPain",
      "What is making that hard or taking too much time? (High bills, slow tools, lack of time?) *"
    ),
    timeline: t(
      "auditPage.formTimeline",
      "When do you absolutely need this setup running smoothly? *"
    ),
    submit: t("auditPage.formSubmit", "Book Your Free 30-Minute Tech Checkup"),
    sending: t("auditPage.formSending", "Booking…"),
    done: t("auditPage.formDone", "Booked — check your inbox. We'll confirm your slot shortly."),
    error: t("auditPage.formError", "Something went wrong — please try again."),
  };

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Free Audit", url: "https://cloudless.gr/audit" },
        ])}
      />

      {/* ── Hero — manifest Element_Hero_Header/Subheader ─────────── */}
      <section className="bg-void relative overflow-hidden py-20 text-white lg:py-24">
        <div className="cyber-grid absolute inset-0 opacity-20" />
        <div className="bg-neon-cyan/5 animate-float absolute top-0 right-0 h-[400px] w-[400px] translate-x-1/3 -translate-y-1/2 rounded-full blur-3xl" />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <div className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="bg-neon-green animate-ping-slow absolute inline-flex h-full w-full rounded-full opacity-75" />
              <span className="bg-neon-green relative inline-flex h-2 w-2 rounded-full" />
            </span>
            {t("auditPage.badge", "FREE 30-MINUTE TECH CHECKUP")}
          </div>
          <h1 className="font-heading text-3xl leading-tight font-bold md:text-5xl">
            {t(
              "auditPage.title",
              "We help startups and small businesses fix slow daily tasks and high software bills."
            )}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            {t(
              "auditPage.subtitle",
              "At Cloudless, we design easy websites, hosting, and automatic marketing systems in just 14 days flat. You own everything we make, and investments start at only €800."
            )}
          </p>
        </div>
      </section>

      {/* ── Problem grid — manifest PROBLEM_GRID_COMPONENT ─────────── */}
      <section className="bg-void-light/20 border-y border-slate-800 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal>
            <h2 className="font-heading mb-10 text-center text-2xl font-bold text-white md:text-3xl">
              {t("auditPage.problemTitle", "Why traditional systems drag you down")}
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {problems.map((p) => (
                <div
                  key={p.title}
                  className="bg-void-light/50 hover:border-neon-magenta/40 rounded-xl border border-slate-800 p-6 transition-all duration-300"
                >
                  <h3 className="text-neon-magenta font-heading text-lg font-bold">{p.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{p.body}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Philosophy pillars — manifest PHILOSOPHY_COMPONENT ─────── */}
      <section className="bg-void border-b border-slate-800 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <ScrollReveal>
            <h2 className="font-heading mb-10 text-center text-2xl font-bold text-white md:text-3xl">
              {t("auditPage.philosophyTitle", "The Cloudless Architecture Blueprint")}
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {pillars.map((p) => (
                <div
                  key={p.metric}
                  className="bg-void-light/50 hover:border-neon-cyan/40 rounded-xl border border-slate-800 p-6 text-center transition-all duration-300"
                >
                  <span className="text-neon-cyan font-mono text-xl font-bold">{p.metric}</span>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{p.desc}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Booking form — manifest CALENDAR_INTEGRATION_ROUTING ───── */}
      <section className="bg-void py-16 lg:py-20">
        <div className="mx-auto max-w-2xl px-6">
          <ScrollReveal>
            <div className="bg-void-light/50 border-neon-cyan/20 rounded-2xl border p-8 lg:p-10">
              <p className="mb-6 text-center font-mono text-sm text-slate-400">
                {t(
                  "auditPage.formIntro",
                  "No sales pitch, just a simple action plan. Let's find your quick wins today."
                )}
              </p>
              <AuditForm labels={labels} />
              <p className="text-neon-green mt-5 text-center font-mono text-xs">
                {t(
                  "auditPage.formFootnote",
                  "No credit card. No obligation. You keep the plan either way."
                )}
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
