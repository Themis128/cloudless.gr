import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getIntegrationSettings, PostizApiError, PostizNotConfiguredError } from "@/lib/postiz";

export const dynamic = "force-dynamic";

/** GET /api/admin/postiz/integrations/:id/settings — posting rules, content
 *  max-length, settings JSON schema, available provider tools. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  try {
    const settings = await getIntegrationSettings(id);
    return NextResponse.json(settings);
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
