import { NextRequest, NextResponse } from "next/server";
import { requestIndexing, getIndexingStatus } from "@/lib/gsc-admin";
import { guardAdmin, parseJsonBody, runGscOperation } from "../_helpers";

/**
 * POST /api/admin/gsc/index — request indexing for a URL (Google Indexing API)
 * Body: { url: string }
 * GET /api/admin/gsc/index?url=... — get indexing notification status
 */
export async function POST(request: NextRequest) {
  const auth = await guardAdmin(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody<{ url?: string }>(request);
  if ("error" in parsed) return parsed.error;

  const url = parsed.data.url?.trim();
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
  return runGscOperation("index", () => requestIndexing(url));
}

export async function GET(request: NextRequest) {
  const auth = await guardAdmin(request);
  if (!auth.ok) return auth.response;

  const url = request.nextUrl.searchParams.get("url")?.trim();
  if (!url) return NextResponse.json({ error: "url query param is required" }, { status: 400 });
  return runGscOperation("index status", () => getIndexingStatus(url));
}
