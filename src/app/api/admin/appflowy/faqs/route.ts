import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import { getAllFaqsAdmin } from "@/lib/appflowy-faqs";
import type { FaqInput } from "@/lib/notion-faqs";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy FAQs not configured" }, { status: 503 });
  }

  try {
    const faqs = await getAllFaqsAdmin();
    return NextResponse.json({ faqs, count: faqs.length });
  } catch (err) {
    console.error("[Admin AppFlowy FAQs] GET failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to list FAQs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy FAQs not configured" }, { status: 503 });
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

  // AppFlowy write API not yet implemented
  console.log("[Admin AppFlowy FAQs] Would create FAQ:", body.question);
  return NextResponse.json({ error: "Write operations not yet implemented for AppFlowy" }, { status: 501 });
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

  // AppFlowy write API not yet implemented
  console.log("[Admin AppFlowy FAQs] Would update FAQ:", body.pageId);
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
  console.log("[Admin AppFlowy FAQs] Would delete FAQ:", pageId);
  return NextResponse.json({ error: "Write operations not yet implemented for AppFlowy" }, { status: 501 });
}
