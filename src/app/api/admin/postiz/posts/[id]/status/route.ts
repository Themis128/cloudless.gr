import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { changePostStatus, PostizApiError, PostizNotConfiguredError } from "@/lib/postiz";

export const dynamic = "force-dynamic";

/** PUT /api/admin/postiz/posts/:id/status
 *  Body: `{ status: "draft" | "schedule" }`. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  let body: { status?: unknown };
  try {
    body = (((await req.json()) as any)) as { status?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.status !== "draft" && body.status !== "schedule") {
    return NextResponse.json(
      { error: "invalid_status", allowed: ["draft", "schedule"] },
      { status: 400 }
    );
  }

  try {
    const result = await changePostStatus(id, body.status);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PostizNotConfiguredError) {
      return NextResponse.json({ error: "postiz_not_configured" }, { status: 503 });
    }
    if (err instanceof PostizApiError) {
      return NextResponse.json(
        { error: "postiz_upstream", status: err.status, body: err.body },
        { status: err.status === 400 ? 400 : 502 }
      );
    }
    throw err;
  }
}
