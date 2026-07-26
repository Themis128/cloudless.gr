import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isConfiguredAsync } from "@/lib/integrations";
import {
  getAllServicesAdmin,
  createService,
  updateService,
  deleteService,
  type ServiceInput,
} from "@/lib/notion-services";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_SERVICES_DB_ID"))) {
    return NextResponse.json({ error: "Notion Services not configured" }, { status: 404 });
  }

  try {
    const services = await getAllServicesAdmin();
    return NextResponse.json({ services, count: services.length });
  } catch (err) {
    console.error("[Admin Services] GET failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to list services" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_SERVICES_DB_ID"))) {
    return NextResponse.json({ error: "Notion Services not configured" }, { status: 404 });
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

  try {
    const id = await createService(body);
    if (!id) return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[Admin Services] POST failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
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

  try {
    const { pageId, ...input } = body;
    const ok = await updateService(pageId, input);
    if (!ok) return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Services] PATCH failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const pageId = new URL(request.url).searchParams.get("pageId");
  if (!pageId) {
    return NextResponse.json({ error: "pageId query parameter is required" }, { status: 400 });
  }

  try {
    const ok = await deleteService(pageId);
    if (!ok) return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Services] DELETE failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}
