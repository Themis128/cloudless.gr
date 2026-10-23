import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  resolvedItemsFromSession,
  ucpCheckoutFromStripe,
  ucpEnvelope,
} from "@/lib/agentic-commerce";

/**
 * POST /api/ucp/checkout-sessions/{id}/cancel — expire the Stripe session.
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json(
      {
        ucp: ucpEnvelope("checkout"),
        messages: [
          {
            type: "error",
            content_type: "plain",
            content: "Payment processing is temporarily unavailable.",
          },
        ],
      },
      { status: 503 }
    );
  }

  let session;
  try {
    session = await stripe.checkout.sessions.expire(id);
  } catch {
    return NextResponse.json(
      {
        ucp: ucpEnvelope("checkout"),
        messages: [
          {
            type: "error",
            content_type: "plain",
            content: "Checkout session not found or already completed/expired.",
          },
        ],
      },
      { status: 400 }
    );
  }

  const resolved = await resolvedItemsFromSession(session);
  return NextResponse.json(ucpCheckoutFromStripe(session, resolved));
}
