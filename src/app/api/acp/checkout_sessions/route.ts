import { NextRequest, NextResponse } from "next/server";
import { canonicalOrigin } from "@/lib/canonical-origin";
import {
  acpSessionFromStripe,
  createStripeCheckoutSession,
  UnknownItemError,
  ACP_VERSION,
} from "@/lib/agentic-commerce";

function acpError(
  type: "invalid_request" | "processing_error" | "service_unavailable",
  code: string,
  message: string,
  status: number,
  param?: string,
) {
  return NextResponse.json(
    { type, code, message, ...(param ? { param } : {}) },
    { status },
  );
}

/**
 * POST /api/acp/checkout_sessions — ACP createCheckoutSession (spec 2026-04-17).
 *
 * Body (CheckoutSessionCreateRequest):
 *   { line_items: [{id, quantity}], currency, buyer?, capabilities?,
 *     discounts?, metadata? }
 * `items` is accepted as a fallback spelling since early draft examples used it.
 *
 * The session is backed by a real Stripe Checkout Session; the buyer pays on
 * the hosted page at `continue_url` (no delegate_payment in this deployment).
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return acpError(
      "invalid_request",
      "invalid_json",
      "Request body must be valid JSON.",
      400,
    );
  }

  const rawItems = (body.line_items ?? body.items) as
    | Array<{ id?: string; quantity?: number }>
    | undefined;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return acpError(
      "invalid_request",
      "missing_line_items",
      "line_items is required and must contain at least one item.",
      400,
      "$.line_items",
    );
  }

  const currency = (body.currency as string | undefined)?.toLowerCase() ?? "eur";
  if (currency !== "eur") {
    return acpError(
      "invalid_request",
      "unsupported_currency",
      "Only 'eur' is supported.",
      400,
      "$.currency",
    );
  }

  const buyer = body.buyer as { email?: string } | undefined;
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || undefined;

  let result;
  try {
    result = await createStripeCheckoutSession({
      items: rawItems,
      buyerEmail: buyer?.email,
      locale: (body.locale as string | undefined) ?? "en",
      idempotencyKey,
      origin: canonicalOrigin(request),
    });
  } catch (err) {
    if (err instanceof UnknownItemError) {
      return acpError(
        "invalid_request",
        "unknown_item",
        err.message,
        400,
        "$.line_items",
      );
    }
    const msg = String((err as Error)?.message ?? "unknown").slice(0, 200);
    console.error("ACP checkout create error: " + JSON.stringify(msg));
    return acpError(
      "processing_error",
      "checkout_failed",
      "Failed to create checkout session.",
      500,
    );
  }

  if (!result.stripe || !result.session) {
    return acpError(
      "service_unavailable",
      "payments_unavailable",
      "Payment processing is temporarily unavailable.",
      503,
    );
  }

  const response = NextResponse.json(
    acpSessionFromStripe(result.session, result.resolved),
    { status: 201 },
  );
  if (idempotencyKey) response.headers.set("Idempotency-Key", idempotencyKey);
  response.headers.set("ACP-Version", ACP_VERSION);
  return response;
}
