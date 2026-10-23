import { NextRequest, NextResponse } from "next/server";
import { canonicalOrigin } from "@/lib/canonical-origin";
import {
  createStripeCheckoutSession,
  UnknownItemError,
  ucpCheckoutFromStripe,
  ucpEnvelope,
} from "@/lib/agentic-commerce";

function ucpError(message: string, status: number, path?: string) {
  return NextResponse.json(
    {
      ucp: ucpEnvelope("checkout"),
      messages: [
        {
          type: "error",
          content_type: "plain",
          content: message,
          ...(path ? { path } : {}),
        },
      ],
    },
    { status },
  );
}

/**
 * POST /api/ucp/checkout-sessions — UCP create checkout (spec 2026-04-08).
 * Body is a checkout object: { line_items: [{item: {id}, quantity}], buyer?,
 * context? }. Backed by a real Stripe Checkout Session; the buyer pays at
 * `continue_url` (hosted checkout — no delegated instruments accepted).
 */
export async function POST(request: NextRequest) {
  let body: {
    line_items?: Array<{ item?: { id?: string }; quantity?: number }>;
    buyer?: { email?: string };
    context?: { language?: string };
  };
  try {
    body = await request.json();
  } catch {
    return ucpError("Request body must be valid JSON.", 400);
  }

  const rawItems = Array.isArray(body.line_items) ? body.line_items : [];
  const items = rawItems
    .map((li) => ({ id: li.item?.id, quantity: li.quantity }))
    .filter((i) => i.id);
  if (items.length === 0) {
    return ucpError(
      "line_items is required and each entry needs an item.id.",
      400,
      "$.line_items",
    );
  }

  let result;
  try {
    result = await createStripeCheckoutSession({
      items,
      buyerEmail: body.buyer?.email,
      locale: body.context?.language ?? "en",
      idempotencyKey:
        request.headers.get("idempotency-key")?.trim() || undefined,
      origin: canonicalOrigin(request),
    });
  } catch (err) {
    if (err instanceof UnknownItemError) {
      return ucpError(err.message, 400, "$.line_items");
    }
    const msg = String((err as Error)?.message ?? "unknown").slice(0, 200);
    console.error("UCP checkout create error: " + JSON.stringify(msg));
    return ucpError("Failed to create checkout session.", 500);
  }

  if (!result.stripe || !result.session) {
    return ucpError("Payment processing is temporarily unavailable.", 503);
  }

  return NextResponse.json(
    ucpCheckoutFromStripe(result.session, result.resolved),
    { status: 201 },
  );
}
