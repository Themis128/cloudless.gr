import { NextResponse } from "next/server";
import { getTopKeywords } from "@/lib/gsc";
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
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

  try {
    const keywords = await getTopKeywords(undefined, limit);
    return NextResponse.json({ keywords, fetchedAt: new Date().toISOString(), source: "google-search-console" });
  } catch (err) {
    console.error("[GSC keywords] Error:", err);
    return NextResponse.json({ error: "Failed to fetch keywords." }, { status: 500 });
  }
}
