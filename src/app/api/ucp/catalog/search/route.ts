import { NextRequest, NextResponse } from "next/server";
import {
  searchCatalog,
  ucpEnvelope,
  ucpProduct,
} from "@/lib/agentic-commerce";

/**
 * POST /api/ucp/catalog/search — UCP catalog_search capability.
 * Body: { query?, filters?, pagination? } → { ucp, products, pagination }
 * An empty query returns the full catalog.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // empty/absent body = list all products
  }

  const query = typeof body.query === "string" ? body.query : "";
  const filters = body.filters as { categories?: string[] } | undefined;
  const category = Array.isArray(filters?.categories)
    ? filters!.categories[0]
    : undefined;

  const products = (await searchCatalog(query, category)).map(ucpProduct);

  return NextResponse.json({
    ucp: ucpEnvelope("catalog"),
    products,
    pagination: { has_next_page: false, total_count: products.length },
  });
}
