import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getDocs } from "@/lib/notion-docs";
import { isConfiguredAsync } from "@/lib/integrations";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isConfiguredAsync("NOTION_API_KEY", "NOTION_DOCS_DB_ID"))) {
    return NextResponse.json(
      { error: "Notion Docs not configured" },
      { status: 503 },
    );
  }

  const docs = await getDocs();
  return NextResponse.json({ docs, count: docs.length });
}
