import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const iconUrl = new URL("/icon", request.nextUrl.origin);
  const res = await fetch(iconUrl.toString());
  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
