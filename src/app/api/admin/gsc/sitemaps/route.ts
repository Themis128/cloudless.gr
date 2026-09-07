import { NextRequest, NextResponse } from "next/server";
import { listSitemaps, submitSitemap, deleteSitemap } from "@/lib/gsc-admin";
import { guardAdmin, parseJsonBody, runGscOperation } from "../_helpers";

/**
 * GET /api/admin/gsc/sitemaps — list submitted sitemaps
 * POST /api/admin/gsc/sitemaps — submit a sitemap (body: { path?: string })
 * DELETE /api/admin/gsc/sitemaps — delete a sitemap (body: { path: string })
 */
export async function GET(request: NextRequest) {
  const auth = await guardAdmin(request);
  if (!auth.ok) return auth.response;
  return runGscOperation("sitemaps", () => listSitemaps());
}

export async function POST(request: NextRequest) {
  const auth = await guardAdmin(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody<{ path?: string }>(request);
  if ("error" in parsed) return parsed.error;

  const path = parsed.data.path?.trim() || "sitemap.xml";
  return runGscOperation("sitemaps submit", () => submitSitemap(path));
}

export async function DELETE(request: NextRequest) {
  const auth = await guardAdmin(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody<{ path?: string }>(request);
  if ("error" in parsed) return parsed.error;

  const path = parsed.data.path?.trim();
  if (!path) return NextResponse.json({ error: "path is required" }, { status: 400 });
  return runGscOperation("sitemaps delete", () => deleteSitemap(path));
}
