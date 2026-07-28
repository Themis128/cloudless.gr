/**
 * POST /api/admin/ops — Operational commands endpoint.
 *
 * Accepts commands for cluster operations, cache management, and other
 * administrative tasks that don't fit in other endpoints.
 *
 * Auth: Bearer token or session cookie (admin required).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { invalidateCache } from "@/lib/notion-cache";
import { mapIntegrationError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface OpsResponse {
  ok: boolean;
  command?: string;
  result?: unknown;
  error?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      command?: string;
      target?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };

    const command = body?.command;
    if (!command) {
      return NextResponse.json({ error: "command is required" }, { status: 400 });
    }

    let result: OpsResponse;

    switch (command) {
      case "clear-cache": {
        const prefix = body.target;
        invalidateCache(prefix);
        result = {
          ok: true,
          command,
          result: { cleared: prefix ?? "(all)" },
        };
        break;
      }

      case "health-check": {
        // Trigger a health check across integrations
        const { getIntegrationsAsync } = await import("@/lib/integrations");
        const config = await getIntegrationsAsync();

        const checks: Record<string, boolean> = {
          stripe: !!config.STRIPE_SECRET_KEY,
          ses: !!process.env.AWS_SES_REGION,
          slack: !!config.SLACK_BOT_TOKEN,
          notion: !!config.NOTION_API_KEY,
          espocrm: !!(config.ESPOCRM_BASE_URL && config.ESPOCRM_API_KEY),
        };

        result = {
          ok: true,
          command,
          result: { checks },
        };
        break;
      }

      case "sync-users": {
        // Trigger user sync (placeholder - actual implementation would use Cognito)
        result = {
          ok: true,
          command,
          result: { message: "User sync initiated" },
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown command: ${command}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    const integrationResponse = mapIntegrationError(err);
    if (integrationResponse) return integrationResponse;
    console.error("[admin/ops] Error:", err);
    return NextResponse.json({ error: "Operational command failed" }, { status: 500 });
  }
}
