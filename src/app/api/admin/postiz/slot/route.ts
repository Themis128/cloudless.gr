import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { findSlot, PostizApiError, PostizNotConfiguredError } from "@/lib/postiz";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_integration_id" }, { status: 400 });
  }

  try {
    const slot = await findSlot(id);
    return NextResponse.json(slot);
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
