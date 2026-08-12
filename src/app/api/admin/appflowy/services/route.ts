import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import { getServices } from "@/lib/appflowy-services";
import type { ServiceInput } from "@/lib/notion-types";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy Services not configured" }, { status: 503 });
  }

  try {
    const services = await getServices();
    return NextResponse.json({ services, count: services.length });
  } catch (err) {
    console.error("[Admin AppFlowy Services] GET failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to list services" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy Services not configured" }, { status: 503 });
  }

  let body: ServiceInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // AppFlowy write API not yet implemented
  console.log("[Admin AppFlowy Services] Would create service:", body.name);
  return NextResponse.json({ error: "Write operations not yet implemented for AppFlowy" }, { status: 501 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { pageId: string } & Partial<ServiceInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }

  // AppFlowy write API not yet implemented
  console.log("[Admin AppFlowy Services] Would update service:", body.pageId);
  return NextResponse.json({ error: "Write operations not yet implemented for AppFlowy" }, { status: 501 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const pageId = new URL(request.url).searchParams.get("pageId");
  if (!pageId) {
    return NextResponse.json({ error: "pageId query parameter is required" }, { status: 400 });
  }

  // AppFlowy write API not yet implemented
  console.log("[Admin AppFlowy Services] Would delete service:", pageId);
  return NextResponse.json({ error: "Write operations not yet implemented for AppFlowy" }, { status: 501 });
}
