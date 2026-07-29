import { NextRequest, NextResponse } from "next/server";
import {
  getDocBySlug as getAppFlowyDocBySlug,
  getDocContentWithToc as getAppFlowyDocContentWithToc,
} from "@/lib/appflowy-docs";
import { getDocBySlug as getNotionDocBySlug, getDocContent as getNotionDocContent } from "@/lib/notion-docs";
import { isConfiguredAsync } from "@/lib/integrations";

/**
 * GET /api/docs/[slug]
 *
 * Returns the full content of a single doc as rendered HTML.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const appFlowyConfigured = await isConfiguredAsync("APPFLOWY_API_URL", "APPFLOWY_JWT_SECRET");
  const notionConfigured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_DOCS_DB_ID");

  if (!appFlowyConfigured && !notionConfigured) {
    return NextResponse.json({ error: "Docs not configured" }, { status: 404 });
  }

  const { slug } = await params;

  try {
    if (appFlowyConfigured) {
      const appFlowyDoc = await getAppFlowyDocBySlug(slug);
      if (appFlowyDoc) {
        const content = await getAppFlowyDocContentWithToc(appFlowyDoc.id);
        return NextResponse.json(
          {
            ...appFlowyDoc,
            html: content.html,
            toc: content.toc,
            source: "appflowy",
          },
          { headers: { "x-cms-source": "appflowy" } }
        );
      }
    }

    const doc = await getNotionDocBySlug(slug);
    if (!doc) {
      return NextResponse.json({ error: "Doc not found" }, { status: 404 });
    }

    const content = await getNotionDocContent(doc.id);
    if (!content) {
      return NextResponse.json({ error: "Failed to load doc content" }, { status: 500 });
    }

    return NextResponse.json({ ...content, source: "notion" }, { headers: { "x-cms-source": "notion" } });
  } catch (err) {
    console.error("[Docs API] Failed to fetch doc:", err);
    return NextResponse.json({ error: "Failed to fetch doc" }, { status: 500 });
  }
}
