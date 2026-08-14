import { NextResponse } from "next/server";
import {
  getDocs as getAppFlowyDocs,
  groupDocsByCategory as groupAppFlowyDocs,
} from "@/lib/appflowy-docs";
import { isAppFlowyConfigured } from "@/lib/appflowy";

/**
 * GET /api/docs
 *
 * Returns all published docs grouped by category.
 * Used by the docs index page and sidebar navigation.
 */
export async function GET() {
  const appFlowyConfigured = await isAppFlowyConfigured();

  if (!appFlowyConfigured) {
    return NextResponse.json(
      { docs: [], source: "static", fallbackReason: "not-configured" },
      { headers: { "x-cms-source": "static" } }
    );
  }

  try {
    const docs = await getAppFlowyDocs();
    const grouped = await groupAppFlowyDocs(docs);
    if (docs.length > 0) {
      return NextResponse.json(
        { docs, grouped, source: "appflowy" },
        { headers: { "x-cms-source": "appflowy" } }
      );
    }
    return NextResponse.json(
      { docs: [], grouped, source: "static", fallbackReason: "cms-empty" },
      { headers: { "x-cms-source": "static" } }
    );
  } catch (err) {
    console.error("[Docs API] Failed to fetch docs:", err);
    return NextResponse.json(
      { docs: [], source: "static", fallbackReason: "cms-error" },
      { headers: { "x-cms-source": "static" } }
    );
  }
}
