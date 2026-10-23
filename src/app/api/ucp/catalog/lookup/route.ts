import { NextRequest, NextResponse } from "next/server";
import { getProductByIdAsync } from "@/lib/store-products";
import { ucpEnvelope, ucpProduct } from "@/lib/agentic-commerce";

/**
 * POST /api/ucp/catalog/lookup — UCP catalog_lookup capability.
 * Body: { ids: string[] } → { ucp, products }
 * Unknown ids are skipped; the response carries only resolved products.
 */
export async function POST(request: NextRequest) {
  let body: { ids?: string[] };
  try {
    body = (await request.json()) as { ids?: string[] };
  } catch {
    return NextResponse.json(
      {
        ucp: ucpEnvelope("catalog"),
        products: [],
        messages: [{ type: "error", content_type: "plain", content: "Invalid JSON body." }],
      },
      { status: 400 }
    );
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
  if (ids.length === 0) {
    return NextResponse.json(
      {
        ucp: ucpEnvelope("catalog"),
        products: [],
        messages: [
          {
            type: "error",
            content_type: "plain",
            content: "ids is required and must be a non-empty array.",
          },
        ],
      },
      { status: 400 }
    );
  }

  const resolved = await Promise.all(ids.map((id) => getProductByIdAsync(id)));
  const products = resolved.filter((p): p is NonNullable<typeof p> => Boolean(p)).map(ucpProduct);
  const missing = ids.filter((id, i) => !resolved[i]);

  return NextResponse.json({
    ucp: ucpEnvelope("catalog"),
    products,
    ...(missing.length
      ? {
          messages: [
            {
              type: "info",
              content_type: "plain",
              content: `Unresolved ids: ${missing.join(", ")}`,
            },
          ],
        }
      : {}),
  });
}
