import { NextResponse } from "next/server";
import {
  getTestimonials as getAppFlowyTestimonials,
  getFeaturedTestimonials as getAppFlowyFeatured,
  staticTestimonials,
} from "@/lib/appflowy-testimonials";
import { isAppFlowyCmsConfigured, cmsSourceHeaders } from "@/lib/cms-provider";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const featured = searchParams.get("featured") === "true";

  const appFlowyConfigured = await isAppFlowyCmsConfigured();

  if (!appFlowyConfigured) {
    const data = featured ? staticTestimonials.filter((t) => t.featured) : staticTestimonials;
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  }

  try {
    const testimonials = featured ? await getAppFlowyFeatured() : await getAppFlowyTestimonials();
    if (testimonials.length > 0) {
      return NextResponse.json(testimonials, {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
          ...cmsSourceHeaders("appflowy"),
        },
      });
    }
    const data = featured ? staticTestimonials.filter((t) => t.featured) : staticTestimonials;
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  } catch (err) {
    console.error("[API /testimonials] Fetch error:", err);
    const data = featured ? staticTestimonials.filter((t) => t.featured) : staticTestimonials;
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  }
}
