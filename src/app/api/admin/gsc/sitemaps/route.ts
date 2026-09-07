import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listSitemaps, submitSitemap, deleteSitemap } from "@/lib/gsc-admin";

/**
 * GET /api/admin/gsc/sitemaps — list submitted sitemaps
 * POST /api/admin/gsc/sitemaps — submit a sitemap (body: { path?: string })
 * DELETE /api/admin/gsc/sitemaps — delete a sitemap (body: { path: string })
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await listSitemaps();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GSC sitemaps] error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { path?: string };
  try {
    body = (await request.json()) as { path?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const path = body.path?.trim() || "sitemap.xml";
  try {
    const result = await submitSitemap(path);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GSC sitemaps] submit error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { path?: string };
  try {
    body = (await request.json()) as { path?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.path?.trim()) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }
  try {
    const result = await deleteSitemap(body.path.trim());
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GSC sitemaps] delete error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
