import { NextResponse } from "next/server";
import { getServices as getAppFlowyServices, staticServices } from "@/lib/appflowy-services";
import { getServices as getNotionServices } from "@/lib/notion-services";
import { isAppFlowyCmsConfigured, isNotionCmsConfigured, cmsSourceHeaders } from "@/lib/cms-provider";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const appFlowyConfigured = await isAppFlowyCmsConfigured();
  const notionConfigured = await isNotionCmsConfigured("NOTION_API_KEY", "NOTION_SERVICES_DB_ID");

  if (!appFlowyConfigured && !notionConfigured) {
    const data = category ? staticServices.filter((s) => s.category === category) : staticServices;
    return NextResponse.json(
      { services: data, source: "static", fallbackReason: "not-configured" },
      { headers: cmsSourceHeaders("static") }
    );
  }

  try {
    if (appFlowyConfigured) {
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
    }

    const all = await getNotionServices();
    const services = category ? all.filter((s) => s.category === category) : all;
    return NextResponse.json(
      { services, source: "notion" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
          ...cmsSourceHeaders("notion"),
        },
      }
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
