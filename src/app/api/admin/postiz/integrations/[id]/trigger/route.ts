import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { triggerIntegrationTool, PostizApiError, PostizNotConfiguredError } from "@/lib/postiz";

export const dynamic = "force-dynamic";

/** POST /api/admin/postiz/integrations/:id/trigger — execute a
 *  provider-specific tool (e.g. listing Discord channels, fetching Reddit
 *  flairs). Body: `{ tool: string, data?: object }`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  let body: { tool?: unknown; data?: unknown };
  try {
    body = (await req.json()) as { tool?: unknown; data?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.tool !== "string" || !body.tool) {
    return NextResponse.json({ error: "missing_tool" }, { status: 400 });
  }

  try {
    const data =
      body.data && typeof body.data === "object"
        ? (body.data as Record<string, unknown>)
        : undefined;
    const result = await triggerIntegrationTool(id, { tool: body.tool, data });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PostizNotConfiguredError) {
      return NextResponse.json({ error: "postiz_not_configured" }, { status: 503 });
    }
    if (err instanceof PostizApiError) {
      return NextResponse.json(
        { error: "postiz_upstream", status: err.status, body: err.body },
        { status: 502 }
      );
    }
    throw err;
  }
}
