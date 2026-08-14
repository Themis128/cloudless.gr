import { NextResponse } from "next/server";
import {
  getCaseStudies as getAppFlowyCaseStudies,
  getFeaturedCaseStudies as getAppFlowyFeatured,
  staticCaseStudies,
} from "@/lib/appflowy-case-studies";
import { isAppFlowyCmsConfigured, cmsSourceHeaders } from "@/lib/cms-provider";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const featured = searchParams.get("featured") === "true";

  const appFlowyConfigured = await isAppFlowyCmsConfigured();

  if (!appFlowyConfigured) {
    const data = featured ? staticCaseStudies.filter((c) => c.featured) : staticCaseStudies;
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  }

  try {
    const caseStudies = featured ? await getAppFlowyFeatured() : await getAppFlowyCaseStudies();
    if (caseStudies.length > 0) {
      return NextResponse.json(caseStudies, {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
          ...cmsSourceHeaders("appflowy"),
        },
      });
    }
    const data = featured ? staticCaseStudies.filter((c) => c.featured) : staticCaseStudies;
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  } catch (err) {
    console.error("[API /case-studies] Fetch error:", err);
    const data = featured ? staticCaseStudies.filter((c) => c.featured) : staticCaseStudies;
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  }
}
