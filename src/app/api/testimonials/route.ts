import { NextResponse } from "next/server";
import { isConfiguredAsync } from "@/lib/integrations";
import {
  getTestimonials,
  getFeaturedTestimonials,
  staticTestimonials,
} from "@/lib/notion-testimonials";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const featured = searchParams.get("featured") === "true";

  const configured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_TESTIMONIALS_DB_ID");

  if (!configured) {
    const data = featured ? staticTestimonials.filter((t) => t.featured) : staticTestimonials;
    return NextResponse.json(data, { headers: { "x-cms-source": "static" } });
  }

  try {
    const testimonials = featured ? await getFeaturedTestimonials() : await getTestimonials();
    return NextResponse.json(testimonials, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
        "x-cms-source": "notion",
      },
    });
  } catch (err) {
    console.error("[API /testimonials] Fetch error:", err);
    const data = featured ? staticTestimonials.filter((t) => t.featured) : staticTestimonials;
    return NextResponse.json(data, { headers: { "x-cms-source": "static" } });
  }
}
