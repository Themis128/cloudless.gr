import { recommendProductsForProduct } from "@/lib/product-recommendations";

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
