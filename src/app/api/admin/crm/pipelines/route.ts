import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { getPipelines, isHubSpotConfigured } from "@/lib/hubspot";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isHubSpotConfigured())) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const VALID_OBJECT_TYPES = ["deals", "tickets", "contacts"];
    const rawType = searchParams.get("objectType") ?? "deals";
    const objectType = VALID_OBJECT_TYPES.includes(rawType) ? rawType : "deals";
    const pipelines = await getPipelines(objectType);

    return NextResponse.json({
      pipelines,
      objectType,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[HubSpot] Error fetching pipelines:", err);
    return NextResponse.json({ error: "Failed to fetch pipelines." }, { status: 500 });
  }
}
