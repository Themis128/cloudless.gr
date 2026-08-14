export const dynamic = "force-dynamic";
export const revalidate = 3600;

import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import {
  getCaseStudyBySlug,
  staticCaseStudies,
  getCaseStudies,
  type CaseStudyWithContent,
} from "@/lib/appflowy-case-studies";
import { isAppFlowyConfigured } from "@/lib/appflowy";

const BASE_URL = "https://cloudless.gr";

// ---------------------------------------------------------------------------
// Static params for ISR
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  try {
    const configured = await isAppFlowyConfigured();
    const slugs = configured
      ? (await getCaseStudies()).map((c) => c.slug)
      : staticCaseStudies.map((c) => c.slug);
    return slugs.map((slug) => ({ slug }));
  } catch {
    return staticCaseStudies.map((c) => ({ slug: c.slug }));
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cs = await loadCaseStudy(slug);
  if (!cs) return { title: "Case Study Not Found" };
  const canonical = `${BASE_URL}/case-studies/${slug}`;
  return {
    title: cs.title,
    description: cs.summary,
    alternates: {
      canonical,
      languages: {
        en: `${BASE_URL}/en/case-studies/${slug}`,
        el: `${BASE_URL}/el/case-studies/${slug}`,
        "x-default": `${BASE_URL}/en/case-studies/${slug}`,
      },
    },
    openGraph: {
      type: "article",
      title: cs.title,
      description: cs.summary,
      url: canonical,
      siteName: "Cloudless",
      ...(cs.coverImage && {
        images: [{ url: cs.coverImage, width: 1200, height: 630, alt: cs.title }],
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadCaseStudy(slug: string): Promise<CaseStudyWithContent | null> {
  try {
    const configured = await isAppFlowyConfigured();
    if (configured) return await getCaseStudyBySlug(slug);
    const cs = staticCaseStudies.find((c) => c.slug === slug);
    return cs ? { ...cs, html: "" } : null;
  } catch {
    const cs = staticCaseStudies.find((c) => c.slug === slug);
    return cs ? { ...cs, html: "" } : null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cs = await loadCaseStudy(slug);
  if (!cs) notFound();

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", url: BASE_URL },
          { name: "Case Studies", url: `${BASE_URL}/case-studies` },
          { name: cs.title, url: `${BASE_URL}/case-studies/${cs.slug}` },
        ])}
      />
      {/* Hero */}
      <section className="px-4 pt-24 pb-12">
        <div className="mx-auto max-w-4xl">
          <ScrollReveal>
            <Link
              href="/case-studies"
              className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#00fff5]"
            >
              ← All case studies
            </Link>

            <div className="mb-4 flex flex-wrap gap-2">
              {cs.services.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-[#00fff5]/10 px-3 py-1 text-xs text-[#00fff5]"
                >
                  {s}
                </span>
              ))}
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-400">
                {cs.industry}
              </span>
            </div>

            <h1 className="mb-4 text-3xl font-bold md:text-4xl">{cs.title}</h1>
            <p className="text-lg text-gray-400">{cs.summary}</p>
          </ScrollReveal>
        </div>
      </section>

      {/* Cover image */}
      {cs.coverImage && (
        <div className="mx-auto mb-12 max-w-4xl px-4">
          <div className="relative h-80 overflow-hidden rounded-2xl">
            <Image
              src={cs.coverImage}
              alt={cs.title}
              fill
              sizes="(max-width: 1024px) 100vw, 896px"
              className="object-cover"
            />
          </div>
        </div>
      )}

      {/* Metrics */}
      {cs.metrics.length > 0 && (
        <section className="mx-auto mb-12 max-w-4xl px-4">
          <ScrollReveal>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {cs.metrics.map((m) => (
                <div
                  key={m.label}
                  className="rounded-2xl border border-[#00fff5]/20 bg-[#00fff5]/5 p-6 text-center"
                >
                  <div className="mb-1 text-3xl font-bold text-[#00fff5]">{m.value}</div>
                  <div className="text-sm text-gray-400">{m.label}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </section>
      )}

      {/* Body */}
      <section className="mx-auto max-w-4xl px-4 pb-24">
        {/* If Notion content exists render it; otherwise render structured fields */}
        {cs.html ? (
          <ScrollReveal>
            <div
              className="prose prose-invert prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: cs.html }}
            />
          </ScrollReveal>
        ) : (
          <div className="space-y-10">
            {cs.challenge && (
              <ScrollReveal>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
                  <h2 className="mb-4 text-2xl font-bold text-[#00fff5]">The Challenge</h2>
                  <p className="text-gray-300">{cs.challenge}</p>
                </div>
              </ScrollReveal>
            )}

            {cs.solution && (
              <ScrollReveal>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
                  <h2 className="mb-4 text-2xl font-bold text-[#00fff5]">Our Approach</h2>
                  <p className="text-gray-300">{cs.solution}</p>
                </div>
              </ScrollReveal>
            )}

            {cs.results && (
              <ScrollReveal>
                <div className="rounded-2xl border border-[#00fff5]/20 bg-[#00fff5]/5 p-8">
                  <h2 className="mb-4 text-2xl font-bold text-[#00fff5]">Results</h2>
                  <p className="text-gray-300">{cs.results}</p>
                </div>
              </ScrollReveal>
            )}
          </div>
        )}

        {/* CTA */}
        <ScrollReveal>
          <div className="mt-16 rounded-2xl border border-[#00fff5]/20 bg-[#00fff5]/5 p-8 text-center">
            <h2 className="mb-3 text-2xl font-bold">Want similar results?</h2>
            <p className="mb-6 text-gray-400">
              Book a free 30-minute call and let&apos;s talk about your cloud setup.
            </p>
            <Link
              href="/contact"
              className="inline-block rounded-xl bg-[#00fff5] px-8 py-4 font-semibold text-[#0a0a0f] transition hover:opacity-90"
            >
              Book a free audit
            </Link>
          </div>
        </ScrollReveal>
      </section>
    </main>
  );
}
