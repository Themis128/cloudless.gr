import { NextResponse } from "next/server";
import { getDocs, groupDocsByCategory } from "@/lib/notion-docs";
import { isConfigured } from "@/lib/integrations";

/**
 * GET /api/docs
 *
 * Returns all published docs grouped by category.
 * Used by the docs index page and sidebar navigation.
 */
export async function GET() {
  if (!isConfigured("NOTION_API_KEY", "NOTION_DOCS_DB_ID")) {
    return NextResponse.json(
      { error: "Docs not configured" },
      { status: 503 },
    );
  }

  try {
    const docs = await getDocs();
    const grouped = groupDocsByCategory(docs);
    return NextResponse.json({ docs, grouped });
  } catch (err) {
    console.error("[Docs API] Failed to fetch docs:", err);
    return NextResponse.json(
      { error: "Failed to fetch docs" },
      { status: 500 },
    );
  }
}
