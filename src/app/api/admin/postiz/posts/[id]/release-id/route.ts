import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { updatePostReleaseId, PostizApiError, PostizNotConfiguredError } from "@/lib/postiz";

export const dynamic = "force-dynamic";

/** PUT /api/admin/postiz/posts/:id/release-id
 *  Body: `{ releaseId: string }`. Connects a "missing" post to the real
 *  platform post-id. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  let body: { releaseId?: unknown };
  try {
    body = (await req.json()) as any as { releaseId?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.releaseId !== "string" || !body.releaseId) {
    return NextResponse.json({ error: "missing_release_id" }, { status: 400 });
  }

  try {
    const result = await updatePostReleaseId(id, body.releaseId);
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
