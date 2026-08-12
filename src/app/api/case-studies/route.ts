import { NextResponse } from "next/server";
import {
  getCaseStudies as getAppFlowyCaseStudies,
  getFeaturedCaseStudies as getAppFlowyFeatured,
  staticCaseStudies,
} from "@/lib/appflowy-case-studies";
import {
  getCaseStudies as getNotionCaseStudies,
  getFeaturedCaseStudies as getNotionFeatured,
} from "@/lib/notion-case-studies";
import {
  isAppFlowyCmsConfigured,
  isNotionCmsConfigured,
  cmsSourceHeaders,
} from "@/lib/cms-provider";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const featured = searchParams.get("featured") === "true";

  const appFlowyConfigured = await isAppFlowyCmsConfigured();
  const notionConfigured = await isNotionCmsConfigured(
    "NOTION_API_KEY",
    "NOTION_CASE_STUDIES_DB_ID"
  );

  if (!appFlowyConfigured && !notionConfigured) {
    const data = featured ? staticCaseStudies.filter((c) => c.featured) : staticCaseStudies;
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  }

  try {
    if (appFlowyConfigured) {
      const caseStudies = featured ? await getAppFlowyFeatured() : await getAppFlowyCaseStudies();
      if (caseStudies.length > 0) {
        return NextResponse.json(caseStudies, {
          headers: {
            "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
            ...cmsSourceHeaders("appflowy"),
          },
        });
      }
    }

    const caseStudies = featured ? await getNotionFeatured() : await getNotionCaseStudies();
    return NextResponse.json(caseStudies, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
        ...cmsSourceHeaders("notion"),
      },
    });
  } catch (err) {
    console.error("[API /case-studies] Fetch error:", err);
    const data = featured ? staticCaseStudies.filter((c) => c.featured) : staticCaseStudies;
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  }
}
