import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getIntegrationConnectUrl, PostizApiError, PostizNotConfiguredError } from "@/lib/postiz";

export const dynamic = "force-dynamic";

/** GET /api/admin/postiz/integrations/:id/connect — returns an OAuth URL the
 *  user opens to connect a new channel of that provider. The `:id` here is
 *  the *provider identifier* (`facebook`, `linkedin`, `tiktok`, ...) not an
 *  existing integration. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_provider" }, { status: 400 });

  try {
    const result = await getIntegrationConnectUrl(id);
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
