import { NextRequest, NextResponse } from "next/server";
import {
  getDocBySlug as getAppFlowyDocBySlug,
  getDocContentWithToc as getAppFlowyDocContentWithToc,
} from "@/lib/appflowy-docs";
import { isAppFlowyConfigured } from "@/lib/appflowy";

/**
 * GET /api/docs/[slug]
 *
 * Returns the full content of a single doc as rendered HTML.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const appFlowyConfigured = await isAppFlowyConfigured();

  if (!appFlowyConfigured) {
    return NextResponse.json({ error: "Docs not configured" }, { status: 503 });
  }

  const { slug } = await params;

  try {
    const appFlowyDoc = await getAppFlowyDocBySlug(slug);
    if (!appFlowyDoc) {
      return NextResponse.json({ error: "Doc not found" }, { status: 404 });
    }
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
  } catch (err) {
    console.error("[Docs API] Failed to fetch doc:", err);
    return NextResponse.json({ error: "Failed to fetch doc" }, { status: 500 });
  }
}
