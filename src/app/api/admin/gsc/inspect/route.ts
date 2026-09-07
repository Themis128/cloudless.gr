import { NextRequest, NextResponse } from "next/server";
import { inspectUrl } from "@/lib/gsc-admin";
import { guardAdmin, parseJsonBody, runGscOperation } from "../_helpers";

/**
 * POST /api/admin/gsc/inspect — inspect a URL's index status
 * Body: { url: string }
 * Returns: GSC URL Inspection result (index status, coverage, mobile usability)
 */
export async function POST(request: NextRequest) {
  const auth = await guardAdmin(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody<{ url?: string }>(request);
  if ("error" in parsed) return parsed.error;

  const url = parsed.data.url?.trim();
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
  return runGscOperation("inspect", () => inspectUrl(url));
}
