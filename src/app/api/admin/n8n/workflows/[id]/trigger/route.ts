import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { triggerWorkflowByWebhookPath, isN8nConfigured, N8nApiError } from "@/lib/n8n";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const configured = await isN8nConfigured();
  if (!configured) {
    return NextResponse.json({ error: "n8n_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  let payload: unknown = {};
  try {
    payload = await req.json();
  } catch {
    // empty body is fine — workflow may not need input
  }

  try {
    const result = await triggerWorkflowByWebhookPath(id, payload);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof N8nApiError) {
      return NextResponse.json(
        { ok: false, error: "n8n_upstream", status: err.status, body: err.body },
        { status: 502 }
      );
    }
    throw err;
  }
}
