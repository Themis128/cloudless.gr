import { NextRequest, NextResponse } from "next/server";
import {
  expireStripeSession,
  resolvedItemsFromSession,
  ucpCheckoutFromStripe,
  ucpEnvelope,
} from "@/lib/agentic-commerce";

/** POST /api/ucp/checkout-sessions/{id}/cancel — expire the Stripe session. */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await expireStripeSession(id);
  if (!result.ok) {
    return NextResponse.json(
      {
        ucp: ucpEnvelope("checkout"),
        messages: [{ type: "error", content_type: "plain", content: result.message }],
      },
      { status: result.status }
    );
  }
  const resolved = await resolvedItemsFromSession(result.session);
  return NextResponse.json(ucpCheckoutFromStripe(result.session, resolved));
}
