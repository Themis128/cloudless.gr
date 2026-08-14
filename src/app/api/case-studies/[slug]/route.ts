import { NextResponse } from "next/server";
import {
  getCaseStudyBySlug as getAppFlowyCaseStudyBySlug,
  staticCaseStudies,
} from "@/lib/appflowy-case-studies";
import { isAppFlowyCmsConfigured, cmsSourceHeaders } from "@/lib/cms-provider";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const appFlowyConfigured = await isAppFlowyCmsConfigured();

  if (!appFlowyConfigured) {
    const cs = staticCaseStudies.find((c) => c.slug === slug);
    if (!cs) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      { caseStudy: { ...cs, html: "" }, source: "static" },
      { headers: cmsSourceHeaders("static") }
    );
  }

  try {
    const caseStudy = await getAppFlowyCaseStudyBySlug(slug);
    if (caseStudy) {
      return NextResponse.json(
        { caseStudy, source: "appflowy" },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
            ...cmsSourceHeaders("appflowy"),
          },
        }
      );
    }
    const cs = staticCaseStudies.find((c) => c.slug === slug);
    if (!cs) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      { caseStudy: { ...cs, html: "" }, source: "static" },
      { headers: cmsSourceHeaders("static") }
    );
  } catch (err) {
    console.error(`[API /case-studies/${slug}] Fetch error:`, err);
    return NextResponse.json({ error: "Failed to load case study" }, { status: 502 });
  }
}
