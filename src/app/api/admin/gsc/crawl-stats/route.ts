import { NextRequest } from "next/server";
import { getCrawlStats } from "@/lib/gsc-admin";
import { guardAdmin, runGscOperation } from "../_helpers";

/**
 * GET /api/admin/gsc/crawl-stats — crawl error samples and stats
 * Returns: { samples: [{ category, pageCount, sampleUrls }], siteUrl }
 */
export async function GET(request: NextRequest) {
  const auth = await guardAdmin(request);
  if (!auth.ok) return auth.response;
  return runGscOperation("crawl-stats", () => getCrawlStats());
}
