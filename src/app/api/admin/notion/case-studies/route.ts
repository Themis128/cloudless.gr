import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isConfiguredAsync } from "@/lib/integrations";
import {
  getAllCaseStudiesAdmin,
  createCaseStudy,
  updateCaseStudy,
  deleteCaseStudy,
  type CaseStudyInput,
} from "@/lib/notion-case-studies";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_CASE_STUDIES_DB_ID"))) {
    return NextResponse.json({ error: "Notion Case Studies not configured" }, { status: 404 });
  }

  try {
    const caseStudies = await getAllCaseStudiesAdmin();
    return NextResponse.json({ caseStudies, count: caseStudies.length });
  } catch (err) {
    console.error("[Admin Case Studies] GET failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to list case studies" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_CASE_STUDIES_DB_ID"))) {
    return NextResponse.json({ error: "Notion Case Studies not configured" }, { status: 404 });
  }

  let body: CaseStudyInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const id = await createCaseStudy(body);
    if (!id) return NextResponse.json({ error: "Failed to create case study" }, { status: 500 });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[Admin Case Studies] POST failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to create case study" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { pageId: string } & Partial<CaseStudyInput>;
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
    const ok = await updateCaseStudy(pageId, input);
    if (!ok) return NextResponse.json({ error: "Failed to update case study" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Case Studies] PATCH failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to update case study" }, { status: 500 });
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
    const ok = await deleteCaseStudy(pageId);
    if (!ok) return NextResponse.json({ error: "Failed to delete case study" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Case Studies] DELETE failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to delete case study" }, { status: 500 });
  }
}
