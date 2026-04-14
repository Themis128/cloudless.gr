import { NextResponse } from "next/server";
import { getPerformanceHistory } from "@/lib/gsc";
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
  const weeks = Math.min(Number(searchParams.get("weeks") ?? "12"), 52);

  try {
    const history = await getPerformanceHistory(undefined, weeks);
    return NextResponse.json({ history, weeks, fetchedAt: new Date().toISOString(), source: "google-search-console" });
  } catch (err) {
    console.error("[GSC history] Error:", err);
    return NextResponse.json({ error: "Failed to fetch history." }, { status: 500 });
  }
}
