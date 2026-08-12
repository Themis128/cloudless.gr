import { NextResponse } from "next/server";
import {
  getCaseStudyBySlug as getAppFlowyCaseStudyBySlug,
  staticCaseStudies,
} from "@/lib/appflowy-case-studies";

import {
  isAppFlowyCmsConfigured,
  isNotionCmsConfigured,
  cmsSourceHeaders,
} from "@/lib/cms-provider";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const appFlowyConfigured = await isAppFlowyCmsConfigured();
  const notionConfigured = await isNotionCmsConfigured(
    "NOTION_API_KEY",
    "NOTION_CASE_STUDIES_DB_ID"
  );

  if (!appFlowyConfigured && !notionConfigured) {
    const cs = staticCaseStudies.find((c) => c.slug === slug);
    if (!cs) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      { caseStudy: { ...cs, html: "" }, source: "static" },
      { headers: cmsSourceHeaders("static") }
    );
  }

  try {
    if (appFlowyConfigured) {
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
    }

    const caseStudy = await getNotionCaseStudyBySlug(slug);
    if (!caseStudy) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { caseStudy, source: "notion" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
          ...cmsSourceHeaders("notion"),
        },
      }
    );
  } catch (err) {
    console.error(`[API /case-studies/${slug}] Fetch error:`, err);
    return NextResponse.json({ error: "Failed to load case study" }, { status: 502 });
  }
}
