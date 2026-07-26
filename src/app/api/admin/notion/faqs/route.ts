import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isConfiguredAsync } from "@/lib/integrations";
import { getAllFaqsAdmin, createFaq, updateFaq, deleteFaq, type FaqInput } from "@/lib/notion-faqs";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_FAQS_DB_ID"))) {
    return NextResponse.json({ error: "Notion FAQs not configured" }, { status: 404 });
  }

  try {
    const faqs = await getAllFaqsAdmin();
    return NextResponse.json({ faqs, count: faqs.length });
  } catch (err) {
    console.error("[Admin FAQs] GET failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to list FAQs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_FAQS_DB_ID"))) {
    return NextResponse.json({ error: "Notion FAQs not configured" }, { status: 404 });
  }

  let body: FaqInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.question?.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  try {
    const id = await createFaq(body);
    if (!id) return NextResponse.json({ error: "Failed to create FAQ" }, { status: 500 });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[Admin FAQs] POST failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to create FAQ" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { pageId: string } & Partial<FaqInput>;
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
    const ok = await updateFaq(pageId, input);
    if (!ok) return NextResponse.json({ error: "Failed to update FAQ" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin FAQs] PATCH failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to update FAQ" }, { status: 500 });
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
    const ok = await deleteFaq(pageId);
    if (!ok) return NextResponse.json({ error: "Failed to delete FAQ" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin FAQs] DELETE failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to delete FAQ" }, { status: 500 });
  }
}
