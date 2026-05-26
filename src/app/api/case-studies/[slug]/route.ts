import { NextResponse } from "next/server";
import { isConfiguredAsync } from "@/lib/integrations";
import { getCaseStudyBySlug, staticCaseStudies } from "@/lib/notion-case-studies";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const configured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_CASE_STUDIES_DB_ID");

  if (!configured) {
    const cs = staticCaseStudies.find((c) => c.slug === slug);
    if (!cs) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      { caseStudy: { ...cs, html: "" }, source: "static" },
      { headers: { "x-cms-source": "static" } }
    );
  }

  try {
    const caseStudy = await getCaseStudyBySlug(slug);
    if (!caseStudy) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { caseStudy, source: "notion" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
          "x-cms-source": "notion",
        },
      }
    );
  } catch (err) {
    console.error(`[API /case-studies/${slug}] Fetch error:`, err);
    return NextResponse.json({ error: "Failed to load case study" }, { status: 502 });
  }
}
