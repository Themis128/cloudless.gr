import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { approveGate, listPendingGates, rejectGate } from "@/lib/socialauto-engagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ items: await listPendingGates() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { id, op, comment_draft } = (await request.json()) as {
      id: string;
      op: "approve" | "reject";
      comment_draft?: string;
    };
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id_required" }, { status: 400 });
    }
    // Anything but an explicit "reject" must never fall through to approve.
    if (op !== "approve" && op !== "reject") {
      return NextResponse.json({ error: "invalid_op" }, { status: 400 });
    }
    const item = op === "reject" ? await rejectGate(id) : await approveGate(id, comment_draft);
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
