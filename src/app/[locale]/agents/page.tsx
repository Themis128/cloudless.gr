import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import AgentCounter from "@/components/AgentCounter";
import { isSupportedLocale, type Locale } from "@/lib/i18n";
import { localizedPageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : "en";
  const title = "Agents";
  const description = "Cloudless Agent Workers — Interactive demos and tools.";

  return localizedPageMetadata({ locale: safeLocale, slug: "agents", title, description });
}

export default async function AgentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <main className="bg-void min-h-screen overflow-x-hidden py-24">
      <JsonLd data={getBreadcrumbSchema([{ name: "Agents", url: "/agents" }], locale)} />

      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-8">
          <span className="text-neon-cyan font-mono text-xs font-medium">AGENTS</span>
          <h1 className="font-heading text-3xl font-bold text-white">Cloudless Agent Worker</h1>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <AgentCounter />
        </div>
      </div>
    </main>
  );
}
