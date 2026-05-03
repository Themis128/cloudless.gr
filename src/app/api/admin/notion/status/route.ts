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

/**
 * Helper: extract a human-readable value from a Notion property object.
 */
function extractValue(prop: NotionProp): unknown {
  if (!prop) return null;
  switch (prop.type) {
    case "title":
      return prop.title?.map((t) => t.plain_text).join("") ?? "";
    case "rich_text":
      return prop.rich_text?.map((t) => t.plain_text).join("") ?? "";
    case "select":
      return prop.select?.name ?? null;
    case "multi_select":
      return (prop.multi_select ?? []).map((s) => s.name);
    case "checkbox":
      return prop.checkbox ?? false;
    case "number":
      return prop.number ?? null;
    case "date":
      return prop.date?.start ?? null;
    case "url":
      return prop.url ?? null;
    case "email":
      return prop.email ?? null;
    default:
      return `(${prop.type})`;
  }
}

async function probeDatabase(
  name: string,
  envKey: string,
  limit = 5,
): Promise<DbStatus> {
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

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY"))) {
    return NextResponse.json(
      {
        authenticated: false,
        error: "NOTION_API_KEY not configured. Add it to .env.local",
        databases: [],
      },
      { status: 200 },
    );
  }

  let botName = "";
  try {
    const me = await notionFetch<{
      name?: string;
      bot?: { owner?: { user?: { name?: string } } };
    }>("/users/me");
    botName = me.name ?? me.bot?.owner?.user?.name ?? "bot";
  } catch (err) {
    const _r = mapIntegrationError(err); if (_r) return _r;
    return NextResponse.json(
      {
        authenticated: false,
        error: "NOTION_API_KEY is invalid or expired",
        databases: [],
      },
      { status: 200 },
    );
  }

  const databases = await Promise.all([
    probeDatabase("Blog", "NOTION_BLOG_DB_ID"),
    probeDatabase("Docs", "NOTION_DOCS_DB_ID"),
    probeDatabase("Projects", "NOTION_PROJECTS_DB_ID"),
    probeDatabase("Tasks", "NOTION_TASKS_DB_ID"),
    probeDatabase("Submissions", "NOTION_SUBMISSIONS_DB_ID"),
    probeDatabase("Analytics", "NOTION_ANALYTICS_DB_ID"),
  ]);

  return NextResponse.json({ authenticated: true, botName, databases });
}
