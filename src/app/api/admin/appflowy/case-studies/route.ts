import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import { appflowyWriteNotImplemented } from "@/lib/appflowy-admin-stub";
import { getCaseStudies } from "@/lib/appflowy-case-studies";
import type { CaseStudyInput } from "@/lib/notion-types";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy Case Studies not configured" }, { status: 503 });
  }

  try {
    const caseStudies = await getCaseStudies();
    return NextResponse.json({ caseStudies, count: caseStudies.length });
  } catch {
    console.error("[Admin AppFlowy Case Studies] GET failed");
    return NextResponse.json({ error: "Failed to list case studies" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isAppFlowyConfigured())) {
    return NextResponse.json({ error: "AppFlowy Case Studies not configured" }, { status: 503 });
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

  return appflowyWriteNotImplemented("Case Studies");
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

  return appflowyWriteNotImplemented("Case Studies");
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const pageId = new URL(request.url).searchParams.get("pageId");
  if (!pageId) {
    return NextResponse.json({ error: "pageId query parameter is required" }, { status: 400 });
  }

  return appflowyWriteNotImplemented("Case Studies");
}
