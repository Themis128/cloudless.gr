import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import { appflowyWriteNotImplemented } from "@/lib/appflowy-admin-stub";

type ListResult = Record<string, unknown>;

/**
 * Shared AppFlowy admin CMS route handlers (FAQs / Services / Case Studies).
 * Keeps per-resource route.ts thin to avoid Sonar duplication on stubs.
 */
export function createAppFlowyAdminHandlers(opts: {
  surface: string;
  listKey: string;
  list: () => Promise<unknown[]>;
  createRequired: {
    field: string;
    message: string;
    read: (body: Record<string, unknown>) => unknown;
  };
}) {
  const { surface, listKey, list, createRequired } = opts;
  const notConfigured = `AppFlowy ${surface} not configured`;
  const listFailed = `Failed to list ${surface.toLowerCase()}`;

  async function GET(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    if (!(await isAppFlowyConfigured())) {
      return NextResponse.json({ error: notConfigured }, { status: 503 });
    }

    try {
      const items = await list();
      const body: ListResult = { [listKey]: items, count: items.length };
      return NextResponse.json(body);
    } catch {
      console.error(`[Admin AppFlowy ${surface}] GET failed`);
      return NextResponse.json({ error: listFailed }, { status: 500 });
    }
  }

  async function POST(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    if (!(await isAppFlowyConfigured())) {
      return NextResponse.json({ error: notConfigured }, { status: 503 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const value = createRequired.read(body);
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json({ error: createRequired.message }, { status: 400 });
    }

    return appflowyWriteNotImplemented(surface);
  }

  async function PATCH(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.pageId) {
      return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    }

    return appflowyWriteNotImplemented(surface);
  }

  async function DELETE(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const pageId = new URL(request.url).searchParams.get("pageId");
    if (!pageId) {
      return NextResponse.json({ error: "pageId query parameter is required" }, { status: 400 });
    }

    return appflowyWriteNotImplemented(surface);
  }

  return { GET, POST, PATCH, DELETE };
}
