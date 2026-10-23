import { NextRequest, NextResponse } from "next/server";
import { getProductByIdAsync } from "@/lib/store-products";
import { ucpEnvelope, ucpProduct } from "@/lib/agentic-commerce";

/**
 * POST /api/ucp/catalog/product — UCP get_product (catalog_lookup capability).
 * Body: { id: string } → { ucp, product }
 */
export async function POST(request: NextRequest) {
  let body: { id?: string };
  try {
    body = (await request.json()) as { id?: string };
  } catch {
    return NextResponse.json(
      {
        ucp: ucpEnvelope("catalog"),
        messages: [{ type: "error", content_type: "plain", content: "Invalid JSON body." }],
      },
      { status: 400 }
    );
  }

  const product = body.id ? await getProductByIdAsync(body.id) : undefined;
  if (!product) {
    return NextResponse.json(
      {
        ucp: ucpEnvelope("catalog"),
        messages: [
          {
            type: "error",
            content_type: "plain",
            content: "Product not found.",
          },
        ],
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ucp: ucpEnvelope("catalog"),
    product: ucpProduct(product),
  });
}
