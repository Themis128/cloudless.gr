import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isConfiguredAsync } from "@/lib/integrations";
import {
  getAllTestimonialsAdmin,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  type TestimonialInput,
} from "@/lib/notion-testimonials";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_TESTIMONIALS_DB_ID"))) {
    return NextResponse.json({ error: "Notion Testimonials not configured" }, { status: 503 });
  }

  try {
    const testimonials = await getAllTestimonialsAdmin();
    return NextResponse.json({ testimonials, count: testimonials.length });
  } catch (err) {
    console.error("[Admin Testimonials] GET failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to list testimonials" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_TESTIMONIALS_DB_ID"))) {
    return NextResponse.json({ error: "Notion Testimonials not configured" }, { status: 503 });
  }

  let body: TestimonialInput;
  try {
    body = ((await request.json()) as any);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.quote?.trim()) {
    return NextResponse.json({ error: "name and quote are required" }, { status: 400 });
  }

  try {
    const id = await createTestimonial(body);
    if (!id) return NextResponse.json({ error: "Failed to create testimonial" }, { status: 500 });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[Admin Testimonials] POST failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to create testimonial" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { pageId: string } & Partial<TestimonialInput>;
  try {
    body = ((await request.json()) as any);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }

  try {
    const { pageId, ...input } = body;
    const ok = await updateTestimonial(pageId, input);
    if (!ok) return NextResponse.json({ error: "Failed to update testimonial" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Testimonials] PATCH failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to update testimonial" }, { status: 500 });
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
    const ok = await deleteTestimonial(pageId);
    if (!ok) return NextResponse.json({ error: "Failed to delete testimonial" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Testimonials] DELETE failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to delete testimonial" }, { status: 500 });
  }
}
