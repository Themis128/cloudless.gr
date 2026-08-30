import { isMeilisearchConfigured } from "@/lib/meilisearch";
import { searchProductsFallback, searchProductsWithMeili } from "@/lib/product-search";
import { searchContent } from "@/lib/content-index";

export const runtime = "nodejs";

function toLimit(value: string | null): number {
  const n = Number.parseInt(value || "8", 10);
  if (!Number.isFinite(n)) return 8;
  return Math.max(1, Math.min(n, 20));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limit = toLimit(url.searchParams.get("limit"));

  if (!q) {
    return Response.json({ query: q, source: "empty", hits: [], content: [] });
  }

  if (isMeilisearchConfigured()) {
    try {
      const [hits, content] = await Promise.all([
        searchProductsWithMeili(q, limit),
        searchContent(q, limit),
      ]);

      return Response.json({
        query: q,
        source: "meilisearch",
        hits,
        content,
      });
    } catch (err) {
      console.warn("[api/search] Meilisearch search failed; using fallback:", err);
    }
  }

  const hits = await searchProductsFallback(q, limit);

  return Response.json({ query: q, source: "fallback", hits, content: [] });
}
