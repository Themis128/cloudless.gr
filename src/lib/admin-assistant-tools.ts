import { notifyTeam } from "@/lib/email";
import {
  getGoldSection,
  getInsight,
  getInsightsIndex,
  getSeoFromLake,
  listInsightDomains,
} from "@/lib/datalake-serve";
import { retrieveAdminRagContext } from "@/lib/admin-rag";

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Tool names keep legacy identifiers (search_notion / get_recent_orders) for
 * prompt compatibility; implementations are lake / Vectorize only — no live
 * Notion or Stripe API calls.
 */
export const ASSISTANT_TOOLS: AnthropicTool[] = [
  {
    name: "search_notion",
    description:
      "Search lake-synced CMS docs via Vectorize RAG (AppFlowy). Falls back to gold SEO keywords. Not live Notion.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query string" },
        limit: {
          type: "number",
          description: "Max results (default 8, max 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_datalake_section",
    description:
      "Read a gold datalake section (stripe_revenue, top_keywords, linkedin_ads, espocrm_funnel, top_errors, etc.).",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          description: "Gold section name from admin-datalake.json",
        },
      },
      required: ["section"],
    },
  },
  {
    name: "get_lake_insight",
    description:
      "Read a materialized LLM insight: seo, revenue, crm_funnel, ads, ops_errors, executive, orchestration.",
    input_schema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Insight domain" },
      },
      required: ["domain"],
    },
  },
  {
    name: "get_recent_orders",
    description:
      "Summarize revenue rows from datalake gold stripe_revenue (not the live Stripe API).",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of gold rows to return (default 5, max 20)",
        },
      },
    },
  },
  {
    name: "draft_email",
    description:
      "Compose and optionally send an email to the admin team. Set send=true to deliver it immediately; omit or false for a preview draft only.",
    input_schema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body text" },
        send: {
          type: "boolean",
          description: "Whether to actually send the email (default false — preview only)",
        },
      },
      required: ["subject", "body"],
    },
  },
];

export async function runAssistantTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    if (name === "search_notion" || name === "search_lake_docs") {
      const query = String(input.query ?? "");
      const limit = Math.min(Number(input.limit ?? 8), 20);
      const rag = await retrieveAdminRagContext(query);
      if (rag.trim()) {
        return rag
          .split("\n\n")
          .slice(0, limit)
          .map((block) => `• ${block.replace(/\n/g, " — ").slice(0, 400)}`)
          .join("\n");
      }
      const seo = await getSeoFromLake(28);
      const matched = seo.keywords
        .filter((k) => k.query.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit);
      if (!matched.length) {
        const index = await listInsightDomains();
        return `No lake docs found for that query. Insight domains: ${
          index.domains.map((d) => d.domain).join(", ") ||
          "(none — run materialize-datalake-insights)"
        }`;
      }
      return matched
        .map((k) => `• keyword "${k.query}" — clicks ${k.clicks}, impressions ${k.impressions}`)
        .join("\n");
    }

    if (name === "get_datalake_section") {
      const section = String(input.section ?? "");
      const result = await getGoldSection(section);
      if (!result) return `Section "${section}" not found in gold snapshot.`;
      if (result.error) return `Section "${section}" error: ${result.error}`;
      return JSON.stringify(
        {
          section: result.section,
          rowCount: result.rowCount,
          rows: (result.rows ?? []).slice(0, 15),
        },
        null,
        2
      );
    }

    if (name === "get_lake_insight") {
      const domain = String(input.domain ?? "");
      const insight = await getInsight(domain);
      if (!insight) {
        const index = await getInsightsIndex();
        return `Insight "${domain}" missing. Index: ${JSON.stringify(index?.domains ?? [])}`;
      }
      return JSON.stringify(
        {
          domain: insight.domain,
          summary: insight.summary,
          bullets: insight.bullets,
          generated_at: insight.generated_at,
          error: insight.error,
        },
        null,
        2
      );
    }

    if (name === "get_recent_orders") {
      const limit = Math.min(Number(input.limit ?? 5), 20);
      const section = await getGoldSection("stripe_revenue");
      if (!section || section.error) {
        return `No recent orders found (stripe_revenue gold ${section?.error ?? "missing"}).`;
      }
      const rows = (section.rows ?? []).slice(0, limit);
      if (!rows.length) return "No recent orders found (stripe_revenue gold empty).";
      return rows
        .map((r) => {
          const day = r.day ?? r.date ?? r.period ?? "unknown";
          const amount = Number(r.revenue ?? r.amount) || 0;
          const count = r.count ?? r.orders ?? r.events ?? "";
          return `• ${day} — EUR ${amount.toFixed(2)} — events ${count}`;
        })
        .join("\n");
    }

    if (name === "draft_email") {
      const subject = String(input.subject ?? "");
      const body = String(input.body ?? "");
      const send = Boolean(input.send);
      if (send) {
        await notifyTeam(subject, body);
        return `Email sent to team: "${subject}"`;
      }
      return `Draft ready (not sent yet):\n\nSubject: ${subject}\n\n${body}`;
    }

    return `Unknown tool: ${name}`;
  } catch (err) {
    return `Tool ${name} error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
