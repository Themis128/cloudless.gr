import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { inspectUrl } from "@/lib/gsc-admin";

/**
 * POST /api/admin/gsc/inspect — inspect a URL's index status
 * Body: { url: string }
 * Returns: GSC URL Inspection result (index status, coverage, mobile usability)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const result = await inspectUrl(url);
    return NextResponse.json({ url, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GSC inspect] error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
