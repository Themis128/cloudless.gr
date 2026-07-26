import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listNotifications, PostizApiError, PostizNotConfiguredError } from "@/lib/postiz";

export const dynamic = "force-dynamic";

/** GET /api/admin/postiz/notifications?page=N — newest 100 per page. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const pageRaw = new URL(req.url).searchParams.get("page");
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);

  try {
    const items = await listNotifications(page);
    return NextResponse.json({ items, page });
  } catch (err) {
    if (err instanceof PostizNotConfiguredError) {
      return NextResponse.json({ error: "postiz_not_configured" }, { status: 404 });
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
