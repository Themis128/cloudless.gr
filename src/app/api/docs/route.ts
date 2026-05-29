import { NextResponse } from "next/server";
import { getDocs, groupDocsByCategory } from "@/lib/notion-docs";
import { isConfiguredAsync } from "@/lib/integrations";

/**
 * GET /api/docs
 *
 * Returns all published docs grouped by category.
 * Used by the docs index page and sidebar navigation.
 */
export async function GET() {
  const configured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_DOCS_DB_ID");

  if (!configured) {
    return NextResponse.json(
      { docs: [], source: "static", fallbackReason: "not-configured" },
      { headers: { "x-cms-source": "static" } }
    );
  }

  try {
    const docs = await getDocs();
    const grouped = groupDocsByCategory(docs);
    return NextResponse.json({ docs, grouped, source: "notion" }, { headers: { "x-cms-source": "notion" } });
  } catch (err) {
    console.error("[Docs API] Failed to fetch docs:", err);
    return NextResponse.json(
      { docs: [], source: "static", fallbackReason: "notion-error" },
      { headers: { "x-cms-source": "static" } }
    );
  }
}
