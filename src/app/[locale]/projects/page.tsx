export const revalidate = 3600;

import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { loadLabProjects } from "@/lib/lab-projects";
import { isSupportedLocale, type Locale } from "@/lib/i18n";
import ProjectCard from "@/components/ProjectCard";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { getServerLocale } from "@/lib/server-locale";
import { getBreadcrumbSchema } from "@/lib/structured-data";

const BASE_URL = "https://cloudless.gr";
const TITLE = "Projects — In-house builds by Cloudless";
const DESCRIPTION =
  "Self-built products designed, shipped and operated by Cloudless — live demos with real infrastructure, not mockups.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : "en";

  // Locale-prefixed: unprefixed paths redirect to /en/…, so an unprefixed
  // canonical would point every localized page at a redirect and contradict
  // its own hreflang alternates.
  const canonical = `${BASE_URL}/${safeLocale}/projects`;

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical,
      languages: {
        en: `${BASE_URL}/en/projects`,
        el: `${BASE_URL}/el/projects`,
        de: `${BASE_URL}/de/projects`,
        fr: `${BASE_URL}/fr/projects`,
        "x-default": `${BASE_URL}/en/projects`,
      },
    },
    openGraph: {
      type: "website",
      title: TITLE,
      description: DESCRIPTION,
      url: canonical,
      siteName: "Cloudless",
    },
  };
}

export default async function ProjectsPage() {
  const locale = await getServerLocale();
  const labProjects = await loadLabProjects();
  const flagship = labProjects.find((p) => p.name.toLowerCase() === "mobile price intelligence");

  return (
    <main className="bg-void relative min-h-screen overflow-x-hidden">
      <JsonLd data={getBreadcrumbSchema([{ name: "Projects", url: "/projects" }], locale)} />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">PROJECTS</span>
        </div>
        <h1 className="font-heading text-4xl leading-tight font-bold text-white sm:text-5xl">
          In-house builds, <span className="text-neon-cyan">live demos</span>
        </h1>
        <p className="font-body mt-4 max-w-2xl text-slate-400">
          Products we designed, built and operate ourselves — real users, real infrastructure, zero
          mockups. Every card links to a running deployment.
        </p>
      </section>

      {/* Project grid */}
      {labProjects.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {labProjects.map((p) => (
              <ScrollReveal key={p.id}>
                <ProjectCard project={p} linkToNotion={Boolean(p.url)} />
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}

      {/* Flagship deep-dive — rendered only for the Mobile Price Intelligence
          build; add a sibling block per project as the lab portfolio grows. */}
      {flagship && (
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="border-neon-cyan/20 bg-void-light/30 rounded-xl border p-8 sm:p-12">
            <p className="text-neon-cyan/70 mb-3 font-mono text-[10px] font-medium tracking-[0.3em] uppercase">
              UNDER THE HOOD
            </p>
            <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">
              {flagship.name}
            </h2>
            <p className="font-body mt-4 max-w-3xl text-slate-400">{flagship.description}</p>

            {/* Creation date + beneficiary occupations — sourced from the
                AppFlowy **StartDate** / **Audience** fields via ProjectCard data. */}
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {flagship.startDate && !Number.isNaN(new Date(flagship.startDate).getTime()) && (
                <div>
                  <dt className="text-neon-cyan/70 font-mono text-[10px] tracking-widest uppercase">
                    Created
                  </dt>
                  <dd className="mt-1 text-sm text-slate-300">
                    {new Date(flagship.startDate).toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                      timeZone: "Europe/Athens",
                    })}
                  </dd>
                </div>
              )}
              {flagship.audience && flagship.audience.length > 0 && (
                <div>
                  <dt className="text-neon-magenta/70 font-mono text-[10px] tracking-widest uppercase">
                    Who it&apos;s for
                  </dt>
                  <dd className="mt-1 text-sm text-slate-300">{flagship.audience.join(", ")}</dd>
                </div>
              )}
            </dl>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="border-neon-cyan/20 rounded-lg border p-5">
                <p className="text-neon-cyan font-mono text-[10px] tracking-widest uppercase">
                  Frontend
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Nuxt 4 on Vercel — SSR search, dataset explorer, model comparison and A/B testing
                  dashboards.
                </p>
              </div>
              <div className="border-neon-magenta/20 rounded-lg border p-5">
                <p className="text-neon-magenta font-mono text-[10px] tracking-widest uppercase">
                  Backend
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  FastAPI + scikit-learn / XGBoost / LightGBM, self-hosted on our own k3s cluster —
                  no managed cloud bill.
                </p>
              </div>
              <div className="border-neon-green/20 rounded-lg border p-5">
                <p className="text-neon-green font-mono text-[10px] tracking-widest uppercase">
                  Edge
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Cloudflare Tunnel + DNS — TLS, caching and DDoS protection on the free tier.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {flagship.url && (
                <a
                  href={flagship.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/20 rounded-lg border px-5 py-2.5 font-mono text-sm transition-colors"
                >
                  Launch live app ↗
                </a>
              )}
              <Link
                href="/work"
                className="hover:border-neon-cyan/40 hover:text-neon-cyan rounded-lg border border-slate-700 px-5 py-2.5 font-mono text-sm text-slate-400 transition-colors"
              >
                See client work →
              </Link>
              <Link
                href="/contact"
                className="text-neon-magenta hover:text-neon-magenta/80 px-2 py-2.5 font-mono text-sm transition-colors"
              >
                Build something with us →
              </Link>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
