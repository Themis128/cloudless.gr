import { isMeilisearchConfigured } from "@/lib/meilisearch";
import { searchProductsFallback, searchProductsWithMeili } from "@/lib/product-search";

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
    return Response.json({
      query: q,
      source: "empty",
      hits: [],
    });
  }

  if (isMeilisearchConfigured()) {
    try {
      const hits = await searchProductsWithMeili(q, limit);

       return Response.json({
         query: q,
         source: "meilisearch",
         hits,
       });
    } catch (err) {
      console.warn("[api/search] Meilisearch/Bedrock search failed; using fallback:", err);
    }
  }

  const hits = await searchProductsFallback(q, limit);

  return Response.json({
    query: q,
    source: "fallback",
    hits,
  });
}

/**
 * POST /api/search — Hybrid semantic search endpoint.
 *
 * Body:
 *   - query: string (required) - Search query
 *   - limit: number (optional, max 20)
 *
 * Returns search results with keyword + semantic scoring.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    query?: string;
    limit?: number;
    semantic?: boolean;
  };

  const q = (body.query || "").trim();
  const limit = toLimit(String(body.limit ?? 8));

  if (!q) {
    return Response.json({
      query: q,
      source: "empty",
      hits: [],
    });
  }

  // Try meilisearch first (supports Bedrock-powered semantic search)
  if (isMeilisearchConfigured()) {
    try {
      const hits = await searchProductsWithMeili(q, limit);

      return Response.json({
        query: q,
        source: "meilisearch",
        hits,
      });
    } catch (err) {
      console.warn("[api/search] Meilisearch failed:", err);
    }
  }

  // Fall back to keyword search
  const hits = await searchProductsFallback(q, limit);

  return Response.json({
    query: q,
    source: "keyword-fallback",
    hits,
  });
}