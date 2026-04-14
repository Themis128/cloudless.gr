import { NextRequest, NextResponse } from "next/server";
import { getDocBySlug, getDocContent } from "@/lib/notion-docs";
import { isConfigured } from "@/lib/integrations";

/**
 * GET /api/docs/[slug]
 *
 * Returns the full content of a single doc as rendered HTML.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!isConfigured("NOTION_API_KEY", "NOTION_DOCS_DB_ID")) {
    return NextResponse.json(
      { error: "Docs not configured" },
      { status: 503 },
    );
  }

  const { slug } = await params;

  try {
    const doc = await getDocBySlug(slug);
    if (!doc) {
      return NextResponse.json({ error: "Doc not found" }, { status: 404 });
    }

    const content = await getDocContent(doc.id);
    if (!content) {
      return NextResponse.json(
        { error: "Failed to load doc content" },
        { status: 500 },
      );
    }

    return NextResponse.json(content);
  } catch (err) {
    console.error("[Docs API] Failed to fetch doc:", err);
    return NextResponse.json(
      { error: "Failed to fetch doc" },
      { status: 500 },
    );
  }
}
