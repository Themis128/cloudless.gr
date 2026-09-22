import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isSocialAutoConfigured, nextSlot } from "@/lib/socialauto";

export const dynamic = "force-dynamic";

/** Next free time slot — SocialAuto has no per-channel slot concept (the
 *  beat scheduler publishes whatever is due), so we return the top of the
 *  next hour. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_integration_id" }, { status: 400 });
  }

  if (!(await isSocialAutoConfigured())) {
    return NextResponse.json({ error: "socialauto_not_configured" }, { status: 503 });
  }

  return NextResponse.json(nextSlot(id));
}
