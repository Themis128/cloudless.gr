import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  getPostMissingContent,
  PostizApiError,
  PostizNotConfiguredError,
} from "@/lib/postiz";

export const dynamic = "force-dynamic";

/** GET /api/admin/postiz/posts/:id/missing-content — list recent content
 *  from the provider so the user can match the right published post when
 *  `releaseId === "missing"`. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  try {
    const items = await getPostMissingContent(id);
    return NextResponse.json({ items });
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
