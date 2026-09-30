import type { Metadata } from "next";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import PlaybookLeadForm from "@/components/PlaybookLeadForm";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import { translate, translateArray, isSupportedLocale, type Locale } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";

type PageProps = { params: Promise<{ locale: string }> };

async function resolveLocale(params: PageProps["params"]): Promise<Locale> {
  const { locale } = await params;
  return isSupportedLocale(locale) ? locale : await getServerLocale();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  return {
    title: t("playbook.title", "The Cloud Migration Playbook"),
    description: t(
      "playbook.subtitle",
      "The exact framework we use with clients to move to the cloud safely, on budget, and without downtime. Free, straight to your inbox."
    ),
    alternates: { canonical: `https://cloudless.gr/${locale}/playbook` },
  };
}

const DEFAULT_POINTS = [
  "Assess: inventory workloads, dependencies, and the real cost baseline",
  "Plan: pick the right migration strategy per workload (rehost, replatform, refactor)",
  "Migrate: cut over in waves with rollback plans and zero-downtime patterns",
  "Optimise: right-size, set budgets and alerts, and keep costs from creeping back",
];

export default async function PlaybookPage({ params }: PageProps) {
  const locale = await resolveLocale(params);
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const points = translateArray(locale, "playbook.points", DEFAULT_POINTS);

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: "https://cloudless.gr" },
          { name: "Cloud Migration Playbook", url: "https://cloudless.gr/en/playbook" },
        ])}
      />
      <div className="min-h-screen">
        <div className="mx-auto grid max-w-5xl gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <ScrollReveal>
            <p
              className="mb-4 font-mono text-xs tracking-widest"
              style={{ color: "var(--secondary)" }}
            >
              {t("playbook.eyebrow", "[ FREE PLAYBOOK ]")}
            </p>
            <h1
              className="font-heading mb-4 text-3xl font-bold lg:text-4xl"
              style={{ color: "var(--ink-primary)" }}
            >
              {t("playbook.title", "The Cloud Migration Playbook")}
            </h1>
            <p className="mb-8 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              {t(
                "playbook.subtitle",
                "The exact framework we use with clients to move to the cloud safely, on budget, and without downtime. Free, straight to your inbox."
              )}
            </p>
            <ul className="space-y-3 text-sm" style={{ color: "var(--ink-muted)" }}>
              {points.map((point) => (
                <li key={point} className="flex gap-3">
                  <span aria-hidden="true" style={{ color: "var(--secondary)" }}>
                    ▸
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <div
              className="rounded-xl border p-6"
              style={{ background: "var(--surface-canvas)", borderColor: "var(--border-subtle)" }}
            >
              <h2
                className="mb-4 font-mono text-sm font-semibold"
                style={{ color: "var(--ink-primary)" }}
              >
                {t("playbook.formTitle", "Where should we send it?")}
              </h2>
              <PlaybookLeadForm />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </>
  );
}
