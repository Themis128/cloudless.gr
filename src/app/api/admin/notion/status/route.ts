import { isConfiguredAsync, getIntegrationsAsync } from "@/lib/integrations";
import { requireAdmin } from "@/lib/api-auth";
import { notionFetch } from "@/lib/notion";
import { NextRequest, NextResponse } from "next/server";
import { mapIntegrationError } from "@/lib/api-errors";

interface DbStatus {
  name: string;
  configured: boolean;
  connected: boolean;
  count: number;
  sample: Record<string, unknown>[];
  error?: string;
}

interface NotionProp {
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  select?: { name: string };
  multi_select?: Array<{ name: string }>;
  checkbox?: boolean;
  number?: number;
  date?: { start: string };
  url?: string;
  email?: string;
  bot?: { owner?: { user?: { name?: string } } };
}

type Extractor = (prop: NotionProp) => unknown;

const joinPlainText = (parts?: Array<{ plain_text: string }>): string =>
  (parts ?? []).map((t) => t.plain_text).join("");

const EXTRACTORS: Record<string, Extractor> = {
  title: (p) => joinPlainText(p.title),
  rich_text: (p) => joinPlainText(p.rich_text),
  select: (p) => p.select?.name ?? null,
  multi_select: (p) => (p.multi_select ?? []).map((s) => s.name),
  checkbox: (p) => p.checkbox ?? false,
  number: (p) => p.number ?? null,
  date: (p) => p.date?.start ?? null,
  url: (p) => p.url ?? null,
  email: (p) => p.email ?? null,
};

function extractValue(prop: NotionProp): unknown {
  if (!prop) return null;
  const fn = EXTRACTORS[prop.type];
  return fn ? fn(prop) : `(${prop.type})`;
}

async function probeDatabase(name: string, envKey: string, limit = 5): Promise<DbStatus> {
  const cfg = await getIntegrationsAsync();
  const dbId = cfg[envKey as keyof typeof cfg] as string | undefined;

  if (!dbId) {
    return { name, configured: false, connected: false, count: 0, sample: [] };
  }

  try {
    const data = await notionFetch<{
      results: Array<{ id: string; properties?: Record<string, NotionProp> }>;
      has_more: boolean;
    }>(`/databases/${dbId}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: limit }),
    });

    const sample = (data.results ?? []).map((page) => {
      const out: Record<string, unknown> = { id: page.id };
      for (const [key, val] of Object.entries(page.properties ?? {})) {
        out[key] = extractValue(val);
      }
      return out;
    });

    return {
      name,
      configured: true,
      connected: true,
      count: data.results?.length ?? 0,
      sample,
    };
  } catch (err: unknown) {
    // Log the raw error server-side (Sentry scrubber redacts secrets) but
    // return a generic public message — the upstream Notion error text can
    // include URLs, request IDs, and account-internal hints we don't want
    // to expose even to admin clients.
    console.error(`[notion-status] ${name} failed:`, err);
    return {
      name,
      configured: true,
      connected: false,
      count: 0,
      sample: [],
      error: "upstream-notion-error",
    };
  }
}

function unauthenticated(error: string) {
  return NextResponse.json({ authenticated: false, error, databases: [] }, { status: 200 });
}

async function resolveBotName(): Promise<
  { ok: true; botName: string } | { ok: false; response: NextResponse }
> {
  try {
    const me = await notionFetch<{
      name?: string;
      bot?: { owner?: { user?: { name?: string } } };
    }>("/users/me");
    return {
      ok: true,
      botName: me.name ?? me.bot?.owner?.user?.name ?? "bot",
    };
  } catch (err) {
    const mapped = mapIntegrationError(err);
    return {
      ok: false,
      response: mapped ?? unauthenticated("NOTION_API_KEY is invalid or expired"),
    };
  }
}

const PROBE_TARGETS: Array<[string, string]> = [
  ["Blog", "NOTION_BLOG_DB_ID"],
  ["Docs", "NOTION_DOCS_DB_ID"],
  ["Projects", "NOTION_PROJECTS_DB_ID"],
  ["Tasks", "NOTION_TASKS_DB_ID"],
  ["Submissions", "NOTION_SUBMISSIONS_DB_ID"],
  ["Analytics", "NOTION_ANALYTICS_DB_ID"],
];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY"))) {
    return unauthenticated("NOTION_API_KEY not configured. Add it to .env.local");
  }

  const bot = await resolveBotName();
  if (!bot.ok) return bot.response;

  const databases = await Promise.all(PROBE_TARGETS.map(([name, key]) => probeDatabase(name, key)));

  return NextResponse.json({
    authenticated: true,
    botName: bot.botName,
    databases,
  });
}
