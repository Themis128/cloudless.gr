/**
 * POST /api/search — Search products via Meilisearch.
 *
 * Accepts a JSON body with:
 *   - query (string): the search term
 *   - limit (number, optional): max results (default 10, max 50)
 *   - offset (number, optional): pagination offset (default 0)
 *   - category (string, optional): filter by category
 *
 * Returns a SearchResult JSON response.
 * Falls back to client-side filtering when Meilisearch is not configured.
 */

import { NextRequest } from "next/server";
import { searchProducts, type SearchResult } from "@/lib/meilisearch";

interface SearchRequest {
  query: string;
  limit?: number;
  offset?: number;
  category?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = (await request.json()) as any;

    if (!body.query || typeof body.query !== "string") {
      return Response.json({ error: "Missing or invalid 'query' field" }, { status: 400 });
    }

    const query = body.query.trim();
    if (query.length === 0) {
      return Response.json({ error: "Query must not be empty" }, { status: 400 });
    }

    const limit = Math.min(Math.max(1, body.limit ?? 10), 50);
    const offset = Math.max(0, body.offset ?? 0);
    const filter = body.category ? `category = ${body.category}` : undefined;

    const result: SearchResult = await searchProducts(query, {
      limit,
      offset,
      filter,
    });

    return Response.json(result, {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=120",
      },
    });
  } catch (err) {
    console.error("[Search API] Error:", err);
    return Response.json(
      {
        hits: [],
        total: 0,
        limit: 10,
        offset: 0,
        query: "",
        configured: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
