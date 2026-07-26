import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSeoSnapshot, getTopKeywords } from "@/lib/gsc";
import { getConfig } from "@/lib/ssm-config";
import { readThrough } from "@/lib/gsc-cache";

/**
 * Combined SEO snapshot + top keywords.
 *
 * Caches the (snapshot, keywords) pair as a single payload because they
 * always render together on the Overview tab. The `keywords` route caches
 * its own list independently so the Keywords tab still benefits when
 * opened without going through Overview first.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const config = await getConfig();
  if (!config.GOOGLE_CLIENT_EMAIL || !config.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json({ error: "Google Search Console not configured." }, { status: 404 });
  }

  const days = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("days") ?? "28"), 365 * 2)
  );

  try {
    const __read = await readThrough(
      "seo",
      { days },
      async () => {
        const [snapshot, keywords] = await Promise.all([
          getSeoSnapshot(undefined, days),
          getTopKeywords(undefined, 20, days),
        ]);
        return { snapshot, keywords };
      },
      { ttlSeconds: 3600 }
    );

    return NextResponse.json({
      snapshot: __read.value.snapshot,
      keywords: __read.value.keywords,
      fetchedAt: new Date().toISOString(),
      source: "google-search-console",
      _cache: { source: __read.source, ageSeconds: __read.ageSeconds },
      _filters: { days },
    });
  } catch (err) {
    console.error("[SEO] Error:", JSON.stringify(String((err as Error)?.message ?? err)));
    return NextResponse.json({ error: "Failed to fetch SEO data." }, { status: 500 });
  }
}
