import { listRecentCheckoutSessions } from "@/lib/stripe";
import { notifyTeam } from "@/lib/email";

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const ASSISTANT_TOOLS: AnthropicTool[] = [
  {
    name: "search_notion",
    description:
      "Search Notion workspace pages and databases. Returns page titles, URLs, and last-edited dates. Use this to find projects, tasks, documentation, or any Notion content.",
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
    name: "get_recent_orders",
    description:
      "Fetch recent Stripe checkout sessions. Returns customer email, order amount, currency, and payment status.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of orders to return (default 5, max 20)",
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
    if (name === "search_notion") {
      const query = String(input.query ?? "");
      const limit = Math.min(Number(input.limit ?? 8), 20);
      const { results } = await searchPages(query, { limit });
      if (!results.length) return "No Notion pages found for that query.";
      return results
        .map(
          (r) =>
            `• [${r.title || "(untitled)"}](${r.url}) — ${r.type}, last edited ${new Date(r.lastEditedTime).toLocaleDateString("en-GB")}`
        )
        .join("\n");
    }

    if (name === "get_recent_orders") {
      const limit = Math.min(Number(input.limit ?? 5), 20);
      const { orders } = await listRecentCheckoutSessions(limit);
      if (!orders.length) return "No recent orders found (Stripe may not be configured).";
      return orders
        .map((o) => {
          const amount = `${o.currency} ${(o.amount / 100).toFixed(2)}`;
          const date = new Date(o.created * 1000).toLocaleDateString("en-GB");
          return `• ${o.email ?? "unknown"} — ${amount} — ${o.paymentStatus} — ${date}`;
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
