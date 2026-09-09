import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import AgentCounter from "@/components/AgentCounter";
import { translate, getMessages, isSupportedLocale, type Locale } from "@/lib/i18n";

const BASE_URL = "https://cloudless.gr";
const canonical = `${BASE_URL}/agents`;

type PageProps = {
  params: Promise<{ locale: string }>;
};

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
  const title = meta?.agents?.title ?? "Agents";
  const description =
    meta?.agents?.description ?? "Cloudless Agent Workers — Interactive demos and tools.";

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${BASE_URL}/en/agents`,
        el: `${BASE_URL}/el/agents`,
        de: `${BASE_URL}/de/agents`,
        fr: `${BASE_URL}/fr/agents`,
        "x-default": `${BASE_URL}/en/agents`,
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: "Cloudless",
    },
  };
}

export default async function AgentsPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isSupportedLocale(rawLocale) ? rawLocale : "en";
  setRequestLocale(rawLocale);
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  return (
    <main className="bg-void min-h-screen overflow-x-hidden py-24">
      <JsonLd data={getBreadcrumbSchema([{ name: "Agents", url: "/agents" }])} />

      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-8">
          <span className="text-neon-cyan font-mono text-xs font-medium">
            {t("agentsPage.label", "AGENTS")}
          </span>
          <h1 className="font-heading text-3xl font-bold text-white">
            {t("agentsPage.title", "Cloudless Agent Worker")}
          </h1>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <AgentCounter />
        </div>
      </div>
    </main>
  );
}
