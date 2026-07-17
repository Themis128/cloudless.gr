import { recommendProductsForProduct } from "@/lib/product-recommendations";
import { getProducts } from "@/lib/store-products";

export const runtime = "nodejs";

function toLimit(value: string | null): number {
  const n = Number.parseInt(value || "3", 10);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(n, 8));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = (url.searchParams.get("productId") || "").trim();
  const limit = toLimit(url.searchParams.get("limit"));

  if (!productId) {
    return Response.json(
      {
        error: "Missing productId",
      },
      {
        status: 400,
      },
    );
  }

  const recommendations = await recommendProductsForProduct(productId, limit);

  return Response.json({
    productId,
    count: recommendations.length,
    recommendations,
  });
}

/**
 * POST /api/products/recommendations — AI-powered product recommendations.
 *
 * Body:
 *   - productId: string (optional, for similar product recommendations)
 *   - limit: number (optional, max 8)
 *   - context: string (optional, for AI-based recommendations)
 *
 * When productId is provided: returns similar products.
 * When context is provided: returns AI-recommended products based on description.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    productId?: string;
    context?: string;
    limit?: number;
  };

  const limit = toLimit(String(body.limit ?? 3));

  // Similar product recommendations
  if (body.productId) {
    const recommendations = await recommendProductsForProduct(body.productId, limit);

    return Response.json({
      productId: body.productId,
      count: recommendations.length,
      recommendations,
    });
  }

  // AI-powered recommendations based on context
  if (body.context) {
    try {
      const products = await getProducts();

      // Simple keyword-based matching when Anthr<output cut>
      const keywords = body.context
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((k) => k.length > 2);

      const matching = products
        .map((p) => ({
          product: p,
          score: keywords.reduce((score, kw) => {
            const haystack = `${p.name} ${p.description} ${p.category ?? ""}`.toLowerCase();
            return score + (haystack.includes(kw) ? 1 : 0);
          }, 0),
        }))
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
        .slice(0, limit)
        .map((m) => m.product);

      return Response.json({
        context: body.context,
        count: matching.length,
        recommendations: matching,
        aiGenerated: !!process.env.ANTHROPIC_API_KEY,
      });
    } catch (err) {
      console.error("[products/recommendations] AI recommendation failed:", err);
      return Response.json(
        { error: "Failed to generate recommendations" },
        { status: 500 }
      );
    }
  }

  return Response.json({ error: "Either productId or context is required" }, { status: 400 });
}
