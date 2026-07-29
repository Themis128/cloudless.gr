import { NextResponse } from "next/server";
import {
  getTestimonials as getAppFlowyTestimonials,
  getFeaturedTestimonials as getAppFlowyFeatured,
  staticTestimonials,
} from "@/lib/appflowy-testimonials";
import {
  getTestimonials as getNotionTestimonials,
  getFeaturedTestimonials as getNotionFeatured,
} from "@/lib/notion-testimonials";
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
    "NOTION_TESTIMONIALS_DB_ID"
  );

  if (!appFlowyConfigured && !notionConfigured) {
    const data = featured ? staticTestimonials.filter((t) => t.featured) : staticTestimonials;
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  }

  try {
    if (appFlowyConfigured) {
      const testimonials = featured ? await getAppFlowyFeatured() : await getAppFlowyTestimonials();
      if (testimonials.length > 0) {
        return NextResponse.json(testimonials, {
          headers: {
            "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
            ...cmsSourceHeaders("appflowy"),
          },
        });
      }
    }

    const testimonials = featured ? await getNotionFeatured() : await getNotionTestimonials();
    return NextResponse.json(testimonials, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
        ...cmsSourceHeaders("notion"),
      },
    });
  } catch (err) {
    console.error("[API /testimonials] Fetch error:", err);
    const data = featured ? staticTestimonials.filter((t) => t.featured) : staticTestimonials;
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  }
}
