import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { approveGate, listPendingGates, rejectGate } from "@/lib/socialauto-engagement";

export const runtime = "edge";
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
      id: string; op: "approve" | "reject"; comment_draft?: string;
    };
    const item = op === "reject"
      ? await rejectGate(id)
      : await approveGate(id, comment_draft);
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
