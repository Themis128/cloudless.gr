import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Use the Host header to build a correct public URL — nextUrl.origin returns
  // the internal pod address (e.g. 0.0.0.0:3000) on k3s, which breaks the
  // fetch/redirect for Playwright running against the cluster.
  const host = request.headers.get("host") ?? "cloudless.gr";
  const publicOrigin = `${request.nextUrl.protocol}//${host}`;
  const iconUrl = new URL("/icon", publicOrigin);

  try {
    const res = await fetch(iconUrl.toString(), {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
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
    return NextResponse.redirect(iconUrl, 302);
  }
}
