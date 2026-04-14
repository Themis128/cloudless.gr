import { NextResponse } from "next/server";
import { getTopPages } from "@/lib/gsc";
import { getConfig } from "@/lib/ssm-config";

export async function GET(req: Request) {
  const config = await getConfig();
  if (!config.GOOGLE_CLIENT_EMAIL || !config.GOOGLE_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Google Search Console not configured." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "25"), 100);

  try {
    const pages = await getTopPages(undefined, limit);
    return NextResponse.json({ pages, fetchedAt: new Date().toISOString(), source: "google-search-console" });
  } catch (err) {
    console.error("[GSC pages] Error:", err);
    return NextResponse.json({ error: "Failed to fetch pages." }, { status: 500 });
  }
}
