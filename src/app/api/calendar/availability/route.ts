import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/google-calendar";
import { isConfigured } from "@/lib/integrations";

export async function GET(request: Request) {
  if (!isConfigured("GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY")) {
    return NextResponse.json(
      { error: "Calendar booking is not yet available." },
      { status: 503 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const DEFAULT_DAYS = 7;
    const MAX_DAYS = 30;
    const days = Math.max(1, Math.min(Number(searchParams.get("days") || DEFAULT_DAYS), MAX_DAYS));
    const slots = await getAvailableSlots(days);

    return NextResponse.json(
      { slots },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60", // NOSONAR — cache TTL values
        },
      },
    );
  } catch (err) {
    console.error("[Calendar] Availability error:", err);
    return NextResponse.json(
      { error: "Failed to fetch availability." },
      { status: 500 },
    );
  }
}
