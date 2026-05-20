import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const iconUrl = new URL("/icon", request.nextUrl.origin);
    const res = await fetch(iconUrl.toString(), {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // If /icon doesn't return 200, redirect to it instead of proxying
      return NextResponse.redirect(iconUrl, 302);
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    // Fallback: redirect to /icon directly
    const iconUrl = new URL("/icon", request.nextUrl.origin);
    return NextResponse.redirect(iconUrl, 302);
  }
}
