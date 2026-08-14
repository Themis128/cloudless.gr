import { NextResponse } from "next/server";
import { getServices as getAppFlowyServices, staticServices } from "@/lib/appflowy-services";
import { isAppFlowyCmsConfigured, cmsSourceHeaders } from "@/lib/cms-provider";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const appFlowyConfigured = await isAppFlowyCmsConfigured();

  if (!appFlowyConfigured) {
    const data = category ? staticServices.filter((s) => s.category === category) : staticServices;
    return NextResponse.json(
      { services: data, source: "static", fallbackReason: "not-configured" },
      { headers: cmsSourceHeaders("static") }
    );
  }

  try {
    const all = await getAppFlowyServices();
    if (all.length > 0) {
      const services = category ? all.filter((s) => s.category === category) : all;
      return NextResponse.json(
        { services, source: "appflowy" },
        {
          headers: {
            "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
            ...cmsSourceHeaders("appflowy"),
          },
        }
      );
    }
    const data = category ? staticServices.filter((s) => s.category === category) : staticServices;
    return NextResponse.json(
      { services: data, source: "static", fallbackReason: "cms-empty" },
      { headers: cmsSourceHeaders("static") }
    );
  } catch (err) {
    console.error("[API /services] Fetch error:", err);
    const data = category ? staticServices.filter((s) => s.category === category) : staticServices;
    return NextResponse.json(
      { services: data, source: "static", fallbackReason: "cms-error" },
      { headers: cmsSourceHeaders("static") }
    );
  }
}
