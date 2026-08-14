export const dynamic = "force-dynamic";
export const revalidate = 3600;

import type { Metadata } from "next";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import { getCaseStudies, staticCaseStudies, type CaseStudy } from "@/lib/appflowy-case-studies";
import { isAppFlowyConfigured } from "@/lib/appflowy";

const BASE_URL = "https://cloudless.gr";
const canonical = `${BASE_URL}/case-studies`;

export const metadata: Metadata = {
  title: "Case Studies",
  description:
    "Real-world results: how Cloudless helped startups and growing businesses cut cloud costs, migrate to serverless, and ship faster.",
  alternates: {
    canonical,
    languages: {
      en: `${BASE_URL}/en/case-studies`,
      el: `${BASE_URL}/el/case-studies`,
      "x-default": `${BASE_URL}/en/case-studies`,
    },
  },
  openGraph: {
    type: "website",
    title: "Case Studies",
    description:
      "Real-world results: how Cloudless helped startups and growing businesses cut cloud costs, migrate to serverless, and ship faster.",
    url: canonical,
    siteName: "Cloudless",
  },
};

async function loadCaseStudies(): Promise<CaseStudy[]> {
  try {
    const configured = await isAppFlowyConfigured();
    return configured ? await getCaseStudies() : staticCaseStudies;
  } catch {
    return staticCaseStudies;
  }
}

function MetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-[#00fff5]/20 bg-[#00fff5]/5 px-4 py-3">
      <span className="text-2xl font-bold text-[#00fff5]">{value}</span>
      <span className="mt-1 text-center text-xs text-gray-400">{label}</span>
    </div>
  );
}

function CaseStudyCard({ cs }: { cs: CaseStudy }) {
  return (
    <ScrollReveal>
      <Link
        href={`/case-studies/${cs.slug}`}
        className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-[#00fff5]/40 hover:bg-white/10"
      >
        {cs.coverImage && (
          <div className="relative mb-4 h-48 overflow-hidden rounded-xl">
            <Image
              src={cs.coverImage}
              alt={cs.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition group-hover:scale-105"
            />
          </div>
        )}

        <div className="mb-2 flex flex-wrap gap-2">
          {cs.services.map((s) => (
            <span key={s} className="rounded-full bg-[#00fff5]/10 px-3 py-1 text-xs text-[#00fff5]">
              {s}
            </span>
          ))}
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-400">
            {cs.industry}
          </span>
        </div>

        <h2 className="mb-2 text-xl font-bold text-white group-hover:text-[#00fff5]">{cs.title}</h2>
        <p className="mb-4 flex-1 text-sm text-gray-400">{cs.summary}</p>

        {cs.metrics.length > 0 && (
          <div className="mt-auto grid grid-cols-3 gap-3">
            {cs.metrics.slice(0, 3).map((m) => (
              <MetricBadge key={m.label} label={m.label} value={m.value} />
            ))}
          </div>
        )}
      </Link>
    </ScrollReveal>
  );
}

export default async function CaseStudiesPage() {
  const caseStudies = await loadCaseStudies();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Hero */}
      <section className="px-4 pt-24 pb-16 text-center">
        <ScrollReveal>
          <span className="mb-4 inline-block rounded-full border border-[#00fff5]/30 bg-[#00fff5]/10 px-4 py-1 text-sm text-[#00fff5]">
            Results that speak for themselves
          </span>
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">Case Studies</h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-400">
            Real engagements, real numbers. Here&apos;s how Cloudless helped businesses reduce cloud
            spend, modernise infrastructure, and ship faster.
          </p>
        </ScrollReveal>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        {caseStudies.length === 0 ? (
          <ScrollReveal>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
              <p className="text-gray-400">Case studies coming soon.</p>
              <Link href="/contact" className="mt-4 inline-block text-[#00fff5] hover:underline">
                Book a free consultation →
              </Link>
            </div>
          </ScrollReveal>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {caseStudies.map((cs) => (
              <CaseStudyCard key={cs.id} cs={cs} />
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 px-4 py-20 text-center">
        <ScrollReveal>
          <h2 className="mb-4 text-3xl font-bold">Ready to be next?</h2>
          <p className="mb-8 text-gray-400">
            Book a free 30-minute cloud audit and see what&apos;s possible.
          </p>
          <Link
            href="/contact"
            className="inline-block rounded-xl bg-[#00fff5] px-8 py-4 font-semibold text-[#0a0a0f] transition hover:opacity-90"
          >
            Book a free audit
          </Link>
        </ScrollReveal>
      </section>
    </div>
  );
}
