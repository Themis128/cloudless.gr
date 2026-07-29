/**
 * GET /api/recommendations — Get product recommendations.
 *
 * Query params:
 *   - type: "similar" (productIds required), "trending" (default)
 *   - productIds: comma-separated product IDs for "similar" type
 *   - limit: max results (default 4, max 20)
 *
 * Returns recommendations array with type indicator.
 */

import { NextRequest } from "next/server";
import { getSimilarProducts, getTrendingProducts } from "@/lib/recommendations";

type RecommendationType = "similar" | "trending";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = (searchParams.get("type") as RecommendationType) || "trending";
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit")) || 4), 20);

  try {
    let recommendations: {
      id: string;
      name: string;
      description: string;
      price: number;
      currency: string;
      category: string;
      image: string;
    }[] = [];

    if (type === "similar") {
      const productIdsParam = searchParams.get("productIds");
      if (!productIdsParam) {
        return Response.json(
          { error: "Missing 'productIds' parameter for 'similar' type" },
          { status: 400 }
        );
      }
      const productIds = productIdsParam.split(",").map((s) => s.trim());
      const products = await getSimilarProducts({}, productIds, limit);
      recommendations = products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        category: p.category,
        image: p.image,
      }));
    } else {
      const products = await getTrendingProducts({}, 30, limit);
      recommendations = products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        category: p.category,
        image: p.image,
      }));
    }

    // Contract: return the recommendations array directly.
    // (The tests expect a raw JSON array for `/api/recommendations`.)
    return Response.json(recommendations, {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=600", // 5-10 min cache
      },
    });
  } catch (err) {
    console.error("[Recommendations API] Error:", err);
    return Response.json([], { status: 500 });
  }
}
