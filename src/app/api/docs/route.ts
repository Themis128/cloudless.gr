import { NextResponse } from "next/server";
import { getDocs as getAppFlowyDocs, groupDocsByCategory as groupAppFlowyDocs } from "@/lib/appflowy-docs";
import { getDocs as getNotionDocs, groupDocsByCategory as groupNotionDocs } from "@/lib/notion-docs";
import { isConfiguredAsync } from "@/lib/integrations";

/**
 * GET /api/docs
 *
 * Returns all published docs grouped by category.
 * Used by the docs index page and sidebar navigation.
 */
export async function GET() {
  const appFlowyConfigured = await isConfiguredAsync("APPFLOWY_API_URL", "APPFLOWY_JWT_SECRET");
  const notionConfigured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_DOCS_DB_ID");

  if (!appFlowyConfigured && !notionConfigured) {
    return NextResponse.json(
      { docs: [], source: "static", fallbackReason: "not-configured" },
      { headers: { "x-cms-source": "static" } }
    );
  }

  try {
    if (appFlowyConfigured) {
      const docs = await getAppFlowyDocs();
      const grouped = await groupAppFlowyDocs(docs);
      if (docs.length > 0) {
        return NextResponse.json(
          { docs, grouped, source: "appflowy" },
          { headers: { "x-cms-source": "appflowy" } }
        );
      }
    }

    const docs = await getNotionDocs();
    const grouped = groupNotionDocs(docs);
    return NextResponse.json(
      { docs, grouped, source: "notion" },
      { headers: { "x-cms-source": "notion" } }
    );
  } catch (err) {
    console.error("[Docs API] Failed to fetch docs:", err);
    return NextResponse.json(
      { docs: [], source: "static", fallbackReason: "notion-error" },
      { headers: { "x-cms-source": "static" } }
    );
  }
}
