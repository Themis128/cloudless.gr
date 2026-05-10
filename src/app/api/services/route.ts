import { NextResponse } from "next/server";
import { getServices, staticServices } from "@/lib/notion-services";
import { isConfiguredAsync } from "@/lib/integrations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const configured = await isConfiguredAsync(
    "NOTION_API_KEY",
    "NOTION_SERVICES_DB_ID",
  );

  if (!configured) {
    const data = category
      ? staticServices.filter((s) => s.category === category)
      : staticServices;
    return NextResponse.json(
      { services: data, source: "static", fallbackReason: "not-configured" },
      { headers: { "x-cms-source": "static" } },
    );
  }

  try {
    const all = await getServices();
    const services = category ? all.filter((s) => s.category === category) : all;
    return NextResponse.json(
      { services, source: "notion" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
          "x-cms-source": "notion",
        },
      },
    );
  } catch (err) {
    console.error("[API /services] Fetch error:", err);
    const data = category
      ? staticServices.filter((s) => s.category === category)
      : staticServices;
    return NextResponse.json(
      { services: data, source: "static", fallbackReason: "notion-error" },
      { headers: { "x-cms-source": "static" } },
    );
  }
}
