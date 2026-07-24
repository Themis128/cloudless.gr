import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/pi-proxy
 * Proxy endpoint for Tailscale connections to internal services
 * Used by external services to reach internal services via Tailscale
 */
export async function POST(request: NextRequest) {
  try {
    const { targetUrl, method, headers, body } = await request.json();
    
    if (!targetUrl) {
      return NextResponse.json(
        { error: "targetUrl is required" },
        { status: 400 }
      );
    }
    
    // Forward request to internal service via Tailscale
    const response = await fetch(targetUrl, {
      method: method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Pi-proxy error:", error);
    return NextResponse.json(
      { error: "Proxy request failed" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";