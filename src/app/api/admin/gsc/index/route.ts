import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { requestIndexing, getIndexingStatus } from "@/lib/gsc-admin";

/**
 * POST /api/admin/gsc/index — request indexing for a URL (Google Indexing API)
 * Body: { url: string }
 * GET /api/admin/gsc/index?url=... — get indexing notification status
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
    const result = await requestIndexing(url);
    return NextResponse.json({ ok: true, url, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GSC index] error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const url = request.nextUrl.searchParams.get("url")?.trim();
  if (!url) {
    return NextResponse.json({ error: "url query param is required" }, { status: 400 });
  }

  try {
    const result = await getIndexingStatus(url);
    return NextResponse.json({ url, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GSC index] status error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
