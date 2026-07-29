import { NextResponse } from "next/server";
import { isConfiguredAsync } from "@/lib/integrations";
import {
  getCaseStudies,
  getFeaturedCaseStudies,
  staticCaseStudies,
} from "@/lib/notion-case-studies";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const featured = searchParams.get("featured") === "true";

  const configured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_CASE_STUDIES_DB_ID");

  if (!configured) {
    const data = featured ? staticCaseStudies.filter((c) => c.featured) : staticCaseStudies;
    return NextResponse.json(data, { headers: { "x-cms-source": "static" } });
  }

  try {
    const caseStudies = featured ? await getFeaturedCaseStudies() : await getCaseStudies();
    return NextResponse.json(caseStudies, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
        "x-cms-source": "notion",
      },
    });
  } catch (err) {
    console.error("[API /case-studies] Fetch error:", err);
    const data = featured ? staticCaseStudies.filter((c) => c.featured) : staticCaseStudies;
    return NextResponse.json(data, { headers: { "x-cms-source": "static" } });
  }
}
